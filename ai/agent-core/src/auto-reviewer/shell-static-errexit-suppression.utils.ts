import type { StaticVariableState } from './shell-static-assignment.types';

export function withStaticErrexitSuppressed<T>(
  state: StaticVariableState,
  run: () => T,
): T {
  const previousSuppressed = state.shellOptions.errexitSuppressed;
  state.shellOptions.errexitSuppressed = true;
  try {
    return run();
  } finally {
    state.shellOptions.errexitSuppressed = previousSuppressed;
  }
}

export function withOptionalStaticErrexitSuppressed<T>(
  state: StaticVariableState,
  enabled: boolean,
  run: () => T,
): T {
  return enabled ? withStaticErrexitSuppressed(state, run) : run();
}
