import type { ToolDefinition, ToolCall, ToolResult, ToolContext, IToolExecutor } from '../types';
import { formatComputerUseErrorMessage } from './computer-use-error.utils';
import { computerInvoke } from './computer-use-invoke';
import { validateKeyboardPressInput } from './computer-use-validation.utils';

export const keyboardTypeDef: ToolDefinition = {
  name: 'keyboard_type',
  description: 'Type a string of text using the keyboard. For special keys, use keyboard_press_key instead.',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Text to type' },
    },
    required: ['text'],
  },
  annotations: { destructiveHint: true, openWorldHint: true },
};

export class KeyboardTypeExecutor implements IToolExecutor {
  async execute(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
    const { text } = call.arguments as any;
    if (!text || typeof text !== 'string') {
      return {
        callId: call.id,
        output: 'Error: "text" is required and must be a string.',
        isError: true,
      };
    }

    try {
      await computerInvoke(ctx, 'keyboard_type_text', { text });
      return {
        callId: call.id,
        output: `Typed ${text.length} characters.`,
        metadata: { textLength: text.length, truncated: text.length > 50 },
      };
    } catch (err: unknown) {
      return {
        callId: call.id,
        output: `Keyboard type failed: ${formatComputerUseErrorMessage(err)}`,
        isError: true,
        metadata: { textLength: text.length, truncated: text.length > 50 },
      };
    }
  }
}

export const keyboardPressKeyDef: ToolDefinition = {
  name: 'keyboard_press_key',
  description:
    'Press a special key, optionally with modifier keys (Ctrl, Alt, Shift, Meta/Cmd). Supported keys: enter, tab, escape, backspace, delete, up, down, left, right, home, end, pageup, pagedown, space, f1-f12.',
  parameters: {
    type: 'object',
    properties: {
      key: {
        type: 'string',
        description: 'Key name (e.g. "enter", "tab", "escape", "c", "a")',
      },
      modifiers: {
        type: 'array',
        items: { type: 'string' },
        description: 'Modifier keys: "ctrl", "alt", "shift", "meta" (or "cmd"). Example: ["ctrl", "shift"]',
      },
    },
    required: ['key'],
  },
  annotations: { destructiveHint: true, openWorldHint: true },
};

export class KeyboardPressKeyExecutor implements IToolExecutor {
  async execute(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
    const { key, modifiers } = call.arguments as any;
    const validation = validateKeyboardPressInput(key, modifiers);
    if ('error' in validation) {
      return { callId: call.id, output: validation.error, isError: true };
    }

    try {
      await computerInvoke(ctx, 'keyboard_press_key', {
        key: validation.key,
        modifiers: validation.modifiers,
      });
      const modStr = validation.modifiers.length ? `${validation.modifiers.join('+')}+` : '';
      return {
        callId: call.id,
        output: `Pressed: ${modStr}${validation.key}`,
        metadata: { key: validation.key, modifiers: validation.modifiers },
      };
    } catch (err: unknown) {
      return {
        callId: call.id,
        output: `Key press failed: ${formatComputerUseErrorMessage(err)}`,
        isError: true,
        metadata: { key: validation.key, modifiers: validation.modifiers },
      };
    }
  }
}
