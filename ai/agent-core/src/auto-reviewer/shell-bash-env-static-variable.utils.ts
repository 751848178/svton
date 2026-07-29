import {
  bashEnvCommandPrefixAssignment,
  bashEnvStaticAssignment,
  bashEnvVariablesWithWorkingDir,
  type BashEnvAssignment,
} from './shell-bash-env-static-assignment.utils';
import {
  bashEnvEnvironmentVariables,
} from './shell-bash-env-startup-value.utils';
import { normalizeShellWordToken } from './shell-command.utils';

export interface BashEnvState {
  value: string;
  exported: boolean;
  allexport: boolean;
  errtrace: boolean;
  functrace: boolean;
  pipefail: boolean;
  readonlyNames: Set<string>;
  terminated: boolean;
  variables: Map<string, string>;
  exportedNames: Set<string>;
  startupExpandable: boolean;
  fdScripts: Map<number, string[]>;
  inheritedValue?: string;
  inheritedStartupExpandable?: boolean;
  localNames?: Set<string>;
}

export interface BashEnvPrefixValues {
  values: BashEnvStartupValue[];
  overrides: boolean;
  variables: Map<string, string>;
}

export interface BashEnvStartupValue {
  value: string;
  variables: Map<string, string>;
  expandVariables: boolean;
}

export function createBashEnvState(): BashEnvState {
  return {
    value: '',
    exported: false,
    allexport: false,
    errtrace: false,
    functrace: false,
    pipefail: false,
    readonlyNames: new Set(),
    terminated: false,
    variables: new Map(),
    exportedNames: new Set(),
    startupExpandable: false,
    fdScripts: new Map(),
  };
}

export function bashEnvStartupValuesFromPrefix(
  tokens: string[],
  state: BashEnvState,
  allowPrefixVariables: boolean,
  workingDir = '',
): BashEnvPrefixValues {
  const variables = bashEnvVariablesWithWorkingDir(state.variables, workingDir);
  const startupVariables = bashEnvEnvironmentVariables(state.variables, state.exportedNames);
  const assignments: BashEnvAssignment[] = [];
  const result: BashEnvPrefixValues = { values: [], overrides: false, variables: startupVariables };

  for (const token of tokens) {
    const assignment = bashEnvCommandPrefixAssignment(token, variables, workingDir);
    if (!assignment) continue;

    assignments.push(assignment);
    startupVariables.set(assignment.name, assignment.value);
    if (allowPrefixVariables) variables.set(assignment.name, assignment.value);
  }

  for (const assignment of assignments) {
    if (assignment.name === 'BASH_ENV') {
      if (state.readonlyNames.has('BASH_ENV')) continue;
      result.overrides = true;
      if (assignment.value) {
        result.values.push({
          value: assignment.value,
          variables: new Map(startupVariables),
          expandVariables: assignment.startupExpandable,
        });
      }
    }
  }

  return result;
}

export function applyBashEnvAssignmentTokens(
  tokens: string[],
  state: BashEnvState,
  exported?: boolean,
  workingDir = '',
): void {
  const variables = bashEnvVariablesWithWorkingDir(state.variables, workingDir);
  for (const token of tokens) {
    const assignment = bashEnvStaticAssignment(token, variables, workingDir);
    if (!assignment) continue;
    applyBashEnvKnownAssignment(assignment, state, exported);
    variables.set(assignment.name, assignment.value);
    if (state.terminated) return;
  }
}

export function applyBashEnvUnsetTokens(tokens: string[], state: BashEnvState): void {
  for (const token of tokens.slice(1)) {
    const name = normalizeShellWordToken(token);
    if (!name || name.startsWith('-')) continue;
    if (state.readonlyNames.has(name)) continue;
    state.variables.delete(name);
    state.exportedNames.delete(name);
    if (name !== 'BASH_ENV') continue;
    state.value = '';
    state.exported = false;
    state.startupExpandable = false;
  }
}

export function applyBashEnvKnownAssignment(
  assignment: BashEnvAssignment,
  state: BashEnvState,
  exported?: boolean,
): void {
  if (state.readonlyNames.has(assignment.name)) {
    state.terminated = true;
    return;
  }

  state.variables.set(assignment.name, assignment.value);
  if (exported === true) state.exportedNames.add(assignment.name);
  else if (exported === false) state.exportedNames.delete(assignment.name);
  if (assignment.name !== 'BASH_ENV') return;

  state.value = assignment.value;
  state.startupExpandable = assignment.startupExpandable;
  if (exported === true) state.exported = true;
  else if (exported === false) state.exported = false;
}
