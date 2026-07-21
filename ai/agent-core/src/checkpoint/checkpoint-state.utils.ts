import type { SerializedRuntime } from './types';

export function parseSerializedRuntime(raw: string): SerializedRuntime | null {
  try {
    const value = JSON.parse(raw) as unknown;
    return isSerializedRuntime(value) ? value : null;
  } catch {
    return null;
  }
}

function isSerializedRuntime(value: unknown): value is SerializedRuntime {
  if (!isRecord(value)) return false;
  if (!Array.isArray(value.messages)) return false;
  if (typeof value.model !== 'string') return false;
  if (typeof value.updatedAt !== 'number' || !Number.isFinite(value.updatedAt)) {
    return false;
  }
  if (value.reasoningEffort !== undefined && typeof value.reasoningEffort !== 'string') {
    return false;
  }
  return value.planId === undefined || typeof value.planId === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
