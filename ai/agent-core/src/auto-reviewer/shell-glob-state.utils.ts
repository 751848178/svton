import { getShellTokenBasename, normalizeShellWordToken } from './shell-command.utils';
import { shellBraceGroupBody } from './shell-brace-group-command.utils';
import { splitShellCommandListSegments } from './shell-command-list.utils';
import { stripShellControlCommandPrefix } from './shell-control-command.utils';

type SplitCommandTokens = (command: string) => string[];

export function nextShellGlobOptionTokenEnabled(token: string, current: boolean): boolean {
  if (/^-[A-Za-z]+$/.test(token) && token.includes('f')) return false;
  if (/^\+[A-Za-z]+$/.test(token) && token.includes('f')) return true;
  return current;
}

export function nextShellGlobEnabled(tokens: string[], current: boolean): boolean {
  if (getShellTokenBasename(tokens[0] ?? '') !== 'set') return current;

  let enabled = current;
  for (let index = 1; index < tokens.length; index += 1) {
    const token = normalizeShellWordToken(tokens[index]);
    if (token === '-o' || token === '+o') {
      if (normalizeShellWordToken(tokens[index + 1] ?? '') === 'noglob') {
        enabled = token === '+o';
        index += 1;
      }
      continue;
    }
    if (token === '--') break;
    enabled = nextShellGlobOptionTokenEnabled(token, enabled);
  }

  return enabled;
}

export function nextShellCommandGlobEnabled(
  command: string,
  current: boolean,
  splitCommandTokens: SplitCommandTokens,
): boolean {
  let enabled = current;
  for (const statement of splitShellCommandListSegments(command)) {
    const shellCommand = stripShellControlCommandPrefix(statement);
    const braceBody = shellBraceGroupBody(shellCommand);
    enabled = braceBody === null
      ? nextShellGlobEnabled(splitCommandTokens(shellCommand), enabled)
      : nextShellCommandGlobEnabled(braceBody, enabled, splitCommandTokens);
  }

  return enabled;
}
