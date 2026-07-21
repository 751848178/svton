import { bashEnvStartupCommandStrings } from './shell-bash-env-command-string.utils';
import { type BashEnvState } from './shell-bash-env-static-variable.utils';
import { splitStaticAssignmentCommandStatements } from './shell-static-assignment-statement.utils';
import {
  shouldApplyStaticStatement,
} from './shell-static-command-list-assignment.utils';
import type { StaticShellCommandStatus } from './shell-static-command-status.types';
import { staticShellCommandExecutionStatus } from './shell-static-command-execution-status.utils';
import {
  type ShellTrapActionCommand,
  shellTrapCommandUpdateFromStatement,
} from './shell-trap-action-command.utils';
import {
  applyShellTrapCommandUpdate,
  shellTrapCommandHasSignal,
} from './shell-trap-command-state.utils';
import {
  signalTrapCommandsReceiveRemoteFetch,
  type TrapRemoteFetchContext,
} from './remote-shell-trap-bash-env-command.utils';

type SplitCommandTokens = (command: string) => string[];

export interface FunctionTrapExecutionContext extends TrapRemoteFetchContext {
  splitCommandTokens: SplitCommandTokens;
}

export function functionTrapExecutionReceivesRemoteFetch(
  command: string,
  context: FunctionTrapExecutionContext,
  state: BashEnvState,
  inheritedTrapCommands: ShellTrapActionCommand[],
): boolean {
  let trapCommands = [...inheritedTrapCommands];
  let previousStatus: StaticShellCommandStatus = null;
  const statements = splitStaticAssignmentCommandStatements(command);

  for (let index = 0; index < statements.length; index += 1) {
    const { statement, operatorBefore } = statements[index];
    const nextOperator = statements[index + 1]?.operatorBefore ?? null;
    if (!shouldApplyStaticStatement(operatorBefore, previousStatus)) continue;
    if (functionSignalTrapReceivesRemoteFetch('DEBUG', trapCommands, context, state)) return true;
    if (functionBashEnvStartupReceivesRemoteFetch(statement, context, state)) return true;

    const trapUpdate = shellTrapCommandUpdateFromStatement(
      statement,
      context.shellFunctions,
      context.splitCommandTokens,
    );
    if (trapUpdate) trapCommands = applyShellTrapCommandUpdate(trapCommands, trapUpdate);

    previousStatus = bashEnvStaticCommandStatus(statement, state);
    if (
      staticStatementFiresErrTrap(previousStatus, nextOperator)
      && functionSignalTrapReceivesRemoteFetch('ERR', trapCommands, context, state)
    ) return true;
  }

  return functionSignalTrapReceivesRemoteFetch('RETURN', trapCommands, context, state);
}

function functionBashEnvStartupReceivesRemoteFetch(
  statement: string,
  context: FunctionTrapExecutionContext,
  state: BashEnvState,
): boolean {
  return bashEnvStartupCommandStrings(
    statement,
    context.tokensStartWithShell,
    context.tokenResolvesToShell,
    { allowLocalDeclarations: true, state, workingDir: context.workingDir ?? '' },
  ).some((script) => context.receivesRemoteFetch(script, context.depth + 1));
}

function functionSignalTrapReceivesRemoteFetch(
  signal: string,
  trapCommands: ShellTrapActionCommand[],
  context: FunctionTrapExecutionContext,
  state: BashEnvState,
): boolean {
  return signalTrapCommandsReceiveRemoteFetch(trapCommands, signal, {
    ...context,
    state,
  });
}

function bashEnvStaticCommandStatus(
  statement: string,
  state: BashEnvState,
): StaticShellCommandStatus {
  return staticShellCommandExecutionStatus(statement, {
    allexport: state.allexport,
    errtrace: state.errtrace,
    functrace: state.functrace,
    pipefail: state.pipefail,
  }).status;
}

export function inheritedFunctionTrapCommands(
  trapCommands: ShellTrapActionCommand[],
  state: BashEnvState,
): ShellTrapActionCommand[] {
  return trapCommands.flatMap((trapCommand) => {
    const signals: string[] = [];
    if (state.errtrace && shellTrapCommandHasSignal(trapCommand, 'ERR')) signals.push('ERR');
    if (state.functrace && shellTrapCommandHasSignal(trapCommand, 'DEBUG')) signals.push('DEBUG');
    if (state.functrace && shellTrapCommandHasSignal(trapCommand, 'RETURN')) signals.push('RETURN');
    return signals.length > 0 ? [{ ...trapCommand, signals }] : [];
  });
}

export function staticStatementFiresErrTrap(
  status: StaticShellCommandStatus,
  nextOperator: string | null,
): boolean {
  return status === false && nextOperator !== '&&' && nextOperator !== '||';
}
