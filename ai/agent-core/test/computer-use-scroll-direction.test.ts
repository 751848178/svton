import { describe, expect, it } from 'vitest';
import { ScrollExecutor } from '../src/tool/builtins/computer-use';
import { createMockPlatform } from './helpers';
import type { ToolCall, ToolContext } from '../src/tool/types';

function makeCall(direction: unknown): ToolCall {
  return {
    id: 'scroll',
    name: 'scroll',
    arguments: { x: 10, y: 20, direction },
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

describe('computer-use scroll direction normalization', () => {
  it('normalizes direction casing and surrounding whitespace before invoking the backend', async () => {
    const { ctx, calls } = makeCtx();
    const result = await new ScrollExecutor().execute(makeCall(' DOWN '), ctx);

    expect(result.isError).toBeUndefined();
    expect(calls[0]).toEqual({
      cmd: 'scroll',
      args: { x: 10, y: 20, direction: 'down', amount: 3 },
    });
    expect(result.metadata).toMatchObject({ x: 10, y: 20, direction: 'down', amount: 3 });
  });
});
