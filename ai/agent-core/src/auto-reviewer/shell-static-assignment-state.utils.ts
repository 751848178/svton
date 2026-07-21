import type {
  StaticShellAssignment,
  StaticVariableState,
} from './shell-static-assignment.types';
import { cloneStaticShellCommandStatusOptions } from './shell-static-option-command.utils';

export function applyStaticAssignmentState(
  assignment: StaticShellAssignment,
  state: StaticVariableState,
): void {
  if (state.readonlyNames.has(assignment.name) && !assignment.readonly) return;
  if (assignment.value === null) {
    state.values.delete(assignment.name);
    state.exportedNames?.delete(assignment.name);
  } else if (assignment.value !== undefined) state.values.set(assignment.name, assignment.value);
  state.unsetNames?.delete(assignment.name);
  const inheritsAllexport = assignment.value !== undefined
    && state.shellOptions.allexport
    && !assignment.blocksAllexport;
  if (assignment.exported === true || inheritsAllexport) state.exportedNames?.add(assignment.name);
  else if (assignment.exported === false) state.exportedNames?.delete(assignment.name);
  if (assignment.readonly) state.readonlyNames.add(assignment.name);
}

export function cloneStaticVariableState(state: StaticVariableState): StaticVariableState {
  return {
    values: new Map(state.values),
    unsetNames: state.unsetNames ? new Set(state.unsetNames) : undefined,
    exportedNames: state.exportedNames ? new Set(state.exportedNames) : undefined,
    readonlyNames: new Set(state.readonlyNames),
    shellOptions: cloneStaticShellCommandStatusOptions(state.shellOptions),
    localNames: state.localNames ? new Set(state.localNames) : undefined,
  };
}

export function commitStaticVariableState(
  target: StaticVariableState,
  source: StaticVariableState,
): void {
  target.values = source.values;
  target.unsetNames = source.unsetNames;
  target.exportedNames = source.exportedNames;
  target.readonlyNames = source.readonlyNames;
  target.shellOptions = source.shellOptions;
  if (source.localNames) target.localNames = source.localNames;
  else delete target.localNames;
}
