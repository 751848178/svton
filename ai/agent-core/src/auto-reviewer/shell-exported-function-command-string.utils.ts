import { firstShellCommandStringInvocation } from './shell-c-command.utils';
import { envCommandEnvironmentEffect } from './env-command-environment-effect.utils';
import {
  expandShellFunctionCommandList,
  normalizeShellFunctionBody,
  type ShellFunctionDefinitions,
} from './shell-function-command.utils';
import { shellAssignmentPrefixName, splitShellAssignmentPrefixes } from './shell-assignment-prefix.utils';
import { getShellTokenBasename, unquoteShellToken } from './shell-command.utils';
import { shellCommandStringTokensWithAssignmentPrefixes } from './shell-command-string-assignment-prefix-tokens.utils';
import { expandShellCommandStringPositionals } from './shell-command-string-positionals.utils';
import { splitUnquotedIfsExpansionTokens } from './shell-ifs-word-splitting.utils';
import { shellCommandStringTokenGroups } from './shell-launcher-command.utils';
import { shellCommandStringPositionals } from './shell-positional-parameter.utils';

type SplitCommandTokens = (command: string) => string[];
type TokensStartWithShell = (tokens: string[]) => boolean;
type TokenResolvesToShell = (token: string) => boolean;
type RemoteFetchDetector = (command: string, depth: number) => boolean;

export function applyShellFunctionExport(
  statement: string,
  definitions: ShellFunctionDefinitions,
  exportedDefinitions: ShellFunctionDefinitions,
  splitCommandTokens: SplitCommandTokens,
): void {
  const exportCommand = shellFunctionExportCommand(statement, splitCommandTokens);
  if (!exportCommand) return;

  for (const name of exportCommand.names) {
    if (exportCommand.removesExport) {
      exportedDefinitions.delete(name);
      continue;
    }
    const body = definitions.get(name);
    if (body !== undefined) exportedDefinitions.set(name, body);
  }
}

export function shellCommandStringReceivesExportedFunction(
  segment: string,
  exportedDefinitions: ShellFunctionDefinitions,
  tokensStartWithShell: TokensStartWithShell,
  tokenResolvesToShell: TokenResolvesToShell,
  receivesRemoteFetch: RemoteFetchDetector,
  depth: number,
): boolean {
  const segmentTokens = shellCommandStringTokensWithAssignmentPrefixes(segment);
  const shellTokenGroups = shellCommandStringTokenGroups(segmentTokens, tokensStartWithShell);
  return shellTokenGroups.some((shellTokens) => {
    const childDefinitions = bashChildShellFunctionDefinitions(
      segmentTokens,
      shellTokens,
      exportedDefinitions,
      tokenResolvesToShell,
    );
    if (childDefinitions.size === 0) return false;

    const invocation = firstShellCommandStringInvocation(shellTokens, tokenResolvesToShell);
    const commandString = expandShellCommandStringPositionals(
      invocation.commandString,
      shellCommandStringPositionals(invocation),
    );
    const expandedCommand = expandShellFunctionCommandList(commandString, childDefinitions);
    return expandedCommand !== commandString && receivesRemoteFetch(expandedCommand, depth + 1);
  });
}

function shellFunctionExportCommand(
  statement: string,
  splitCommandTokens: SplitCommandTokens,
): { names: string[]; removesExport: boolean } | null {
  const tokens = splitUnquotedIfsExpansionTokens(splitCommandTokens(statement)).map(unquoteShellToken);
  const commandName = getShellTokenBasename(tokens[0] ?? '');
  if (!['declare', 'export', 'typeset'].includes(commandName)) return null;

  let exportsFunction = false;
  let removesExport = false;
  const names: string[] = [];
  for (const token of tokens.slice(1)) {
    if (token === '--') continue;
    if (token.startsWith('-') || token.startsWith('+')) {
      exportsFunction ||= token.includes('f');
      removesExport ||= token.includes('n') || token.startsWith('+');
      continue;
    }
    names.push(token);
  }

  return exportsFunction ? { names, removesExport } : null;
}

function bashChildShellFunctionDefinitions(
  segmentTokens: string[],
  shellTokens: string[],
  exportedDefinitions: ShellFunctionDefinitions,
  tokenResolvesToShell: TokenResolvesToShell,
): ShellFunctionDefinitions {
  if (!tokensLaunchBash(shellTokens, tokenResolvesToShell)) return new Map();

  const envEffect = segmentEnvEffect(segmentTokens);
  const inheritedDefinitions = envEffect.preservesParentEnvironment
    ? [...exportedDefinitions].filter(([name]) => !envEffect.unsetNames.has(bashFunctionEnvName(name)))
    : [];
  return new Map([
    ...inheritedDefinitions,
    ...bashFunctionEnvDefinitions(shellTokens, tokenResolvesToShell),
  ]);
}

function segmentEnvEffect(tokens: string[]): ReturnType<typeof envCommandEnvironmentEffect> {
  const { assignmentPrefixes, commandTokens } = splitShellAssignmentPrefixes(tokens);
  const commandName = getShellTokenBasename(commandTokens[0] ?? '');
  const prefixUnsetNames = assignmentPrefixes
    .map(shellAssignmentPrefixName)
    .filter((name): name is string => name !== null);
  const effect = commandName === 'env'
    ? envCommandEnvironmentEffect(commandTokens)
    : { preservesParentEnvironment: true, unsetNames: new Set<string>() };
  for (const name of prefixUnsetNames) effect.unsetNames.delete(name);
  return effect;
}

function tokensLaunchBash(
  shellTokens: string[],
  tokenResolvesToShell: TokenResolvesToShell,
): boolean {
  const shellToken = shellTokens.find(tokenResolvesToShell);
  return getShellTokenBasename(shellToken ?? '') === 'bash';
}

function bashFunctionEnvDefinitions(
  shellTokens: string[],
  tokenResolvesToShell: TokenResolvesToShell,
): [string, string][] {
  const shellIndex = shellTokens.findIndex(tokenResolvesToShell);
  return shellTokens.slice(0, shellIndex).flatMap((token) => {
    const match = unquoteShellToken(token).match(/^BASH_FUNC_([A-Za-z_][\w-]*)%%=\(\)\s*\{\s*([\s\S]*)\s*\}$/);
    return match ? [[match[1], normalizeShellFunctionBody(match[2])] as [string, string]] : [];
  });
}

function bashFunctionEnvName(name: string): string {
  return `BASH_FUNC_${name}%%`;
}
