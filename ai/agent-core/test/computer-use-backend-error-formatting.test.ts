import { describe, expect, it } from 'vitest';
import {
  MouseClickExecutor,
  MouseDoubleClickExecutor,
  MouseDownExecutor,
  MouseDragExecutor,
  MouseMoveExecutor,
  MouseUpExecutor,
  ScreenshotExecutor,
  ScrollExecutor,
} from '../src/tool/builtins/computer-use';
import { createMockPlatform } from './helpers';
import type { ToolCall, ToolContext } from '../src/tool/types';

type Executor = {
  execute(call: ToolCall, ctx: ToolContext): Promise<{ isError?: boolean; output: string; metadata?: unknown }>;
};

function makeCall(name: string, args: Record<string, unknown>): ToolCall {
  return { id: name, name, arguments: args };
}

function makeThrowingCtx(): ToolContext {
  const platform = createMockPlatform({ capabilities: { computerUse: true } });
  (platform as any).computerUse = {
    invoke: async () => {
      throw { code: 'backend_down' };
    },
  };

  return { platform, sessionId: 'session', workingDir: '/' };
}

describe('computer-use backend error formatting', () => {
  it.each([
    {
      label: 'screenshot',
      executor: new ScreenshotExecutor(),
      name: 'screenshot',
      args: { display: 1 },
      prefix: 'Screenshot failed: Unknown error',
      metadata: { displayIndex: 1, mimeType: 'image/png', dataLength: 0 },
    },
    {
      label: 'scroll',
      executor: new ScrollExecutor(),
      name: 'scroll',
      args: { x: 10, y: 20, direction: 'down', amount: 2 },
      prefix: 'Scroll failed: Unknown error',
      metadata: { x: 10, y: 20, direction: 'down', amount: 2 },
    },
    {
      label: 'mouse click',
      executor: new MouseClickExecutor(),
      name: 'mouse_click',
      args: { x: 10, y: 20 },
      prefix: 'Mouse click failed: Unknown error',
      metadata: { x: 10, y: 20, button: 'left' },
    },
    {
      label: 'mouse double click',
      executor: new MouseDoubleClickExecutor(),
      name: 'mouse_double_click',
      args: { x: 10, y: 20 },
      prefix: 'Double click failed: Unknown error',
      metadata: { x: 10, y: 20, button: 'left' },
    },
    {
      label: 'mouse move',
      executor: new MouseMoveExecutor(),
      name: 'mouse_move',
      args: { x: 10, y: 20 },
      prefix: 'Mouse move failed: Unknown error',
      metadata: { x: 10, y: 20 },
    },
    {
      label: 'mouse down',
      executor: new MouseDownExecutor(),
      name: 'mouse_down',
      args: { x: 10, y: 20 },
      prefix: 'Mouse down failed: Unknown error',
      metadata: { x: 10, y: 20, button: 'left' },
    },
    {
      label: 'mouse up',
      executor: new MouseUpExecutor(),
      name: 'mouse_up',
      args: { x: 10, y: 20 },
      prefix: 'Mouse up failed: Unknown error',
      metadata: { x: 10, y: 20, button: 'left' },
    },
    {
      label: 'mouse drag',
      executor: new MouseDragExecutor(),
      name: 'mouse_drag',
      args: { start_x: 1, start_y: 2, end_x: 3, end_y: 4 },
      prefix: 'Mouse drag failed: Unknown error',
      metadata: { startX: 1, startY: 2, endX: 3, endY: 4, button: 'left' },
    },
  ] satisfies Array<{
    label: string;
    executor: Executor;
    name: string;
    args: Record<string, unknown>;
    prefix: string;
    metadata: Record<string, unknown>;
  }>)('normalizes non-Error $label failures', async ({ executor, name, args, prefix, metadata }) => {
    const result = await executor.execute(makeCall(name, args), makeThrowingCtx());

    expect(result.isError).toBe(true);
    expect(result.output).toContain(prefix);
    expect(result.output).not.toContain('[object Object]');
    expect(result.metadata).toMatchObject(metadata);
  });
});
