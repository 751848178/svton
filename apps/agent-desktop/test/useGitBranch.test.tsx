/**
 * useGitBranch hook tests.
 *
 * Verifies the hook reads the current branch via platform.process.exec and
 * updates state, plus refreshes on window focus.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGitBranch } from '../src/hooks/useGitBranch';
import type { TauriPlatform } from '@svton/agent-platform';

function makePlatform(stdout: string, exitCode = 0): { platform: TauriPlatform; exec: ReturnType<typeof vi.fn> } {
  const exec = vi.fn(async () => ({ stdout, stderr: '', exitCode, timedOut: false }));
  const platform = {
    type: 'tauri',
    capabilities: {},
    process: { exec, getEnv: () => '', getCwd: () => '/', spawn: async () => { throw new Error('x'); } },
  } as unknown as TauriPlatform;
  return { platform, exec };
}

describe('useGitBranch', () => {
  it('returns the current branch on mount', async () => {
    const { platform, exec } = makePlatform('feature/test-branch\n');
    const { result } = renderHook(() => useGitBranch(platform, '/repo'));
    // wait for the async fetch to settle
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(exec).toHaveBeenCalledWith('git rev-parse --abbrev-ref HEAD', expect.objectContaining({ cwd: '/repo' }));
    expect(result.current).toBe('feature/test-branch');
  });

  it('returns empty string when not a git repo (exitCode != 0)', async () => {
    const { platform } = makePlatform('', 128);
    const { result } = renderHook(() => useGitBranch(platform, '/not-a-repo'));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(result.current).toBe('');
  });

  it('returns empty string when exec throws', async () => {
    const exec = vi.fn(async () => { throw new Error('spawn failed'); });
    const platform = { type: 'tauri', capabilities: {}, process: { exec, getEnv: () => '', getCwd: () => '/', spawn: async () => { throw new Error('x'); } } } as unknown as TauriPlatform;
    const { result } = renderHook(() => useGitBranch(platform, '/repo'));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(result.current).toBe('');
  });

  it('refreshes on window focus', async () => {
    const { platform, exec } = makePlatform('main\n');
    renderHook(() => useGitBranch(platform, '/repo'));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    // initial fetch
    expect(exec).toHaveBeenCalledTimes(1);
    // dispatch a focus event
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
      await Promise.resolve();
    });
    // focus handler triggered another exec
    expect(exec).toHaveBeenCalledTimes(2);
  });
});
