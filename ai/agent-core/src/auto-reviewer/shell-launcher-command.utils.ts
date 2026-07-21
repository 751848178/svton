import { envCommandEnvironmentEffect } from './env-command-environment-effect.utils';
import { firstEnvCommandTokensWithAssignments } from './env-command-token.utils';
import { shellAssignmentPrefixName, splitShellAssignmentPrefixes } from './shell-assignment-prefix.utils';
import { findExecCommandTokenGroups } from './find-exec-command.utils';
import { getShellTokenBasename } from './shell-command.utils';
import { shellExecutableCommandTokens } from './shell-executable-command.utils';
import { splitUnquotedIfsExpansionTokens } from './shell-ifs-word-splitting.utils';
import { firstXargsCommandIndex } from './xargs-command.utils';

type StartsWithShell = (tokens: string[]) => boolean;

function directShellCommandTokens(tokens: string[], startsWithShell: StartsWithShell): string[] {
  const { assignmentPrefixes, commandTokens } = splitShellAssignmentPrefixes(tokens);
  const shellWords = splitUnquotedIfsExpansionTokens(commandTokens);
  const first = shellWords[0];
  if (!first || !startsWithShell(shellWords)) return [];

  return getShellTokenBasename(first) === 'env'
    ? envShellCommandTokens(assignmentPrefixes, shellWords)
    : [...assignmentPrefixes, ...shellExecutableCommandTokens(shellWords)];
}

function envShellCommandTokens(assignmentPrefixes: string[], commandTokens: string[]): string[] {
  const envTokens = firstEnvCommandTokensWithAssignments(commandTokens);
  const effect = envCommandEnvironmentEffect(commandTokens);
  const inheritedPrefixes = effect.preservesParentEnvironment
    ? assignmentPrefixes.filter((prefix) => {
      const name = shellAssignmentPrefixName(prefix);
      return name !== null && !effect.unsetNames.has(name);
    })
    : [];

  return [...inheritedPrefixes, ...envTokens];
}

export function shellCommandTokens(tokens: string[], startsWithShell: StartsWithShell): string[] {
  const first = tokens[0];
  if (!first) return [];

  if (getShellTokenBasename(first) === 'xargs') {
    const commandIndex = firstXargsCommandIndex(tokens);
    return commandIndex >= 0 ? shellCommandTokens(tokens.slice(commandIndex), startsWithShell) : [];
  }

  return directShellCommandTokens(tokens, startsWithShell);
}

export function shellCommandStringTokenGroups(tokens: string[], startsWithShell: StartsWithShell): string[][] {
  const first = tokens[0];
  if (!first) return [];

  const firstName = getShellTokenBasename(first);
  if (firstName === 'find') {
    return findExecCommandTokenGroups(tokens)
      .flatMap((group) => shellCommandStringTokenGroups(group, startsWithShell));
  }

  const shellTokens = directShellCommandTokens(tokens, startsWithShell);
  return shellTokens.length > 0 ? [shellTokens] : [];
}
