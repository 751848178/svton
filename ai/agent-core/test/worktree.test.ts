import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorktreeManager } from '@svton/agent-core';
import type { IPlatform, IProcess, IFileSystem } from '@svton/agent-platform';

// ==============================================================
// Mock Helpers
// ==============================================================

/**
 * Creates a mock IPlatform with a controllable IProcess.
 * The exec mock returns queued results or a default success.
 */
function createMockPlatform(
  execResults: Array<{ stdout: string; stderr: string; exitCode: number }> = [],
  fsOverrides: Partial<IFileSystem> = {},
): IPlatform {
  let callIndex = 0;
  const execMock = vi.fn(async (_command: string, _opts?: any) => {
    const result = execResults[callIndex] ?? {
      stdout: '',
      stderr: '',
      exitCode: 0,
    };
    callIndex++;
    return { ...result, timedOut: false };
  });

  const fs: IFileSystem = {
    readFile: vi.fn(async () => ''),
    writeFile: vi.fn(async () => {}),
    editFile: vi.fn(async () => true),
    deleteFile: vi.fn(async () => {}),
    exists: vi.fn(async () => true),
    stat: vi.fn(async () => ({
      isFile: true,
      isDirectory: false,
      size: 0,
      modifiedAt: 0,
      createdAt: 0,
    })),
    listDir: vi.fn(async () => []),
    watch: vi.fn(() => ({ close: () => {} })),
    join: vi.fn((...paths: string[]) => paths.join('/')),
    resolve: vi.fn((p: string) => p),
    relative: vi.fn((from: string, to: string) => to),
    dirname: vi.fn((p: string) => p.split('/').slice(0, -1).join('/') || '/'),
    basename: vi.fn((p: string) => p.split('/').pop() || ''),
    ...fsOverrides,
  };

  return {
    type: 'tauri',
    capabilities: {
      filesystem: true,
      process: true,
      watch: false,
      mcpStdio: false,
      clipboard: false,
      notification: false,
    },
    fs,
    process: { exec: execMock } as unknown as IProcess,
    storage: {} as any,
    search: {} as any,
  };
}

// Sample `git worktree list --porcelain` output
const SAMPLE_PORCELAIN = `worktree /home/user/repo
HEAD 1234567890abcdef1234567890abcdef12345678
branch refs/heads/main

worktree /home/user/repo/.worktrees/feature
HEAD abcdef1234567890abcdef1234567890abcdef12
branch refs/heads/feature-branch

worktree /home/user/repo/.worktrees/hotfix
HEAD fedcba9876543210fedcba9876543210fedcba98
detached
locked
`;

// ==============================================================
// Tests
// ==============================================================

describe('F3 — Git Worktrees (WorktreeManager)', () => {
  // ----------------------------------------------------------
  // list()
  // ----------------------------------------------------------
  describe('list()', () => {
    it('parses git worktree porcelain output into WorktreeInfo[]', async () => {
      const platform = createMockPlatform([
        { stdout: SAMPLE_PORCELAIN, stderr: '', exitCode: 0 },
      ]);
      const manager = new WorktreeManager(platform);

      const worktrees = await manager.list('/home/user/repo');

      expect(worktrees).toHaveLength(3);

      // Main worktree
      expect(worktrees[0].path).toBe('/home/user/repo');
      expect(worktrees[0].branch).toBe('main');
      expect(worktrees[0].head).toBe(
        '1234567890abcdef1234567890abcdef12345678',
      );
      expect(worktrees[0].locked).toBe(false);

      // Feature branch worktree
      expect(worktrees[1].path).toBe('/home/user/repo/.worktrees/feature');
      expect(worktrees[1].branch).toBe('feature-branch');
      expect(worktrees[1].locked).toBe(false);

      // Detached + locked worktree
      expect(worktrees[2].path).toBe('/home/user/repo/.worktrees/hotfix');
      expect(worktrees[2].branch).toBe('(detached)');
      expect(worktrees[2].locked).toBe(true);
    });

    it('calls git worktree list with cwd set to repoDir', async () => {
      const platform = createMockPlatform([
        { stdout: '', stderr: '', exitCode: 0 },
      ]);
      const manager = new WorktreeManager(platform);

      await manager.list('/my/repo');

      expect(platform.process.exec).toHaveBeenCalledWith(
        'git worktree list --porcelain',
        { cwd: '/my/repo' },
      );
    });

    it('throws when git returns a non-zero exit code', async () => {
      const platform = createMockPlatform([
        { stdout: '', stderr: 'not a git repo', exitCode: 128 },
      ]);
      const manager = new WorktreeManager(platform);

      await expect(manager.list('/bad/path')).rejects.toThrow(
        'git worktree list failed',
      );
    });

    it('handles empty output gracefully', async () => {
      const platform = createMockPlatform([
        { stdout: '', stderr: '', exitCode: 0 },
      ]);
      const manager = new WorktreeManager(platform);

      const worktrees = await manager.list('/repo');
      expect(worktrees).toEqual([]);
    });
  });

  // ----------------------------------------------------------
  // create()
  // ----------------------------------------------------------
  describe('create()', () => {
    it('calls git worktree add with the correct branch and path', async () => {
      // create() calls exec for the add, then again for list()
      const platform = createMockPlatform([
        { stdout: '', stderr: '', exitCode: 0 }, // git worktree add
        { stdout: 'worktree /repo/.worktrees/feat\nHEAD abc\ndetached\n', stderr: '', exitCode: 0 }, // git worktree list
      ]);
      const manager = new WorktreeManager(platform);

      await manager.create('/repo', {
        branch: 'feat',
        path: '/repo/.worktrees/feat',
      });

      // The first exec call should be the add command
      const firstCall = (platform.process.exec as any).mock.calls[0];
      expect(firstCall[0]).toContain('git worktree add');
      expect(firstCall[0]).toContain('-b feat');
      expect(firstCall[0]).toContain('/repo/.worktrees/feat');
    });

    it('includes the base branch when provided', async () => {
      const platform = createMockPlatform([
        { stdout: '', stderr: '', exitCode: 0 },
        { stdout: 'worktree /wt\n', stderr: '', exitCode: 0 },
      ]);
      const manager = new WorktreeManager(platform);

      await manager.create('/repo', {
        branch: 'new-branch',
        path: '/wt',
        baseBranch: 'main',
      });

      const addCommand = (platform.process.exec as any).mock.calls[0][0];
      expect(addCommand).toContain('main');
    });

    it('throws when git worktree add fails', async () => {
      const platform = createMockPlatform([
        { stdout: '', stderr: 'branch already exists', exitCode: 1 },
      ]);
      const manager = new WorktreeManager(platform);

      await expect(
        manager.create('/repo', { branch: 'dup', path: '/wt' }),
      ).rejects.toThrow('git worktree add failed');
    });
  });

  // ----------------------------------------------------------
  // remove()
  // ----------------------------------------------------------
  describe('remove()', () => {
    it('calls git worktree remove with the given path', async () => {
      const platform = createMockPlatform([
        { stdout: '', stderr: '', exitCode: 0 },
      ]);
      const manager = new WorktreeManager(platform);

      await manager.remove('/repo', '/repo/.worktrees/feat');

      const cmd = (platform.process.exec as any).mock.calls[0][0];
      expect(cmd).toContain('git worktree remove');
      expect(cmd).toContain('/repo/.worktrees/feat');
    });

    it('passes --force when force=true', async () => {
      const platform = createMockPlatform([
        { stdout: '', stderr: '', exitCode: 0 },
      ]);
      const manager = new WorktreeManager(platform);

      await manager.remove('/repo', '/wt', true);

      const cmd = (platform.process.exec as any).mock.calls[0][0];
      expect(cmd).toContain('--force');
    });

    it('does not pass --force by default', async () => {
      const platform = createMockPlatform([
        { stdout: '', stderr: '', exitCode: 0 },
      ]);
      const manager = new WorktreeManager(platform);

      await manager.remove('/repo', '/wt');

      const cmd = (platform.process.exec as any).mock.calls[0][0];
      expect(cmd).not.toContain('--force');
    });

    it('throws when git worktree remove fails', async () => {
      const platform = createMockPlatform([
        { stdout: '', stderr: 'worktree not found', exitCode: 1 },
      ]);
      const manager = new WorktreeManager(platform);

      await expect(
        manager.remove('/repo', '/bad/path'),
      ).rejects.toThrow('git worktree remove failed');
    });
  });

  // ----------------------------------------------------------
  // detectCurrent()
  // ----------------------------------------------------------
  describe('detectCurrent()', () => {
    it('returns the worktree matching repoDir', async () => {
      const platform = createMockPlatform([
        { stdout: SAMPLE_PORCELAIN, stderr: '', exitCode: 0 },
      ]);
      const manager = new WorktreeManager(platform);

      const found = await manager.detectCurrent(
        '/home/user/repo/.worktrees/feature',
      );

      expect(found).not.toBeNull();
      expect(found!.branch).toBe('feature-branch');
    });

    it('returns null when repoDir does not match any worktree', async () => {
      const platform = createMockPlatform([
        { stdout: SAMPLE_PORCELAIN, stderr: '', exitCode: 0 },
      ]);
      const manager = new WorktreeManager(platform);

      const found = await manager.detectCurrent('/somewhere/else');
      expect(found).toBeNull();
    });
  });
});
