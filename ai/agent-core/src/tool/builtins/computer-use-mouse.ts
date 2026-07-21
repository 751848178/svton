import type { ToolDefinition, ToolCall, ToolResult, ToolContext, IToolExecutor } from '../types';
import { formatComputerUseErrorMessage } from './computer-use-error.utils';
import { computerInvoke } from './computer-use-invoke';
import { mouseDragErrorResult, mouseDragResult, mousePointErrorResult, mousePointResult } from './computer-use-mouse-result.utils';
import { validateMouseInput } from './computer-use-validation.utils';

const buttonProperty = {
  type: 'string',
  description: 'Mouse button: "left" (default), "right", "middle"',
  enum: ['left', 'right', 'middle'],
};

const pointProperties = {
  x: { type: 'number', description: 'X coordinate (pixels)' },
  y: { type: 'number', description: 'Y coordinate (pixels)' },
};

function validationFailure(call: ToolCall, output: string): ToolResult {
  return { callId: call.id, output, isError: true };
}

export const mouseClickDef: ToolDefinition = {
  name: 'mouse_click',
  description: 'Click the mouse at the specified screen coordinates. Use "left", "right", or "middle" for the button.',
  parameters: {
    type: 'object',
    properties: { ...pointProperties, button: buttonProperty },
    required: ['x', 'y'],
  },
  annotations: { destructiveHint: true, openWorldHint: true },
};

export class MouseClickExecutor implements IToolExecutor {
  async execute(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
    const { x, y, button } = call.arguments as any;
    const validation = validateMouseInput({ x, y }, button);
    if ('error' in validation) return validationFailure(call, validation.error);

    try {
      await computerInvoke(ctx, 'mouse_click', { x, y, button: validation.button });
      return mousePointResult(call, `Clicked ${validation.button} at (${x}, ${y})`, x, y, validation.button);
    } catch (err: unknown) {
      return mousePointErrorResult(call, `Mouse click failed: ${formatComputerUseErrorMessage(err)}`, x, y, validation.button);
    }
  }
}

export const mouseDoubleClickDef: ToolDefinition = {
  name: 'mouse_double_click',
  description: 'Double-click the mouse at the specified screen coordinates. Useful for opening files, selecting words, etc.',
  parameters: {
    type: 'object',
    properties: { ...pointProperties, button: buttonProperty },
    required: ['x', 'y'],
  },
  annotations: { destructiveHint: true, openWorldHint: true },
};

export class MouseDoubleClickExecutor implements IToolExecutor {
  async execute(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
    const { x, y, button } = call.arguments as any;
    const validation = validateMouseInput({ x, y }, button);
    if ('error' in validation) return validationFailure(call, validation.error);

    try {
      await computerInvoke(ctx, 'mouse_double_click', { x, y, button: validation.button });
      return mousePointResult(call, `Double-clicked ${validation.button} at (${x}, ${y})`, x, y, validation.button);
    } catch (err: unknown) {
      return mousePointErrorResult(call, `Double click failed: ${formatComputerUseErrorMessage(err)}`, x, y, validation.button);
    }
  }
}

export const mouseMoveDef: ToolDefinition = {
  name: 'mouse_move',
  description: 'Move the mouse cursor to the specified screen coordinates without clicking.',
  parameters: {
    type: 'object',
    properties: pointProperties,
    required: ['x', 'y'],
  },
  annotations: { destructiveHint: false, openWorldHint: true },
};

export class MouseMoveExecutor implements IToolExecutor {
  async execute(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
    const { x, y } = call.arguments as any;
    const validation = validateMouseInput({ x, y }, undefined);
    if ('error' in validation) return validationFailure(call, validation.error);

    try {
      await computerInvoke(ctx, 'mouse_move', { x, y });
      return mousePointResult(call, `Moved mouse to (${x}, ${y})`, x, y);
    } catch (err: unknown) {
      return mousePointErrorResult(call, `Mouse move failed: ${formatComputerUseErrorMessage(err)}`, x, y);
    }
  }
}

export const mouseDownDef: ToolDefinition = {
  name: 'mouse_down',
  description: 'Press and hold the mouse button at the specified coordinates. Pair with mouse_up for drag selection or long press.',
  parameters: {
    type: 'object',
    properties: { ...pointProperties, button: buttonProperty },
    required: ['x', 'y'],
  },
  annotations: { destructiveHint: true, openWorldHint: true },
};

export class MouseDownExecutor implements IToolExecutor {
  async execute(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
    const { x, y, button } = call.arguments as any;
    const validation = validateMouseInput({ x, y }, button);
    if ('error' in validation) return validationFailure(call, validation.error);

    try {
      await computerInvoke(ctx, 'mouse_down', { x, y, button: validation.button });
      return mousePointResult(call, `Pressed ${validation.button} at (${x}, ${y})`, x, y, validation.button);
    } catch (err: unknown) {
      return mousePointErrorResult(call, `Mouse down failed: ${formatComputerUseErrorMessage(err)}`, x, y, validation.button);
    }
  }
}

export const mouseUpDef: ToolDefinition = {
  name: 'mouse_up',
  description: 'Release the mouse button at the specified coordinates. Pair with mouse_down for drag selection or long press.',
  parameters: {
    type: 'object',
    properties: { ...pointProperties, button: buttonProperty },
    required: ['x', 'y'],
  },
  annotations: { destructiveHint: true, openWorldHint: true },
};

export class MouseUpExecutor implements IToolExecutor {
  async execute(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
    const { x, y, button } = call.arguments as any;
    const validation = validateMouseInput({ x, y }, button);
    if ('error' in validation) return validationFailure(call, validation.error);

    try {
      await computerInvoke(ctx, 'mouse_up', { x, y, button: validation.button });
      return mousePointResult(call, `Released ${validation.button} at (${x}, ${y})`, x, y, validation.button);
    } catch (err: unknown) {
      return mousePointErrorResult(call, `Mouse up failed: ${formatComputerUseErrorMessage(err)}`, x, y, validation.button);
    }
  }
}

export const mouseDragDef: ToolDefinition = {
  name: 'mouse_drag',
  description: 'Drag from one screen coordinate to another. Used for moving files, resizing windows, drag-selecting text, etc.',
  parameters: {
    type: 'object',
    properties: {
      start_x: { type: 'number', description: 'Start X coordinate (pixels)' },
      start_y: { type: 'number', description: 'Start Y coordinate (pixels)' },
      end_x: { type: 'number', description: 'End X coordinate (pixels)' },
      end_y: { type: 'number', description: 'End Y coordinate (pixels)' },
      button: buttonProperty,
    },
    required: ['start_x', 'start_y', 'end_x', 'end_y'],
  },
  annotations: { destructiveHint: true, openWorldHint: true },
};

export class MouseDragExecutor implements IToolExecutor {
  async execute(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
    const { start_x, start_y, end_x, end_y, button } = call.arguments as any;
    const validation = validateMouseInput({ start_x, start_y, end_x, end_y }, button);
    if ('error' in validation) return validationFailure(call, validation.error);

    try {
      await computerInvoke(ctx, 'mouse_drag', {
        startX: start_x,
        startY: start_y,
        endX: end_x,
        endY: end_y,
        button: validation.button,
      });
      return mouseDragResult(
        call,
        `Dragged from (${start_x}, ${start_y}) to (${end_x}, ${end_y})`,
        start_x,
        start_y,
        end_x,
        end_y,
        validation.button,
      );
    } catch (err: unknown) {
      return mouseDragErrorResult(call, `Mouse drag failed: ${formatComputerUseErrorMessage(err)}`, start_x, start_y, end_x, end_y, validation.button);
    }
  }
}
