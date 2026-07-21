import { describe, expect, it, vi } from 'vitest';
import {
  GitDiffExecutor,
  GitLogRangeExecutor,
} from '../src/tool/builtins/git_review';
import type { ToolCall, ToolContext } from '../src/tool/types';
import { createMockPlatform } from './helpers';

function makeCall(name: string, args: Record<string, unknown>): ToolCall {
  return { id: name, name, arguments: args };
}

function makeThrowingCtx(): { ctx: ToolContext; exec: ReturnType<typeof vi.fn> } {
  const exec = vi.fn(async () => {
    throw { code: 'git_down' };
  });
  const platform = createMockPlatform({
    process: { exec: exec as any },
    capabilities: { process: true },
  });
  return { ctx: { platform, sessionId: 'session', workingDir: '/repo' }, exec };
}

describe('git review tool error formatting', () => {
  it('normalizes non-Error git_diff command failures', async () => {
    const { ctx, exec } = makeThrowingCtx();

    const result = await new GitDiffExecutor().execute(
      makeCall('git_diff', { base: 'main', head: 'feature' }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('Error running git diff: Unknown error');
    expect(result.output).not.toContain('[object Object]');
    expect(result.metadata).toMatchObject({
      command: 'git diff main...feature',
    });
    expect(exec).toHaveBeenCalledWith(
      'git diff main...feature',
      { cwd: '/repo', timeout: 30_000, signal: undefined },
    );
  });

  it('normalizes non-Error git_log_range command failures', async () => {
    const { ctx, exec } = makeThrowingCtx();

    const result = await new GitLogRangeExecutor().execute(
      makeCall('git_log_range', { base: 'main', head: 'feature', limit: 3 }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('Error running git log: Unknown error');
    expect(result.output).not.toContain('[object Object]');
    expect(result.metadata).toMatchObject({
      command: "git log '--format=%H|%an|%ad|%s' --date=short -3 main..feature",
    });
    expect(exec).toHaveBeenCalledWith(
      "git log '--format=%H|%an|%ad|%s' --date=short -3 main..feature",
      { cwd: '/repo', timeout: 15_000, signal: undefined },
    );
  });
});
