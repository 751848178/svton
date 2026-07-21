import { describe, expect, it } from 'vitest';
import { MouseClickExecutor } from '../src/tool/builtins/computer-use';
import { createMockPlatform } from './helpers';
import type { ToolCall, ToolContext } from '../src/tool/types';

function makeCall(button: unknown): ToolCall {
  return {
    id: 'mouse',
    name: 'mouse_click',
    arguments: { x: 10, y: 20, button },
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

describe('computer-use mouse button normalization', () => {
  it('normalizes button casing and surrounding whitespace before invoking the backend', async () => {
    const { ctx, calls } = makeCtx();
    const result = await new MouseClickExecutor().execute(makeCall(' RIGHT '), ctx);

    expect(result.isError).toBeUndefined();
    expect(calls[0]).toEqual({
      cmd: 'mouse_click',
      args: { x: 10, y: 20, button: 'right' },
    });
    expect(result.metadata).toMatchObject({ x: 10, y: 20, button: 'right' });
  });
});
