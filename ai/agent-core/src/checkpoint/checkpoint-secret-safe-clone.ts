import type { AgentMessage } from '@earendil-works/pi-agent-core';
import {
  isSensitiveKey,
  redactPublicArguments,
  redactSecrets,
} from '../agent/secret-redactor.utils';

const HUMAN_TEXT_KEYS = new Set([
  'output', 'stdout', 'stderr', 'summary', 'diff', 'progress', 'reason', 'message',
  'command', 'result', 'diagnostic', 'text', 'title', 'error', 'content',
]);

/** Schema-aware checkpoint clone: redacts public text without corrupting opaque provider data. */
export function cloneSecretSafeMessages(messages: AgentMessage[]): AgentMessage[] {
  return messages.map((message) => cloneMessage(message));
}

function cloneMessage(message: AgentMessage): AgentMessage {
  const source = message as unknown as Record<string, unknown>;
  const cloned = cloneJsonValue(source, new WeakSet()) as Record<string, unknown>;
  if (source.metadata !== undefined) cloned.metadata = cloneToolDetails(source.metadata);
  if (source.role === 'user') cloned.content = cloneHumanContent(source.content);
  if (source.role === 'assistant') {
    cloned.content = cloneAssistantContent(source.content);
    if (typeof source.errorMessage === 'string') {
      cloned.errorMessage = redactSecrets(source.errorMessage);
    }
  }
  if (source.role === 'toolResult') {
    cloned.content = cloneHumanContent(source.content);
    if (source.details !== undefined) cloned.details = cloneToolDetails(source.details);
  }
  return cloneJsonValue(cloned, new WeakSet()) as AgentMessage;
}

function cloneAssistantContent(value: unknown): unknown {
  if (!Array.isArray(value)) return cloneHumanContent(value);
  return value.map((block) => {
    const cloned = cloneJsonValue(block, new WeakSet());
    if (!isRecord(block) || !isRecord(cloned)) return cloned;
    if (block.type === 'text' && typeof block.text === 'string') {
      cloned.text = redactSecrets(block.text);
    }
    if (block.type === 'thinking' && typeof block.thinking === 'string') {
      cloned.thinking = redactSecrets(block.thinking);
    }
    if (block.type === 'toolCall' && isRecord(block.arguments)) {
      cloned.arguments = cloneJsonValue(redactPublicArguments(block.arguments), new WeakSet());
    }
    return cloned;
  });
}

function cloneHumanContent(value: unknown): unknown {
  if (typeof value === 'string') return redactSecrets(value);
  if (!Array.isArray(value)) return cloneJsonValue(value, new WeakSet());
  return value.map((block) => {
    const cloned = cloneJsonValue(block, new WeakSet());
    if (isRecord(block) && isRecord(cloned)
      && block.type === 'text' && typeof block.text === 'string') {
      cloned.text = redactSecrets(block.text);
    }
    return cloned;
  });
}

function cloneToolDetails(
  value: unknown,
  key?: string,
  ancestors: WeakSet<object> = new WeakSet(),
): unknown {
  if (key && isSensitiveKey(key)) return '[REDACTED:field]';
  if (typeof value === 'string') {
    return key && HUMAN_TEXT_KEYS.has(key.toLowerCase()) ? redactSecrets(value) : value;
  }
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value !== 'object') return null;
  if (ancestors.has(value)) return '[circular]';
  ancestors.add(value);
  const cloned = Array.isArray(value)
    ? value.map((item) => cloneToolDetails(item, key, ancestors))
    : Object.fromEntries(Object.entries(value as Record<string, unknown>).flatMap(
    ([entryKey, item]) => isUnsupported(item)
      ? []
      : [[entryKey, cloneToolDetails(item, entryKey, ancestors)]],
    ));
  ancestors.delete(value);
  return cloned;
}

function cloneJsonValue(
  value: unknown,
  ancestors: WeakSet<object>,
): unknown {
  if (typeof value === 'string') return value;
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value !== 'object') return null;
  if (ancestors.has(value)) return '[circular]';
  ancestors.add(value);
  const cloned = Array.isArray(value)
    ? value.map((item) => isUnsupported(item)
      ? null
      : cloneJsonValue(item, ancestors))
    : cloneRecord(value as Record<string, unknown>, ancestors);
  ancestors.delete(value);
  return cloned;
}

function cloneRecord(
  value: Record<string, unknown>,
  ancestors: WeakSet<object>,
): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).flatMap(([key, item]) => (
    isUnsupported(item)
      ? []
      : [[key, cloneJsonValue(item, ancestors)]]
  )));
}

function isUnsupported(value: unknown): boolean {
  return value === undefined || typeof value === 'function' || typeof value === 'symbol';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
