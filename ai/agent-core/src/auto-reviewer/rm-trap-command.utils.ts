import { getShellTokenBasename, unquoteShellToken } from './shell-command.utils';
import { splitUnquotedIfsExpansionTokens } from './shell-ifs-word-splitting.utils';

const TRAP_PRINT_OPTIONS = new Set(['-l', '-p']);

export interface TrapCommandSpec {
  action: string;
  signals: string[];
  reset: boolean;
}

export function trapCommandString(tokens: string[]): string {
  return trapCommandSpec(tokens)?.action ?? '';
}

export function trapCommandSpec(tokens: string[]): TrapCommandSpec | null {
  const trapWords = splitUnquotedIfsExpansionTokens(tokens);
  if (getShellTokenBasename(trapWords[0] ?? '') !== 'trap') return null;

  const actionIndex = trapActionIndex(trapWords);
  if (actionIndex >= trapWords.length - 1) return null;

  const action = unquoteShellToken(trapWords[actionIndex] ?? '');
  const signals = trapWords.slice(actionIndex + 1).map(unquoteShellToken);
  if (action === '-') return { action: '', signals, reset: true };
  return action ? { action, signals, reset: false } : null;
}

function trapActionIndex(tokens: string[]): number {
  for (let index = 1; index < tokens.length; index += 1) {
    const token = unquoteShellToken(tokens[index]);
    if (token === '--') return index + 1;
    if (TRAP_PRINT_OPTIONS.has(token)) return tokens.length;
    if (token.startsWith('-') && token !== '-') continue;
    return index;
  }

  return tokens.length;
}
