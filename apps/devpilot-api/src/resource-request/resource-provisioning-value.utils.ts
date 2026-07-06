/**
 * Pure value-coercion helpers shared across the resource-request feature.
 *
 * These are stateless utilities (no service/DB/config dependencies) extracted
 * verbatim from the original `ResourceRequestService` private methods so that
 * every focused service and the wiring factory can reuse one implementation.
 * No behavior change — identical inputs produce identical outputs.
 */

import { JsonRecord } from './resource-request.types';

export function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as JsonRecord;
}

export function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

export function dateToIso(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  return undefined;
}

export function readBoolean(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }
  return fallback;
}

export function readPositiveInteger(value: unknown) {
  const numberValue =
    typeof value === 'number' ? value : Number.parseInt(readString(value), 10);
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : undefined;
}

export function readListLimit(value: unknown, fallback: number, max: number) {
  const limit = readPositiveInteger(value) || fallback;
  return Math.min(limit, max);
}

export function readNonNegativeInteger(value: unknown) {
  const numberValue =
    typeof value === 'number' ? value : Number.parseInt(readString(value), 10);
  return Number.isInteger(numberValue) && numberValue >= 0 ? numberValue : undefined;
}

export function clampPositiveInteger(value: number, min: number, max: number) {
  return Math.min(Math.max(Math.floor(value), min), max);
}

export function clampNonNegativeInteger(value: number, min: number, max: number) {
  return Math.min(Math.max(Math.floor(value), min), max);
}

export function readStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => readString(item)).filter(Boolean);
}

export function readStringMap(value: unknown) {
  const source = asRecord(value);
  return Object.entries(source).reduce<Record<string, string>>((acc, [key, entry]) => {
    const header = readString(entry);
    if (header) {
      acc[key] = header;
    }
    return acc;
  }, {});
}

export function hasRecordValues(value: JsonRecord) {
  return Object.keys(value).length > 0;
}

export function truncateText(text: string, maxLength = 500) {
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

export function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'provisioning_failed';
}
