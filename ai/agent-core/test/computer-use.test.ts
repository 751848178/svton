/**
 * Computer Use executor tests.
 *
 * After the refactor, all 10 executors route through `ctx.platform.computerUse.invoke`,
 * so tests inject a mock that records the command + args and returns canned values.
 * No real Tauri invoke / screen interaction happens.
 */
import { describe, it, expect } from 'vitest';
import {
  ScreenshotExecutor,
  MouseClickExecutor,
  MouseDoubleClickExecutor,
  MouseMoveExecutor,
  MouseDownExecutor,
  MouseUpExecutor,
  MouseDragExecutor,
  ScrollExecutor,
  KeyboardTypeExecutor,
  KeyboardPressKeyExecutor,
} from '../src/tool/builtins/computer-use';
import { createMockPlatform } from './helpers';
import type { ToolCall, ToolContext } from '../src/tool/types';

/** Build a ToolContext whose platform.computerUse.invoke records calls. */
function makeCtx(): { ctx: ToolContext; calls: Array<{ cmd: string; args: Record<string, unknown> }> } {
  const calls: Array<{ cmd: string; args: Record<string, unknown> }> = [];
  const platform = createMockPlatform({
    capabilities: { computerUse: true },
  });
  // Attach a mock computerUse that resolves and records the call.
  (platform as any).computerUse = {
    invoke: async <T>(cmd: string, args?: Record<string, unknown>): Promise<T> => {
      calls.push({ cmd, args: args ?? {} });
      // screenshot returns base64; others return void.
      if (cmd === 'screenshot_display') return 'BASE64PNG' as unknown as T;
      return undefined as unknown as T;
    },
  };
  return { ctx: { platform, sessionId: 's', workingDir: '/' }, calls };
}

function makeCall(name: string, args: Record<string, unknown>): ToolCall {
  return { id: 'c1', name, arguments: args };
}

describe('Computer Use executors', () => {
  it('screenshot captures and returns image JSON', async () => {
    const { ctx, calls } = makeCtx();
    const result = await new ScreenshotExecutor().execute(makeCall('screenshot', {}), ctx);
    expect(calls[0]).toEqual({ cmd: 'screenshot_display', args: { displayIndex: 0 } });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.output);
    expect(parsed.type).toBe('image');
    expect(parsed.data).toBe('BASE64PNG');
  });

  it('mouse_click sends coords + button (default left)', async () => {
    const { ctx, calls } = makeCtx();
    const result = await new MouseClickExecutor().execute(makeCall('mouse_click', { x: 10, y: 20 }), ctx);
    expect(calls[0]).toEqual({ cmd: 'mouse_click', args: { x: 10, y: 20, button: 'left' } });
    expect(result.output).toContain('Clicked left at (10, 20)');
  });

  it('mouse_click honours explicit button', async () => {
    const { ctx, calls } = makeCtx();
    await new MouseClickExecutor().execute(makeCall('mouse_click', { x: 5, y: 5, button: 'right' }), ctx);
    expect(calls[0].args.button).toBe('right');
  });

  it('mouse_double_click sends double_click command', async () => {
    const { ctx, calls } = makeCtx();
    await new MouseDoubleClickExecutor().execute(makeCall('mouse_double_click', { x: 1, y: 2 }), ctx);
    expect(calls[0].cmd).toBe('mouse_double_click');
  });

  it('mouse_move sends move command', async () => {
    const { ctx, calls } = makeCtx();
    await new MouseMoveExecutor().execute(makeCall('mouse_move', { x: 100, y: 200 }), ctx);
    expect(calls[0]).toEqual({ cmd: 'mouse_move', args: { x: 100, y: 200 } });
  });

  it('mouse_down / mouse_up send press + release', async () => {
    const { ctx, calls } = makeCtx();
    await new MouseDownExecutor().execute(makeCall('mouse_down', { x: 1, y: 1 }), ctx);
    await new MouseUpExecutor().execute(makeCall('mouse_up', { x: 1, y: 1 }), ctx);
    expect(calls.map((c) => c.cmd)).toEqual(['mouse_down', 'mouse_up']);
  });

  it('mouse_drag maps start/end to startX/startY/endX/endY', async () => {
    const { ctx, calls } = makeCtx();
    await new MouseDragExecutor().execute(makeCall('mouse_drag', {
      start_x: 1, start_y: 2, end_x: 3, end_y: 4,
    }), ctx);
    expect(calls[0].args).toEqual({
      startX: 1, startY: 2, endX: 3, endY: 4, button: 'left',
    });
  });

  it('scroll defaults amount to 3', async () => {
    const { ctx, calls } = makeCtx();
    await new ScrollExecutor().execute(makeCall('scroll', { x: 0, y: 0, direction: 'down' }), ctx);
    expect(calls[0].args.amount).toBe(3);
  });

  it('scroll honours explicit amount', async () => {
    const { ctx, calls } = makeCtx();
    await new ScrollExecutor().execute(makeCall('scroll', { x: 0, y: 0, direction: 'up', amount: 7 }), ctx);
    expect(calls[0].args.amount).toBe(7);
  });

  it('keyboard_type sends text', async () => {
    const { ctx, calls } = makeCtx();
    const result = await new KeyboardTypeExecutor().execute(makeCall('keyboard_type', { text: 'hello' }), ctx);
    expect(calls[0]).toEqual({ cmd: 'keyboard_type_text', args: { text: 'hello' } });
    expect(result.output).toContain('hello');
  });

  it('keyboard_press_key sends key + modifiers (default empty)', async () => {
    const { ctx, calls } = makeCtx();
    await new KeyboardPressKeyExecutor().execute(makeCall('keyboard_press_key', { key: 'enter' }), ctx);
    expect(calls[0]).toEqual({ cmd: 'keyboard_press_key', args: { key: 'enter', modifiers: [] } });
  });

  it('keyboard_press_key passes modifiers through', async () => {
    const { ctx, calls } = makeCtx();
    await new KeyboardPressKeyExecutor().execute(makeCall('keyboard_press_key', {
      key: 'c', modifiers: ['ctrl', 'shift'],
    }), ctx);
    expect(calls[0].args.modifiers).toEqual(['ctrl', 'shift']);
  });

  it('returns error when invoke throws', async () => {
    const { ctx } = makeCtx();
    // override invoke to throw
    (ctx.platform as any).computerUse.invoke = async () => { throw new Error('permission denied'); };
    const result = await new MouseClickExecutor().execute(makeCall('mouse_click', { x: 1, y: 1 }), ctx);
    expect(result.isError).toBe(true);
    expect(result.output).toContain('permission denied');
  });
});
