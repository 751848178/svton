/**
 * HTTP provisioning success-path response handler.
 *
 * Extracted from `ResourceRequestHttpProvisioningService.applyHttpFetchResult`
 * so the adapter stays under the 200-line ceiling. Given a successful HTTP
 * response, splits delivery/credentials, builds the completed-provisioning
 * block, and returns the inputs needed to complete the request and finish the
 * run. Pure data shaping — no DB writes. No behavior change.
 */

import {
  HttpProvisioningResponse,
  JsonRecord,
  ProvisioningMode,
  ProvisioningProcessorContext,
  ProvisioningResourceType,
  ResourceProvisioningRunRecord,
} from './resource-request.types';
import {
  asRecord,
  hasRecordValues,
  readBoolean,
  readString,
} from './resource-provisioning-value.utils';
import {
  redactUrl,
  resolveRequestedResourceName,
  splitDeliveryAndCredentials,
} from './resource-provisioning-sensitive.utils';
import { resolveHttpProvisioningDeliverySource } from './resource-provisioning-http-request.utils';
import { readHttpMaxAttempts } from './resource-provisioning-http-retry.utils';

export function buildHttpProvisioningCompletion(input: {
  response: HttpProvisioningResponse;
  responseBody: unknown;
  attempt: number;
  request: JsonRecord;
  resourceType: ProvisioningResourceType;
  mode: Extract<ProvisioningMode, 'webhook' | 'api'>;
  context: ProvisioningProcessorContext;
  provisioningRun: ResourceProvisioningRunRecord;
  url: string;
  method: string;
  idempotencyKey: string;
  credentialRef: unknown;
  provisioningConfig: JsonRecord;
}) {
  const { response, responseBody, attempt, request, resourceType, mode, context, provisioningRun } = input;
  const maxAttempts = readHttpMaxAttempts(input.provisioningConfig);
  const responseRecord = asRecord(responseBody);
  const deliverySource = resolveHttpProvisioningDeliverySource(responseRecord);
  const split = splitDeliveryAndCredentials(deliverySource, resourceType.deliverySchema);
  const adapterConfig = asRecord(responseRecord.config);
  const createInstance = readBoolean(
    responseRecord.createInstance,
    readBoolean(input.provisioningConfig.createInstanceOnSuccess, true),
  );
  const shouldCreateInstance = createInstance && (
    hasRecordValues(split.delivery) || hasRecordValues(split.credentials) || hasRecordValues(adapterConfig)
  );
  const providerRunId = readString(responseRecord.providerRunId)
    || readString(responseRecord.runId) || readString(responseRecord.id);
  const completedAt = new Date().toISOString();
  const completedProvisioning = {
    mode, status: 'completed', boundary: 'http_adapter',
    provisioningRunId: provisioningRun.id, replayOfRunId: context.replayOfRunId,
    method: input.method, url: redactUrl(input.url), httpStatus: response.status,
    idempotencyKey: input.idempotencyKey, credentialRef: input.credentialRef || undefined,
    providerRunId: providerRunId || undefined, attempt, maxAttempts,
    responseKeys: Object.keys(responseRecord), deliveryKeys: Object.keys(split.delivery),
    credentialKeys: Object.keys(split.credentials), createInstance: shouldCreateInstance, completedAt,
  };
  const completionInput = {
    createInstance: shouldCreateInstance,
    instanceName: readString(responseRecord.instanceName) || readString(responseRecord.resourceName)
      || resolveRequestedResourceName(request.spec) || (request.title as string),
    config: { ...adapterConfig, provisioningMode: mode, adapter: mode, endpoint: redactUrl(input.url),
      providerRunId: providerRunId || undefined, credentialRef: input.credentialRef || undefined },
    delivery: split.delivery, credentials: split.credentials, provisioning: completedProvisioning,
    auditMetadata: { createInstance: shouldCreateInstance, provisioningMode: mode, boundary: 'http_adapter',
      method: input.method, url: redactUrl(input.url), httpStatus: response.status,
      idempotencyKey: input.idempotencyKey, credentialRef: input.credentialRef || undefined,
      providerRunId: providerRunId || undefined, provisioningRunId: provisioningRun.id, attempt, maxAttempts,
      responseKeys: Object.keys(responseRecord) },
  };
  return { completedProvisioning, completionInput };
}
