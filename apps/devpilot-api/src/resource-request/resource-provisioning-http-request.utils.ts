/**
 * HTTP / external-adapter provisioning *request* helpers.
 *
 * Pure functions extracted from `resource-provisioning-http.utils.ts` so each
 * file stays under the 200-line ceiling. Builds the outbound HTTP headers and
 * the external adapter payload, parses the HTTP response body, and resolves
 * the delivery source from a successful response. No behavior change.
 */

import {
  HttpProvisioningResponse,
  JsonRecord,
  ProvisioningCredentialRef,
  ProvisioningMode,
  ProvisioningResourceType,
} from './resource-request.types';
import {
  asRecord,
  hasRecordValues,
  readStringMap,
  truncateText,
} from './resource-provisioning-value.utils';
import { exposeCredentialRef } from './resource-provisioning-http-config.utils';

export function buildHttpProvisioningHeaders(
  config: JsonRecord,
  idempotencyKey: string,
  credentialRef: ProvisioningCredentialRef | null,
) {
  const headers = {
    ...readStringMap(config.headers),
  };
  const hasContentType = Object.keys(headers).some((key) => key.toLowerCase() === 'content-type');

  if (!hasContentType) {
    headers['content-type'] = 'application/json';
  }

  headers['idempotency-key'] = idempotencyKey;
  headers['x-devpilot-idempotency-key'] = idempotencyKey;

  if (credentialRef && exposeCredentialRef(config)) {
    headers['x-devpilot-credential-id'] = credentialRef.referenceId;
    headers['x-devpilot-credential-type'] = credentialRef.credentialType;
    headers['x-devpilot-auth-adapter'] = credentialRef.authAdapterKey;
  }

  return headers;
}

export function buildExternalProvisioningPayload(
  request: JsonRecord,
  resourceType: ProvisioningResourceType,
  mode: Extract<ProvisioningMode, 'webhook' | 'api'>,
  credentialRef: ProvisioningCredentialRef | null,
  idempotencyKey: string,
) {
  const project = asRecord(request.project);
  const projectEnvironment = asRecord(request.projectEnvironment);

  return {
    mode,
    resourceType: {
      id: resourceType.id,
      key: resourceType.key,
      name: resourceType.name,
    },
    request: {
      id: request.id,
      title: request.title,
      purpose: request.purpose,
      projectId: request.projectId,
      environmentId: request.environmentId,
      environment: request.environment,
      spec: asRecord(request.spec),
    },
    adapter: {
      boundary: 'http_adapter',
      idempotencyKey,
      credentialRef: credentialRef || undefined,
    },
    project: hasRecordValues(project)
      ? { id: project.id, name: project.name }
      : undefined,
    projectEnvironment: hasRecordValues(projectEnvironment)
      ? {
        id: projectEnvironment.id,
        key: projectEnvironment.key,
        name: projectEnvironment.name,
        status: projectEnvironment.status,
      }
      : undefined,
  };
}

export async function readHttpProvisioningBody(response: HttpProvisioningResponse) {
  const contentType = response.headers?.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (_error) {
    return { message: truncateText(text) };
  }
}

export function resolveHttpProvisioningDeliverySource(response: JsonRecord) {
  const delivery = asRecord(response.delivery);
  const credentials = asRecord(response.credentials);

  if (hasRecordValues(delivery) || hasRecordValues(credentials)) {
    return {
      ...delivery,
      ...credentials,
    };
  }

  const resource = asRecord(response.resource);
  if (hasRecordValues(resource)) {
    return resource;
  }

  const instance = asRecord(response.instance);
  if (hasRecordValues(instance)) {
    return instance;
  }

  return {};
}
