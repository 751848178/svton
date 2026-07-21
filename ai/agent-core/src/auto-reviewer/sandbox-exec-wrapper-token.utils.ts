import { unquoteShellToken } from './shell-command.utils';

const PROFILE_OPTIONS = new Set(['-f', '-n', '-p']);
const PARAMETER_OPTION = '-D';

export function sandboxExecWrapperTokens(tokens: string[]): string[] {
  let hasProfile = false;

  for (let index = 1; index < tokens.length; index += 1) {
    const token = unquoteShellToken(tokens[index]);
    if (token === '--') return hasProfile ? tokens.slice(index + 1) : [];
    if (PROFILE_OPTIONS.has(token)) {
      hasProfile = true;
      index += 1;
      continue;
    }
    if (PARAMETER_OPTION === token) {
      index += 1;
      continue;
    }
    if (token.startsWith('-')) return [];
    return hasProfile ? tokens.slice(index) : [];
  }

  return [];
}
