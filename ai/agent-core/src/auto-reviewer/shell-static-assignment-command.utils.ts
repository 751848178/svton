import { applyShellCommandNegationStatus, stripShellCommandNegation } from './shell-command-negation.utils';
import { resolveShellFunctionCommand, type ShellFunctionDefinitions } from './shell-function-command.utils';
import { splitStaticAssignmentCommandStatements } from './shell-static-assignment-statement.utils';
import { applyStaticCaseState } from './shell-static-case-assignment.utils';
import { applyStaticForLoopState } from './shell-static-for-loop-assignment.utils';
import { applyFunctionLocalDeclaration } from './shell-static-function-assignment.utils';
import { applyStaticFunctionStateWithNegation } from './shell-static-function-negation-assignment.utils';
import { applyStaticFunctionInvocationState } from './shell-static-function-invocation-assignment.utils';
import { applyStaticBraceGroupState } from './shell-static-group-assignment.utils';
import type { StaticAssignmentCommandOptions, StaticVariableState } from './shell-static-assignment.types';
import { applyStaticAssignmentState } from './shell-static-assignment-state.utils';
import { staticShellCommandExecutionStatus } from './shell-static-command-execution-status.utils';
import { staticShellFunctionCommandStatus, type StaticShellCommandStatus } from './shell-static-command-status.utils';
import { applyStaticEvalState } from './shell-static-eval-assignment.utils';
import { withOptionalStaticErrexitSuppressed } from './shell-static-errexit-suppression.utils';
import { withExportedStaticEnvCommand } from './shell-static-exported-env-command.utils';
import { applyStaticIfState } from './shell-static-if-assignment.utils';
import { applyNegatedStaticVariableState } from './shell-static-negated-assignment.utils';
import { staticPrintfAssignment } from './shell-static-printf-assignment.utils';
import { staticReadHereStringAssignments } from './shell-static-read-assignment.utils';
import { applyStaticUnset } from './shell-static-unset-assignment.utils';
import { substituteStaticShellVariables } from './shell-static-variable-command.utils';
import { shouldApplyStaticStatement } from './shell-static-command-list-assignment.utils';
import { staticErrexitStopsCommandList } from './shell-static-errexit-command.utils';
import { applyStaticShellOptionState } from './shell-static-option-command.utils';
import { applyStaticParameterDefaultAssignmentState } from './shell-static-parameter-default-assignment.utils';
import { staticDeclarationAssignments, staticShellAssignment } from './shell-static-declaration-assignment.utils';
import { applyStaticWhileUntilState } from './shell-static-while-until-assignment.utils';
import { isStaticShellControlStatement } from './shell-static-control-statement.utils';

export function staticAssignmentCommandStrings(command: string, options: StaticAssignmentCommandOptions = {}): string[] {
  const state: StaticVariableState = {
    values: new Map(),
    unsetNames: new Set(),
    exportedNames: new Set(),
    readonlyNames: new Set(),
    shellOptions: { errexit: false, allexport: false, pipefail: false },
  };
  const statements = splitStaticAssignmentCommandStatements(command);
  const expandedStatements: string[] = [];
  const shellFunctions = new Map<string, string>();
  let previousStatus: StaticShellCommandStatus = null;
  let changed = false;
  let exited = false;

  for (let index = 0; index < statements.length; index += 1) {
    const { statement, operatorBefore } = statements[index];
    const nextOperator = statements[index + 1]?.operatorBefore ?? null;
    const ignoresErrexit = nextOperator === '&&' || nextOperator === '||';

    if (exited) {
      expandedStatements.push(statement);
      continue;
    }

    if (!shouldApplyStaticStatement(operatorBefore, previousStatus)) {
      expandedStatements.push(statement);
      continue;
    }

    const negation = stripShellCommandNegation(statement);
    const stateStatement = negation.count > 0 ? negation.tokens.join(' ') : statement;
    const shellCommand = resolveShellFunctionCommand(stateStatement, shellFunctions);
    if (shellCommand === null) {
      expandedStatements.push(statement);
      previousStatus = true;
      continue;
    }

    const isControlStatement = isStaticShellControlStatement(stateStatement);
    const expanded = isControlStatement ? statement : withExportedStaticEnvCommand(substituteStaticShellVariables(statement, state.values, state.unsetNames), state);
    const expandedStateStatement = isControlStatement
      ? stateStatement
      : substituteStaticShellVariables(stateStatement, state.values, state.unsetNames);
    expandedStatements.push(expanded);
    changed ||= expanded !== statement;

    if (shellCommand !== stateStatement) {
      const applyFunctionState = () => applyStaticFunctionStateWithNegation(
        expandedStateStatement,
        shellCommand,
        state,
        options,
        shellFunctions,
        negation.count,
        (functionStatement, functionState, functionOptions) => applyStaticVariableState(functionStatement, functionState, functionOptions, 0, shellFunctions),
      );
      const functionVariant = withOptionalStaticErrexitSuppressed(state, ignoresErrexit, applyFunctionState);
      if (functionVariant) {
        expandedStatements[expandedStatements.length - 1] = functionVariant;
        changed = true;
      }
      const readFunctionStatus = () => staticShellFunctionCommandStatus(
        expandedStateStatement,
        shellCommand,
        state.shellOptions,
      );
      const functionStatus = withOptionalStaticErrexitSuppressed(state, ignoresErrexit, readFunctionStatus);
      previousStatus = applyShellCommandNegationStatus(functionStatus, negation.count);
      exited = staticErrexitStopsCommandList(
        previousStatus,
        state.shellOptions,
        nextOperator,
        negation.count === 0,
      );
      continue;
    }

    const applyVariableState = () => applyStaticVariableState(
      negation.count > 0 ? expanded : isControlStatement ? stateStatement : expandedStateStatement,
      state,
      options,
      0,
      shellFunctions,
    );
    withOptionalStaticErrexitSuppressed(state, ignoresErrexit, applyVariableState);
    const readCommandStatus = () => staticShellCommandExecutionStatus(
      isControlStatement ? statement : expanded,
      state.shellOptions,
    );
    const commandStatus = withOptionalStaticErrexitSuppressed(state, ignoresErrexit, readCommandStatus);
    previousStatus = commandStatus.status;
    exited = staticErrexitStopsCommandList(
      previousStatus,
      state.shellOptions,
      nextOperator,
      commandStatus.exitsOnErrexit,
    );
  }

  return changed ? [expandedStatements.join('; ')] : [];
}

function applyStaticVariableState(
  statement: string,
  state: StaticVariableState,
  options: StaticAssignmentCommandOptions,
  evalDepth = 0,
  shellFunctions: ShellFunctionDefinitions = new Map(),
): void {
  const negation = stripShellCommandNegation(statement);
  if (negation.count > 0) {
    applyNegatedStaticVariableState(
      negation.tokens.join(' '),
      state,
      options,
      evalDepth,
      shellFunctions,
      applyStaticVariableState,
    );
    return;
  }

  applyStaticParameterDefaultAssignmentState(statement, state);
  if (options.trackFunctionLocalDeclarations && applyFunctionLocalDeclaration(statement, state)) return;
  if (applyStaticFunctionInvocationState(
    statement,
    state,
    options,
    shellFunctions,
    applyStaticVariableState,
  )) return;
  if (applyStaticShellOptionState(statement, state.shellOptions)) return;

  const assignment = staticShellAssignment(statement);
  if (assignment) {
    applyStaticAssignmentState(assignment, state);
    return;
  }

  const declarations = staticDeclarationAssignments(statement, options);
  if (declarations.length > 0) {
    declarations.forEach((declaration) => applyStaticAssignmentState(declaration, state));
    return;
  }

  const printfAssignment = staticPrintfAssignment(statement);
  if (printfAssignment) {
    applyStaticAssignmentState(printfAssignment, state);
    return;
  }

  const readAssignments = staticReadHereStringAssignments(statement);
  if (readAssignments.length > 0) {
    readAssignments.forEach((readAssignment) => applyStaticAssignmentState(readAssignment, state));
    return;
  }

  if (applyStaticEvalState(statement, state, options, evalDepth, applyStaticVariableState, shellFunctions)) return;
  if (applyStaticIfState(statement, state, options, applyStaticVariableState, shellFunctions)) return;
  if (applyStaticCaseState(statement, state, options, applyStaticVariableState, shellFunctions)) return;
  if (applyStaticForLoopState(statement, state, options, applyStaticVariableState, shellFunctions)) return;
  if (applyStaticWhileUntilState(statement, state, options, applyStaticVariableState, shellFunctions)) return;
  if (applyStaticBraceGroupState(statement, state, options, applyStaticVariableState, shellFunctions)) return;

  applyStaticUnset(statement, state);
}
