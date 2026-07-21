import { evalCommandString } from './eval-command-string.utils';
import { nextStaticWorkingDirState, type WorkingDirState } from './rm-working-dir.utils';
import { shellCaseBranchCommandStrings } from './shell-case-command.utils';
import { splitShellCommandListSegments } from './shell-command-list.utils';
import { stripShellControlCommandPrefix } from './shell-control-command.utils';
import { type ShellPositionalArguments, shellPositionalTargetTokens } from './shell-positional-parameter.utils';

type SplitCommandTokens = (command: string) => string[];

export function nextStaticShellCommandWorkingDirState(
  command: string,
  state: WorkingDirState,
  splitCommandTokens: SplitCommandTokens,
  positionals?: ShellPositionalArguments,
): WorkingDirState {
  let currentState = state;
  for (const statement of splitShellCommandListSegments(command)) {
    currentState = nextStaticShellStatementWorkingDirState(
      statement,
      currentState,
      splitCommandTokens,
      positionals,
    );
  }

  return currentState;
}

function nextStaticShellStatementWorkingDirState(
  statement: string,
  state: WorkingDirState,
  splitCommandTokens: SplitCommandTokens,
  positionals?: ShellPositionalArguments,
): WorkingDirState {
  const command = stripShellControlCommandPrefix(statement);
  const braceGroup = unwrapBraceGroupCommand(command);
  if (braceGroup) {
    return nextStaticShellCommandWorkingDirState(braceGroup, state, splitCommandTokens, positionals);
  }

  const caseBranches = shellCaseBranchCommandStrings(command);
  if (caseBranches.length === 1) {
    return nextStaticShellCommandWorkingDirState(caseBranches[0], state, splitCommandTokens, positionals);
  }

  const evalTokens = splitCommandTokens(command, true)
    .flatMap((token) => shellPositionalTargetTokens(token, positionals));
  const evalCommand = evalCommandString(evalTokens);
  if (evalCommand) {
    return nextStaticShellCommandWorkingDirState(evalCommand, state, splitCommandTokens, positionals);
  }

  const tokens = splitCommandTokens(command).flatMap((token) => shellPositionalTargetTokens(token, positionals));
  return nextStaticWorkingDirState(tokens, state);
}

function unwrapBraceGroupCommand(command: string): string {
  const trimmed = command.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return '';

  return trimmed.slice(1, -1).trim().replace(/;$/, '').trim();
}
