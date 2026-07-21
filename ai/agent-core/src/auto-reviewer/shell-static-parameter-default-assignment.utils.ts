import { applyStaticAssignmentState } from './shell-static-assignment-state.utils';
import type { StaticVariableState } from './shell-static-assignment.types';
import { staticShellWordValue } from './shell-static-variable-command.utils';

type ParameterDefaultAssignmentOperator = ':=' | '=';

interface ParameterDefaultAssignmentExpansion {
  name: string;
  operator: ParameterDefaultAssignmentOperator;
  word: string;
  length: number;
}

export function applyStaticParameterDefaultAssignmentState(
  statement: string,
  state: StaticVariableState,
): void {
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < statement.length; index += 1) {
    const char = statement[index];
    if (char === "'" && quote !== '"') {
      quote = quote === "'" ? null : "'";
      continue;
    }
    if (char === '"' && quote !== "'") {
      quote = quote === '"' ? null : '"';
      continue;
    }
    if (char === '\\' && quote !== "'") {
      index += 1;
      continue;
    }
    if (quote === "'") continue;

    const expansion = parameterDefaultAssignmentExpansion(statement, index);
    if (!expansion) continue;

    applyParameterDefaultAssignmentExpansion(expansion, state);
    index += expansion.length - 1;
  }
}

function applyParameterDefaultAssignmentExpansion(
  expansion: ParameterDefaultAssignmentExpansion,
  state: StaticVariableState,
): void {
  if (!parameterDefaultAssigns(expansion, state)) return;
  if (state.readonlyNames.has(expansion.name)) return;

  applyStaticAssignmentState({
    name: expansion.name,
    value: staticShellWordValue(expansion.word),
    readonly: false,
  }, state);
}

function parameterDefaultAssigns(
  expansion: ParameterDefaultAssignmentExpansion,
  state: StaticVariableState,
): boolean {
  if (!state.values.has(expansion.name)) return true;
  return expansion.operator === ':=' && state.values.get(expansion.name) === '';
}

function parameterDefaultAssignmentExpansion(
  statement: string,
  index: number,
): ParameterDefaultAssignmentExpansion | null {
  const match = statement.slice(index).match(/^\$\{([A-Za-z_][A-Za-z0-9_]*)(:=|=)([^}]*)\}/);
  if (!match) return null;

  return {
    name: match[1],
    operator: match[2] as ParameterDefaultAssignmentOperator,
    word: match[3],
    length: match[0].length,
  };
}
