import { describe, expect, it } from 'vitest';
import { KeyboardPressKeyExecutor } from '../src/tool/builtins/computer-use';
import { createMockPlatform } from './helpers';
import type { ToolCall, ToolContext } from '../src/tool/types';

function makeCall(key: unknown): ToolCall {
  return {
    id: 'key',
    name: 'keyboard_press_key',
    arguments: { key },
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

describe('computer-use keyboard key validation', () => {
  it('rejects blank keys before invoking the backend', async () => {
    const { ctx, calls } = makeCtx();
    const result = await new KeyboardPressKeyExecutor().execute(makeCall('  \n\t  '), ctx);

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"key"');
    expect(result.output).toContain('non-empty');
    expect(calls).toHaveLength(0);
  });

  it('normalizes key casing and surrounding whitespace before invoking the backend', async () => {
    const { ctx, calls } = makeCtx();
    const result = await new KeyboardPressKeyExecutor().execute(makeCall(' Enter '), ctx);

    expect(result.isError).toBeUndefined();
    expect(calls[0]).toEqual({
      cmd: 'keyboard_press_key',
      args: { key: 'enter', modifiers: [] },
    });
    expect(result.metadata).toMatchObject({ key: 'enter', modifiers: [] });
  });
});
