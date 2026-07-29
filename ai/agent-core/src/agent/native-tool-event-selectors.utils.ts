import type { AgentEvent } from '@earendil-works/pi-agent-core';
import type { ToolCall, ToolResult } from '../tool/types';

type ToolStartEvent = Extract<AgentEvent, { type: 'tool_execution_start' }>;
type ToolUpdateEvent = Extract<AgentEvent, { type: 'tool_execution_update' }>;
type ToolEndEvent = Extract<AgentEvent, { type: 'tool_execution_end' }>;

export function selectNativeToolCall(event: ToolStartEvent): ToolCall {
  return {
    id: event.toolCallId,
    name: event.toolName,
    arguments: readRecord(event.args) ?? {},
  };
}

export function selectNativeToolUpdate(event: ToolUpdateEvent): {
  callId: string;
  name?: string;
  arguments: Record<string, unknown>;
} {
  return {
    callId: event.toolCallId,
    ...(event.toolName ? { name: event.toolName } : {}),
    arguments: readRecord(event.args) ?? {},
  };
}

export function selectNativeToolResult(event: ToolEndEvent): ToolResult {
  const result = readRecord(event.result);
  const details = readRecord(result?.details);
  const metadata = readRecord(details?.metadata);
  return {
    callId: event.toolCallId,
    output: readToolOutput(result?.content),
    isError: event.isError,
    ...(metadata ? { metadata } : {}),
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
