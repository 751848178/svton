import { describe, expect, it } from 'vitest';
import { KeyboardPressKeyExecutor } from '../src/tool/builtins/computer-use';
import { createMockPlatform } from './helpers';
import type { ToolCall, ToolContext } from '../src/tool/types';

function makeCall(modifiers: unknown): ToolCall {
  return {
    id: 'key',
    name: 'keyboard_press_key',
    arguments: { key: 'c', modifiers },
  };
}

function makeCtx(): {
  ctx: ToolContext;
  calls: Array<{ cmd: string; args: Record<string, unknown> }>;
} {
  const calls: Array<{ cmd: string; args: Record<string, unknown> }> = [];
  const platform = createMockPlatform({ capabilities: { computerUse: true } });
  (platform as any).computerUse = {
    invoke: async (cmd: string, args?: Record<string, unknown>) => {
      calls.push({ cmd, args: args ?? {} });
    },
  };

  return {
    ctx: { platform, sessionId: 'session', workingDir: '/' },
    calls,
  };
}

describe('computer-use keyboard modifier validation', () => {
  it('rejects unsupported modifiers before invoking the backend', async () => {
    const { ctx, calls } = makeCtx();
    const result = await new KeyboardPressKeyExecutor().execute(
      makeCall(['ctrl', 'hyper']),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"modifiers"');
    expect(result.output).toContain('ctrl, alt, shift, meta, or cmd');
    expect(calls).toHaveLength(0);
  });

  it('normalizes supported modifier casing before invoking the backend', async () => {
    const { ctx, calls } = makeCtx();
    const result = await new KeyboardPressKeyExecutor().execute(
      makeCall(['Ctrl', 'SHIFT']),
      ctx,
    );

    expect(result.isError).toBeUndefined();
    expect(calls[0]).toEqual({
      cmd: 'keyboard_press_key',
      args: { key: 'c', modifiers: ['ctrl', 'shift'] },
    });
    expect(result.metadata).toMatchObject({ key: 'c', modifiers: ['ctrl', 'shift'] });
  });
});
