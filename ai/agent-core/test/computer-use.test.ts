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
    expect(parsed.mimeType).toBe('image/png');
    expect(result.metadata).toMatchObject({
      displayIndex: 0,
      mimeType: 'image/png',
      dataLength: 9,
    });
  });

  it('screenshot rejects invalid display before invoking backend', async () => {
    const { ctx, calls } = makeCtx();
    const result = await new ScreenshotExecutor().execute(makeCall('screenshot', { display: Number.NaN }), ctx);

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"display"');
    expect(result.output).toContain('non-negative integer');
    expect(calls).toHaveLength(0);
  });

  it('mouse_click sends coords + button (default left)', async () => {
    const { ctx, calls } = makeCtx();
    const result = await new MouseClickExecutor().execute(makeCall('mouse_click', { x: 10, y: 20 }), ctx);
    expect(calls[0]).toEqual({ cmd: 'mouse_click', args: { x: 10, y: 20, button: 'left' } });
    expect(result.output).toContain('Clicked left at (10, 20)');
    expect(result.metadata).toMatchObject({ x: 10, y: 20, button: 'left' });
  });

  it('mouse_click honours explicit button', async () => {
    const { ctx, calls } = makeCtx();
    await new MouseClickExecutor().execute(makeCall('mouse_click', { x: 5, y: 5, button: 'right' }), ctx);
    expect(calls[0].args.button).toBe('right');
  });

  it('mouse_double_click sends double_click command', async () => {
    const { ctx, calls } = makeCtx();
    const result = await new MouseDoubleClickExecutor().execute(makeCall('mouse_double_click', { x: 1, y: 2 }), ctx);
    expect(calls[0].cmd).toBe('mouse_double_click');
    expect(result.metadata).toMatchObject({ x: 1, y: 2, button: 'left' });
  });

  it('mouse_move sends move command', async () => {
    const { ctx, calls } = makeCtx();
    const result = await new MouseMoveExecutor().execute(makeCall('mouse_move', { x: 100, y: 200 }), ctx);
    expect(calls[0]).toEqual({ cmd: 'mouse_move', args: { x: 100, y: 200 } });
    expect(result.metadata).toMatchObject({ x: 100, y: 200 });
  });

  it('mouse_down / mouse_up send press + release', async () => {
    const { ctx, calls } = makeCtx();
    const downResult = await new MouseDownExecutor().execute(makeCall('mouse_down', { x: 1, y: 1 }), ctx);
    const upResult = await new MouseUpExecutor().execute(makeCall('mouse_up', { x: 1, y: 1 }), ctx);
    expect(calls.map((c) => c.cmd)).toEqual(['mouse_down', 'mouse_up']);
    expect(downResult.metadata).toMatchObject({ x: 1, y: 1, button: 'left' });
    expect(upResult.metadata).toMatchObject({ x: 1, y: 1, button: 'left' });
  });

  it('mouse_drag maps start/end to startX/startY/endX/endY', async () => {
    const { ctx, calls } = makeCtx();
    const result = await new MouseDragExecutor().execute(makeCall('mouse_drag', {
      start_x: 1, start_y: 2, end_x: 3, end_y: 4,
    }), ctx);
    expect(calls[0].args).toEqual({
      startX: 1, startY: 2, endX: 3, endY: 4, button: 'left',
    });
    expect(result.metadata).toMatchObject({
      startX: 1, startY: 2, endX: 3, endY: 4, button: 'left',
    });
  });

  it.each([
    ['mouse_click x', new MouseClickExecutor(), 'mouse_click', { x: Number.NaN, y: 20 }, '"x"', 'finite number'],
    ['mouse_double_click button', new MouseDoubleClickExecutor(), 'mouse_double_click', { x: 1, y: 2, button: 'side' }, '"button"', 'left, right, or middle'],
    ['mouse_move y', new MouseMoveExecutor(), 'mouse_move', { x: 1, y: Number.POSITIVE_INFINITY }, '"y"', 'finite number'],
    ['mouse_down button', new MouseDownExecutor(), 'mouse_down', { x: 1, y: 2, button: 123 }, '"button"', 'left, right, or middle'],
    ['mouse_up x', new MouseUpExecutor(), 'mouse_up', { x: '1', y: 2 }, '"x"', 'finite number'],
    ['mouse_drag end_y', new MouseDragExecutor(), 'mouse_drag', { start_x: 1, start_y: 2, end_x: 3, end_y: Number.NaN }, '"end_y"', 'finite number'],
  ])('rejects invalid %s before invoking backend', async (_label, executor, name, args, field, message) => {
    const { ctx, calls } = makeCtx();
    const result = await executor.execute(makeCall(name, args), ctx);

    expect(result.isError).toBe(true);
    expect(result.output).toContain(field);
    expect(result.output).toContain(message);
    expect(calls).toHaveLength(0);
  });

  it('scroll defaults amount to 3', async () => {
    const { ctx, calls } = makeCtx();
    const result = await new ScrollExecutor().execute(makeCall('scroll', { x: 0, y: 0, direction: 'down' }), ctx);
    expect(calls[0].args.amount).toBe(3);
    expect(result.metadata).toMatchObject({ x: 0, y: 0, direction: 'down', amount: 3 });
  });

  it('scroll honours explicit amount', async () => {
    const { ctx, calls } = makeCtx();
    const result = await new ScrollExecutor().execute(makeCall('scroll', { x: 0, y: 0, direction: 'up', amount: 7 }), ctx);
    expect(calls[0].args.amount).toBe(7);
    expect(result.metadata).toMatchObject({ x: 0, y: 0, direction: 'up', amount: 7 });
  });

  it.each([
    ['scroll x', new ScrollExecutor(), 'scroll', { x: Number.NaN, y: 0, direction: 'down' }, '"x"', 'finite number'],
    ['scroll direction', new ScrollExecutor(), 'scroll', { x: 0, y: 0, direction: 'diagonal' }, '"direction"', 'up, down, left, or right'],
    ['scroll amount', new ScrollExecutor(), 'scroll', { x: 0, y: 0, direction: 'down', amount: Number.POSITIVE_INFINITY }, '"amount"', 'finite number'],
    ['keyboard key', new KeyboardPressKeyExecutor(), 'keyboard_press_key', { key: 123 }, '"key"', 'must be a string'],
    ['keyboard modifiers', new KeyboardPressKeyExecutor(), 'keyboard_press_key', { key: 'c', modifiers: ['ctrl', 123] }, '"modifiers"', 'array of strings'],
  ])('rejects invalid %s before invoking backend', async (_label, executor, name, args, field, message) => {
    const { ctx, calls } = makeCtx();
    const result = await executor.execute(makeCall(name, args), ctx);

    expect(result.isError).toBe(true);
    expect(result.output).toContain(field);
    expect(result.output).toContain(message);
    expect(calls).toHaveLength(0);
  });

  it('keyboard_type sends text', async () => {
    const { ctx, calls } = makeCtx();
    const result = await new KeyboardTypeExecutor().execute(makeCall('keyboard_type', { text: 'hello' }), ctx);
    expect(calls[0]).toEqual({ cmd: 'keyboard_type_text', args: { text: 'hello' } });
    expect(result.output).not.toContain('hello');
    expect(result.output).toContain('5 characters');
    expect(result.metadata).toMatchObject({ textLength: 5, truncated: false });
  });

  it('keyboard_type rejects non-string text before invoking backend', async () => {
    const { ctx, calls } = makeCtx();
    const result = await new KeyboardTypeExecutor().execute(makeCall('keyboard_type', { text: 123 }), ctx);

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"text"');
    expect(result.output).toContain('must be a string');
    expect(calls).toHaveLength(0);
  });

  it('keyboard_press_key sends key + modifiers (default empty)', async () => {
    const { ctx, calls } = makeCtx();
    const result = await new KeyboardPressKeyExecutor().execute(makeCall('keyboard_press_key', { key: 'enter' }), ctx);
    expect(calls[0]).toEqual({ cmd: 'keyboard_press_key', args: { key: 'enter', modifiers: [] } });
    expect(result.metadata).toMatchObject({ key: 'enter', modifiers: [] });
  });

  it('keyboard_press_key passes modifiers through', async () => {
    const { ctx, calls } = makeCtx();
    const result = await new KeyboardPressKeyExecutor().execute(makeCall('keyboard_press_key', {
      key: 'c', modifiers: ['ctrl', 'shift'],
    }), ctx);
    expect(calls[0].args.modifiers).toEqual(['ctrl', 'shift']);
    expect(result.metadata).toMatchObject({ key: 'c', modifiers: ['ctrl', 'shift'] });
  });

  it.each([
    [
      'screenshot',
      new ScreenshotExecutor(),
      { display: 1 },
      { displayIndex: 1, mimeType: 'image/png', dataLength: 0 },
    ],
    [
      'scroll',
      new ScrollExecutor(),
      { x: 10, y: 20, direction: 'down', amount: 4 },
      { x: 10, y: 20, direction: 'down', amount: 4 },
    ],
    [
      'keyboard_type',
      new KeyboardTypeExecutor(),
      { text: 'secret hello world' },
      { textLength: 18, truncated: false },
    ],
    [
      'keyboard_press_key',
      new KeyboardPressKeyExecutor(),
      { key: 'c', modifiers: ['ctrl', 'shift'] },
      { key: 'c', modifiers: ['ctrl', 'shift'] },
    ],
  ])('preserves metadata when %s invoke throws', async (name, executor, args, metadata) => {
    const { ctx } = makeCtx();
    (ctx.platform as any).computerUse.invoke = async () => { throw new Error('permission denied'); };

    const result = await executor.execute(makeCall(name, args), ctx);

    expect(result.isError).toBe(true);
    expect(result.output).toContain('permission denied');
    expect(result.output).not.toContain('secret hello world');
    expect(result.metadata).toMatchObject(metadata);
  });

  it.each([
    [
      'mouse_click',
      new MouseClickExecutor(),
      { x: 1, y: 1 },
      { x: 1, y: 1, button: 'left' },
    ],
    [
      'mouse_double_click',
      new MouseDoubleClickExecutor(),
      { x: 2, y: 3, button: 'right' },
      { x: 2, y: 3, button: 'right' },
    ],
    [
      'mouse_move',
      new MouseMoveExecutor(),
      { x: 4, y: 5 },
      { x: 4, y: 5 },
    ],
    [
      'mouse_down',
      new MouseDownExecutor(),
      { x: 6, y: 7, button: 'middle' },
      { x: 6, y: 7, button: 'middle' },
    ],
    [
      'mouse_up',
      new MouseUpExecutor(),
      { x: 8, y: 9 },
      { x: 8, y: 9, button: 'left' },
    ],
    [
      'mouse_drag',
      new MouseDragExecutor(),
      { start_x: 1, start_y: 2, end_x: 3, end_y: 4, button: 'right' },
      { startX: 1, startY: 2, endX: 3, endY: 4, button: 'right' },
    ],
  ])('preserves metadata when %s invoke throws', async (name, executor, args, metadata) => {
    const { ctx } = makeCtx();
    (ctx.platform as any).computerUse.invoke = async () => { throw new Error('permission denied'); };

    const result = await executor.execute(makeCall(name, args), ctx);

    expect(result.isError).toBe(true);
    expect(result.output).toContain('permission denied');
    expect(result.metadata).toMatchObject(metadata);
  });
});
