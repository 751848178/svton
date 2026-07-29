import type { AgentMessage } from '@earendil-works/pi-agent-core';

export function isAgentMessageArray(value: unknown): value is AgentMessage[] {
  return Array.isArray(value) && value.every(isAgentMessage);
}

function isAgentMessage(value: unknown): value is AgentMessage {
  if (!isRecord(value) || typeof value.role !== 'string') return false;
  switch (value.role) {
    case 'user':
      return isTimestamp(value.timestamp) && (
        typeof value.content === 'string' || isUserContent(value.content)
      );
    case 'assistant':
      return isAssistantMessage(value);
    case 'toolResult':
      return isToolResultMessage(value);
    default:
      return false;
  }
}

function isAssistantMessage(value: Record<string, unknown>): boolean {
  return Array.isArray(value.content)
    && value.content.every(isAssistantContent)
    && typeof value.api === 'string'
    && typeof value.provider === 'string'
    && typeof value.model === 'string'
    && isUsage(value.usage)
    && isStopReason(value.stopReason)
    && isTimestamp(value.timestamp)
    && optionalString(value.responseModel)
    && optionalString(value.responseId)
    && optionalString(value.errorMessage);
}

function isToolResultMessage(value: Record<string, unknown>): boolean {
  return typeof value.toolCallId === 'string'
    && typeof value.toolName === 'string'
    && Array.isArray(value.content)
    && value.content.every(isTextOrImage)
    && typeof value.isError === 'boolean'
    && isTimestamp(value.timestamp)
    && (value.usage === undefined || isUsage(value.usage))
    && (value.addedToolNames === undefined || (
      Array.isArray(value.addedToolNames)
      && value.addedToolNames.every((name) => typeof name === 'string')
    ));
}

function isUserContent(value: unknown): boolean {
  return Array.isArray(value) && value.every(isTextOrImage);
}

function isAssistantContent(value: unknown): boolean {
  if (!isRecord(value) || typeof value.type !== 'string') return false;
  if (value.type === 'text') {
    return typeof value.text === 'string' && optionalString(value.textSignature);
  }
  if (value.type === 'thinking') {
    return typeof value.thinking === 'string'
      && optionalString(value.thinkingSignature)
      && (value.redacted === undefined || typeof value.redacted === 'boolean');
  }
  return value.type === 'toolCall'
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && isRecord(value.arguments)
    && optionalString(value.thoughtSignature);
}

function isTextOrImage(value: unknown): boolean {
  if (!isRecord(value) || typeof value.type !== 'string') return false;
  if (value.type === 'text') {
    return typeof value.text === 'string' && optionalString(value.textSignature);
  }
  return value.type === 'image'
    && typeof value.data === 'string'
    && typeof value.mimeType === 'string';
}

function isUsage(value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value.cost)) return false;
  return numericFields(value, ['input', 'output', 'cacheRead', 'cacheWrite', 'totalTokens'])
    && numericFields(value.cost, ['input', 'output', 'cacheRead', 'cacheWrite', 'total']);
}

function numericFields(value: Record<string, unknown>, fields: string[]): boolean {
  return fields.every((field) => {
    const entry = value[field];
    return typeof entry === 'number' && Number.isFinite(entry);
  });
}

function isStopReason(value: unknown): boolean {
  return value === 'stop'
    || value === 'length'
    || value === 'toolUse'
    || value === 'error'
    || value === 'aborted';
}

function isTimestamp(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}

function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
