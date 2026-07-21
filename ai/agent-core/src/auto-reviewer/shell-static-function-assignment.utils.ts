import { getShellTokenBasename, normalizeShellWordToken, splitShellWords } from './shell-command.utils';
import {
  expandShellFunctionCommand,
  resolveShellFunctionCommand,
  type ShellFunctionDefinitions,
} from './shell-function-command.utils';
import type { StaticAssignmentCommandOptions, StaticVariableState } from './shell-static-assignment.types';
import { applyStaticAssignmentState } from './shell-static-assignment-state.utils';
import { staticShellCommandExecutionStatus } from './shell-static-command-execution-status.utils';
import {
  staticShellFunctionCommandStatus,
} from './shell-static-command-status.utils';
import { staticDeclarationAssignments } from './shell-static-declaration-assignment.utils';
import { withExportedStaticEnvCommand } from './shell-static-exported-env-command.utils';
import { applyStaticFunctionCommandListState } from './shell-static-function-command-list-assignment.utils';
import { applyStaticFunctionStatementState } from './shell-static-function-statement-assignment.utils';
import { isStaticShellControlStatement } from './shell-static-control-statement.utils';
import { cloneStaticShellCommandStatusOptions } from './shell-static-option-command.utils';
import { substituteStaticShellVariables } from './shell-static-variable-command.utils';

const MAX_STATIC_FUNCTION_DEPTH = 3;

type ApplyStaticVariableState = (
  statement: string,
  state: StaticVariableState,
  options: StaticAssignmentCommandOptions,
  evalDepth?: number,
  shellFunctions?: ShellFunctionDefinitions,
) => void;

export function applyStaticFunctionState(
  command: string,
  state: StaticVariableState,
  options: StaticAssignmentCommandOptions,
  parentFunctions: ShellFunctionDefinitions,
  applyStaticVariableState: ApplyStaticVariableState,
  functionDepth = 0,
): string | null {
  if (functionDepth >= MAX_STATIC_FUNCTION_DEPTH) return null;

  const callerValues = new Map(state.values);
  const callerReadonlyNames = new Set(state.readonlyNames);
  const callerExportedNames = new Set(state.exportedNames);
  const expandedStatements: string[] = [];
  const functionState: StaticVariableState = {
    values: new Map(state.values),
    exportedNames: state.exportedNames ? new Set(state.exportedNames) : undefined,
    readonlyNames: new Set(state.readonlyNames),
    shellOptions: cloneStaticShellCommandStatusOptions(state.shellOptions),
    localNames: new Set(),
  };
  const shellFunctions = new Map(parentFunctions);
  const functionOptions = {
    ...options,
    trackFunctionLocalDeclarations: true,
  };
  let changed = false;

  applyStaticFunctionCommandListState(command, (statement) => {
    const shellCommand = resolveShellFunctionCommand(statement, shellFunctions);
    if (shellCommand === null) {
      expandedStatements.push(statement);
      return true;
    }

    const substituted = substituteStaticShellVariables(statement, functionState.values, functionState.unsetNames);
    const expanded = isStaticShellControlStatement(statement)
      ? substituted
      : withExportedStaticEnvCommand(substituted, functionState);
    expandedStatements.push(expanded);
    changed ||= expanded !== statement;
    if (shellCommand !== statement) {
      const nestedVariant = applyStaticFunctionState(
        expandShellFunctionCommand(expanded, shellCommand),
        functionState,
        functionOptions,
        shellFunctions,
        applyStaticVariableState,
        functionDepth + 1,
      );
      if (nestedVariant) {
        expandedStatements[expandedStatements.length - 1] = nestedVariant;
        changed = true;
      }
      return {
        status: staticShellFunctionCommandStatus(
          expanded,
          shellCommand,
          functionState.shellOptions,
        ),
        exitsOnErrexit: true,
      };
    }

    return applyStaticFunctionStatementState(
      expanded,
      functionState,
      functionOptions,
      shellFunctions,
      applyStaticVariableState,
      staticFunctionAwareExecutionStatus,
    );
  }, functionState.shellOptions);

  commitStaticFunctionState(
    state,
    functionState,
    callerValues,
    callerReadonlyNames,
    callerExportedNames,
  );
  state.shellOptions = functionState.shellOptions;
  return changed ? expandedStatements.join('; ') : null;
}

function commitStaticFunctionState(
  target: StaticVariableState,
  source: StaticVariableState,
  callerValues: Map<string, string>,
  callerReadonlyNames: Set<string>,
  callerExportedNames: Set<string>,
): void {
  const nextValues = new Map(source.values);
  const nextReadonlyNames = new Set(source.readonlyNames);
  const nextExportedNames = source.exportedNames ? new Set(source.exportedNames) : undefined;

  for (const localName of source.localNames ?? []) {
    if (callerValues.has(localName)) nextValues.set(localName, callerValues.get(localName) ?? '');
    else nextValues.delete(localName);

    if (callerReadonlyNames.has(localName)) nextReadonlyNames.add(localName);
    else nextReadonlyNames.delete(localName);

    if (callerExportedNames.has(localName)) nextExportedNames?.add(localName);
    else nextExportedNames?.delete(localName);
  }

  target.values = nextValues;
  target.readonlyNames = nextReadonlyNames;
  if (nextExportedNames) target.exportedNames = nextExportedNames;
  else delete target.exportedNames;
}

function staticFunctionAwareExecutionStatus(
  statement: string,
  state: StaticVariableState,
  shellFunctions: ShellFunctionDefinitions,
) {
  const shellCommand = resolveShellFunctionCommand(statement, shellFunctions);
  if (shellCommand === null) return { status: true, exitsOnErrexit: false };
  if (shellCommand === statement) return staticShellCommandExecutionStatus(statement, state.shellOptions);

  return {
    status: staticShellFunctionCommandStatus(statement, shellCommand, state.shellOptions),
    exitsOnErrexit: true,
  };
}

export function applyFunctionLocalDeclaration(statement: string, state: StaticVariableState): boolean {
  const tokens = splitShellWords(statement);
  const command = getShellTokenBasename(tokens[0] ?? '');
  if (!['declare', 'local', 'typeset'].includes(command)) return false;

  let marksLocal = command === 'local' || command === 'declare' || command === 'typeset';
  const names: string[] = [];
  for (const token of tokens.slice(1)) {
    const word = normalizeShellWordToken(token);
    if (word === '--') continue;
    if (word.startsWith('-')) {
      if (word.includes('g')) marksLocal = false;
      continue;
    }

    const separator = token.indexOf('=');
    const name = normalizeShellWordToken(separator >= 0 ? token.slice(0, separator) : token);
    if (/^[A-Za-z_]\w*$/.test(name)) names.push(name);
  }

  if (!marksLocal || names.length === 0) return false;
  state.localNames ??= new Set();
  names.forEach((name) => state.localNames?.add(name));
  staticDeclarationAssignments(statement, { allowLocalDeclarations: true })
    .forEach((declaration) => applyStaticAssignmentState(declaration, state));
  return true;
}
