/**
 * Resource-control docker / cloud-sync service.
 *
 * Owns `syncServerDocker` (server docker inventory via CLI SSH or dockerode
 * API, with stub fallback) and `syncCloudResources` (cloud provider inventory
 * via the cloud-provider inventory service). Includes the managed-resource
 * upsert and the cloud-inventory collection boundary. Extracted from
 * `ResourceControlService`. Behavior preserved verbatim.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ServerExecutorService } from '../server-executor';
import { ResourceControlRepository } from './resource-control.repository';
import { ResourceControlBindingService } from './resource-control-binding.service';
import { managedResourceInclude } from './resource-control-includes.constants';
import {
  buildDockerInventorySeedsFromDockerPs,
  buildDockerInventorySeedsFromRecords,
  DOCKER_INVENTORY_ADAPTER_KEY,
  DOCKER_PS_JSON_COMMAND,
} from './inventory/docker-inventory';
import { DockerInventoryExecutorFactory } from './inventory/executors/docker-inventory-executor.factory';
import { CloudInventoryProvider } from './inventory/cloud-inventory';
import { CloudProviderInventoryService } from './inventory/cloud-provider-inventory.service';
import { SyncCloudResourcesDto, SyncServerDockerDto } from './dto/resource-control.dto';
import { toJsonValue } from './resource-control-query-type.utils';
import { asRecord } from './resource-control-value.utils';
import {
  buildServerDockerInventory,
  readServerExecutionStdout,
  summarizeServerExecution,
} from './resource-control-docker-inventory.utils';

type ManagedResourceSeed = {
  sourceType: string; provider: string; kind: string; name: string; externalId: string;
  status: string; endpoint?: string; serverId?: string; projectId?: string;
  environmentId?: string; credentialId?: string; metadata?: Record<string, unknown>; config?: Record<string, unknown>;
};
type ServerInventorySource = { id: string; name: string; host: string; status: string; services: Prisma.JsonValue | null };
type EnvironmentRef = { id: string; projectId: string; key: string; name: string };

@Injectable()
export class ResourceControlSyncService {
  constructor(
    private readonly repo: ResourceControlRepository,
    private readonly binding: ResourceControlBindingService,
    private readonly serverExecutorService: ServerExecutorService,
    private readonly dockerInventoryExecutorFactory: DockerInventoryExecutorFactory,
    private readonly cloudProviderInventoryService: CloudProviderInventoryService,
  ) {}

  async syncServerDocker(teamId: string, userId: string | null, serverId: string, dto: SyncServerDockerDto) {
    const server = await this.repo.findServer({ where: { id: serverId, teamId }, select: { id: true, name: true, host: true, status: true, services: true } });
    if (!server) throw new NotFoundException('服务器不存在');
    const environmentRef = await this.binding.resolveProjectEnvironment(teamId, dto.environmentId);
    const syncRun = await this.repo.createSyncRun({
      data: {
        teamId, actorId: userId, serverId, sourceType: 'server', provider: 'docker',
        scope: dto.scope || 'docker', status: 'running',
        metadata: toJsonValue({ syncMode: 'server_executor_inventory', adapterBoundary: 'server_executor', includeContainers: dto.includeContainers !== false, includeMiddleware: dto.includeMiddleware !== false, environmentId: environmentRef?.id, environmentKey: environmentRef?.key, projectId: environmentRef?.projectId }),
      },
    });
    try {
      if (environmentRef) {
        await this.binding.bindServerToEnvironment(teamId, environmentRef, server.id, { source: 'resource-control.syncServerDocker' });
      }
      const inventory = await this.collectServerDockerInventory(teamId, userId, server, dto, environmentRef);
      const seeds = inventory.seeds;
      const resources = await this.upsertManagedResources(teamId, userId, seeds);
      const services = asRecord(server.services);
      await this.repo.updateServer({ where: { id: server.id }, data: { services: toJsonValue({ ...services, docker: seeds.some((s) => s.kind === 'docker_container'), mysql: seeds.some((s) => s.kind === 'mysql'), redis: seeds.some((s) => s.kind === 'redis') }) } });
      const completedRun = await this.repo.updateSyncRun({
        where: { id: syncRun.id },
        data: { status: 'completed', discovered: resources.length, finishedAt: new Date(),
          metadata: toJsonValue({ syncMode: inventory.syncMode, adapterBoundary: 'server_executor', includeContainers: dto.includeContainers !== false, includeMiddleware: dto.includeMiddleware !== false, environmentId: environmentRef?.id, environmentKey: environmentRef?.key, projectId: environmentRef?.projectId, execution: inventory.execution, parser: inventory.parser, fallbackReason: inventory.fallbackReason }) },
        include: { server: { select: { id: true, name: true, host: true } }, actor: { select: { id: true, name: true, email: true } } },
      });
      return { syncRun: completedRun, resources };
    } catch (error) {
      await this.repo.updateSyncRun({ where: { id: syncRun.id }, data: { status: 'failed', error: error instanceof Error ? error.message : '同步失败', finishedAt: new Date() } });
      throw error;
    }
  }

  async syncCloudResources(teamId: string, userId: string, dto: SyncCloudResourcesDto) {
    const environmentRef = await this.binding.resolveProjectEnvironment(teamId, dto.environmentId);
    const credential = dto.credentialId ? await this.repo.findTeamCredential({ where: { id: dto.credentialId, teamId }, select: { id: true, name: true, type: true } }) : null;
    if (dto.credentialId && !credential) throw new NotFoundException('云资源凭证不存在');
    const provider = dto.provider || 'all';
    const syncRun = await this.repo.createSyncRun({
      data: { teamId, actorId: userId, credentialId: credential?.id, sourceType: 'cloud', provider, scope: dto.scope || dto.region || 'all', status: 'running',
        metadata: toJsonValue({ syncMode: 'cloud_provider_inventory_adapter', adapterBoundary: 'cloud_provider_inventory', region: dto.region || 'default', credentialName: credential?.name, credentialType: credential?.type, environmentId: environmentRef?.id, environmentKey: environmentRef?.key, projectId: environmentRef?.projectId }) },
    });
    try {
      const providers = provider === 'all' ? ['aliyun-rds', 'aliyun-sls', 'tencent-cos'] : [provider];
      const inventories = await Promise.all(providers.map((item) => this.collectCloudInventory(teamId, item as CloudInventoryProvider, dto, credential, environmentRef)));
      const seeds = inventories.flatMap((inv) => inv.seeds);
      const resources = await this.upsertManagedResources(teamId, userId, seeds);
      const completedRun = await this.repo.updateSyncRun({
        where: { id: syncRun.id },
        data: { status: 'completed', discovered: resources.length, finishedAt: new Date(),
          metadata: toJsonValue({ syncMode: inventories.every((inv) => inv.syncMode === 'cloud_inventory_stub_fallback') ? 'cloud_inventory_stub_fallback' : 'cloud_provider_inventory_adapter', adapterBoundary: 'cloud_provider_inventory', region: dto.region || 'default', credentialName: credential?.name, credentialType: credential?.type, environmentId: environmentRef?.id, environmentKey: environmentRef?.key, projectId: environmentRef?.projectId, providers: inventories.map((inv) => ({ provider: inv.provider, syncMode: inv.syncMode, parsedCount: inv.parsedCount, skippedCount: inv.skippedCount, errors: inv.errors, fallbackReason: inv.fallbackReason, live: inv.live, sdk: inv.sdk, regions: inv.regions, requestPolicy: inv.requestPolicy })) }) },
        include: { credential: { select: { id: true, name: true, type: true } }, actor: { select: { id: true, name: true, email: true } } },
      });
      return { syncRun: completedRun, resources };
    } catch (error) {
      await this.repo.updateSyncRun({ where: { id: syncRun.id }, data: { status: 'failed', error: error instanceof Error ? error.message : '同步失败', finishedAt: new Date() } });
      throw error;
    }
  }

  async upsertManagedResources(teamId: string, userId: string | null, seeds: ManagedResourceSeed[]) {
    const resources = [];
    const syncedAt = new Date();
    for (const seed of seeds) {
      const resource = await this.repo.upsertManagedResource({
        where: { teamId_sourceType_provider_externalId: { teamId, sourceType: seed.sourceType, provider: seed.provider, externalId: seed.externalId } },
        create: { teamId, createdById: userId, sourceType: seed.sourceType, provider: seed.provider, kind: seed.kind, name: seed.name, externalId: seed.externalId, status: seed.status, endpoint: seed.endpoint, serverId: seed.serverId, projectId: seed.projectId, environmentId: seed.environmentId, credentialId: seed.credentialId, metadata: seed.metadata ? toJsonValue(seed.metadata) : undefined, config: seed.config ? toJsonValue(seed.config) : undefined, lastSyncAt: syncedAt },
        update: { name: seed.name, kind: seed.kind, status: seed.status, endpoint: seed.endpoint, serverId: seed.serverId, projectId: seed.projectId, environmentId: seed.environmentId, credentialId: seed.credentialId, metadata: seed.metadata ? toJsonValue(seed.metadata) : undefined, config: seed.config ? toJsonValue(seed.config) : undefined, syncError: null, lastSyncAt: syncedAt },
        include: managedResourceInclude,
      });
      resources.push(resource);
    }
    return resources;
  }

  private async collectServerDockerInventory(teamId: string, userId: string | null, server: ServerInventorySource, dto: SyncServerDockerDto, environment?: EnvironmentRef | null) {
    const includeContainers = dto.includeContainers !== false;
    const includeMiddleware = dto.includeMiddleware !== false;
    if (this.dockerInventoryExecutorFactory.usesDockerApi({ services: server.services })) {
      return this.collectServerDockerInventoryViaApi(teamId, server, dto, environment, includeContainers, includeMiddleware);
    }
    const target = await this.serverExecutorService.resolveTarget(teamId, server.id);
    const execution = await this.serverExecutorService.execute({
      teamId, userId: userId || undefined, operationKey: 'resource.sync_docker_inventory', adapterKey: DOCKER_INVENTORY_ADAPTER_KEY, dryRun: false, target,
      steps: [{ key: 'docker-ps-json', label: 'list docker containers as json lines', command: DOCKER_PS_JSON_COMMAND, required: true, risk: 'low', timeoutSeconds: 30 }],
      metadata: { source: 'resource-control.syncServerDocker', inventoryProvider: 'docker', includeContainers, includeMiddleware, environmentId: environment?.id, environmentKey: environment?.key, projectId: environment?.projectId },
    });
    const executionSummary = summarizeServerExecution(execution);
    if (execution.status === 'completed') {
      const stdout = readServerExecutionStdout(execution);
      if (stdout !== undefined) {
        const parsed = buildDockerInventorySeedsFromDockerPs(stdout, { server, environment, includeContainers, includeMiddleware, syncMode: 'server_executor_live' });
        return { syncMode: 'server_executor_live', seeds: parsed.seeds, execution: executionSummary, parser: { parsedCount: parsed.parsedCount, skippedCount: parsed.skippedCount, errors: parsed.errors } };
      }
    }
    const fallbackReason = execution.error || `Server executor ${execution.status}`;
    const seeds = buildServerDockerInventory(server, dto, environment).map((seed) => ({ ...seed, metadata: { ...(seed.metadata || {}), fallbackReason } }));
    return { syncMode: 'inventory_stub_fallback', seeds, execution: executionSummary, parser: { parsedCount: 0, skippedCount: 0, errors: ['server executor live inventory did not return parseable stdout'] }, fallbackReason };
  }

  private async collectServerDockerInventoryViaApi(teamId: string, server: ServerInventorySource, dto: SyncServerDockerDto, environment: EnvironmentRef | null | undefined, includeContainers: boolean, includeMiddleware: boolean) {
    const executor = this.dockerInventoryExecutorFactory.resolve({ services: server.services });
    try {
      const records = await executor.listContainers({ teamId, serverId: server.id });
      const parsed = buildDockerInventorySeedsFromRecords(records, { server, environment, includeContainers, includeMiddleware, syncMode: 'docker_api_live' });
      return { syncMode: 'docker_api_live', seeds: parsed.seeds, execution: { status: 'completed', mode: 'docker_api', adapterKey: 'docker-api-inventory', executable: true, warnings: [], error: undefined }, parser: { parsedCount: parsed.parsedCount, skippedCount: parsed.skippedCount, errors: parsed.errors } };
    } catch (error) {
      const fallbackReason = error instanceof Error ? error.message : 'Docker API inventory failed';
      const seeds = buildServerDockerInventory(server, dto, environment).map((seed) => ({ ...seed, metadata: { ...(seed.metadata || {}), fallbackReason } }));
      return { syncMode: 'inventory_stub_fallback', seeds, execution: { status: 'failed', mode: 'docker_api', adapterKey: 'docker-api-inventory', executable: true, warnings: [], error: fallbackReason }, parser: { parsedCount: 0, skippedCount: 0, errors: [fallbackReason] }, fallbackReason };
    }
  }

  private async collectCloudInventory(teamId: string, provider: CloudInventoryProvider, dto: SyncCloudResourcesDto, credential?: { id: string; name: string; type: string } | null, environment?: EnvironmentRef | null) {
    const region = dto.region || (provider === 'tencent-cos' ? 'ap-shanghai' : 'cn-hangzhou');
    return this.cloudProviderInventoryService.collect({ teamId, provider, region, regionExplicit: Boolean(dto.region), credential, environment });
  }
}
