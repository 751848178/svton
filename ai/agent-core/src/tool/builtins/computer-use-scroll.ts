import type { ToolDefinition, ToolCall, ToolResult, ToolContext, IToolExecutor } from '../types';
import { formatComputerUseErrorMessage } from './computer-use-error.utils';
import { computerInvoke } from './computer-use-invoke';
import { validateScrollInput } from './computer-use-validation.utils';

export const scrollDef: ToolDefinition = {
  name: 'scroll',
  description: 'Scroll at the specified screen position. Supports up/down/left/right directions.',
  parameters: {
    type: 'object',
    properties: {
      x: { type: 'number', description: 'X coordinate (pixels)' },
      y: { type: 'number', description: 'Y coordinate (pixels)' },
      direction: {
        type: 'string',
        description: 'Scroll direction: "up", "down", "left", "right"',
        enum: ['up', 'down', 'left', 'right'],
      },
      amount: {
        type: 'number',
        description: 'Scroll amount (number of ticks). Defaults to 3.',
      },
    },
    required: ['x', 'y', 'direction'],
  },
  annotations: { destructiveHint: false, openWorldHint: true },
};

export class ScrollExecutor implements IToolExecutor {
  async execute(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
    const { x, y, direction, amount } = call.arguments as any;
    const validation = validateScrollInput({ x, y }, direction, amount);
    if ('error' in validation) {
      return { callId: call.id, output: validation.error, isError: true };
    }

    try {
      await computerInvoke(ctx, 'scroll', {
        x,
        y,
        direction: validation.direction,
        amount: validation.amount,
      });
      return {
        callId: call.id,
        output: `Scrolled ${validation.direction} by ${validation.amount} at (${x}, ${y})`,
        metadata: { x, y, direction: validation.direction, amount: validation.amount },
      };
    } catch (err: unknown) {
      return {
        callId: call.id,
        output: `Scroll failed: ${formatComputerUseErrorMessage(err)}`,
        isError: true,
        metadata: { x, y, direction: validation.direction, amount: validation.amount },
      };
    }
  }
}
