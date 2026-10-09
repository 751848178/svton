import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { PlatformExecutorService } from '../executor/platform-executor.service.js';
import type { PlanRequest } from '../executor/executor.port.js';
import type { RequestContext } from '../policy/request-context.js';
import { ProjectService } from '../projects/project.service.js';
import { LocalPolicyService } from '../policy/local-policy.service.js';
import { encodeJson } from '../transport/public-data.js';
import { planView } from './task.view.js';
import { proposedReleaseVersion, releaseVersion } from './release-version.js';

@Injectable()
export class PlanService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(ProjectService) private readonly projects: ProjectService,
    @Inject(PlatformExecutorService) private readonly executor: PlatformExecutorService,
    @Inject(LocalPolicyService) private readonly policy: LocalPolicyService,
  ) {}
  async prepare(id: string, body: Record<string, unknown>, context: RequestContext): Promise<unknown> {
    const project = await this.projects.get(id, context);
    this.policy.authorize(context, 'plan.prepare', project.workspaceId);
    const request = this.request(body);
    const version = proposedReleaseVersion(body.version === undefined ? undefined : releaseVersion(body.version), project.lastVersion);
    const targetKey = typeof body.targetKey === 'string' ? body.targetKey : project.targetKey;
    if (!project.targets.some((target) => target.targetKey === targetKey)) throw new BadRequestException('目标未注册');
    const execution = await this.executor.preparePlan({ ...project, targetKey }, request);
    const expiresAt = new Date(execution.expiresAt);
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) throw new BadRequestException('执行器返回的计划有效期无效');
    const plan = await this.db.plan.create({ data: {
      projectId: project.id, kind: execution.kind, version, targetKey,
      baseReleaseId: execution.baseReleaseId, selectionJson: encodeJson(execution.selection),
      snapshotJson: encodeJson(execution), fingerprint: execution.fingerprint, actorId: context.actorId, expiresAt,
    } });
    return planView(plan);
  }
  private request(body: Record<string, unknown>): PlanRequest {
    if (!['release', 'rollback'].includes(String(body.kind))) throw new BadRequestException('kind 必须为 release 或 rollback');
    if (!Array.isArray(body.services) || body.services.length === 0 || body.services.length > 100 || body.services.some((s) => typeof s !== 'string' || !/^[a-z][a-z0-9-]{0,62}$/.test(s))) {
      throw new BadRequestException('需要明确选择有效服务');
    }
    if (new Set(body.services).size !== body.services.length) throw new BadRequestException('服务选择重复');
    if (body.sourceMode !== undefined && !['git', 'directory'].includes(String(body.sourceMode))) throw new BadRequestException('sourceMode 必须为 git 或 directory');
    for (const key of ['keepEnv', 'keepBuilder']) if (body[key] !== undefined && typeof body[key] !== 'boolean') throw new BadRequestException(`${key} 必须为布尔值`);
    if (body.changeReleaseId !== undefined && (typeof body.changeReleaseId !== 'string' || !/^[a-z0-9-]{6,40}$/.test(body.changeReleaseId))) throw new BadRequestException('历史变更记录无效');
    return {
      kind: body.kind as PlanRequest['kind'], services: body.services,
      sourceMode: body.sourceMode as PlanRequest['sourceMode'], changeReleaseId: body.changeReleaseId as string | undefined,
      keepEnv: body.keepEnv as boolean | undefined, keepBuilder: body.keepBuilder as boolean | undefined,
    };
  }
}
