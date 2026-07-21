import { containsOutputProcessSubstitutionCommand } from './process-substitution.utils';
import { getShellTokenBasename, unquoteShellToken } from './shell-command.utils';
import { shellExecutableCommandTokens } from './shell-executable-command.utils';
import { splitUnquotedIfsExpansionTokens } from './shell-ifs-word-splitting.utils';

type SplitCommandTokens = (command: string) => string[];
type SegmentPredicate = (segment: string) => boolean;

export function remoteOutputProcessSubstitutionReceivesShell(
  segment: string,
  splitCommandTokens: SplitCommandTokens,
  startsWithShellCommand: SegmentPredicate,
  segmentStartsWithFetch: SegmentPredicate,
): boolean {
  const tokens = splitUnquotedIfsExpansionTokens(splitCommandTokens(segment));

  if (segmentStartsWithFetch(segment)) {
    return hasOutputProcessSubstitutionRedirection(tokens, startsWithShellCommand);
  }
  if (segmentCommandReadsPipeToTee(tokens)) {
    return containsOutputProcessSubstitutionCommand(segment, startsWithShellCommand);
  }
  if (segmentCommandReadsPipeToStdout(tokens)) {
    return hasOutputProcessSubstitutionRedirection(tokens, startsWithShellCommand);
  }

  return false;
}

export function shellCommandTokensWithoutOutputRedirections(tokens: string[]): string[] {
  const commandTokens: string[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const word = unquoteShellToken(tokens[index]);
    if (isStandaloneOutputRedirect(word)) {
      index += 1;
      continue;
    }
    if (isAttachedOutputRedirect(word)) continue;
    commandTokens.push(tokens[index]);
  }

  return commandTokens;
}

export function commandTokensRedirectStdout(tokens: string[]): boolean {
  return tokens.some((token) => {
    const word = unquoteShellToken(token);
    return isStandaloneStdoutRedirect(word) || isAttachedStdoutRedirect(word);
  });
}

function hasOutputProcessSubstitutionRedirection(
  tokens: string[],
  startsWithShellCommand: SegmentPredicate,
): boolean {
  for (let index = 0; index < tokens.length; index += 1) {
    const word = unquoteShellToken(tokens[index]);
    if (!isStandaloneOutputRedirect(word)) continue;
    if (containsOutputProcessSubstitutionCommand(tokens[index + 1] ?? '', startsWithShellCommand)) {
      return true;
    }
  }

  return false;
}

function segmentCommandReadsPipeToTee(tokens: string[]): boolean {
  return getSegmentCommandName(tokens) === 'tee';
}

function segmentCommandReadsPipeToStdout(tokens: string[]): boolean {
  const commandTokens = shellCommandTokensWithoutOutputRedirections(tokens);
  if (getSegmentCommandName(commandTokens) !== 'cat') return false;

  const operands = commandTokens.slice(1)
    .map(unquoteShellToken)
    .filter((token) => token && !token.startsWith('-'));
  return operands.length === 0 || operands.includes('-');
}

function getSegmentCommandName(tokens: string[]): string {
  return getShellTokenBasename(shellExecutableCommandTokens(tokens)[0] ?? '');
}

function isStandaloneOutputRedirect(word: string): boolean {
  return /^(?:\d+|&)?>>?$/.test(word);
}

function isAttachedOutputRedirect(word: string): boolean {
  return !word.startsWith('>(') && /^(?:\d+|&)?>>?.+/.test(word);
}

function isStandaloneStdoutRedirect(word: string): boolean {
  return /^(?:1|&)?>>?$/.test(word);
}

function isAttachedStdoutRedirect(word: string): boolean {
  return !word.startsWith('>(') && /^(?:1|&)?>>?.+/.test(word);
}
