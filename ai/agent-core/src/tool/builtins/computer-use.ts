/**
 * Computer Use tools: screenshot capture, mouse, keyboard, and scroll input simulation.
 *
 * These tools enable the agent to see and interact with the user's screen.
 * Backend is implemented as Tauri commands (Rust side).
 */

import type { ToolDefinition, ToolCall, ToolResult, ToolContext, IToolExecutor } from '../types';

// ── Screenshot ──────────────────────────────────────────────

export const screenshotDef: ToolDefinition = {
  name: 'screenshot',
  description:
    'Capture a screenshot of the current display. Returns a base64-encoded PNG image. Use this to see what is on the screen before interacting with it.',
  parameters: {
    type: 'object',
    properties: {
      display: {
        type: 'number',
        description: 'Display index (0 = primary). Defaults to 0.',
      },
    },
  },
  annotations: {
    readOnlyHint: true,
    openWorldHint: false,
  },
};

export class ScreenshotExecutor implements IToolExecutor {
  async execute(call: ToolCall, _ctx: ToolContext): Promise<ToolResult> {
    try {
      const api = await import('@tauri-apps/api/core' as string);
      const invoke = (api as any).invoke;
      const displayIndex = (call.arguments as any).display ?? 0;
      const base64 = await invoke('screenshot_display', { displayIndex });
      return {
        callId: call.id,
        output: JSON.stringify({
          type: 'image',
          data: base64,
          mimeType: 'image/jpeg',
        }),
      };
    } catch (err: any) {
      return {
        callId: call.id,
        output: `Screenshot failed: ${err.message || err}`,
        isError: true,
      };
    }
  }
}

// ── Mouse Click ─────────────────────────────────────────────

export const mouseClickDef: ToolDefinition = {
  name: 'mouse_click',
  description:
    'Click the mouse at the specified screen coordinates. Use "left", "right", or "middle" for the button.',
  parameters: {
    type: 'object',
    properties: {
      x: { type: 'number', description: 'X coordinate (pixels)' },
      y: { type: 'number', description: 'Y coordinate (pixels)' },
      button: {
        type: 'string',
        description: 'Mouse button: "left" (default), "right", "middle"',
        enum: ['left', 'right', 'middle'],
      },
    },
    required: ['x', 'y'],
  },
  annotations: {
    destructiveHint: true,
    openWorldHint: true,
  },
};

export class MouseClickExecutor implements IToolExecutor {
  async execute(call: ToolCall, _ctx: ToolContext): Promise<ToolResult> {
    try {
      const api = await import('@tauri-apps/api/core' as string);
      const invoke = (api as any).invoke;
      const { x, y, button } = call.arguments as any;
      await invoke('mouse_click', { x, y, button: button || 'left' });
      return { callId: call.id, output: `Clicked ${button || 'left'} at (${x}, ${y})` };
    } catch (err: any) {
      return { callId: call.id, output: `Mouse click failed: ${err.message || err}`, isError: true };
    }
  }
}

// ── Mouse Double Click ──────────────────────────────────────

export const mouseDoubleClickDef: ToolDefinition = {
  name: 'mouse_double_click',
  description:
    'Double-click the mouse at the specified screen coordinates. Useful for opening files, selecting words, etc.',
  parameters: {
    type: 'object',
    properties: {
      x: { type: 'number', description: 'X coordinate (pixels)' },
      y: { type: 'number', description: 'Y coordinate (pixels)' },
      button: {
        type: 'string',
        description: 'Mouse button: "left" (default), "right", "middle"',
        enum: ['left', 'right', 'middle'],
      },
    },
    required: ['x', 'y'],
  },
  annotations: {
    destructiveHint: true,
    openWorldHint: true,
  },
};

export class MouseDoubleClickExecutor implements IToolExecutor {
  async execute(call: ToolCall, _ctx: ToolContext): Promise<ToolResult> {
    try {
      const api = await import('@tauri-apps/api/core' as string);
      const invoke = (api as any).invoke;
      const { x, y, button } = call.arguments as any;
      await invoke('mouse_double_click', { x, y, button: button || 'left' });
      return { callId: call.id, output: `Double-clicked ${button || 'left'} at (${x}, ${y})` };
    } catch (err: any) {
      return { callId: call.id, output: `Double click failed: ${err.message || err}`, isError: true };
    }
  }
}

// ── Mouse Move ──────────────────────────────────────────────

export const mouseMoveDef: ToolDefinition = {
  name: 'mouse_move',
  description: 'Move the mouse cursor to the specified screen coordinates without clicking.',
  parameters: {
    type: 'object',
    properties: {
      x: { type: 'number', description: 'X coordinate (pixels)' },
      y: { type: 'number', description: 'Y coordinate (pixels)' },
    },
    required: ['x', 'y'],
  },
  annotations: {
    destructiveHint: false,
    openWorldHint: true,
  },
};

export class MouseMoveExecutor implements IToolExecutor {
  async execute(call: ToolCall, _ctx: ToolContext): Promise<ToolResult> {
    try {
      const api = await import('@tauri-apps/api/core' as string);
      const invoke = (api as any).invoke;
      const { x, y } = call.arguments as any;
      await invoke('mouse_move', { x, y });
      return { callId: call.id, output: `Moved mouse to (${x}, ${y})` };
    } catch (err: any) {
      return { callId: call.id, output: `Mouse move failed: ${err.message || err}`, isError: true };
    }
  }
}

// ── Mouse Down ──────────────────────────────────────────────

export const mouseDownDef: ToolDefinition = {
  name: 'mouse_down',
  description: 'Press and hold the mouse button at the specified coordinates. Pair with mouse_up for drag selection or long press.',
  parameters: {
    type: 'object',
    properties: {
      x: { type: 'number', description: 'X coordinate (pixels)' },
      y: { type: 'number', description: 'Y coordinate (pixels)' },
      button: {
        type: 'string',
        description: 'Mouse button: "left" (default), "right", "middle"',
        enum: ['left', 'right', 'middle'],
      },
    },
    required: ['x', 'y'],
  },
  annotations: {
    destructiveHint: true,
    openWorldHint: true,
  },
};

export class MouseDownExecutor implements IToolExecutor {
  async execute(call: ToolCall, _ctx: ToolContext): Promise<ToolResult> {
    try {
      const api = await import('@tauri-apps/api/core' as string);
      const invoke = (api as any).invoke;
      const { x, y, button } = call.arguments as any;
      await invoke('mouse_down', { x, y, button: button || 'left' });
      return { callId: call.id, output: `Pressed ${button || 'left'} at (${x}, ${y})` };
    } catch (err: any) {
      return { callId: call.id, output: `Mouse down failed: ${err.message || err}`, isError: true };
    }
  }
}

// ── Mouse Up ────────────────────────────────────────────────

export const mouseUpDef: ToolDefinition = {
  name: 'mouse_up',
  description: 'Release the mouse button at the specified coordinates. Pair with mouse_down for drag selection or long press.',
  parameters: {
    type: 'object',
    properties: {
      x: { type: 'number', description: 'X coordinate (pixels)' },
      y: { type: 'number', description: 'Y coordinate (pixels)' },
      button: {
        type: 'string',
        description: 'Mouse button: "left" (default), "right", "middle"',
        enum: ['left', 'right', 'middle'],
      },
    },
    required: ['x', 'y'],
  },
  annotations: {
    destructiveHint: true,
    openWorldHint: true,
  },
};

export class MouseUpExecutor implements IToolExecutor {
  async execute(call: ToolCall, _ctx: ToolContext): Promise<ToolResult> {
    try {
      const api = await import('@tauri-apps/api/core' as string);
      const invoke = (api as any).invoke;
      const { x, y, button } = call.arguments as any;
      await invoke('mouse_up', { x, y, button: button || 'left' });
      return { callId: call.id, output: `Released ${button || 'left'} at (${x}, ${y})` };
    } catch (err: any) {
      return { callId: call.id, output: `Mouse up failed: ${err.message || err}`, isError: true };
    }
  }
}

// ── Mouse Drag ──────────────────────────────────────────────

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
      button: {
        type: 'string',
        description: 'Mouse button: "left" (default), "right", "middle"',
        enum: ['left', 'right', 'middle'],
      },
    },
    required: ['start_x', 'start_y', 'end_x', 'end_y'],
  },
  annotations: {
    destructiveHint: true,
    openWorldHint: true,
  },
};

export class MouseDragExecutor implements IToolExecutor {
  async execute(call: ToolCall, _ctx: ToolContext): Promise<ToolResult> {
    try {
      const api = await import('@tauri-apps/api/core' as string);
      const invoke = (api as any).invoke;
      const { start_x, start_y, end_x, end_y, button } = call.arguments as any;
      await invoke('mouse_drag', { startX: start_x, startY: start_y, endX: end_x, endY: end_y, button: button || 'left' });
      return { callId: call.id, output: `Dragged from (${start_x}, ${start_y}) to (${end_x}, ${end_y})` };
    } catch (err: any) {
      return { callId: call.id, output: `Mouse drag failed: ${err.message || err}`, isError: true };
    }
  }
}

// ── Scroll ──────────────────────────────────────────────────

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
  annotations: {
    destructiveHint: false,
    openWorldHint: true,
  },
};

export class ScrollExecutor implements IToolExecutor {
  async execute(call: ToolCall, _ctx: ToolContext): Promise<ToolResult> {
    try {
      const api = await import('@tauri-apps/api/core' as string);
      const invoke = (api as any).invoke;
      const { x, y, direction, amount } = call.arguments as any;
      await invoke('scroll', { x, y, direction, amount: amount ?? 3 });
      return { callId: call.id, output: `Scrolled ${direction} by ${amount ?? 3} at (${x}, ${y})` };
    } catch (err: any) {
      return { callId: call.id, output: `Scroll failed: ${err.message || err}`, isError: true };
    }
  }
}

// ── Keyboard Type ───────────────────────────────────────────

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
  annotations: {
    destructiveHint: true,
    openWorldHint: true,
  },
};

export class KeyboardTypeExecutor implements IToolExecutor {
  async execute(call: ToolCall, _ctx: ToolContext): Promise<ToolResult> {
    try {
      const api = await import('@tauri-apps/api/core' as string);
      const invoke = (api as any).invoke;
      const { text } = call.arguments as any;
      await invoke('keyboard_type_text', { text });
      return { callId: call.id, output: `Typed: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"` };
    } catch (err: any) {
      return { callId: call.id, output: `Keyboard type failed: ${err.message || err}`, isError: true };
    }
  }
}

// ── Keyboard Press Key ──────────────────────────────────────

export const keyboardPressKeyDef: ToolDefinition = {
  name: 'keyboard_press_key',
  description: 'Press a special key, optionally with modifier keys (Ctrl, Alt, Shift, Meta/Cmd). Supported keys: enter, tab, escape, backspace, delete, up, down, left, right, home, end, pageup, pagedown, space, f1-f12.',
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
  annotations: {
    destructiveHint: true,
    openWorldHint: true,
  },
};

export class KeyboardPressKeyExecutor implements IToolExecutor {
  async execute(call: ToolCall, _ctx: ToolContext): Promise<ToolResult> {
    try {
      const api = await import('@tauri-apps/api/core' as string);
      const invoke = (api as any).invoke;
      const { key, modifiers } = call.arguments as any;
      await invoke('keyboard_press_key', { key, modifiers: modifiers || [] });
      const modStr = modifiers?.length ? `${modifiers.join('+')}+` : '';
      return { callId: call.id, output: `Pressed: ${modStr}${key}` };
    } catch (err: any) {
      return { callId: call.id, output: `Key press failed: ${err.message || err}`, isError: true };
    }
  }
}
