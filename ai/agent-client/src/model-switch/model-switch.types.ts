export interface ModelKey {
  readonly providerId: string;
  readonly modelId: string;
}

export type ModelSwitchPhase =
  | 'idle'
  | 'preparing'
  | 'committing'
  | 'succeeded'
  | 'failed';

export interface ModelSwitchRequest {
  requestId: string;
  sessionId: string | null;
  from: ModelKey;
  to: ModelKey;
  reasoningEffort?: ReasoningEffort;
  persistence: 'session' | 'default-and-session';
}

export type ModelSwitchResult =
  | {
      kind: 'succeeded';
      requestId: string;
      active: ModelKey;
      persisted: ModelKey;
    }
  | {
      kind: 'failed';
      requestId: string;
      active: ModelKey;
      persisted: ModelKey;
      message: string;
      code: 'blocked' | 'prepare' | 'commit' | 'persistence';
      activeDefaultSplit: boolean;
    }
  | {
      kind: 'superseded';
      requestId: string;
      active: ModelKey;
      persisted: ModelKey;
    };

export function encodeModelKey(key: ModelKey): string {
  return JSON.stringify({
    providerId: key.providerId,
    modelId: key.modelId,
  });
}

export function decodeModelKey(value: string | null | undefined): ModelKey | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const candidate = parsed as Record<string, unknown>;
    if (
      typeof candidate.providerId !== 'string'
      || typeof candidate.modelId !== 'string'
      || !candidate.providerId
      || !candidate.modelId
    ) return null;
    return {
      providerId: candidate.providerId,
      modelId: candidate.modelId,
    };
  } catch {
    return null;
  }
}

export function modelKeysEqual(left: ModelKey | null, right: ModelKey | null): boolean {
  return left?.providerId === right?.providerId && left?.modelId === right?.modelId;
}
import type { ReasoningEffort } from '@svton/agent-core';
