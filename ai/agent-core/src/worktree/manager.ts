import type { IPlatform } from '@svton/agent-platform';
import type { WorktreeInfo, CreateWorktreeOptions } from './types';

/**
 * Manages git worktrees for parallel agent sessions.
 *
 * Worktrees allow multiple working directories on different branches
 * sharing the same repository. This is useful for running multiple
 * agent sessions concurrently without interfering with each other.
 *
 * All git operations are performed via {@link IPlatform.process.exec}.
 */
export class WorktreeManager {
  constructor(private platform: IPlatform) {}

  /**
   * List all worktrees in the repository.
   * Uses `git worktree list --porcelain`.
   */
  async list(repoDir: string): Promise<WorktreeInfo[]> {
    const result = await this.platform.process.exec(
      'git worktree list --porcelain',
      { cwd: repoDir },
    );

    if (result.exitCode !== 0) {
      throw new Error(`git worktree list failed: ${result.stderr.trim()}`);
    }

    return this.parsePorcelain(result.stdout);
  }

  /**
   * Create a new worktree.
   * Uses `git worktree add`.
   */
  async create(repoDir: string, opts: CreateWorktreeOptions = {}): Promise<WorktreeInfo> {
    const branch =
      opts.branch ?? `agent-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const worktreePath = opts.path ?? this.derivePath(repoDir, branch);

    const args = ['worktree', 'add', '-b', branch, worktreePath];
    if (opts.baseBranch) {
      args.push(opts.baseBranch);
    }

    const result = await this.platform.process.exec(`git ${args.join(' ')}`, {
      cwd: repoDir,
    });

    if (result.exitCode !== 0) {
      throw new Error(`git worktree add failed: ${result.stderr.trim()}`);
    }

    // Return the created worktree info
    const worktrees = await this.list(repoDir);
    const created = worktrees.find((w) => w.path === this.resolvePath(worktreePath));
    if (!created) {
      throw new Error(
        `Worktree was created but could not be located at ${worktreePath}`,
      );
    }
    return created;
  }

  /**
   * Remove a worktree.
   * Uses `git worktree remove`.
   */
  async remove(repoDir: string, path: string, force: boolean = false): Promise<void> {
    const args = ['worktree', 'remove', path];
    if (force) {
      args.push('--force');
    }

    const result = await this.platform.process.exec(`git ${args.join(' ')}`, {
      cwd: repoDir,
    });

    if (result.exitCode !== 0) {
      throw new Error(`git worktree remove failed: ${result.stderr.trim()}`);
    }
  }

  /**
   * Detect the worktree that contains `repoDir`, if any.
   * Returns null if the directory is the main worktree or not in a worktree.
   */
  async detectCurrent(repoDir: string): Promise<WorktreeInfo | null> {
    const worktrees = await this.list(repoDir);
    const resolved = this.resolvePath(repoDir);
    return worktrees.find((w) => w.path === resolved) ?? null;
  }

  // ----------------------------------------------------------
  // Private helpers
  // ----------------------------------------------------------

  /**
   * Parse `git worktree list --porcelain` output.
   *
   * Format:
   * ```
   * worktree /path/to/worktree
   * HEAD <sha>
   * branch refs/heads/<branch>
   * locked
   *
   * worktree /path/to/another
   * ...
   * ```
   */
  private parsePorcelain(output: string): WorktreeInfo[] {
    const worktrees: WorktreeInfo[] = [];
    let current: Partial<WorktreeInfo> | null = null;

    for (const line of output.split('\n')) {
      const trimmed = line.trim();

      if (trimmed === '') {
        // Blank line separates entries
        if (current && current.path) {
          worktrees.push(this.finalizeWorktree(current));
        }
        current = null;
        continue;
      }

      const spaceIdx = trimmed.indexOf(' ');
      const key = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
      const value = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1);

      if (key === 'worktree') {
        if (current && current.path) {
          worktrees.push(this.finalizeWorktree(current));
        }
        current = { path: value, locked: false };
      } else if (current) {
        if (key === 'HEAD') {
          current.head = value;
        } else if (key === 'branch') {
          // value is like "refs/heads/feature-branch"
          current.branch = value.replace(/^refs\/heads\//, '');
        } else if (key === 'detached') {
          // Detached HEAD - no branch name
          current.branch = '(detached)';
        } else if (key === 'locked') {
          current.locked = true;
        }
      }
    }

    // Handle last entry (no trailing blank line)
    if (current && current.path) {
      worktrees.push(this.finalizeWorktree(current));
    }

    return worktrees;
  }

  private finalizeWorktree(partial: Partial<WorktreeInfo>): WorktreeInfo {
    return {
      path: partial.path ?? '',
      branch: partial.branch ?? '',
      head: partial.head ?? '',
      locked: partial.locked ?? false,
      sessionId: partial.sessionId,
    };
  }

  /**
   * Derive a worktree path from the repo directory and branch name.
   * Places worktrees in a sibling directory: `<repoParent>/.worktrees/<branch>`
   */
  private derivePath(repoDir: string, branch: string): string {
    const parent = this.platform.fs.dirname(repoDir);
    const safeBranch = branch.replace(/[^a-zA-Z0-9._-]/g, '-');
    return this.platform.fs.join(parent, '.worktrees', safeBranch);
  }

  /**
   * Resolve a path to absolute form.
   */
  private resolvePath(p: string): string {
    try {
      return this.platform.fs.resolve(p);
    } catch {
      return p;
    }
  }
}
