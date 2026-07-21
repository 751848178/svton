import { unquoteShellToken } from './shell-command.utils';

const SCRIPT_OPTIONS_WITH_ARGUMENT = new Set(['-t']);
const SCRIPT_PLAYBACK_OPTIONS = new Set(['-p']);
const SCRIPT_FLAG_CHARS = new Set(['a', 'e', 'F', 'k', 'q', 'r']);

export function scriptWrapperTokens(tokens: string[]): string[] {
  for (let index = 1; index < tokens.length; index += 1) {
    const token = unquoteShellToken(tokens[index]);
    if (token === '--') return commandAfterScriptFile(tokens, index + 1);
    if (!token.startsWith('-') || token === '-') return commandAfterScriptFile(tokens, index);
    if (SCRIPT_OPTIONS_WITH_ARGUMENT.has(token)) {
      index += 1;
      continue;
    }
    if (!scriptOptionIsSafeToSkip(token)) return [];
  }

  return [];
}

function commandAfterScriptFile(tokens: string[], fileIndex: number): string[] {
  return tokens[fileIndex + 1] ? tokens.slice(fileIndex + 1) : [];
}

function scriptOptionIsSafeToSkip(token: string): boolean {
  if (!token.startsWith('-') || token.startsWith('--') || token.length < 2) return false;
  if (SCRIPT_PLAYBACK_OPTIONS.has(token)) return false;

  for (const char of token.slice(1)) {
    if (!SCRIPT_FLAG_CHARS.has(char)) return false;
  }

  return true;
}
