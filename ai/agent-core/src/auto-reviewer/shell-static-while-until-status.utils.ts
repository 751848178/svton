import { staticLoopControlCommand } from './shell-loop-control-command.utils';
import { shellWhileUntilLoopStatement } from './shell-while-until-loop-parser.utils';
import { splitStaticAssignmentCommandStatements } from './shell-static-assignment-statement.utils';
import { staticShellCommandListStatus } from './shell-static-command-list-status.utils';
import type {
  StaticShellCommandStatus,
  StaticShellCommandStatusOptions,
  StaticShellCommandStatusResolver,
} from './shell-static-command-status.types';
import { cloneStaticShellCommandStatusOptions } from './shell-static-option-command.utils';
import { shouldApplyStaticStatement } from './shell-static-command-list-assignment.utils';

export function staticShellWhileUntilLoopStatus(
  statement: string,
  resolveStatus: StaticShellCommandStatusResolver,
  options: StaticShellCommandStatusOptions,
): StaticShellCommandStatus {
  const loop = shellWhileUntilLoopStatement(statement);
  if (!loop) return null;

  const conditionOptions = cloneStaticShellCommandStatusOptions(options);
  conditionOptions.errexitSuppressed = true;
  const conditionStatus = staticShellCommandListStatus(
    loop.condition,
    resolveStatus,
    conditionOptions,
  );

  if (loop.kind === 'while' && conditionStatus === false) return true;
  if (loop.kind === 'until' && conditionStatus === true) return true;

  const entersBody = loop.kind === 'while' ? conditionStatus === true : conditionStatus === false;
  return entersBody ? staticShellBreakLoopBodyStatus(loop.body, resolveStatus, options) : null;
}

function staticShellBreakLoopBodyStatus(
  body: string,
  resolveStatus: StaticShellCommandStatusResolver,
  options: StaticShellCommandStatusOptions,
): StaticShellCommandStatus {
  const statements = splitStaticAssignmentCommandStatements(body);
  let previousStatus: StaticShellCommandStatus = null;

  for (const { statement, operatorBefore } of statements) {
    if (!shouldApplyStaticStatement(operatorBefore, previousStatus)) continue;

    const control = staticLoopControlCommand(statement);
    if (control === 'break') return true;
    if (control === 'continue') return null;
    previousStatus = resolveStatus(statement, options);
  }

  return null;
}
