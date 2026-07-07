/**
 * Project-environment sync-apply orchestration service.
 *
 * Owns `applySyncSuggestions`: turns a sync diff into an apply plan that creates
 * missing service skeletons and completes deploy-config fields (dry-run or
 * applied), writes an audit record, and surfaces follow-up todos for actions
 * the current version does not auto-apply. Depends on the read-side
 * `ProjectEnvironmentSyncService` for diff computation. Extracted from the
 * sync service to keep each file under the size ceiling. Behavior preserved.
 */

import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { AuditEventService } from '../audit-event';
import { ProjectEnvironmentRepository } from './project-environment.repository';
import { ApplyProjectEnvironmentSyncSuggestionsDto } from './dto/project-environment.dto';
import { ProjectEnvironmentSyncService } from './project-environment-sync.service';
import {
  applicationServiceSyncKey as applicationServiceSyncKeyUtil,
  readConfigString as readConfigStringUtil,
  recordFromJson,
  safeDeployConfig as safeDeployConfigUtil,
  toJsonValue as toJsonValueUtil,
} from './project-environment-helpers.utils';
import { buildSyncApplyAuditInput } from './project-environment-audit.utils';
import {
  APPLYABLE_SYNC_ACTION_KINDS,
  type EnvironmentSyncApplyStep,
} from './project-environment-sync.utils';
import {
  applyApplicationServicesArgs,
  buildCompleteDeployConfigAppliedStep,
  buildCompleteDeployConfigPlannedStep,
  buildCreateMissingServiceAppliedStep,
  buildCreateMissingServicePlannedStep,
  buildCreateMissingServiceData,
  computeMissingDeployConfigFields,
  mergeDeployConfigFields,
  resolveActionKinds,
} from './project-environment-sync-step.utils';

@Injectable()
export class ProjectEnvironmentSyncApplyService {
  constructor(
    private readonly repo: ProjectEnvironmentRepository,
    private readonly syncService: ProjectEnvironmentSyncService,
    @Optional() private readonly auditEventService: AuditEventService | null,
  ) {}

  async applySyncSuggestions(teamId: string, userId: string, dto: ApplyProjectEnvironmentSyncSuggestionsDto) {
    if (!dto.projectId || !dto.sourceEnvironmentId || !dto.targetEnvironmentId) {
      throw new BadRequestException('projectId、sourceEnvironmentId 和 targetEnvironmentId 不能为空');
    }

    const dryRun = dto.dryRun !== false;
    const actionKinds = resolveActionKinds(dto.actionKinds);
    const source = await this.resolveProjectEnvironment(teamId, dto.projectId, dto.sourceEnvironmentId);
    const target = await this.resolveProjectEnvironment(teamId, dto.projectId, dto.targetEnvironmentId);

    if (source.id === target.id) {
      throw new BadRequestException('源环境和目标环境不能相同');
    }
    if (!dryRun && dto.confirmationText !== target.name && dto.confirmationText !== target.key) {
      throw new BadRequestException(`确认文本必须等于目标环境名称或 key：${target.name} / ${target.key}`);
    }

    const suggestions = await this.syncService.listSyncSuggestions(teamId, {
      projectId: dto.projectId,
      referenceEnvironmentId: source.id,
    }, [source.id, target.id]);
    const targetSuggestion = suggestions.profiles.find((profile) => profile.environment.id === target.id);

    const services = await this.repo.findApplicationServices(
      applyApplicationServicesArgs(teamId, dto.projectId, [source.id, target.id]),
    );
    const sourceServices: any[] = services.filter((service: any) => service.environmentId === source.id);
    const targetServices: any[] = services.filter((service: any) => service.environmentId === target.id);
    const targetServiceByKey = new Map<string, any>(targetServices.map((service: any) => [
      applicationServiceSyncKeyUtil(service.applicationId, service.name),
      service,
    ]));
    const steps: EnvironmentSyncApplyStep[] = [];

    for (const sourceService of sourceServices) {
      const targetService = targetServiceByKey.get(
        applicationServiceSyncKeyUtil(sourceService.applicationId, sourceService.name),
      );
      const sourceDeployConfig = safeDeployConfigUtil(sourceService.deployConfig);

      if (!targetService) {
        if (!actionKinds.has('create_missing_service')) {
          continue;
        }

        const copiedDeployConfigFields = Object.keys(sourceDeployConfig);
        if (dryRun) {
          steps.push(buildCreateMissingServicePlannedStep(sourceService, copiedDeployConfigFields));
          continue;
        }

        const data = buildCreateMissingServiceData(
          teamId, dto.projectId, target.id, source.id, userId, sourceService, sourceDeployConfig,
        );
        const created = await this.repo.createApplicationService({ data, select: { id: true } });
        steps.push(buildCreateMissingServiceAppliedStep(sourceService, created.id, copiedDeployConfigFields));
        continue;
      }

      if (!actionKinds.has('complete_deploy_config')) {
        continue;
      }

      const targetDeployConfig = recordFromJson(targetService.deployConfig);
      const missingFields = computeMissingDeployConfigFields(sourceDeployConfig, (field) =>
        readConfigStringUtil(targetDeployConfig, field),
      );
      if (missingFields.length === 0) {
        continue;
      }

      if (dryRun) {
        steps.push(buildCompleteDeployConfigPlannedStep(targetService, sourceService, missingFields));
        continue;
      }

      const nextDeployConfig = mergeDeployConfigFields(targetDeployConfig, sourceDeployConfig, missingFields);
      await this.repo.updateApplicationService({
        where: { id: targetService.id },
        data: { deployConfig: toJsonValueUtil(nextDeployConfig) },
        select: { id: true },
      });
      steps.push(buildCompleteDeployConfigAppliedStep(targetService, sourceService, missingFields));
    }

    for (const action of targetSuggestion?.actions || []) {
      if (APPLYABLE_SYNC_ACTION_KINDS.has(action.kind) || !actionKinds.has(action.kind)) {
        continue;
      }

      steps.push({
        kind: action.kind,
        status: 'skipped',
        title: action.title,
        description: `${action.description} 当前版本只生成待办，不自动复制线上绑定、密钥或基础设施配置。`,
        targetType: action.target,
        metadata: action.metadata,
      });
    }

    const result = {
      projectId: dto.projectId,
      sourceEnvironment: { id: source.id, key: source.key, name: source.name },
      targetEnvironment: { id: target.id, key: target.key, name: target.name },
      dryRun,
      status: dryRun ? 'planned' : 'completed',
      plannedCount: steps.filter((step) => step.status === 'planned').length,
      appliedCount: steps.filter((step) => step.status === 'applied').length,
      skippedCount: steps.filter((step) => step.status === 'skipped').length,
      steps,
      warnings: [
        '不会复制环境变量、SecretKey 明文或 secretKeyIds。',
        '不会自动复制服务器、站点、托管资源、CDN 或密钥绑定；这些需要在对应控制台确认。',
      ],
    };

    await this.auditEventService?.create(buildSyncApplyAuditInput(teamId, userId, result) as any);
    return result;
  }

  async getSyncApplyAccessScope(teamId: string, dto: ApplyProjectEnvironmentSyncSuggestionsDto) {
    const source = await this.getEnvironment(teamId, dto.sourceEnvironmentId);
    const target = await this.getEnvironment(teamId, dto.targetEnvironmentId);

    if (source.projectId !== dto.projectId || target.projectId !== dto.projectId || source.projectId !== target.projectId) {
      throw new BadRequestException('源环境、目标环境和项目不匹配');
    }

    return {
      projectId: source.projectId,
      sourceEnvironmentId: source.id,
      targetEnvironmentId: target.id,
    };
  }

  private async getEnvironment(teamId: string, id: string) {
    const environment = await this.repo.findProjectEnvironment({ where: { id, teamId } });
    if (!environment) throw new NotFoundException('项目环境不存在');
    return environment;
  }

  private async resolveProjectEnvironment(teamId: string, projectId: string, environmentId: string) {
    const environment = await this.repo.findProjectEnvironment({
      where: { id: environmentId, teamId, projectId, status: 'active' },
      select: { id: true, projectId: true, key: true, name: true, status: true },
    });
    if (!environment) throw new NotFoundException('项目环境不存在或不可用');
    return environment;
  }
}
