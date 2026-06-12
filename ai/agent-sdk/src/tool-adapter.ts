/**
 * Adapts a simple user function into the IToolExecutor interface.
 */

import type { IToolExecutor, ToolCall, ToolContext, ToolResult } from '@svton/agent-core';

export type ToolExecuteFn = (
  args: Record<string, unknown>,
  context: ToolContext,
) => Promise<string>;

export class FunctionToolExecutor implements IToolExecutor {
  constructor(private readonly fn: ToolExecuteFn) {}

  async execute(call: ToolCall, context: ToolContext): Promise<ToolResult> {
    try {
      const output = await this.fn(call.arguments, context);
      return { callId: call.id, output };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { callId: call.id, output: message, isError: true };
    }
  }
}
