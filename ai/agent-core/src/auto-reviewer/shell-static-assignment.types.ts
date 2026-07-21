import type { StaticShellCommandStatusOptions } from './shell-static-command-status.types';

export interface StaticShellAssignment {
  name: string;
  value?: string | null;
  readonly: boolean;
  exported?: boolean;
  blocksAllexport?: boolean;
}

export interface StaticVariableState {
  values: Map<string, string>;
  unsetNames?: Set<string>;
  exportedNames?: Set<string>;
  readonlyNames: Set<string>;
  shellOptions: StaticShellCommandStatusOptions;
  localNames?: Set<string>;
}

export interface StaticAssignmentCommandOptions {
  allowLocalDeclarations?: boolean;
  trackFunctionLocalDeclarations?: boolean;
}
