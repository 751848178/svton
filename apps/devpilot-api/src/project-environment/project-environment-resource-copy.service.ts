/**
 * Project-environment resource-copy service.
 *
 * Owns `copyResources` + `getResourceCopyAccessScope`: copies ManagedResource
 * indices and SecretKey skeletons across environments (dry-run or applied) with
 * explicit per-resource/per-secret target overrides, deduplication skips, and
 * an audit record. Extracted from `ProjectEnvironmentService`. Behavior
 * preserved verbatim.
 */

import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { AuditEventService } from '../audit-event';
import { CryptoService } from '../common/crypto/crypto.service';
import { ProjectEnvironmentRepository } from './project-environment.repository';
import { CopyProjectEnvironmentResourcesDto } from './dto/project-environment.dto';
import { buildResourceCopyAuditInput } from './project-environment-audit.utils';
import {
  buildCreateManagedResourceData,
  buildCreateSecretKeyData,
  buildResourceAppliedStep,
  buildResourceCopyResult,
  buildResourcePlannedStep,
  buildResourceSkippedStep,
  buildSecretAppliedStep,
  buildSecretPlannedStep,
  buildSecretSkippedStep,
  type EnvironmentResourceCopyStep,
} from './project-environment-resource-copy.utils';

@Injectable()
export class ProjectEnvironmentResourceCopyService {
  constructor(
    private readonly repo: ProjectEnvironmentRepository,
    private readonly cryptoService: CryptoService,
    @Optional() private readonly auditEventService: AuditEventService | null,
  ) {}

  async getResourceCopyAccessScope(teamId: string, dto: CopyProjectEnvironmentResourcesDto) {
    const source = await this.resolveProjectEnvironment(teamId, dto.projectId, dto.sourceEnvironmentId);
    const target = await this.resolveProjectEnvironment(teamId, dto.projectId, dto.targetEnvironmentId);
    return {
      projectId: source.projectId,
      sourceEnvironmentId: source.id,
      targetEnvironmentId: target.id,
    };
  }

  async copyResources(teamId: string, userId: string, dto: CopyProjectEnvironmentResourcesDto) {
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

    const sourceResources = await this.repo.findManagedResources({
      where: { teamId, projectId: dto.projectId, environmentId: source.id, ...(dto.managedResourceIds?.length ? { id: { in: dto.managedResourceIds } } : {}) },
      select: { id: true, sourceType: true, provider: true, kind: true, name: true, externalId: true, status: true, endpoint: true, serverId: true, credentialId: true },
      orderBy: [{ name: 'asc' }, { externalId: 'asc' }],
    });
    const sourceSecrets = await this.repo.findSecretKeys({
      where: { teamId, projectId: dto.projectId, environmentId: source.id, ...(dto.secretKeyIds?.length ? { id: { in: dto.secretKeyIds } } : {}) },
      select: { id: true, name: true, type: true, description: true },
      orderBy: [{ name: 'asc' }, { type: 'asc' }],
    });
    const targetResourceExternalIds = dto.targetResourceExternalIds || {};
    const targetResourceNames = dto.targetResourceNames || {};
    const targetResourceEndpoints = dto.targetResourceEndpoints || {};
    const targetResourceServerIds = dto.targetResourceServerIds || {};
    const targetResourceCredentialIds = dto.targetResourceCredentialIds || {};
    const targetSecretNames = dto.targetSecretNames || {};
    const targetSecretValues = dto.targetSecretValues || {};
    const targetSecretDescriptions = dto.targetSecretDescriptions || {};
    const requestedTargetExternalIds = Object.values(targetResourceExternalIds).map((v) => v?.trim()).filter(Boolean);
    const existingResources = requestedTargetExternalIds.length ? await this.repo.findManagedResources({ where: { teamId, externalId: { in: requestedTargetExternalIds } }, select: { sourceType: true, provider: true, externalId: true } }) : [];
    const existingResourceKeys = new Set(existingResources.map((r: any) => `${r.sourceType}:${r.provider}:${r.externalId}`));
    const existingTargetSecrets = await this.repo.findSecretKeys({
      where: { teamId, projectId: dto.projectId, environmentId: target.id },
      select: { name: true },
    });
    const existingTargetSecretNames = new Set(existingTargetSecrets.map((s: any) => s.name));

    const steps: EnvironmentResourceCopyStep[] = await this.copyManagedResources(
      teamId, userId, dto, source, target, sourceResources as any[], {
        targetResourceExternalIds, targetResourceNames, targetResourceEndpoints,
        targetResourceServerIds, targetResourceCredentialIds, dryRun, existingResourceKeys,
      },
    );
    await this.copySecrets(teamId, userId, dto, target, sourceSecrets as any[], {
      targetSecretNames, targetSecretValues, targetSecretDescriptions,
      dryRun, existingTargetSecretNames,
    }, steps);

    const result = buildResourceCopyResult(dto.projectId, source, target, dryRun, steps);
    await this.auditEventService?.create(buildResourceCopyAuditInput(teamId, userId, result) as any);
    return result;
  }

  private async copyManagedResources(
    teamId: string, userId: string, dto: CopyProjectEnvironmentResourcesDto,
    source: any, target: any, sourceResources: any[], opts: any,
  ): Promise<EnvironmentResourceCopyStep[]> {
    const steps: EnvironmentResourceCopyStep[] = [];
    for (const resource of sourceResources) {
      const targetExternalId = opts.targetResourceExternalIds[resource.id]?.trim();
      const targetName = opts.targetResourceNames[resource.id]?.trim() || `${resource.name} (${target.name})`;
      const targetEndpoint = opts.targetResourceEndpoints[resource.id]?.trim();
      const targetServerId = opts.targetResourceServerIds[resource.id]?.trim();
      const targetCredentialId = opts.targetResourceCredentialIds[resource.id]?.trim();
      const baseMetadata = {
        sourceType: resource.sourceType, provider: resource.provider, kind: resource.kind,
        sourceExternalId: resource.externalId, targetExternalId: targetExternalId || null,
        hasTargetServer: Boolean(targetServerId), hasTargetCredential: Boolean(targetCredentialId),
      };
      if (!targetExternalId) {
        steps.push(buildResourceSkippedStep(resource, baseMetadata, 'missing_target_external_id', '缺少目标 externalId，apply 时不会自动复制该资源索引'));
        continue;
      }
      const resourceKey = `${resource.sourceType}:${resource.provider}:${targetExternalId}`;
      if (opts.existingResourceKeys.has(resourceKey)) {
        steps.push(buildResourceSkippedStep(resource, baseMetadata, 'target_external_id_exists', `团队内已存在同 provider/sourceType 的 externalId ${targetExternalId}`));
        continue;
      }
      if (opts.dryRun) {
        steps.push(buildResourcePlannedStep(resource, target.name, targetExternalId, baseMetadata));
        opts.existingResourceKeys.add(resourceKey);
        continue;
      }
      if (targetServerId) await this.assertServer(teamId, targetServerId);
      if (targetCredentialId) await this.assertTeamCredential(teamId, targetCredentialId);
      const data = buildCreateManagedResourceData(teamId, userId, dto.projectId, target.id, resource, targetName, targetExternalId, targetEndpoint, targetServerId, targetCredentialId);
      const created = await this.repo.createManagedResource({ data, select: { id: true } });
      opts.existingResourceKeys.add(resourceKey);
      steps.push(buildResourceAppliedStep(resource, created.id, targetExternalId, baseMetadata));
    }
    return steps;
  }

  private async copySecrets(
    teamId: string, userId: string, dto: CopyProjectEnvironmentResourcesDto,
    target: any, sourceSecrets: any[], opts: any, steps: EnvironmentResourceCopyStep[],
  ): Promise<void> {
    for (const secret of sourceSecrets) {
      const targetName = opts.targetSecretNames[secret.id]?.trim() || `${secret.name} (${target.name})`;
      const rawTargetValue = opts.targetSecretValues[secret.id];
      const targetValue = typeof rawTargetValue === 'string' && rawTargetValue.length > 0 ? rawTargetValue : undefined;
      const targetDescription = opts.targetSecretDescriptions[secret.id] !== undefined ? opts.targetSecretDescriptions[secret.id] : secret.description || undefined;
      const baseMetadata = { type: secret.type, sourceName: secret.name, targetName, hasTargetValue: Boolean(targetValue) };
      if (!targetValue) {
        steps.push(buildSecretSkippedStep(secret, baseMetadata, 'missing_target_secret_value', '缺少目标密钥值，apply 时不会自动复制该密钥'));
        continue;
      }
      if (opts.existingTargetSecretNames.has(targetName)) {
        steps.push(buildSecretSkippedStep(secret, baseMetadata, 'target_secret_name_exists', `目标环境已存在同名密钥 ${targetName}`));
        continue;
      }
      if (opts.dryRun) {
        steps.push(buildSecretPlannedStep(secret, target.name, baseMetadata));
        opts.existingTargetSecretNames.add(targetName);
        continue;
      }
      const data = buildCreateSecretKeyData(teamId, userId, dto.projectId, target.id, secret, targetName, this.encryptSecretValue(targetValue), targetDescription);
      const created = await this.repo.createSecretKey({ data, select: { id: true } });
      opts.existingTargetSecretNames.add(targetName);
      steps.push(buildSecretAppliedStep(secret, created.id, targetName));
    }
  }

  private encryptSecretValue(text: string): string {
    return this.cryptoService.encryptCbc(text);
  }

  private async resolveProjectEnvironment(teamId: string, projectId: string, environmentId: string) {
    const env = await this.repo.findProjectEnvironment({
      where: { id: environmentId, teamId, projectId, status: 'active' },
      select: { id: true, projectId: true, key: true, name: true, status: true },
    });
    if (!env) throw new NotFoundException('项目环境不存在或不可用');
    return env;
  }

  private async assertServer(teamId: string, serverId: string) {
    const server = await this.repo.findServer({ where: { id: serverId, teamId }, select: { id: true } });
    if (!server) throw new NotFoundException('服务器不存在或不属于当前团队');
    return server;
  }

  private async assertTeamCredential(teamId: string, credentialId: string) {
    const credential = await this.repo.findTeamCredential({ where: { id: credentialId, teamId }, select: { id: true } });
    if (!credential) throw new NotFoundException('凭据不存在或不属于当前团队');
    return credential;
  }
}
