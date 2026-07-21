import { getShellTokenBasename, normalizeShellWordToken, splitShellWords } from './shell-command.utils';
import type { StaticVariableState } from './shell-static-assignment.types';

export function applyStaticUnset(statement: string, state: StaticVariableState): void {
  const tokens = splitShellWords(statement);
  if (getShellTokenBasename(tokens[0] ?? '') !== 'unset') return;

  let unsetsVariables = true;
  for (const token of tokens.slice(1)) {
    const word = normalizeShellWordToken(token);
    if (word === '--') continue;
    if (word.startsWith('-')) {
      if (word.includes('f')) unsetsVariables = false;
      if (word.includes('v')) unsetsVariables = true;
      continue;
    }
    if (state.localNames?.has(word)) continue;
    if (unsetsVariables && !state.readonlyNames.has(word)) {
      state.values.delete(word);
      state.exportedNames?.delete(word);
      state.unsetNames?.add(word);
    }
  }
}
