import { bashReadsStartupFile } from './shell-bash-startup-invocation.utils';
import { bashEnvEnvironmentVariables, expandBashEnvStartup } from './shell-bash-env-startup-value.utils';
import { bashEnvStartupFilenameHasLiteralShellSyntax } from './shell-bash-env-startup-filename.utils';
import { expandLeadingCommandSubstitutionTokens, mergeWholeCommandSubstitutionTokens } from './command-substitution-token.utils';
import { envCommandEnvironmentEffect } from './env-command-environment-effect.utils';
import { getShellTokenBasename } from './shell-command.utils';
import { splitStaticAssignmentCommandStatements } from './shell-static-assignment-statement.utils';
import { shellAssignmentPrefixName, splitShellAssignmentPrefixes } from './shell-assignment-prefix.utils';
import { unwrapShellGroupCommand } from './shell-group-command.utils';
import { splitUnquotedIfsExpansionTokens } from './shell-ifs-word-splitting.utils';
import { shellCommandStringTokenGroups } from './shell-launcher-command.utils';
import { bashEnvFdStartupCommandStrings } from './shell-bash-env-fd-startup-command.utils';
import { moveLeadingFdInputRedirectsAfterCommand } from './shell-bash-env-fd-redirection-token.utils';
import { splitShellWordsWithProcessSubstitutions } from './shell-process-substitution-word.utils';
import { shouldApplyStaticStatement } from './shell-static-command-list-assignment.utils';
import { staticShellCommandExecutionStatus } from './shell-static-command-execution-status.utils';
import type { StaticShellCommandStatus } from './shell-static-command-status.types';
import { applyStaticShellOptionState } from './shell-static-option-command.utils';
import { applyBashEnvAssignmentTokens, applyBashEnvUnsetTokens, bashEnvStartupValuesFromPrefix, bashEnvVariablesWithWorkingDir, createBashEnvState, type BashEnvState } from './shell-bash-env-static-variable.utils';
import { applyBashEnvDeclarationTokens } from './shell-bash-env-declaration-state.utils';
import { activeBashEnvStartup } from './shell-bash-env-function-state.utils';
import { applyBashEnvStaticCommandAssignment } from './shell-bash-env-static-command.utils';
import { bashEnvStateCommandTokens } from './shell-bash-env-state-command.utils';
import { applyBashEnvPersistentFdState, bashEnvPersistentFdStartupCommandStrings } from './shell-bash-env-persistent-fd-state.utils';

type TokensStartWithShell = (tokens: string[]) => boolean;
type TokenResolvesToShell = (token: string) => boolean;
export type BashEnvStartupCommandStringOptions = {
  allowLocalDeclarations?: boolean;
  sourceCommand?: string;
  state?: BashEnvState;
  workingDir?: string;
};

export function bashEnvStartupCommandStrings(
  command: string,
  tokensStartWithShell: TokensStartWithShell,
  tokenResolvesToShell: TokenResolvesToShell,
  options: BashEnvStartupCommandStringOptions = {},
): string[] {
  const state = options.state ?? createBashEnvState();
  const sourceCommand = options.sourceCommand ?? command;
  let previousStatus: StaticShellCommandStatus = null;

  return splitStaticAssignmentCommandStatements(command).flatMap(({ statement, operatorBefore }) => {
    if (state.terminated) return [];
    if (!shouldApplyStaticStatement(operatorBefore, previousStatus)) return [];

    const tokens = splitBashEnvCommandTokens(statement);
    const startupCommands = bashEnvStartupCommandsForTokens(
      statement,
      tokens,
      state,
      tokensStartWithShell,
      tokenResolvesToShell,
      sourceCommand,
      options.workingDir ?? '',
    );
    applyBashEnvState(statement, tokens, state, options);
    previousStatus = staticShellCommandExecutionStatus(statement, {
      allexport: state.allexport,
      pipefail: state.pipefail,
    }).status;
    return startupCommands;
  });
}

function splitBashEnvCommandTokens(command: string): string[] {
  const tokens = mergeWholeCommandSubstitutionTokens(
    splitShellWordsWithProcessSubstitutions(unwrapShellGroupCommand(command)),
  );
  const expandedTokens = shellAssignmentPrefixName(tokens[0] ?? '')
    ? tokens
    : expandLeadingCommandSubstitutionTokens(tokens);
  return splitUnquotedIfsExpansionTokens(expandedTokens);
}

function bashEnvStartupCommandsForTokens(
  statement: string,
  tokens: string[],
  state: BashEnvState,
  tokensStartWithShell: TokensStartWithShell,
  tokenResolvesToShell: TokenResolvesToShell,
  sourceCommand: string,
  workingDir: string,
): string[] {
  const shellGroupTokens = moveLeadingFdInputRedirectsAfterCommand(tokens);
  return shellCommandStringTokenGroups(shellGroupTokens, tokensStartWithShell)
    .filter((shellTokens) => bashReadsStartupFile(shellTokens, tokenResolvesToShell))
    .flatMap((shellTokens) => {
      const shellIndex = shellTokens.findIndex(tokenResolvesToShell);
      const prefixTokens = shellTokens.slice(0, shellIndex);
      const directStartup = bashEnvStartupValuesFromPrefix(prefixTokens, state, prefixAssignmentsExpandInShell(tokens), workingDir);
      if (directStartup.overrides) {
        return directStartup.values.flatMap((startup) => bashEnvSourceCommands(
          startup.value,
          statement,
          sourceCommand,
          startup.variables,
          startup.expandVariables,
          workingDir,
          state,
        ));
      }
      const activeStartup = activeBashEnvStartup(state);
      if (!activeStartup || !segmentPreservesBashEnv(tokens)) return [];
      return bashEnvSourceCommands(activeStartup.value, statement, sourceCommand, bashEnvEnvironmentVariables(state.variables, state.exportedNames), activeStartup.startupExpandable, workingDir, state);
    });
}

function prefixAssignmentsExpandInShell(tokens: string[]): boolean {
  const { commandTokens } = splitShellAssignmentPrefixes(tokens);
  return getShellTokenBasename(commandTokens[0] ?? '') !== 'env';
}

function bashEnvSourceCommands(
  value: string,
  statement: string,
  sourceCommand: string,
  variables: Map<string, string>,
  expandVariables: boolean,
  workingDir: string,
  state: BashEnvState,
): string[] {
  const startup = expandBashEnvStartup(value, bashEnvVariablesWithWorkingDir(variables, workingDir), expandVariables, workingDir);
  if (!startup.value) return [];

  if (
    startup.hasUnresolvedParameterExpansion
    || (expandVariables && bashEnvStartupFilenameHasLiteralShellSyntax(startup.value))
  ) return startup.commands;

  return [
    `source ${startup.value}`,
    ...startup.commands,
    ...bashEnvFdStartupCommandStrings(statement, startup.value, sourceCommand),
    ...bashEnvPersistentFdStartupCommandStrings(state, startup.value),
  ];
}

function segmentPreservesBashEnv(tokens: string[]): boolean {
  const { commandTokens } = splitShellAssignmentPrefixes(tokens);
  if (getShellTokenBasename(commandTokens[0] ?? '') !== 'env') return true;
  const effect = envCommandEnvironmentEffect(commandTokens);
  return effect.preservesParentEnvironment && !effect.unsetNames.has('BASH_ENV');
}

function applyBashEnvState(
  statement: string,
  tokens: string[],
  state: BashEnvState,
  options: BashEnvStartupCommandStringOptions,
): void {
  const { assignmentPrefixes, commandTokens } = splitShellAssignmentPrefixes(tokens);
  if (commandTokens.length === 0) {
    applyBashEnvAssignmentTokens(assignmentPrefixes, state, state.allexport || undefined, options.workingDir ?? '');
    return;
  }

  const stateCommandTokens = bashEnvStateCommandTokens(commandTokens, options);
  const activeCommandTokens = stateCommandTokens.length > 0 ? stateCommandTokens : commandTokens;
  const commandName = getShellTokenBasename(activeCommandTokens[0] ?? '');
  applyBashEnvPersistentFdState(statement, tokens, state);
  if (commandName === 'unset') {
    applyBashEnvUnsetTokens(activeCommandTokens, state);
    return;
  }
  if (commandName === 'set') {
    applyBashEnvShellOptionState(statement, state);
    return;
  }
  if (stateCommandTokens.length > 0) {
    applyBashEnvDeclarationTokens(commandName, stateCommandTokens, state, options.workingDir ?? '');
    return;
  }
  applyBashEnvStaticCommandAssignment(commandTokens, state);
}

function applyBashEnvShellOptionState(statement: string, state: BashEnvState): void {
  const options = {
    allexport: state.allexport,
    errtrace: state.errtrace,
    functrace: state.functrace,
    pipefail: state.pipefail,
  };
  if (!applyStaticShellOptionState(statement, options)) return;
  state.allexport = options.allexport === true;
  state.errtrace = options.errtrace === true;
  state.functrace = options.functrace === true;
  state.pipefail = options.pipefail === true;
}
