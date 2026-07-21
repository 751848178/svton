import { splitStaticAssignmentCommandStatements } from './shell-static-assignment-statement.utils';
import type {
  StaticShellCommandStatus,
  StaticShellCommandStatusOptions,
  StaticShellCommandStatusResolver,
} from './shell-static-command-status.types';
import {
  applyStaticShellOptionState,
  cloneStaticShellCommandStatusOptions,
} from './shell-static-option-command.utils';

export function staticShellCommandListStatus(
  command: string,
  resolveStatus: StaticShellCommandStatusResolver,
  options: StaticShellCommandStatusOptions = {},
): StaticShellCommandStatus {
  const statements = splitStaticAssignmentCommandStatements(command);
  const activeOptions = cloneStaticShellCommandStatusOptions(options);
  let previousStatus: StaticShellCommandStatus = null;
  let executed = false;

  for (const { statement, operatorBefore } of statements) {
    if (operatorBefore === '&&' && previousStatus !== true) continue;
    if (operatorBefore === '||' && previousStatus !== false) continue;

    executed = true;
    previousStatus = resolveStatus(statement, activeOptions);
    applyStaticShellOptionState(statement, activeOptions);
  }

  return executed ? previousStatus : true;
}
