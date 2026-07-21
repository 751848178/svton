import {
  applyBashEnvKnownAssignment,
  bashEnvStaticAssignment,
  bashEnvVariablesWithWorkingDir,
  type BashEnvState,
} from './shell-bash-env-static-variable.utils';
import { normalizeShellWordToken, unquoteShellToken } from './shell-command.utils';

const LOCAL_DECLARATION_COMMANDS = new Set(['declare', 'local', 'typeset']);

export function applyBashEnvDeclarationTokens(
  commandName: string,
  tokens: string[],
  state: BashEnvState,
  workingDir = '',
): void {
  const readonlyDeclaration = commandName === 'readonly';
  let exportState: boolean | undefined = commandName === 'export' ? true : undefined;
  let appliesReadonly = readonlyDeclaration;
  let declaresGlobal = false;
  const baseVariables = bashEnvVariablesWithWorkingDir(state.variables, workingDir);

  for (const token of tokens.slice(1)) {
    const word = unquoteShellToken(token);
    if (word === '--') continue;
    if (word.startsWith('-') || word.startsWith('+')) {
      if (readonlyDeclaration) return;
      if (word.startsWith('-') && word.includes('g')) declaresGlobal = true;
      if (word.includes('n')) exportState = false;
      else if (word.startsWith('+')) exportState = state.allexport ? true : false;
      else if (word.includes('x') || commandName === 'export') exportState = true;
      appliesReadonly ||= word.startsWith('-') && word.includes('r');
      continue;
    }

    const assignment = bashEnvStaticAssignment(token, baseVariables, workingDir);
    const name = assignment?.name ?? normalizeShellWordToken(token);
    if (!/^[A-Za-z_]\w*$/.test(name)) continue;

    const localDeclaration = isFunctionLocalDeclaration(commandName, state, declaresGlobal);
    const exported = declarationExportState(exportState, state, name, localDeclaration);
    if (localDeclaration) markLocalDeclarationName(name, state);

    if (assignment) {
      applyBashEnvKnownAssignment(assignment, state, exported);
      if (state.terminated) return;
      if (appliesReadonly) state.readonlyNames.add(assignment.name);
      continue;
    }

    if (appliesReadonly) state.readonlyNames.add(name);
    if (exported === true) state.exportedNames.add(name);
    else if (exported === false) state.exportedNames.delete(name);
    if (exported !== undefined && name === 'BASH_ENV') state.exported = exported;
  }
}

function declarationExportState(
  exportState: boolean | undefined,
  state: BashEnvState,
  name: string,
  localDeclaration: boolean,
): boolean | undefined {
  if (exportState !== undefined) return exportState;
  if (state.allexport) return true;
  return localDeclaration && state.exportedNames.has(name) ? true : undefined;
}

function isFunctionLocalDeclaration(
  commandName: string,
  state: BashEnvState,
  declaresGlobal: boolean,
): boolean {
  return state.localNames !== undefined
    && LOCAL_DECLARATION_COMMANDS.has(commandName)
    && !declaresGlobal;
}

function markLocalDeclarationName(name: string, state: BashEnvState): void {
  state.localNames?.add(name);
  if (name !== 'BASH_ENV' || state.inheritedValue !== undefined) return;
  if (!state.exported || !state.value) return;
  state.inheritedValue = state.value;
  state.inheritedStartupExpandable = state.startupExpandable;
}
