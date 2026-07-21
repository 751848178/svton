import { describe, expect, it, vi } from 'vitest';
import { BashExecutor } from '../src/tool/builtins/shell';
import type { ToolCall, ToolContext } from '../src/tool/types';
import { createMockPlatform } from './helpers';

function makeCall(args: Record<string, unknown>): ToolCall {
  return { id: 'bash-result', name: 'bash', arguments: args };
}

function makeThrowingCtx(): { ctx: ToolContext; exec: ReturnType<typeof vi.fn> } {
  const exec = vi.fn(async () => {
    throw { code: 'exec_down' };
  });
  const platform = createMockPlatform({
    process: { exec: exec as any },
    capabilities: { process: true },
  });
  return { ctx: { platform, sessionId: 'session', workingDir: '/repo' }, exec };
}

describe('bash tool error formatting', () => {
  it('normalizes non-Error command execution failures', async () => {
    const { ctx, exec } = makeThrowingCtx();

    const result = await new BashExecutor().execute(
      makeCall({ command: 'echo hi', timeout: 5000 }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('Error executing command: Unknown error');
    expect(result.output).not.toContain('[object Object]');
    expect(result.metadata).toMatchObject({
      command: 'echo hi',
      timeout: 5000,
    });
    expect(exec).toHaveBeenCalledWith(
      'echo hi',
      { cwd: '/repo', timeout: 5000, signal: undefined },
    );
  });
});
