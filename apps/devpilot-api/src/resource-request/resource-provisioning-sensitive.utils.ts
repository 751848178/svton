/**
 * Delivery / credential splitting and sensitive-value redaction helpers.
 *
 * Stateless pure functions extracted verbatim from the original
 * `ResourceRequestService` private methods. They drive the boundary between
 * "safe to return" delivery fields and "must be encrypted as credentials"
 * sensitive fields for every provisioning adapter (pool / script / http /
 * provider).
 */

import { JsonRecord } from './resource-request.types';
import { asRecord, hasRecordValues, readString } from './resource-provisioning-value.utils';

export function splitDeliveryAndCredentials(deliveryInput: unknown, schemaInput: unknown) {
  const source = asRecord(deliveryInput);
  const sensitiveKeys = readSensitiveFieldKeys(schemaInput);
  const delivery: JsonRecord = {};
  const credentials: JsonRecord = {};

  for (const [key, value] of Object.entries(source)) {
    if (sensitiveKeys.has(key) || isImplicitSensitiveKey(key)) {
      credentials[key] = value;
    } else {
      delivery[key] = value;
    }
  }

  return { delivery, credentials };
}

export function readSensitiveFieldKeys(schemaInput: unknown) {
  const schema = asRecord(schemaInput);
  const fields = Array.isArray(schema.fields) ? schema.fields : [];
  return fields.reduce<Set<string>>((acc, field) => {
    const fieldRecord = asRecord(field);
    const key = readString(fieldRecord.key);
    if (key && fieldRecord.sensitive === true) {
      acc.add(key);
    }
    return acc;
  }, new Set<string>());
}

export function isImplicitSensitiveKey(key: string) {
  const normalizedKey = key.toLowerCase();
  return (
    normalizedKey.includes('password')
    || normalizedKey.includes('secret')
    || normalizedKey.includes('token')
    || normalizedKey.includes('accesskey')
    || normalizedKey.includes('privatekey')
  );
}

export function redactSensitiveRecord(input: JsonRecord): JsonRecord {
  const output: JsonRecord = {};

  for (const [key, value] of Object.entries(input)) {
    if (isImplicitSensitiveKey(key)) {
      output[key] = 'redacted';
    } else if (Array.isArray(value)) {
      output[key] = value.map((item) => (
        hasRecordValues(asRecord(item))
          ? redactSensitiveRecord(asRecord(item))
          : item
      ));
    } else if (hasRecordValues(asRecord(value))) {
      output[key] = redactSensitiveRecord(asRecord(value));
    } else {
      output[key] = value;
    }
  }

  return output;
}

export function resolveRequestedResourceName(specInput: unknown) {
  const spec = asRecord(specInput);
  return (
    readString(spec.resourceName)
    || readString(spec.database)
    || readString(spec.dbName)
    || readString(spec.name)
    || undefined
  );
}

export function redactUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.username) {
      parsed.username = 'redacted';
    }
    if (parsed.password) {
      parsed.password = 'redacted';
    }
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (isImplicitSensitiveKey(key)) {
        parsed.searchParams.set(key, 'redacted');
      }
    }
    return parsed.toString();
  } catch (_error) {
    const queryIndex = url.indexOf('?');
    return queryIndex >= 0 ? `${url.slice(0, queryIndex)}?...` : url;
  }
}
