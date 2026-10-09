import { storedProjectInput } from '../projects/project-source.service.js';
import { BadRequestException, Inject, Injectable, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service.js';
import { PlatformExecutorService } from '../executor/platform-executor.service.js';
import type { PlanRequest } from '../executor/executor.port.js';
import type { RequestContext } from '../policy/request-context.js';
import { ProjectService } from '../projects/project.service.js';
import { LocalPolicyService } from '../policy/local-policy.service.js';
import { encodeJson } from '../transport/public-data.js';
import { planView } from './task.view.js';
import { proposedReleaseVersion, releaseVersion } from './release-version.js';
import { planRequest } from './plan-request.dto.js';
import { PlanInputService } from './plan-input.service.js';

@Injectable()
export class PlanService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(ProjectService) private readonly projects: ProjectService,
    @Inject(PlatformExecutorService) private readonly executor: PlatformExecutorService,
    @Inject(LocalPolicyService) private readonly policy: LocalPolicyService,
    @Optional() @Inject(PlanInputService) private readonly inputs?: PlanInputService,
  ) {}
  async prepare(id: string, body: Record<string, unknown>, context: RequestContext): Promise<unknown> {
    const project = await this.projects.get(id, context);
    this.policy.authorize(context, 'plan.prepare', project.workspaceId);
    const request = planRequest(body);
    const version = proposedReleaseVersion(body.version === undefined ? undefined : releaseVersion(body.version), project.lastVersion);
    const targetKey = typeof body.targetKey === 'string' ? body.targetKey : project.targetKey;
    if (!project.targets.some((target) => target.targetKey === targetKey)) throw new BadRequestException('目标未注册');
    const idForPlan = randomUUID();
    const prepared = await this.inputs?.prepare(project, request, targetKey, idForPlan);
    const execution = await this.executor.preparePlan(prepared?.input ?? storedProjectInput(project, targetKey), request, prepared?.options);
    const configDiff = await prepared?.diff(execution.detail.currentConfigRefs);
    if (configDiff) execution.detail.configDiff = configDiff;
    const bindings = execution.configBindings;
    if (bindings) Object.assign(execution.detail, { configBindings: Object.fromEntries(Object.entries(bindings).map(([key, binding]) => [key,
      { mode: binding.mode, ...(binding.configRef ?? {}) }])) });
    const expiresAt = new Date(execution.expiresAt);
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) throw new BadRequestException('执行器返回的计划有效期无效');
    const plan = await this.db.$transaction(async tx => {
      if (request.configVersionId && !await tx.configVersion.findFirst({ where: { id: request.configVersionId, projectId: project.id, targetKey, archivedAt: null } })) {
        throw new BadRequestException('配置版本已归档或不属于当前项目与环境，请重新核对');
      }
      return tx.plan.create({ data: {
      id: idForPlan, projectId: project.id, kind: execution.kind, version, targetKey,
      baseReleaseId: execution.baseReleaseId, selectionJson: encodeJson(execution.selection),
      configVersionId: request.configVersionId, snapshotJson: encodeJson(execution), privateSnapshot: prepared?.encrypted(), fingerprint: execution.fingerprint, actorId: context.actorId, expiresAt,
      } });
    });
    return planView(plan);
  }
}
