import { splitShellWords, unquoteShellToken } from './shell-command.utils';
import { splitShellAssignmentPrefixes } from './shell-assignment-prefix.utils';
import {
  ENV_CHDIR_OPTION,
  ENV_OPTIONS_WITH_IGNORED_ARGUMENT,
  ENV_SPLIT_STRING_OPTION,
  ENV_UNSET_OPTION,
  envOptionIsInvalid,
  envOptionStopsCommandParsing,
  isLongOptionWithValue,
  shortOptionGroupHasInlineArgument,
  shortOptionGroupNeedsArgument,
  splitStringShortOptionIndex,
} from './env-option-token.utils';

function splitEnvShortStringTokens(token: string, nextToken: string, trailingTokens: string[]): string[] {
  const splitStringIndex = splitStringShortOptionIndex(token);
  if (splitStringIndex < 0) return [];

  const inlineValue = token.slice(splitStringIndex + 2);
  return splitEnvCommandTokens(
    inlineValue || nextToken,
    inlineValue ? trailingTokens : trailingTokens.slice(1),
    true,
  );
}

function splitEnvCommandString(token: string): string[] {
  return splitShellWords(unquoteShellToken(token));
}

function splitEnvCommandTokens(
  token: string,
  trailingTokens: string[],
  keepAssignmentPrefixes: boolean,
): string[] {
  const tokens = [...splitEnvCommandString(token), ...trailingTokens];
  return keepAssignmentPrefixes ? tokens : splitShellAssignmentPrefixes(tokens).commandTokens;
}

export function firstEnvCommandTokens(tokens: string[]): string[] {
  return firstEnvCommandTokensByMode(tokens, false);
}

export function firstEnvCommandTokensWithAssignments(tokens: string[]): string[] {
  return firstEnvCommandTokensByMode(tokens, true);
}

function firstEnvCommandTokensByMode(tokens: string[], keepAssignmentPrefixes: boolean): string[] {
  let skipNext = false;
  const assignments: string[] = [];

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (skipNext) {
      skipNext = false;
      continue;
    }

    if (envOptionStopsCommandParsing(token) || envOptionIsInvalid(token)) return [];

    if (token === '-S' || token === ENV_SPLIT_STRING_OPTION) {
      return splitEnvCommandTokens(tokens[index + 1] ?? '', tokens.slice(index + 2), keepAssignmentPrefixes);
    }

    if (isLongOptionWithValue(token, ENV_SPLIT_STRING_OPTION)) {
      return splitEnvCommandTokens(
        token.slice(`${ENV_SPLIT_STRING_OPTION}=`.length),
        tokens.slice(index + 1),
        keepAssignmentPrefixes,
      );
    }

    if (token.startsWith('-S') && token.length > 2) {
      return splitEnvCommandTokens(token.slice(2), tokens.slice(index + 1), keepAssignmentPrefixes);
    }

    const splitStringTokens = splitEnvShortStringTokens(
      token,
      tokens[index + 1] ?? '',
      tokens.slice(index + 1),
    );
    if (splitStringTokens.length > 0) {
      return keepAssignmentPrefixes
        ? splitStringTokens
        : splitShellAssignmentPrefixes(splitStringTokens).commandTokens;
    }

    if (
      isLongOptionWithValue(token, ENV_UNSET_OPTION)
      || isLongOptionWithValue(token, ENV_CHDIR_OPTION)
      || shortOptionGroupHasInlineArgument(token)
    ) {
      continue;
    }

    if (token.includes('=')) {
      if (keepAssignmentPrefixes) assignments.push(token);
      continue;
    }

    if (token.startsWith('-')) {
      skipNext = ENV_OPTIONS_WITH_IGNORED_ARGUMENT.has(token) || shortOptionGroupNeedsArgument(token);
      continue;
    }

    return keepAssignmentPrefixes ? [...assignments, ...tokens.slice(index)] : tokens.slice(index);
  }

  return [];
}

export function firstEnvCommandToken(tokens: string[]): string {
  return firstEnvCommandTokens(tokens)[0] ?? '';
}
