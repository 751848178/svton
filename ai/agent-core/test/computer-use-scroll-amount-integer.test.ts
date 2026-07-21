import { describe, expect, it } from 'vitest';
import { ScrollExecutor } from '../src/tool/builtins/computer-use';
import { createMockPlatform } from './helpers';
import type { ToolCall, ToolContext } from '../src/tool/types';

function makeCall(amount: number): ToolCall {
  return {
    id: 'scroll',
    name: 'scroll',
    arguments: { x: 10, y: 20, direction: 'down', amount },
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

describe('computer-use scroll amount integer validation', () => {
  it('rejects fractional amounts before invoking the backend', async () => {
    const { ctx, calls } = makeCtx();
    const result = await new ScrollExecutor().execute(makeCall(1.5), ctx);

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"amount"');
    expect(result.output).toContain('integer');
    expect(calls).toHaveLength(0);
  });
});
