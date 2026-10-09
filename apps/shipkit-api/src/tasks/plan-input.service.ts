import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { ExecutionPlan, PlanRequest, PrivateProjectSnapshot, PrivatePlanOptions, ProjectInput } from 'shipkit/platform';
import { ConfigService } from '../configs/config.service.js';
import { SecretStore } from '../secrets/secret-store.js';
import { ProjectSourceService } from '../projects/project-source.service.js';
import type { StoredProject } from '../projects/project.repository.js';
import type { StoredTask } from './task.repository.js';

@Injectable()
export class PlanInputService {
  constructor(@Inject(SecretStore) private readonly secrets: SecretStore,
    @Inject(ConfigService) private readonly configs: ConfigService,
    @Inject(ProjectSourceService) private readonly sources: ProjectSourceService) {}

  async prepare(project: StoredProject, request: PlanRequest, targetKey: string, planId: string) {
    if (project.sourceKind === 'repository' && request.kind !== 'rollback' && (request.configMode ?? 'files') === 'files') throw new BadRequestException('仓库项目的运行秘密不从 Git 读取，请选择配置版本或继承当前配置');
    const input = this.sources.input(project, targetKey);
    const protectedPlan = Boolean(process.env.SHIPKIT_SECRET_KEY_FILE || project.sourceKind === 'repository' || request.configMode === 'version' || request.kind === 'config-only');
    let privateSnapshot: string | null = null;
    const options: PrivatePlanOptions = {};
    if (request.kind === 'release' && project.sourceKind === 'repository') options.repository = this.sources.credentials(project);
    if (request.configMode === 'version') {
      const config = await this.configs.resolve(project.id, targetKey, request.configVersionId!, request.services);
      options.runtimeConfiguration = { envFiles: config.envFiles, configRefs: config.configRefs, noEnvServices: config.noEnvServices,
        redactionValues: config.redactionValues, fingerprint: config.fingerprint };
    }
    if (protectedPlan) options.onPrivateSnapshot = async snapshot => {
      privateSnapshot = this.secrets.seal(snapshot, this.scope(project.id, targetKey, planId));
    };
    return { input, options, diff: async (current: ExecutionPlan['detail']['currentConfigRefs']) => {
      if (request.configMode !== 'version') return undefined;
      return (await this.configs.diff(project.id, targetKey, request.configVersionId!, request.services, current ?? {})).services;
    }, encrypted: () => {
      if (protectedPlan && !privateSnapshot) throw new BadRequestException('执行器未固定私密发布输入，请升级执行器后重新核对');
      return privateSnapshot;
    } };
  }

  taskInput(task: StoredTask): ProjectInput {
    const executionKind = task.plan.kind as NonNullable<ProjectInput['executionKind']>;
    if (!['release', 'rollback', 'config-only'].includes(executionKind)) throw new BadRequestException('未知发布任务类型，无法恢复执行输入');
    if (!task.plan.privateSnapshot) return { ...this.sources.input(task.project, task.plan.targetKey), executionKind };
    const privateSnapshot = this.secrets.open<PrivateProjectSnapshot>(task.plan.privateSnapshot, this.scope(task.projectId, task.plan.targetKey, task.planId));
    return { targetKey: task.plan.targetKey, privateSnapshot, executionKind };
  }

  private scope(projectId: string, targetKey: string, planId: string) {
    return { kind: 'plan', projectId, targetKey, objectId: planId };
  }
}
