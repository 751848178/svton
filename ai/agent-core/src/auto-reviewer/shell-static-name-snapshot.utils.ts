import type { StaticVariableState } from './shell-static-assignment.types';

export interface StaticNameSnapshot {
  exported: boolean;
  readonly: boolean;
  unset: boolean;
  value?: string;
}

export function snapshotStaticVariableNames(
  names: Set<string>,
  state: StaticVariableState,
): Map<string, StaticNameSnapshot> {
  const snapshots = new Map<string, StaticNameSnapshot>();
  for (const name of names) {
    const value = state.values.get(name);
    snapshots.set(name, {
      exported: state.exportedNames?.has(name) ?? false,
      readonly: state.readonlyNames.has(name),
      unset: state.unsetNames?.has(name) ?? false,
      ...(value === undefined ? {} : { value }),
    });
  }
  return snapshots;
}

export function restoreStaticVariableNames(
  snapshots: Map<string, StaticNameSnapshot>,
  state: StaticVariableState,
): void {
  for (const [name, snapshot] of snapshots) {
    if (snapshot.value === undefined) state.values.delete(name);
    else state.values.set(name, snapshot.value);
    restoreOptionalSetName(state.exportedNames, name, snapshot.exported);
    restoreRequiredSetName(state.readonlyNames, name, snapshot.readonly);
    if (snapshot.unset) {
      state.unsetNames ??= new Set();
      state.unsetNames.add(name);
    } else state.unsetNames?.delete(name);
  }
}

function restoreOptionalSetName(set: Set<string> | undefined, name: string, included: boolean): void {
  if (included) set?.add(name);
  else set?.delete(name);
}

function restoreRequiredSetName(set: Set<string>, name: string, included: boolean): void {
  if (included) set.add(name);
  else set.delete(name);
}
