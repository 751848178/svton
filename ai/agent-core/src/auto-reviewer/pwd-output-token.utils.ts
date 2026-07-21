import { getShellTokenBasename, splitShellWords, unquoteShellToken } from './shell-command.utils';
import { unwrapShellGroupCommand } from './shell-group-command.utils';
import { splitUnquotedIfsExpansionTokens } from './shell-ifs-word-splitting.utils';

const COMMAND_LITERAL_OPTIONS = new Set(['-p']);
const MAX_COMMAND_WRAPPER_DEPTH = 8;

export function pwdCommandOutputToken(command: string, workingDir: string): string | null {
  if (!workingDir.startsWith('/')) return null;
  const tokens = pwdCommandTokens(command);
  if (getShellTokenBasename(tokens[0] ?? '') !== 'pwd') return null;
  if (tokens.slice(1).some((token) => !/^-[LP]+$/.test(unquoteShellToken(token)))) return null;
  return workingDir;
}

function pwdCommandTokens(command: string): string[] {
  let current = splitUnquotedIfsExpansionTokens(
    splitShellWords(unwrapShellGroupCommand(command, { stripTrailingTerminator: true })),
  );
  for (let depth = 0; current.length > 0 && depth < MAX_COMMAND_WRAPPER_DEPTH; depth += 1) {
    const firstName = getShellTokenBasename(current[0] ?? '');
    if (firstName === 'builtin') {
      current = current.slice(1);
      continue;
    }
    if (firstName !== 'command') return current;
    const next = commandWrapperTargetIndex(current);
    if (next < 0) return [];
    current = current.slice(next);
  }
  return [];
}

function commandWrapperTargetIndex(tokens: string[]): number {
  for (let index = 1; index < tokens.length; index += 1) {
    const token = unquoteShellToken(tokens[index]);
    if (token === '--') return index + 1;
    if (COMMAND_LITERAL_OPTIONS.has(token)) continue;
    if (token.startsWith('-')) return -1;
    return index;
  }
  return -1;
}
