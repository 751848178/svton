import { unquoteShellToken } from './shell-command.utils';

export const ENV_OPTIONS_WITH_IGNORED_ARGUMENT = new Set(['-u', '--unset', '-C', '--chdir', '-P']);
export const ENV_SPLIT_STRING_OPTION = '--split-string';
export const ENV_UNSET_OPTION = '--unset';
export const ENV_CHDIR_OPTION = '--chdir';

const ENV_TERMINATING_OPTIONS = new Set(['--help', '--version']);
const ENV_LONG_FLAGS = new Set(['--debug', '--ignore-environment']);
const ENV_SHORT_OPTIONS_WITH_ARGUMENT = new Set(['u', 'C', 'P']);
const ENV_SHORT_FLAGS = new Set(['i', 'v']);
const ENV_NON_EXECUTING_SHORT_OPTIONS = new Set(['0']);
const ENV_SPLIT_STRING_SHORT_OPTION = 'S';

export function isLongOptionWithValue(token: string, option: string): boolean {
  return token.startsWith(`${option}=`);
}

export function envOptionStopsCommandParsing(token: string): boolean {
  const unquoted = unquoteShellToken(token);
  return ENV_TERMINATING_OPTIONS.has(unquoted) || shortOptionGroupHasNonExecutingOption(unquoted);
}

export function envOptionIsInvalid(token: string): boolean {
  const unquoted = unquoteShellToken(token);
  if (!unquoted.startsWith('-') || unquoted === '--') return false;
  if (unquoted.startsWith('--')) return !envLongOptionIsKnown(unquoted);
  return shortOptionGroupHasUnknownOption(unquoted);
}

export function shortOptionArgumentIndex(token: string): number {
  if (!token.startsWith('-') || token.startsWith('--')) return -1;

  return [...token.slice(1)].findIndex((char) => ENV_SHORT_OPTIONS_WITH_ARGUMENT.has(char));
}

export function splitStringShortOptionIndex(token: string): number {
  if (!token.startsWith('-') || token.startsWith('--')) return -1;

  const optionChars = [...token.slice(1)];
  const splitStringIndex = optionChars.indexOf(ENV_SPLIT_STRING_SHORT_OPTION);
  const argumentIndex = shortOptionArgumentIndex(token);
  if (splitStringIndex < 0) return -1;

  return argumentIndex >= 0 && argumentIndex < splitStringIndex ? -1 : splitStringIndex;
}

export function shortOptionGroupNeedsArgument(token: string): boolean {
  const argumentIndex = shortOptionArgumentIndex(token);
  return argumentIndex >= 0 && argumentIndex === token.length - 2;
}

export function shortOptionGroupHasInlineArgument(token: string): boolean {
  const argumentIndex = shortOptionArgumentIndex(token);
  return argumentIndex >= 0 && argumentIndex < token.length - 2;
}

function envLongOptionIsKnown(token: string): boolean {
  const [name] = token.split('=', 1);
  return ENV_LONG_FLAGS.has(name)
    || ENV_TERMINATING_OPTIONS.has(name)
    || name === ENV_UNSET_OPTION
    || name === ENV_CHDIR_OPTION
    || name === ENV_SPLIT_STRING_OPTION;
}

function shortOptionParsingEndIndex(token: string): number {
  const optionChars = [...token.slice(1)];
  const optionIndexes = [shortOptionArgumentIndex(token), splitStringShortOptionIndex(token)]
    .filter((index) => index >= 0);
  return optionIndexes.length > 0 ? Math.min(...optionIndexes) : optionChars.length;
}

function shortOptionGroupHasNonExecutingOption(token: string): boolean {
  if (!token.startsWith('-') || token.startsWith('--')) return false;

  const optionChars = [...token.slice(1)];
  return optionChars
    .slice(0, shortOptionParsingEndIndex(token))
    .some((char) => ENV_NON_EXECUTING_SHORT_OPTIONS.has(char));
}

function shortOptionGroupHasUnknownOption(token: string): boolean {
  if (!token.startsWith('-') || token.startsWith('--')) return false;

  const optionChars = [...token.slice(1)];
  return optionChars
    .slice(0, shortOptionParsingEndIndex(token))
    .some((char) => !ENV_SHORT_FLAGS.has(char) && !ENV_NON_EXECUTING_SHORT_OPTIONS.has(char));
}
