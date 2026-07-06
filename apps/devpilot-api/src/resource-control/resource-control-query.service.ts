/**
 * Resource query service.
 *
 * Owns the `runResourceQuery` flow: resolve resource + credential + query
 * type/shape, create the query run, dispatch the query plan execution
 * (direct-db live or dry-run contract preview), persist the terminal run, and
 * write the resource-query audit event. Credential / auth-adapter resolution
 * is delegated to the connection-shared service; preview / planned-calls /
 * live-prerequisites shaping lives in `resource-control-query-preview.utils`.
 * Extracted from `ResourceControlService`. Behavior preserved verbatim.
 */
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditEventService } from '../audit-event';
import { ResourceControlRepository } from './resource-control.repository';
import { ResourceControlBindingService } from './resource-control-binding.service';
import { ResourceControlConnectionSharedService } from './resource-control-connection-shared.service';
import { ResolvedCredentialRef } from './credentials/credential-resolver';
import { DirectDbQueryExecutor } from './executors/direct-db-query.executor';
import { queryRunInclude } from './resource-control-includes.constants';
import { RunResourceQueryDto } from './dto/resource-control.dto';
import { asString } from './resource-control-value.utils';
import {
  normalizeResourceQuery,
  resolveQueryExecutionShape,
  resolveQueryType,
  toJsonValue,
} from './resource-control-query-type.utils';
import {
  canExecuteDirectDbLiveQuery,
  isLiveQueryConfirmed,
  queryResultContract,
  validateReadOnlyQuery,
} from './resource-control-query-validation.utils';
import {
  buildConnectionTarget,
} from './resource-control-connection-probe.utils';
import {
  buildResourceQueryResultPreview,
  livePrerequisitesForQuery,
  nextQueryExecutorBoundary,
  plannedCallsForQuery,
} from './resource-control-query-preview.utils';

type ManagedResourceForConnection = {
  id: string; sourceType: string; provider: string; kind: string; name: string;
  externalId: string; status: string; endpoint: string | null;
  projectId: string | null; environmentId: string | null; serverId: string | null;
  credentialId: string | null; config: Prisma.JsonValue | null; metadata: Prisma.JsonValue | null;
};

type ResourceQueryExecutionResult = {
  status: 'completed' | 'failed' | 'blocked' | 'cancelled';
  executorKey: string; adapterKey: string; authAdapterKey: string;
  queryPlan?: Prisma.InputJsonValue; result?: Prisma.InputJsonValue; error?: string;
};

@Injectable()
export class ResourceControlResourceQueryService {
  constructor(
    private readonly repo: ResourceControlRepository,
    private readonly binding: ResourceControlBindingService,
    private readonly connectionShared: ResourceControlConnectionSharedService,
    private readonly directDbQueryExecutor: DirectDbQueryExecutor,
    private readonly auditEventService: AuditEventService,
  ) {}

  async runResourceQuery(teamId: string, userId: string, resourceId: string, dto: RunResourceQueryDto) {
    const resource = await this.binding.getManagedResource(teamId, resourceId);
    const action = this.connectionShared.buildConnectionProbeAction(resource);
    const credential = await this.connectionShared.resolveResourceQueryCredential(teamId, resource, action);
    const dryRun = dto.dryRun ?? true;
    const params = dto.params || {};
    const queryType = resolveQueryType(resource, dto.queryType);
    const query = normalizeResourceQuery(resource, queryType, dto.query, params, asString);
    const authAdapterKey = this.connectionShared.resolveAuthAdapterKey(resource, credential);
    const executionShape = resolveQueryExecutionShape(resource);
    const runCredentialId = this.connectionShared.resolveQueryRunCredentialId(resource, credential);

    const run = await this.repo.createQueryRun({
      data: {
        teamId, actorId: userId, resourceId: resource.id, credentialId: runCredentialId,
        projectId: resource.projectId, environmentId: resource.environmentId, serverId: resource.serverId,
        sourceType: resource.sourceType, provider: resource.provider, kind: resource.kind,
        queryType, query, authAdapterKey, executorKey: executionShape.executorKey,
        adapterKey: executionShape.adapterKey, dryRun, status: 'running', params: toJsonValue(params),
      },
    });

    try {
      const execution = await this.executeResourceQueryPlan(teamId, resource, credential, run.id, {
        dryRun, params, query, queryType, authAdapterKey,
      });
      const completed = await this.repo.updateQueryRun({
        where: { id: run.id },
        data: {
          status: execution.status, executorKey: execution.executorKey, adapterKey: execution.adapterKey,
          authAdapterKey: execution.authAdapterKey, queryPlan: execution.queryPlan,
          result: execution.result, error: execution.error, finishedAt: new Date(),
        },
        include: queryRunInclude,
      });
      await this.writeResourceQueryAudit(teamId, userId, resource, completed);
      return completed;
    } catch (error) {
      const failed = await this.repo.updateQueryRun({
        where: { id: run.id },
        data: { status: 'failed', error: error instanceof Error ? error.message : '资源查询计划生成失败', finishedAt: new Date() },
        include: queryRunInclude,
      });
      await this.writeResourceQueryAudit(teamId, userId, resource, failed);
      return failed;
    }
  }

  private async executeResourceQueryPlan(
    teamId: string, resource: ManagedResourceForConnection, credential: ResolvedCredentialRef, runId: string,
    options: { dryRun: boolean; params: Record<string, unknown>; query: string; queryType: string; authAdapterKey: string },
  ): Promise<ResourceQueryExecutionResult> {
    const shape = resolveQueryExecutionShape(resource);
    const validation = validateReadOnlyQuery(options.queryType, options.query);
    const missingCredential = resource.sourceType === 'cloud' && credential.source !== 'team_credential';
    const directDbLiveQuery = canExecuteDirectDbLiveQuery(resource, credential, options.queryType);
    const liveMissingConfirmation = !options.dryRun && directDbLiveQuery && !isLiveQueryConfirmed(options.params);
    const liveUnsupported = !options.dryRun && !directDbLiveQuery;
    const plannedCalls = plannedCallsForQuery(resource, options.queryType, options.query, options.params);
    const resultContract = queryResultContract(options.queryType);
    const livePrerequisites = livePrerequisitesForQuery(resource, credential, shape.adapterKey, validation, !options.dryRun && directDbLiveQuery);
    const preview = buildResourceQueryResultPreview(resource, options.queryType, options.query, options.params, resultContract);
    const warnings = [
      ...(!validation.ok ? [validation.reason] : []),
      ...(missingCredential ? ['resource has no TeamCredential binding'] : []),
      ...(liveUnsupported ? ['live resource query execution only supports direct DB MySQL/Redis adapters'] : []),
      ...(liveMissingConfirmation ? ['live resource query requires params.confirmLiveRead=true'] : []),
    ];
    const executable = warnings.length === 0;
    const status = executable ? 'completed' : 'blocked';
    const error = warnings.join('；') || undefined;
    const queryPlan = toJsonValue({
      executorKey: shape.executorKey, adapterKey: shape.adapterKey, operationKey: 'resource.query.readonly',
      dryRun: options.dryRun, executable, target: buildConnectionTarget(resource),
      auth: { adapterKey: options.authAdapterKey, credential },
      query: { type: options.queryType, text: options.query, readOnly: validation.ok, params: options.params },
      safety: {
        readOnlyOnly: true, arbitraryShell: false, secretsInOutput: 'must_mask_before_persisting',
        liveExecutionDefault: directDbLiveQuery ? 'requires_explicit_confirmLiveRead' : 'blocked_until_driver_adapter_ready',
        adapterBoundary: shape.executorKey,
      },
      warnings, metadata: { resourceQueryRunId: runId, nextExecutorBoundary: nextQueryExecutorBoundary(shape.adapterKey) },
      plannedCalls, resultContract, livePrerequisites,
    });

    if (!options.dryRun && executable && directDbLiveQuery) {
      const liveExecution = await this.directDbQueryExecutor.execute({
        teamId, resource, credential, queryType: options.queryType, query: options.query,
        params: options.params, contract: resultContract, adapterKey: shape.adapterKey,
        authAdapterKey: options.authAdapterKey, runId,
      });
      return {
        status: liveExecution.status, executorKey: shape.executorKey, adapterKey: shape.adapterKey,
        authAdapterKey: options.authAdapterKey, queryPlan, result: liveExecution.result, error: liveExecution.error,
      };
    }

    return {
      status, executorKey: shape.executorKey, adapterKey: shape.adapterKey, authAdapterKey: options.authAdapterKey,
      queryPlan,
      result: toJsonValue({
        mode: options.dryRun ? 'resource_query_plan' : 'blocked_live_transport', executed: false,
        executorKey: shape.executorKey, adapterKey: shape.adapterKey, authAdapterKey: options.authAdapterKey,
        adapterState: {
          current: options.dryRun ? 'dry_run_contract_preview' : 'blocked_live_transport',
          executable: executable && options.dryRun, nextExecutorBoundary: nextQueryExecutorBoundary(shape.adapterKey),
        },
        preview, livePrerequisites, warnings,
      }),
      error,
    };
  }

  private async writeResourceQueryAudit(
    teamId: string, userId: string,
    resource: { id: string; name: string; projectId: string | null; environmentId: string | null; serverId: string | null; sourceType: string; provider: string; kind: string; endpoint: string | null },
    queryRun: { id: string; status: string; dryRun: boolean; queryType: string; executorKey: string; adapterKey: string; authAdapterKey: string; error: string | null },
  ) {
    await this.auditEventService.create({
      teamId, actorId: userId, projectId: resource.projectId, environmentId: resource.environmentId,
      serverId: resource.serverId, managedResourceId: resource.id, resourceQueryRunId: queryRun.id,
      category: 'resource_query', action: 'resource.query.readonly',
      targetType: 'managed_resource', targetId: resource.id, risk: 'low', status: queryRun.status,
      summary: `资源只读查询 ${resource.name} ${queryRun.status}`,
      metadata: {
        dryRun: queryRun.dryRun, queryType: queryRun.queryType, sourceType: resource.sourceType,
        provider: resource.provider, kind: resource.kind, endpoint: resource.endpoint, resourceName: resource.name,
        executorKey: queryRun.executorKey, adapterKey: queryRun.adapterKey,
        authAdapterKey: queryRun.authAdapterKey, error: queryRun.error,
      },
    });
  }
}
