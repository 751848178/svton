import { redactPublicArguments, redactSecretRecord } from '@svton/agent-core';
import { boundTimelineText } from './bounds';

const MAX_DEPTH = 6;
const MAX_ENTRIES = 50;

export function sanitizeApprovalArguments(
  value: Record<string, unknown>,
): Record<string, unknown> {
  return boundRecord(redactPublicArguments(value));
}

export function sanitizeApprovalMetadata(
  value: Record<string, unknown>,
): Record<string, unknown> {
  return boundRecord(redactSecretRecord(value));
}

function boundRecord(value: Record<string, unknown>): Record<string, unknown> {
  return boundUnknown(value, 0) as Record<string, unknown>;
}

function boundUnknown(value: unknown, depth: number): unknown {
  if (typeof value === 'string') return boundTimelineText(value);
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value !== 'object') return null;
  if (depth >= MAX_DEPTH) return '[truncated]';
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ENTRIES).map((item) => boundUnknown(item, depth + 1));
  }
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .slice(0, MAX_ENTRIES)
    .map(([key, item]) => [boundTimelineText(key, 256), boundUnknown(item, depth + 1)]));
}
