export { shellQuote } from '../utils/shell-quote.utils';

export function readSafeGitRefs(
  base?: unknown,
  head?: unknown,
): { base?: string; head?: string; error?: string } {
  if (
    (base !== undefined && typeof base !== 'string') ||
    (head !== undefined && typeof head !== 'string')
  ) {
    return { error: 'Error: invalid git ref: refs must be strings.' };
  }
  const resolvedBase = typeof base === 'string' ? base.trim() : base;
  const resolvedHead = typeof head === 'string' ? head.trim() : head;
  if (
    (resolvedBase !== undefined && isUnsafeGitRef(resolvedBase)) ||
    (resolvedHead !== undefined && isUnsafeGitRef(resolvedHead))
  ) {
    return { error: 'Error: invalid git ref: refs must not be empty or start with "-".' };
  }
  return { base: resolvedBase, head: resolvedHead };
}

function isUnsafeGitRef(value: string): boolean {
  return value.length === 0 || value.startsWith('-');
}
