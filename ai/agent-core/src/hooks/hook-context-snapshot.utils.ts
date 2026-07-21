import type { ToolCall, ToolResult } from '../tool/types';
import type { HookContext } from './types';

export function cloneHookContext(context: HookContext): HookContext {
  const cloned: HookContext = { ...context };
  if (context.toolCall) cloned.toolCall = cloneToolCall(context.toolCall);
  if (context.toolResult) cloned.toolResult = cloneToolResult(context.toolResult);
  return cloned;
}

export function cloneHookUpdates(
  updates: Record<string, unknown>,
): Record<string, unknown> {
  const cloned = { ...updates };
  if (isToolCall(updates.toolCall)) {
    cloned.toolCall = cloneToolCall(updates.toolCall);
  }
  if (isToolResult(updates.toolResult)) {
    cloned.toolResult = cloneToolResult(updates.toolResult);
  }
  return cloned;
}

function cloneToolCall(call: ToolCall): ToolCall {
  return {
    ...call,
    arguments: { ...call.arguments },
  };
}

function cloneToolResult(result: ToolResult): ToolResult {
  const cloned: ToolResult = { ...result };
  if (result.metadata) cloned.metadata = { ...result.metadata };
  return cloned;
}

function isToolCall(value: unknown): value is ToolCall {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    isRecord(value.arguments)
  );
}

function isToolResult(value: unknown): value is ToolResult {
  if (!isRecord(value)) return false;
  return typeof value.callId === 'string' && typeof value.output === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
