import type {
  StaticShellCommandExecutionStatus,
  StaticShellCommandStatusOptions,
} from './shell-static-command-status.types';
import { stripShellCommandNegation } from './shell-command-negation.utils';
import { staticShellCommandStatus } from './shell-static-command-status.utils';
import {
  staticShellCommandErrexitExecutionStatus,
  staticShellCommandExitsOnErrexit,
} from './shell-static-errexit-command.utils';

export function staticShellCommandExecutionStatus(
  statement: string,
  options: StaticShellCommandStatusOptions,
): StaticShellCommandExecutionStatus {
  const negation = stripShellCommandNegation(statement);
  if (negation.count > 0) {
    return {
      status: staticShellCommandStatus(statement, options),
      exitsOnErrexit: false,
    };
  }

  const compoundStatus = staticShellCommandErrexitExecutionStatus(
    statement,
    options,
    staticShellCommandStatus,
  );
  if (compoundStatus) return compoundStatus;

  const status = staticShellCommandStatus(statement, options);
  return {
    status,
    exitsOnErrexit: staticShellCommandExitsOnErrexit(
      statement,
      status,
      options,
      staticShellCommandStatus,
    ),
  };
}
