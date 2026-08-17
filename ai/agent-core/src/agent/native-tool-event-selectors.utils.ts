import type { AgentEvent } from '@earendil-works/pi-agent-core';
import type { ToolCall, ToolResult } from '../tool/types';
import {
  redactPublicArguments,
  redactSecretRecord,
  redactSecrets,
} from './secret-redactor.utils';

type ToolStartEvent = Extract<AgentEvent, { type: 'tool_execution_start' }>;
type ToolUpdateEvent = Extract<AgentEvent, { type: 'tool_execution_update' }>;
type ToolEndEvent = Extract<AgentEvent, { type: 'tool_execution_end' }>;

export function selectNativeToolCall(event: ToolStartEvent): ToolCall {
  return {
    id: event.toolCallId,
    name: event.toolName,
    arguments: redactPublicArguments(readRecord(event.args) ?? {}),
  };
}

export function selectNativeToolUpdate(event: ToolUpdateEvent): {
  callId: string;
  name?: string;
  arguments: Record<string, unknown>;
  partialResult?: ToolResult;
} {
  const partialResult = readNativeToolResult(event.toolCallId, event.partialResult);
  return {
    callId: event.toolCallId,
    ...(event.toolName ? { name: event.toolName } : {}),
    arguments: redactPublicArguments(readRecord(event.args) ?? {}),
    ...(partialResult ? { partialResult } : {}),
  };
}

export function selectNativeToolResult(event: ToolEndEvent): ToolResult {
  return readNativeToolResult(event.toolCallId, event.result, event.isError) ?? {
    callId: event.toolCallId,
    output: '',
    isError: event.isError,
  };
}

function readNativeToolResult(
  callId: string,
  value: unknown,
  fallbackIsError = false,
): ToolResult | undefined {
  const result = readRecord(value);
  if (!result) return undefined;
  const details = readRecord(result?.details);
  const metadata = readRecord(details?.metadata);
  return {
    callId,
    output: redactSecrets(readToolOutput(result?.content)),
    isError: typeof details?.isError === 'boolean' ? details.isError : fallbackIsError,
    ...(metadata ? { metadata: redactSecretRecord(metadata) } : {}),
  };
}

function readToolOutput(content: unknown): string {
  if (!Array.isArray(content)) return '';
  return content.map(readContentBlock).filter((value) => value.length > 0).join('\n');
}

function readContentBlock(value: unknown): string {
  const block = readRecord(value);
  if (!block) return '';
  if (block.type === 'text' && typeof block.text === 'string') return block.text;
  if (
    block.type === 'image'
    && typeof block.data === 'string'
    && typeof block.mimeType === 'string'
  ) {
    return JSON.stringify({
      type: 'image',
      data: block.data,
      mimeType: block.mimeType,
    });
  }
  return '';
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  return Object.fromEntries(Object.entries(value));
}
