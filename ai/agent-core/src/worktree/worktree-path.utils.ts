import type { WorktreeInfo } from './types';

export function findContainingLinkedWorktree(
  worktrees: readonly WorktreeInfo[],
  targetPath: string,
): WorktreeInfo | null {
  const linkedWorktrees = worktrees.slice(1);
  const containing = linkedWorktrees
    .filter((worktree) => pathContains(worktree.path, targetPath))
    .sort((a, b) => normalizePath(b.path).length - normalizePath(a.path).length);

  return containing[0] ?? null;
}

function pathContains(parentPath: string, childPath: string): boolean {
  const parent = normalizePath(parentPath);
  const child = normalizePath(childPath);

  return child === parent || child.startsWith(`${parent}/`) || child.startsWith(`${parent}\\`);
}

function normalizePath(path: string): string {
  return path.replace(/[\\/]+$/, '');
}
