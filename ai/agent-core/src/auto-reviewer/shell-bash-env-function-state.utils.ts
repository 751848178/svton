import { type BashEnvState } from './shell-bash-env-static-variable.utils';

export interface ActiveBashEnvStartup {
  value: string;
  startupExpandable: boolean;
}

export function cloneBashEnvState(state: BashEnvState): BashEnvState {
  return {
    value: state.value,
    exported: state.exported,
    allexport: state.allexport,
    errtrace: state.errtrace,
    functrace: state.functrace,
    pipefail: state.pipefail,
    readonlyNames: new Set(state.readonlyNames),
    terminated: state.terminated,
    variables: new Map(state.variables),
    exportedNames: new Set(state.exportedNames),
    startupExpandable: state.startupExpandable,
    fdScripts: new Map([...state.fdScripts].map(([fd, scripts]) => [fd, [...scripts]])),
    inheritedValue: state.inheritedValue,
    inheritedStartupExpandable: state.inheritedStartupExpandable,
    localNames: state.localNames ? new Set(state.localNames) : undefined,
  };
}

export function createBashEnvFunctionState(caller: BashEnvState): BashEnvState {
  const state = cloneBashEnvState(caller);
  state.localNames = new Set();
  return state;
}

export function commitBashEnvFunctionState(
  target: BashEnvState,
  source: BashEnvState,
  caller: BashEnvState,
): void {
  assignBashEnvState(target, source);
  for (const name of source.localNames ?? []) restoreCallerName(target, caller, name);
  restoreLocalTracking(target, caller);
}

export function activeBashEnvStartup(state: BashEnvState): ActiveBashEnvStartup | null {
  if (state.exported && state.value) {
    return { value: state.value, startupExpandable: state.startupExpandable };
  }
  if (!state.inheritedValue) return null;
  return {
    value: state.inheritedValue,
    startupExpandable: state.inheritedStartupExpandable === true,
  };
}

function assignBashEnvState(target: BashEnvState, source: BashEnvState): void {
  target.value = source.value;
  target.exported = source.exported;
  target.allexport = source.allexport;
  target.errtrace = source.errtrace;
  target.functrace = source.functrace;
  target.pipefail = source.pipefail;
  target.readonlyNames = new Set(source.readonlyNames);
  target.terminated = source.terminated;
  target.variables = new Map(source.variables);
  target.exportedNames = new Set(source.exportedNames);
  target.startupExpandable = source.startupExpandable;
  target.fdScripts = new Map([...source.fdScripts].map(([fd, scripts]) => [fd, [...scripts]]));
  target.inheritedValue = source.inheritedValue;
  target.inheritedStartupExpandable = source.inheritedStartupExpandable;
  target.localNames = source.localNames ? new Set(source.localNames) : undefined;
}

function restoreCallerName(target: BashEnvState, caller: BashEnvState, name: string): void {
  if (caller.variables.has(name)) target.variables.set(name, caller.variables.get(name) ?? '');
  else target.variables.delete(name);

  if (caller.exportedNames.has(name)) target.exportedNames.add(name);
  else target.exportedNames.delete(name);

  if (caller.readonlyNames.has(name)) target.readonlyNames.add(name);
  else target.readonlyNames.delete(name);

  if (name === 'BASH_ENV') restoreCallerBashEnv(target, caller);
}

function restoreCallerBashEnv(target: BashEnvState, caller: BashEnvState): void {
  target.value = caller.value;
  target.exported = caller.exported;
  target.startupExpandable = caller.startupExpandable;
  target.inheritedValue = caller.inheritedValue;
  target.inheritedStartupExpandable = caller.inheritedStartupExpandable;
}

function restoreLocalTracking(target: BashEnvState, caller: BashEnvState): void {
  target.localNames = caller.localNames ? new Set(caller.localNames) : undefined;
}
