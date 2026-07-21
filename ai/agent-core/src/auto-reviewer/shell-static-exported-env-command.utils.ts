import { firstShellCommandStringInvocation } from './shell-c-command.utils';
import { shellAssignmentPrefixName, splitShellAssignmentPrefixes } from './shell-assignment-prefix.utils';
import { SHELL_COMMANDS } from './shell-command-name.constants';
import { getShellTokenBasename, splitShellWords } from './shell-command.utils';
import { splitUnquotedIfsExpansionTokens } from './shell-ifs-word-splitting.utils';
import { splitShellPipelineSegments } from './shell-pipeline-command.utils';
import type { StaticVariableState } from './shell-static-assignment.types';

export function withExportedStaticEnvCommand(statement: string, state: StaticVariableState): string {
  const segments = splitShellPipelineSegments(statement);
  const expandedSegments = segments.map((segment) => withExportedStaticEnvSegment(segment, state));
  if (expandedSegments.every((segment, index) => segment === segments[index])) return statement;

  return replacePipelineSegments(statement, segments, expandedSegments);
}

function withExportedStaticEnvSegment(statement: string, state: StaticVariableState): string {
  const tokens = splitExportedEnvCommandWords(statement);
  const prefixNames = new Set(
    splitShellAssignmentPrefixes(tokens).assignmentPrefixes
      .map((prefix) => shellAssignmentPrefixName(prefix))
      .filter((name): name is string => name !== null),
  );
  const prefixes = exportedStaticAssignmentPrefixes(state, prefixNames);
  if (
    prefixes.length === 0
    || !hasShellCommandString(tokens)
  ) return statement;

  return `${prefixes.join(' ')} ${statement}`;
}

function replacePipelineSegments(
  statement: string,
  segments: string[],
  expandedSegments: string[],
): string {
  let cursor = 0;
  let result = '';

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const segmentIndex = statement.indexOf(segment, cursor);
    if (segmentIndex < 0) return expandedSegments.join(' | ');
    result += statement.slice(cursor, segmentIndex);
    result += expandedSegments[index];
    cursor = segmentIndex + segment.length;
  }

  return result + statement.slice(cursor);
}

function splitExportedEnvCommandWords(statement: string): string[] {
  const { assignmentPrefixes, commandTokens } = splitShellAssignmentPrefixes(splitShellWords(statement));
  return [
    ...assignmentPrefixes,
    ...splitUnquotedIfsExpansionTokens(commandTokens),
  ];
}

function exportedStaticAssignmentPrefixes(state: StaticVariableState, prefixNames: Set<string>): string[] {
  if (!state.exportedNames) return [];

  return [...state.exportedNames].flatMap((name) => {
    const value = state.values.get(name);
    return value !== undefined && !prefixNames.has(name) && isSafeAssignmentValue(value)
      ? [`${name}=${value}`]
      : [];
  });
}

function hasShellCommandString(tokens: string[]): boolean {
  const invocation = firstShellCommandStringInvocation(
    tokens,
    (token) => SHELL_COMMANDS.has(getShellTokenBasename(token)),
  );
  return invocation.commandString !== '';
}

function isSafeAssignmentValue(value: string): boolean {
  return !/[\s'"\\]/.test(value);
}
