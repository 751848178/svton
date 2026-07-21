import { normalizeShellWordToken } from './shell-command.utils';

const SHELL_STDIN_PATHS = new Set(['/dev/stdin', '/dev/fd/0', '/proc/self/fd/0']);

export function isShellStdinPath(token: string): boolean {
  return SHELL_STDIN_PATHS.has(normalizeShellWordToken(token));
}

export function shellFdPathNumber(token: string): number | null {
  const word = normalizeShellWordToken(token);
  if (word === '/dev/stdin') return 0;

  const match = word.match(/^\/(?:dev\/fd|proc\/self\/fd)\/(\d+)$/);
  if (!match) return null;

  return Number.parseInt(match[1], 10);
}
