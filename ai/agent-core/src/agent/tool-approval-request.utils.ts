import type { ToolCall } from '../tool/types';
import { redactPublicArguments, redactSecretRecord, redactSecrets } from './secret-redactor.utils';
import { canonicalSessionId } from './session-id';
import { validateSessionScopeKey } from '../permission/session-scope';
import type { ToolApprovalDecision, ToolApprovalRequest } from './tool-approval.types';

const MAX_DEPTH = 6;
const MAX_ENTRIES = 50;
const MAX_TEXT = 4_096;
export function createToolApprovalRequest(input: {
  call: ToolCall;
  sessionId?: string;
  createdAt: number;
  reason?: string;
  metadata?: Record<string, unknown>;
  sessionScopeKey?: string;
}): ToolApprovalRequest {
  const sessionId = canonicalSessionId(input.sessionId);
  const sessionScopeKey = validateSessionScopeKey(input.sessionScopeKey);
  const decisions: ToolApprovalDecision[] = sessionScopeKey
    ? ['accept', 'acceptForSession', 'decline', 'cancel']
    : ['accept', 'decline', 'cancel'];
  const metadata = input.metadata
    ? boundRecord(redactSecretRecord(input.metadata))
    : undefined;
  return {
    requestId: `approval:${input.call.id}:${input.createdAt}`,
    sessionId,
    itemId: input.call.id,
    createdAt: input.createdAt,
    toolName: boundText(input.call.name),
    arguments: boundRecord(redactPublicArguments(input.call.arguments ?? {})),
    ...(input.reason ? { reason: boundText(redactSecrets(input.reason)) } : {}),
    ...(metadata && Object.keys(metadata).length > 0 ? { metadata } : {}),
    decisions,
    ...(sessionScopeKey ? { sessionScopeKey } : {}),
  };
}

function boundRecord(value: Record<string, unknown>): Record<string, unknown> {
  return boundUnknown(value, 0) as Record<string, unknown>;
}

function boundUnknown(value: unknown, depth: number): unknown {
  if (typeof value === 'string') return boundText(value);
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
    .map(([key, item]) => [boundText(key, 256), boundUnknown(item, depth + 1)]));
}

function boundText(value: string, max = MAX_TEXT): string {
  return value.length <= max ? value : `${value.slice(0, max - 12)}[truncated]`;
}
