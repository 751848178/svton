import type { HookManager } from '../hooks/manager';
import type { ToolCall, ToolResult } from '../tool/types';

export interface PreToolUseHookOutcome {
  deniedResult: ToolResult | null;
  toolCall: ToolCall;
}

export async function runPreToolUseHook(
  hookManager: HookManager | null,
  call: ToolCall,
): Promise<PreToolUseHookOutcome> {
  if (!hookManager) return { deniedResult: null, toolCall: call };

  const hookContext = {
    event: 'pre_tool_use',
    toolName: call.name,
    toolCall: call,
  };
  const hookResult = await hookManager.trigger('pre_tool_use', hookContext);
  const toolCall = normalizeModifiedToolCall(hookContext.toolCall, call);

  if (hookResult.action !== 'deny') return { deniedResult: null, toolCall };
  const deniedResult = {
    callId: call.id,
    output: `Tool call denied by hook: ${hookResult.reason || 'no reason given'}`,
    isError: true,
  };
  return { deniedResult, toolCall };
}

export async function runPostToolUseHook(
  hookManager: HookManager | null,
  call: ToolCall,
  result: ToolResult,
): Promise<void> {
  if (!hookManager) return;

  await hookManager.trigger('post_tool_use', {
    event: 'post_tool_use',
    toolName: call.name,
    toolCall: call,
    toolResult: result,
  });
}

function normalizeModifiedToolCall(value: unknown, original: ToolCall): ToolCall {
  if (!value || typeof value !== 'object') return original;
  const candidate = value as Partial<ToolCall>;
  return {
    id: original.id,
    name: typeof candidate.name === 'string' ? candidate.name : original.name,
    arguments: isRecord(candidate.arguments) ? candidate.arguments : original.arguments,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
