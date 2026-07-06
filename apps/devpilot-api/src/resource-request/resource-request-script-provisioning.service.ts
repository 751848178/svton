/**
 * Script (Server executor) provisioning adapter.
 *
 * Builds server-command steps from the resource-type provisioning config,
 * resolves the Server executor target and credential ref, and dispatches the
 * execution inline or via the queue. Maps the executor outcome back to a
 * provisioning status. Extracted verbatim from the original `provisionWithScript`
 * in `ResourceRequestService`. No behavior change.
 */

import { Injectable } from '@nestjs/common';
import { ResourceRequestStatusWriterService } from './resource-request-status-writer.service';
import { ResourceRequestCredentialRefService } from './resource-request-credential-ref.service';
import { ServerExecutorService } from '../server-executor/server-executor.service';
import {
  ServerCommandStep,
  ServerExecutionInput,
  ServerExecutionResult,
} from '../server-executor/server-executor.types';
import {
  JsonRecord,
  ProvisioningCredentialRef,
  ProvisioningResourceType,
} from './resource-request.types';
import {
  asRecord,
  errorMessage,
  readBoolean,
  readPositiveInteger,
  readString,
  readStringArray,
} from './resource-provisioning-value.utils';
import { buildProvisioningIdempotencyKey } from './resource-provisioning-http-config.utils';
import {
  buildScriptProvisioningSteps,
  mapScriptProvisioningStatus,
  summarizeServerExecution,
} from './resource-provisioning-script.utils';

@Injectable()
export class ResourceRequestScriptProvisioningService {
  constructor(
    private readonly statusWriter: ResourceRequestStatusWriterService,
    private readonly credentialRef: ResourceRequestCredentialRefService,
    private readonly serverExecutor: ServerExecutorService,
  ) {}

  async provisionWithScript(
    teamId: string,
    userId: string,
    request: JsonRecord,
    resourceType: ProvisioningResourceType,
  ) {
    const provisioningConfig = asRecord(resourceType.provisioningConfig);
    const steps: ServerCommandStep[] = buildScriptProvisioningSteps(provisioningConfig);

    if (steps.length === 0) {
      return this.statusWriter.markProvisioningStatus(teamId, userId, request, {
        mode: 'script',
        status: 'blocked',
        boundary: 'server_executor',
        reason: 'missing_script_steps',
        blockedAt: new Date().toISOString(),
      });
    }

    const serverId = readString(provisioningConfig.serverId);
    const target = await this.serverExecutor.resolveTarget(teamId, serverId || null);
    const dryRun = readBoolean(provisioningConfig.dryRun, true);
    const queue = readBoolean(provisioningConfig.queue, false);
    const adapterKey = readString(provisioningConfig.adapterKey) || 'resource-provisioning-script';
    const idempotencyKey = buildProvisioningIdempotencyKey(request, resourceType, 'script', provisioningConfig);
    let credentialRef: ProvisioningCredentialRef | null;

    try {
      credentialRef = await this.credentialRef.resolveProvisioningCredentialRef(teamId, provisioningConfig);
    } catch (error) {
      return this.statusWriter.markProvisioningStatus(teamId, userId, request, {
        mode: 'script',
        status: 'blocked',
        boundary: 'server_executor',
        reason: errorMessage(error),
        idempotencyKey,
        blockedAt: new Date().toISOString(),
      });
    }

    const executionInput: ServerExecutionInput = {
      teamId,
      userId,
      operationKey: readString(provisioningConfig.operationKey) || `resource.provision.${resourceType.key}`,
      adapterKey,
      dryRun,
      target,
      steps,
      warnings: readStringArray(provisioningConfig.warnings),
      metadata: {
        requestId: request.id,
        resourceTypeId: resourceType.id,
        resourceTypeKey: resourceType.key,
        projectId: request.projectId,
        environmentId: request.environmentId,
        provisioningMode: 'script',
        boundary: 'resource_request',
        idempotencyKey,
        credentialRef: credentialRef || undefined,
        businessRunSync: queue ? 'resource_request_provisioning' : undefined,
      },
      blockOnWarnings: !dryRun,
      requiredConfirmationText: readString(provisioningConfig.requiredConfirmationText) || undefined,
      confirmationText: readString(provisioningConfig.confirmationText) || undefined,
    };

    let execution: ServerExecutionResult;
    try {
      execution = queue
        ? await this.serverExecutor.queueExecution(executionInput, {
          maxAttempts: readPositiveInteger(provisioningConfig.maxAttempts),
        })
        : await this.serverExecutor.execute(executionInput);
    } catch (error) {
      return this.statusWriter.markProvisioningStatus(teamId, userId, request, {
        mode: 'script',
        status: 'blocked',
        boundary: 'server_executor',
        reason: errorMessage(error),
        serverId: serverId || undefined,
        dryRun,
        idempotencyKey,
        credentialRef: credentialRef || undefined,
        blockedAt: new Date().toISOString(),
      });
    }

    const provisioningStatus = mapScriptProvisioningStatus(execution, dryRun);
    return this.statusWriter.markProvisioningStatus(teamId, userId, request, {
      mode: 'script',
      status: provisioningStatus,
      boundary: 'server_executor',
      dryRun,
      serverId: serverId || undefined,
      targetTransport: target.transport,
      idempotencyKey,
      credentialRef: credentialRef || undefined,
      requiresManualCompletion: provisioningStatus !== 'completed',
      ...summarizeServerExecution(execution),
      updatedAt: new Date().toISOString(),
    });
  }
}
