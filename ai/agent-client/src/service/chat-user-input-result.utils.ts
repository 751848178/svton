import type { ToolResult } from '@svton/agent-core';

const USER_INPUT_TOOL = 'request_user_input';

export function toSecretSafeDisplayResult(toolName: string, result: ToolResult): ToolResult {
  if (toolName !== USER_INPUT_TOOL) return result;
  return {
    callId: result.callId,
    output: result.isError ? 'Structured user input did not complete.' : 'Structured user input submitted.',
    isError: result.isError,
    metadata: { structuredUserInput: true },
  };
}
