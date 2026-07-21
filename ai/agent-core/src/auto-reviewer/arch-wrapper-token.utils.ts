import { unquoteShellToken } from './shell-command.utils';

const EXECUTING_ARCH_OPTIONS = new Set(['-arm64', '-x86_64']);

export function archWrapperTokens(tokens: string[]): string[] {
  const archOption = unquoteShellToken(tokens[1] ?? '');
  if (!EXECUTING_ARCH_OPTIONS.has(archOption)) return [];

  return tokens.slice(2);
}
