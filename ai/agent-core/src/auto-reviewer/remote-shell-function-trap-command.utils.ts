import {
  expandShellFunctionPipelineCommand,
  resolveShellFunctionCommand,
  type ShellFunctionDefinitions,
} from './shell-function-command.utils';
import {
  applyShellFunctionExport,
  shellCommandStringReceivesExportedFunction,
} from './shell-exported-function-command-string.utils';
import { bashEnvStartupCommandStrings } from './shell-bash-env-command-string.utils';
import { createBashEnvState, type BashEnvState } from './shell-bash-env-static-variable.utils';
import { cloneBashEnvState, commitBashEnvFunctionState, createBashEnvFunctionState } from './shell-bash-env-function-state.utils';
import {
  type ShellTrapActionCommand,
  shellTrapCommandUpdateFromStatement,
} from './shell-trap-action-command.utils';
import { applyShellTrapCommandUpdate } from './shell-trap-command-state.utils';
import {
  exitTrapCommandReceivesRemoteFetch,
  signalTrapCommandsReceiveRemoteFetch,
} from './remote-shell-trap-bash-env-command.utils';
import {
  functionTrapExecutionReceivesRemoteFetch,
  inheritedFunctionTrapCommands,
  staticStatementFiresErrTrap,
} from './remote-shell-function-trap-execution.utils';
import { hasStaticAssignmentCommandVariant } from './shell-static-assignment-variant.utils';
import { splitShellPipelineSegments } from './shell-pipeline-command.utils';
import { splitStaticAssignmentCommandStatements } from './shell-static-assignment-statement.utils';
import { shouldApplyStaticStatement } from './shell-static-command-list-assignment.utils';
import { staticShellCommandExecutionStatus } from './shell-static-command-execution-status.utils';
import type { StaticShellCommandStatus } from './shell-static-command-status.types';

type SplitCommandTokens = (command: string) => string[];
type TokensStartWithShell = (tokens: string[]) => boolean;
type TokenResolvesToShell = (token: string) => boolean;
type RemoteFetchDetector = (command: string, depth: number) => boolean;

export function shellFunctionOrTrapReceivesRemoteFetch(
  command: string,
  depth: number,
  splitCommandTokens: SplitCommandTokens,
  tokensStartWithShell: TokensStartWithShell,
  tokenResolvesToShell: TokenResolvesToShell,
  receivesRemoteFetch: RemoteFetchDetector,
  workingDir = '',
): boolean {
  const shellFunctions = new Map<string, string>();
  const exportedShellFunctions = new Map<string, string>();
  let trapCommands: ShellTrapActionCommand[] = [];
  const bashEnvState = createBashEnvState();
  let previousStatus: StaticShellCommandStatus = null;

  const statements = splitStaticAssignmentCommandStatements(command);
  for (let index = 0; index < statements.length; index += 1) {
    const { statement: segment, operatorBefore } = statements[index];
    const nextOperator = statements[index + 1]?.operatorBefore ?? null;
    if (!shouldApplyStaticStatement(operatorBefore, previousStatus)) continue;
    if (signalTrapCommandsReceiveRemoteFetch(
      trapCommands,
      'DEBUG',
      trapRemoteFetchContext(
        shellFunctions,
        depth,
        tokensStartWithShell,
        tokenResolvesToShell,
        receivesRemoteFetch,
        bashEnvState,
        workingDir,
      ),
    )) return true;
    const shellCommand = resolveShellFunctionCommand(segment, shellFunctions);
    if (shellCommand === null) {
      previousStatus = bashEnvStaticCommandStatus(segment, bashEnvState);
      continue;
    }
    const functionCommand = expandShellFunctionPipelineCommand(segment, shellFunctions);
    if (functionCommand !== segment) {
      const callerBashEnvState = cloneBashEnvState(bashEnvState);
      const functionBashEnvState = createBashEnvFunctionState(callerBashEnvState);
      if (functionTrapExecutionReceivesRemoteFetch(
        functionCommand,
        {
          shellFunctions,
          depth,
          splitCommandTokens,
          tokensStartWithShell,
          tokenResolvesToShell,
          receivesRemoteFetch,
          state: functionBashEnvState,
          workingDir,
        },
        functionBashEnvState,
        inheritedFunctionTrapCommands(trapCommands, bashEnvState),
      )) return true;
      if (splitShellPipelineSegments(segment).length === 1) commitBashEnvFunctionState(bashEnvState, functionBashEnvState, callerBashEnvState);
      if (hasStaticAssignmentCommandVariant(
        functionCommand,
        (variant) => receivesRemoteFetch(variant, depth + 1),
        { allowLocalDeclarations: true },
      )) return true;
      if (receivesRemoteFetch(functionCommand, depth + 1)) return true;
      previousStatus = bashEnvStaticCommandStatus(segment, bashEnvState);
      continue;
    }
    if (bashEnvSegmentReceivesRemoteFetch(
      segment,
      depth,
      tokensStartWithShell,
      tokenResolvesToShell,
      receivesRemoteFetch,
      bashEnvState,
      workingDir,
    )) return true;
    applyShellFunctionExport(segment, shellFunctions, exportedShellFunctions, splitCommandTokens);
    if (shellCommandStringReceivesExportedFunction(
      segment,
      exportedShellFunctions,
      tokensStartWithShell,
      tokenResolvesToShell,
      receivesRemoteFetch,
      depth,
    )) return true;

    const trapUpdate = shellTrapCommandUpdateFromStatement(segment, shellFunctions, splitCommandTokens);
    if (trapUpdate) trapCommands = applyShellTrapCommandUpdate(trapCommands, trapUpdate);
    previousStatus = bashEnvStaticCommandStatus(segment, bashEnvState);
    if (
      staticStatementFiresErrTrap(previousStatus, nextOperator)
      && signalTrapCommandsReceiveRemoteFetch(
        trapCommands,
        'ERR',
        trapRemoteFetchContext(
          shellFunctions,
          depth,
          tokensStartWithShell,
          tokenResolvesToShell,
          receivesRemoteFetch,
          bashEnvState,
          workingDir,
        ),
      )
    ) return true;
  }

  return exitTrapCommandReceivesRemoteFetch(
    trapCommands,
    trapRemoteFetchContext(
      shellFunctions,
      depth,
      tokensStartWithShell,
      tokenResolvesToShell,
      receivesRemoteFetch,
      bashEnvState,
      workingDir,
    ),
  );
}

function bashEnvSegmentReceivesRemoteFetch(
  segment: string,
  depth: number,
  tokensStartWithShell: TokensStartWithShell,
  tokenResolvesToShell: TokenResolvesToShell,
  receivesRemoteFetch: RemoteFetchDetector,
  state: BashEnvState,
  workingDir: string,
): boolean {
  return bashEnvStartupCommandStrings(
    segment,
    tokensStartWithShell,
    tokenResolvesToShell,
    { state, workingDir },
  ).some((script) => receivesRemoteFetch(script, depth + 1));
}

function bashEnvStaticCommandStatus(
  segment: string,
  state: BashEnvState,
): StaticShellCommandStatus {
  return staticShellCommandExecutionStatus(segment, {
    allexport: state.allexport,
    errtrace: state.errtrace,
    functrace: state.functrace,
    pipefail: state.pipefail,
  }).status;
}

function trapRemoteFetchContext(
  shellFunctions: ShellFunctionDefinitions,
  depth: number,
  tokensStartWithShell: TokensStartWithShell,
  tokenResolvesToShell: TokenResolvesToShell,
  receivesRemoteFetch: RemoteFetchDetector,
  state: BashEnvState,
  workingDir: string,
) {
  return { shellFunctions, depth, tokensStartWithShell, tokenResolvesToShell, receivesRemoteFetch, state, workingDir };
}
