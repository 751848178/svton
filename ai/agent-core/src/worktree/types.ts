/**
 * Git Worktree type definitions.
 */

export interface WorktreeInfo {
  /** Absolute filesystem path of the worktree */
  path: string;
  /** Branch checked out in this worktree */
  branch: string;
  /** HEAD commit SHA */
  head: string;
  /** Whether the worktree is locked */
  locked: boolean;
  /** Optional associated session ID */
  sessionId?: string;
}

export interface CreateWorktreeOptions {
  /** Branch name for the new worktree. Auto-generated if omitted. */
  branch?: string;
  /** Base branch to create the worktree from. Defaults to current HEAD. */
  baseBranch?: string;
  /** Explicit path for the worktree directory. Auto-derived if omitted. */
  path?: string;
}
