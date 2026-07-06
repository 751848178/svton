/**
 * HTTP / external-adapter provisioning *credential / idempotency* helpers.
 *
 * Pure functions split out of the original combined http utils so each file
 * stays under the 200-line ceiling. Resolves credential-ref metadata (without
 * decrypting), the auth-adapter key, the expose-credential-ref flag, and the
 * idempotency key shared across webhook / api / script / provider adapters.
 * Retry / auto-retry / queue helpers live in `resource-provisioning-http-retry.utils`;
 * request headers / payload / body / delivery live in
 * `resource-provisioning-http-request.utils`. No behavior change.
 */

import {
  JsonRecord,
  ProvisioningMode,
  ProvisioningResourceType,
} from './resource-request.types';
import {
  asRecord,
  readBoolean,
  readString,
  readStringArray,
} from './resource-provisioning-value.utils';

export function readCredentialTypeAllowList(config: JsonRecord, auth: JsonRecord) {
  const allowedTypes = [
    ...readStringArray(config.allowedCredentialTypes),
    ...readStringArray(auth.allowedCredentialTypes),
    readString(config.credentialType),
    readString(auth.credentialType),
  ].filter(Boolean);
  return Array.from(new Set(allowedTypes));
}

export function resolveAuthAdapterKey(credentialType: string, auth: JsonRecord) {
  return (
    readString(auth.adapterKey)
    || readString(auth.authAdapterKey)
    || `${credentialType}-credential-ref`
  );
}

export function exposeCredentialRef(config: JsonRecord) {
  const auth = asRecord(config.auth);
  return readBoolean(config.exposeCredentialRef, readBoolean(auth.exposeCredentialRef, true));
}

export function buildProvisioningIdempotencyKey(
  request: JsonRecord,
  resourceType: ProvisioningResourceType,
  mode: ProvisioningMode,
  config: JsonRecord,
) {
  const explicit = readString(config.idempotencyKey);
  if (explicit) {
    return explicit;
  }

  const prefix = readString(config.idempotencyPrefix) || 'resource-request';
  return [
    prefix,
    request.id,
    resourceType.id,
    resourceType.key,
    mode,
  ].filter(Boolean).join(':');
}
