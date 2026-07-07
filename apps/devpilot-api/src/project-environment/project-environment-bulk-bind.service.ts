/**
 * Project-environment bulk-bind service.
 *
 * Owns `bulkBindResources` + `getResourceBulkBindingAccessScope`: binds
 * existing project-scoped (unbound) managed resources / resource instances /
 * sites / CDN configs / secret keys to an environment (dry-run or applied) and
 * writes an audit record. Extracted from `ProjectEnvironmentService`.
 * Behavior preserved verbatim.
 */

import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { AuditEventService } from '../audit-event';
import { ProjectEnvironmentRepository } from './project-environment.repository';
import { BulkBindProjectEnvironmentResourcesDto } from './dto/project-environment.dto';
import { buildResourceBulkBindingAuditInput } from './project-environment-audit.utils';
import { normalizeResourceBindingTypes as normalizeResourceBindingTypesUtil } from './project-environment-helpers.utils';
import {
  buildBulkBindResult,
  buildCdnConfigBindingSteps,
  buildManagedResourceBindingSteps,
  buildResourceInstanceBindingSteps,
  buildSecretKeyBindingSteps,
  buildSiteBindingSteps,
  collectBindingIds,
  type EnvironmentResourceBindingStep,
} from './project-environment-bulk-bind.utils';

@Injectable()
export class ProjectEnvironmentBulkBindService {
  constructor(
    private readonly repo: ProjectEnvironmentRepository,
    @Optional() private readonly auditEventService: AuditEventService | null,
  ) {}

  async getResourceBulkBindingAccessScope(teamId: string, dto: BulkBindProjectEnvironmentResourcesDto) {
    const environment = await this.resolveProjectEnvironment(teamId, dto.projectId, dto.environmentId);
    return { projectId: environment.projectId, environmentId: environment.id };
  }

  async bulkBindResources(teamId: string, userId: string, dto: BulkBindProjectEnvironmentResourcesDto) {
    if (!dto.projectId || !dto.environmentId) {
      throw new BadRequestException('projectId 和 environmentId 不能为空');
    }
    const dryRun = dto.dryRun !== false;
    const environment = await this.resolveProjectEnvironment(teamId, dto.projectId, dto.environmentId);
    if (!dryRun && dto.confirmationText !== environment.name && dto.confirmationText !== environment.key) {
      throw new BadRequestException(`确认文本必须等于目标环境名称或 key：${environment.name} / ${environment.key}`);
    }

    const requestedTypes = normalizeResourceBindingTypesUtil(dto.resourceTypes);
    const resourceIds = dto.resourceIds || {};
    const [managedResources, resourceInstances, sites, cdnConfigs, secretKeys] = await Promise.all([
      requestedTypes.has('managed_resource') ? this.repo.findManagedResources({ where: this.unboundWhere(teamId, dto.projectId, resourceIds.managedResourceIds), select: { id: true, name: true, provider: true, kind: true, status: true, endpoint: true }, orderBy: [{ provider: 'asc' }, { kind: 'asc' }, { name: 'asc' }] }) : Promise.resolve([]),
      requestedTypes.has('resource_instance') ? this.repo.findResourceInstances({ where: this.unboundWhere(teamId, dto.projectId, resourceIds.resourceInstanceIds), select: { id: true, name: true, status: true, resourceType: { select: { id: true, key: true, name: true, category: true } } }, orderBy: [{ status: 'asc' }, { name: 'asc' }] }) : Promise.resolve([]),
      requestedTypes.has('site') ? this.repo.findSites({ where: this.unboundWhere(teamId, dto.projectId, resourceIds.siteIds), select: { id: true, name: true, primaryDomain: true, runtimeType: true, status: true }, orderBy: [{ status: 'asc' }, { name: 'asc' }] }) : Promise.resolve([]),
      requestedTypes.has('cdn_config') ? this.repo.findCDNConfigs({ where: this.unboundWhere(teamId, dto.projectId, resourceIds.cdnConfigIds), select: { id: true, name: true, domain: true, provider: true, status: true }, orderBy: [{ provider: 'asc' }, { name: 'asc' }] }) : Promise.resolve([]),
      requestedTypes.has('secret_key') ? this.repo.findSecretKeys({ where: this.unboundWhere(teamId, dto.projectId, resourceIds.secretKeyIds), select: { id: true, name: true, type: true, description: true }, orderBy: [{ type: 'asc' }, { name: 'asc' }] }) : Promise.resolve([]),
    ]) as [any[], any[], any[], any[], any[]];

    const status = dryRun ? 'planned' : 'applied';
    const steps: EnvironmentResourceBindingStep[] = [
      ...buildManagedResourceBindingSteps(managedResources, status, environment.name),
      ...buildResourceInstanceBindingSteps(resourceInstances, status, environment.name),
      ...buildSiteBindingSteps(sites, status, environment.name),
      ...buildCdnConfigBindingSteps(cdnConfigs, status, environment.name),
      ...buildSecretKeyBindingSteps(secretKeys, status, environment.name),
    ];

    if (!dryRun) {
      await this.applyResourceEnvironmentBinding(teamId, dto.projectId, environment.id, collectBindingIds(managedResources, resourceInstances, sites, cdnConfigs, secretKeys));
    }

    const result = buildBulkBindResult(dto.projectId, environment, dryRun, steps, managedResources, resourceInstances, sites, cdnConfigs, secretKeys);
    await this.auditEventService?.create(buildResourceBulkBindingAuditInput(teamId, userId, result) as any);
    return result;
  }

  /** Shared where-clause for project-scoped unbound (environmentId: null) reads. */
  private unboundWhere(teamId: string, projectId: string, ids: string[] | undefined) {
    return { teamId, projectId, environmentId: null, ...(ids?.length ? { id: { in: ids } } : {}) };
  }

  private async applyResourceEnvironmentBinding(teamId: string, projectId: string, environmentId: string, ids: any) {
    const updates: Array<Promise<unknown>> = [];
    if (ids.managedResourceIds.length > 0) updates.push(this.repo.updateManagedResources({ where: { teamId, projectId, environmentId: null, id: { in: ids.managedResourceIds } }, data: { environmentId } }));
    if (ids.resourceInstanceIds.length > 0) updates.push(this.repo.updateResourceInstances({ where: { teamId, projectId, environmentId: null, id: { in: ids.resourceInstanceIds } }, data: { environmentId } }));
    if (ids.siteIds.length > 0) updates.push(this.repo.updateSites({ where: { teamId, projectId, environmentId: null, id: { in: ids.siteIds } }, data: { environmentId } }));
    if (ids.cdnConfigIds.length > 0) updates.push(this.repo.updateCDNConfigs({ where: { teamId, projectId, environmentId: null, id: { in: ids.cdnConfigIds } }, data: { environmentId } }));
    if (ids.secretKeyIds.length > 0) updates.push(this.repo.updateSecretKeys({ where: { teamId, projectId, environmentId: null, id: { in: ids.secretKeyIds } }, data: { environmentId } }));
    await Promise.all(updates);
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
