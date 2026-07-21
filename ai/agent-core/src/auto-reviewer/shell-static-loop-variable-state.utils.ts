import type { StaticVariableState } from './shell-static-assignment.types';

export function applyStaticLoopVariableValue(
  name: string,
  value: string,
  state: StaticVariableState,
): void {
  if (state.readonlyNames.has(name)) return;
  state.values.set(name, value);
}

export function clearStaticLoopVariable(
  name: string,
  state: StaticVariableState,
): void {
  if (state.readonlyNames.has(name)) return;
  state.values.delete(name);
}
