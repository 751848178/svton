/**
 * Project-environment CDN-config copy service.
 *
 * Owns `copyCdnConfigs` + `getCdnConfigCopyAccessScope`: copies CDN config
 * skeletons across environments (dry-run or applied) with per-config target
 * domain/origin/credential overrides, target-domain dedup skips, and an audit
 * record. Extracted from `ProjectEnvironmentService`. Behavior preserved verbatim.
 */

import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { AuditEventService } from '../audit-event';
import { ProjectEnvironmentRepository } from './project-environment.repository';
import { CopyProjectEnvironmentCdnConfigsDto } from './dto/project-environment.dto';
import { buildCdnConfigCopyAuditInput } from './project-environment-audit.utils';
import { toJsonValue as toJsonValueUtil } from './project-environment-helpers.utils';
import {
  buildCdnAppliedStep,
  buildCdnConfigCopyResult,
  buildCdnPlannedStep,
  buildCdnSkippedStep,
  buildCreateCdnConfigData,
  type EnvironmentCdnConfigCopyStep,
} from './project-environment-cdn-copy.utils';

@Injectable()
export class ProjectEnvironmentCdnCopyService {
  constructor(
    private readonly repo: ProjectEnvironmentRepository,
    @Optional() private readonly auditEventService: AuditEventService | null,
  ) {}

  async getCdnConfigCopyAccessScope(teamId: string, dto: CopyProjectEnvironmentCdnConfigsDto) {
    const source = await this.resolveProjectEnvironment(teamId, dto.projectId, dto.sourceEnvironmentId);
    const target = await this.resolveProjectEnvironment(teamId, dto.projectId, dto.targetEnvironmentId);
    return {
      projectId: source.projectId,
      sourceEnvironmentId: source.id,
      targetEnvironmentId: target.id,
    };
  }

  async copyCdnConfigs(teamId: string, userId: string, dto: CopyProjectEnvironmentCdnConfigsDto) {
    if (!dto.projectId || !dto.sourceEnvironmentId || !dto.targetEnvironmentId) {
      throw new BadRequestException('projectId、sourceEnvironmentId 和 targetEnvironmentId 不能为空');
    }
    const dryRun = dto.dryRun !== false;
    const source = await this.resolveProjectEnvironment(teamId, dto.projectId, dto.sourceEnvironmentId);
    const target = await this.resolveProjectEnvironment(teamId, dto.projectId, dto.targetEnvironmentId);
    if (source.id === target.id) throw new BadRequestException('源环境和目标环境不能相同');
    if (!dryRun && dto.confirmationText !== target.name && dto.confirmationText !== target.key) {
      throw new BadRequestException(`确认文本必须等于目标环境名称或 key：${target.name} / ${target.key}`);
    }

    const sourceConfigs = await this.repo.findCDNConfigs({
      where: { teamId, projectId: dto.projectId, environmentId: source.id, ...(dto.cdnConfigIds?.length ? { id: { in: dto.cdnConfigIds } } : {}) },
      select: { id: true, name: true, domain: true, origin: true, provider: true, credentialId: true, cacheRules: true, status: true },
      orderBy: [{ name: 'asc' }, { domain: 'asc' }],
    });
    const targetConfigs = await this.repo.findCDNConfigs({
      where: { teamId, projectId: dto.projectId, environmentId: target.id },
      select: { id: true, domain: true },
    });
    const existingTargetDomains = new Set(targetConfigs.map((config: any) => config.domain));
    const targetDomainOverrides = dto.targetDomainOverrides || {};
    const targetOriginOverrides = dto.targetOriginOverrides || {};
    const targetCredentialIds = dto.targetCredentialIds || {};

    const steps: EnvironmentCdnConfigCopyStep[] = [];
    for (const config of sourceConfigs as any[]) {
      const targetDomain = targetDomainOverrides[config.id]?.trim();
      const targetOrigin = targetOriginOverrides[config.id]?.trim();
      const targetCredentialId = targetCredentialIds[config.id]?.trim();
      const baseMetadata = {
        provider: config.provider,
        sourceDomain: config.domain,
        sourceOrigin: config.origin,
        targetDomain: targetDomain || null,
        targetOrigin: targetOrigin || null,
        targetCredentialId: targetCredentialId || null,
      };
      if (!targetDomain) {
        steps.push(buildCdnSkippedStep(config, baseMetadata, 'missing_target_domain', '缺少目标域名，apply 时不会自动复制该 CDN 配置'));
        continue;
      }
      if (!targetOrigin) {
        steps.push(buildCdnSkippedStep(config, baseMetadata, 'missing_target_origin', '缺少目标源站，apply 时不会自动复制该 CDN 配置'));
        continue;
      }
      if (!targetCredentialId) {
        steps.push(buildCdnSkippedStep(config, baseMetadata, 'missing_target_credential', '缺少目标云凭据，apply 时不会自动复制该 CDN 配置'));
        continue;
      }
      if (existingTargetDomains.has(targetDomain)) {
        steps.push(buildCdnSkippedStep(config, baseMetadata, 'target_domain_exists', `目标环境已存在 CDN 域名 ${targetDomain}`));
        continue;
      }
      if (dryRun) {
        steps.push(buildCdnPlannedStep(config, target.name, baseMetadata));
        continue;
      }
      const data = buildCreateCdnConfigData(teamId, userId, dto.projectId, target.id, config, target.name, targetDomain, targetOrigin, targetCredentialId, toJsonValueUtil);
      const created = await this.repo.createCDNConfig({ data, select: { id: true } });
      existingTargetDomains.add(targetDomain);
      steps.push(buildCdnAppliedStep(config, created.id, targetDomain, baseMetadata));
    }

    const result = buildCdnConfigCopyResult(dto.projectId, source, target, dryRun, steps);
    await this.auditEventService?.create(buildCdnConfigCopyAuditInput(teamId, userId, result) as any);
    return result;
  }

  private async resolveProjectEnvironment(teamId: string, projectId: string, environmentId: string) {
    const env = await this.repo.findProjectEnvironment({
      where: { id: environmentId, teamId, projectId, status: 'active' },
      select: { id: true, projectId: true, key: true, name: true, status: true },
    });
    if (!env) throw new NotFoundException('项目环境不存在或不可用');
    return env;
  }
}
