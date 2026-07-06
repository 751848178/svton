/**
 * Resource connection-probe service.
 *
 * Owns the `probeResourceConnection` flow: resolve the resource + credential +
 * auth adapter, create the connection run, dispatch the probe execution
 * (server SSH / cloud SDK / direct-db boundary), persist the terminal run, and
 * write the connection-probe audit event. Credential / auth-adapter / probe-
 * action resolution is delegated to `ResourceControlConnectionSharedService`;
 * step / target / sdk-call shaping lives in `resource-control-connection-probe.utils`.
 * Extracted from `ResourceControlService`. Behavior preserved verbatim.
 */
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditEventService } from '../audit-event';
import { ServerCommandStep, ServerExecutionResult, ServerExecutorService } from '../server-executor';
import { ResourceControlRepository } from './resource-control.repository';
import { ResourceControlBindingService } from './resource-control-binding.service';
import { ResourceControlConnectionSharedService } from './resource-control-connection-shared.service';
import { ResolvedCredentialRef } from './credentials/credential-resolver';
import { connectionRunInclude } from './resource-control-includes.constants';
import { ProbeResourceConnectionDto } from './dto/resource-control.dto';
import { toJsonValue } from './resource-control-query-type.utils';
import {
  buildConnectionTarget,
  buildServerConnectionSteps,
  sdkCallsForConnectionProbe,
} from './resource-control-connection-probe.utils';
import { asRecord } from './resource-control-value.utils';

type ManagedResourceForConnection = {
  id: string; sourceType: string; provider: string; kind: string; name: string;
  externalId: string; status: string; endpoint: string | null;
  projectId: string | null; environmentId: string | null; serverId: string | null;
  credentialId: string | null; config: Prisma.JsonValue | null; metadata: Prisma.JsonValue | null;
};

type ResourceConnectionExecutionResult = {
  status: 'completed' | 'failed' | 'blocked' | 'cancelled';
  executorKey: string; adapterKey: string; authAdapterKey: string;
  connectionPlan?: Prisma.InputJsonValue; result?: Prisma.InputJsonValue; error?: string;
};

@Injectable()
export class ResourceControlConnectionProbeService {
  constructor(
    private readonly repo: ResourceControlRepository,
    private readonly binding: ResourceControlBindingService,
    private readonly shared: ResourceControlConnectionSharedService,
    private readonly serverExecutorService: ServerExecutorService,
    private readonly auditEventService: AuditEventService,
  ) {}

  async probeResourceConnection(teamId: string, userId: string, resourceId: string, dto: ProbeResourceConnectionDto) {
    const resource = await this.binding.getManagedResource(teamId, resourceId);
    const action = this.shared.buildConnectionProbeAction(resource);
    const credential = await this.shared.resolveResourceQueryCredential(teamId, resource, action);
    const dryRun = dto.dryRun ?? true;
    const params = dto.params || {};
    const authAdapterKey = this.shared.resolveAuthAdapterKey(resource, credential);
    const executionShape = this.shared.resolveConnectionExecutionShape(resource, credential);
    const runCredentialId = this.shared.resolveQueryRunCredentialId(resource, credential);

    const run = await this.repo.createConnectionRun({
      data: {
        teamId, actorId: userId, resourceId: resource.id, credentialId: runCredentialId,
        projectId: resource.projectId, environmentId: resource.environmentId, serverId: resource.serverId,
        sourceType: resource.sourceType, provider: resource.provider, kind: resource.kind,
        targetEndpoint: resource.endpoint, authAdapterKey,
        executorKey: executionShape.executorKey, adapterKey: executionShape.adapterKey,
        dryRun, status: 'running', params: toJsonValue(params),
      },
    });

    try {
      const execution = await this.executeConnectionProbe(teamId, userId, resource, credential, run.id, { dryRun, params, authAdapterKey });
      const completed = await this.repo.updateConnectionRun({
        where: { id: run.id },
        data: {
          status: execution.status, executorKey: execution.executorKey, adapterKey: execution.adapterKey,
          authAdapterKey: execution.authAdapterKey, connectionPlan: execution.connectionPlan,
          result: execution.result, error: execution.error, finishedAt: new Date(),
        },
        include: connectionRunInclude,
      });
      await this.writeResourceConnectionAudit(teamId, userId, resource, completed);
      return completed;
    } catch (error) {
      const failed = await this.repo.updateConnectionRun({
        where: { id: run.id },
        data: { status: 'failed', error: error instanceof Error ? error.message : '资源连接探测失败', finishedAt: new Date() },
        include: connectionRunInclude,
      });
      await this.writeResourceConnectionAudit(teamId, userId, resource, failed);
      return failed;
    }
  }

  private async executeConnectionProbe(
    teamId: string, userId: string, resource: ManagedResourceForConnection, credential: ResolvedCredentialRef,
    runId: string, options: { dryRun: boolean; params: Record<string, unknown>; authAdapterKey: string },
  ): Promise<ResourceConnectionExecutionResult> {
    if (resource.sourceType === 'server' && credential.transport === 'ssh') {
      return this.executeServerConnectionProbe(teamId, userId, resource, credential, runId, options);
    }
    if (resource.sourceType === 'cloud') {
      return this.executeCloudConnectionProbe(resource, credential, runId, options);
    }
    const adapterKey = 'direct-db-connection-plan';
    const error = 'Direct DB credential adapter 尚未启用，当前只记录连接探测边界。';
    return {
      status: 'blocked', executorKey: 'direct-db-adapter', adapterKey, authAdapterKey: options.authAdapterKey,
      connectionPlan: toJsonValue({
        executorKey: 'direct-db-adapter', adapterKey, operationKey: 'resource.connection.probe',
        dryRun: options.dryRun, executable: false, target: buildConnectionTarget(resource),
        safety: { secretsInOutput: 'must_mask_before_persisting', liveExecutionDefault: 'blocked_until_direct_db_adapter_ready' },
        warnings: [error],
        metadata: { resourceConnectionRunId: runId, authAdapterKey: options.authAdapterKey, credential: credential.metadata, params: options.params },
      }),
      result: toJsonValue({ mode: 'blocked_adapter_missing', executed: false, nextExecutorBoundary: 'direct_db_driver_adapter' }),
      error,
    };
  }

  private async executeServerConnectionProbe(
    teamId: string, userId: string, resource: ManagedResourceForConnection, credential: ResolvedCredentialRef,
    runId: string, options: { dryRun: boolean; params: Record<string, unknown>; authAdapterKey: string },
  ): Promise<ResourceConnectionExecutionResult> {
    const { steps, warnings } = buildServerConnectionSteps(resource);
    const target = await this.serverExecutorService.resolveTarget(teamId, resource.serverId);
    const execution: ServerExecutionResult = await this.serverExecutorService.execute({
      teamId, userId, operationKey: 'resource.connection.probe', adapterKey: 'resource-connection-plan',
      dryRun: options.dryRun, target, steps, warnings, blockOnWarnings: true,
      metadata: {
        resourceConnectionRunId: runId, resource: buildConnectionTarget(resource),
        credential: credential.metadata, authAdapterKey: options.authAdapterKey, params: options.params,
      },
    });
    return {
      status: this.terminalConnectionStatus(execution.status), executorKey: execution.executorKey,
      adapterKey: execution.adapterKey, authAdapterKey: options.authAdapterKey,
      connectionPlan: execution.commandPlan, result: execution.result, error: execution.error,
    };
  }

  private executeCloudConnectionProbe(
    resource: ManagedResourceForConnection, credential: ResolvedCredentialRef, runId: string,
    options: { dryRun: boolean; params: Record<string, unknown>; authAdapterKey: string },
  ): ResourceConnectionExecutionResult {
    const adapterKey = `${resource.provider}-connection-plan`;
    const hasCredential = credential.source === 'team_credential';
    const status = hasCredential && options.dryRun ? 'completed' : 'blocked';
    const error = !hasCredential ? '云资源未绑定 TeamCredential，无法验证 provider 授权。'
      : !options.dryRun ? 'Cloud provider SDK live connection probe 尚未启用。' : undefined;
    const warnings = [
      ...(!hasCredential ? ['resource has no TeamCredential binding'] : []),
      ...(!options.dryRun ? ['live provider SDK connection probe is disabled'] : []),
    ];
    return {
      status, executorKey: 'cloud-sdk', adapterKey, authAdapterKey: options.authAdapterKey,
      connectionPlan: toJsonValue({
        executorKey: 'cloud-sdk', adapterKey, operationKey: 'resource.connection.probe', dryRun: options.dryRun,
        executable: hasCredential && options.dryRun, target: buildConnectionTarget(resource),
        auth: { adapterKey: options.authAdapterKey, credential },
        safety: { providerSdkOnly: true, arbitraryShell: false, secretsInOutput: 'must_mask_before_persisting', liveExecutionDefault: 'blocked_until_provider_adapter_ready' },
        warnings, metadata: { resourceConnectionRunId: runId, params: options.params },
        sdkCalls: sdkCallsForConnectionProbe(resource, options.params),
      }),
      result: toJsonValue({
        mode: options.dryRun ? 'cloud_connection_plan' : 'blocked_live_transport', executed: false,
        executorKey: 'cloud-sdk', adapterKey, authAdapterKey: options.authAdapterKey,
        credential: credential.metadata, warnings,
      }),
      error,
    };
  }

  private terminalConnectionStatus(status: string): ResourceConnectionExecutionResult['status'] {
    return status === 'queued' ? 'blocked' : (status as ResourceConnectionExecutionResult['status']);
  }

  private async writeResourceConnectionAudit(
    teamId: string, userId: string,
    resource: { id: string; name: string; projectId: string | null; environmentId: string | null; serverId: string | null; sourceType: string; provider: string; kind: string; endpoint: string | null },
    connectionRun: { id: string; status: string; dryRun: boolean; executorKey: string; adapterKey: string; authAdapterKey: string; error: string | null },
  ) {
    await this.auditEventService.create({
      teamId, actorId: userId, projectId: resource.projectId, environmentId: resource.environmentId,
      serverId: resource.serverId, managedResourceId: resource.id, resourceConnectionRunId: connectionRun.id,
      category: 'resource_connection', action: 'resource.connection.probe',
      targetType: 'managed_resource', targetId: resource.id, risk: 'low', status: connectionRun.status,
      summary: `资源连接探测 ${resource.name} ${connectionRun.status}`,
      metadata: {
        dryRun: connectionRun.dryRun, sourceType: resource.sourceType, provider: resource.provider,
        kind: resource.kind, endpoint: resource.endpoint, resourceName: resource.name,
        executorKey: connectionRun.executorKey, adapterKey: connectionRun.adapterKey,
        authAdapterKey: connectionRun.authAdapterKey, error: connectionRun.error,
      },
    });
  }
}
