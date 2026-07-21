import {
  expandLeadingCommandSubstitutionTokens,
  mergeWholeCommandSubstitutionTokens,
} from './command-substitution-token.utils';
import { splitShellAssignmentPrefixes } from './shell-assignment-prefix.utils';
import { splitShellWords } from './shell-command.utils';
import { unwrapShellGroupCommand } from './shell-group-command.utils';

export function shellCommandStringTokensWithAssignmentPrefixes(command: string): string[] {
  const tokens = mergeWholeCommandSubstitutionTokens(splitShellWords(unwrapShellGroupCommand(command)));
  const { assignmentPrefixes, commandTokens } = splitShellAssignmentPrefixes(tokens);

  return [
    ...assignmentPrefixes,
    ...expandLeadingCommandSubstitutionTokens(commandTokens),
  ];
}
