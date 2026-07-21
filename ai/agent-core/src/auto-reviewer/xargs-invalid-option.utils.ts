import {
  xargsInlineShortOptionArgument,
  xargsShortOptionClusterHasOption,
  xargsShortOptionTokenIsValid,
  xargsTrailingShortOptionWithSeparatedArgument,
} from './xargs-short-option.utils';

const XARGS_LONG_OPTIONS_WITH_SEPARATED_ARGUMENT = new Set([
  '--arg-file',
  '--delimiter',
  '--max-args',
  '--max-chars',
  '--max-procs',
  '--process-slot-var',
]);

const XARGS_LONG_OPTIONS_WITH_INLINE_ARGUMENT = new Set([
  '--arg-file',
  '--delimiter',
  '--eof',
  '--replace',
  '--max-lines',
  '--max-args',
  '--max-chars',
  '--max-procs',
  '--process-slot-var',
]);

const XARGS_LONG_FLAGS = new Set([
  '--null',
  '--eof',
  '--replace',
  '--max-lines',
  '--verbose',
  '--interactive',
  '--exit',
  '--no-run-if-empty',
  '--open-tty',
]);

const XARGS_LONG_NO_UTILITY_OPTIONS = new Set([
  '--help',
  '--version',
  '--show-limits',
]);

export function xargsHasInvalidOption(
  tokens: string[],
  _optionEndIndex: (tokens: string[], index: number) => number,
): boolean {
  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === '--') return false;
    if (!token.startsWith('-')) return false;
    if (token.startsWith('--')) {
      if (XARGS_LONG_NO_UTILITY_OPTIONS.has(token)) return true;
      if (!xargsLongOptionIsValid(token)) return true;
      if (xargsPositiveIntegerOptionIsInvalid(tokens, index)) return true;
      if (xargsNonnegativeIntegerOptionIsInvalid(tokens, index)) return true;
      if (XARGS_LONG_OPTIONS_WITH_SEPARATED_ARGUMENT.has(token) && tokens[index + 1]) index += 1;
      continue;
    }
    if (!xargsShortOptionTokenIsValid(token)) return true;
    if (xargsPositiveIntegerOptionIsInvalid(tokens, index)) return true;
    if (xargsNonnegativeIntegerOptionIsInvalid(tokens, index)) return true;
    if (xargsTrailingShortOptionWithSeparatedArgument(token) && tokens[index + 1]) index += 1;
  }

  return false;
}

function xargsLongOptionIsValid(token: string): boolean {
  const equalsIndex = token.indexOf('=');
  if (equalsIndex > 0) {
    return XARGS_LONG_OPTIONS_WITH_INLINE_ARGUMENT.has(token.slice(0, equalsIndex));
  }

  return XARGS_LONG_FLAGS.has(token)
    || XARGS_LONG_NO_UTILITY_OPTIONS.has(token)
    || XARGS_LONG_OPTIONS_WITH_SEPARATED_ARGUMENT.has(token);
}

function xargsPositiveIntegerOptionIsInvalid(tokens: string[], index: number): boolean {
  const value = xargsPositiveIntegerOptionValue(tokens, index);
  return value !== null && !xargsPositiveInteger(value);
}

function xargsPositiveIntegerOptionValue(tokens: string[], index: number): string | null {
  const token = tokens[index];
  if (token === '--max-args') return tokens[index + 1] ?? null;
  if (token.startsWith('--max-args=')) return token.slice('--max-args='.length);
  if (token === '--max-chars') return tokens[index + 1] ?? null;
  if (token.startsWith('--max-chars=')) return token.slice('--max-chars='.length);
  if (token.startsWith('--max-lines=')) return token.slice('--max-lines='.length);
  if (token === '-n' || token === '-L' || token === '-s') return tokens[index + 1] ?? null;
  if (token.startsWith('-n') && token.length > 2) return token.slice(2);
  if (token.startsWith('-L') && token.length > 2) return token.slice(2);
  if (token.startsWith('-s') && token.length > 2) return token.slice(2);
  if (token === '-R') return tokens[index + 1] ?? null;
  if (token.startsWith('-R') && token.length > 2) return token.slice(2);
  if (token === '-l' || token === '--max-lines') return '1';
  if (token.startsWith('-l') && token.length > 2) return token.slice(2);

  const inline = xargsInlineShortOptionArgument(token, '-n')
    || xargsInlineShortOptionArgument(token, '-L')
    || xargsInlineShortOptionArgument(token, '-s')
    || xargsInlineShortOptionArgument(token, '-R')
    || xargsInlineShortOptionArgument(token, '-l');
  if (inline) return inline;
  if (xargsShortOptionClusterHasOption(token, '-l')) return '1';
  const trailingOption = xargsTrailingShortOptionWithSeparatedArgument(token);
  return trailingOption === '-n' || trailingOption === '-L' || trailingOption === '-s'
    || trailingOption === '-R'
    ? tokens[index + 1] ?? null
    : null;
}

function xargsPositiveInteger(value: string): boolean {
  if (!/^\d+$/.test(value)) return false;
  return Number.parseInt(value, 10) > 0;
}

function xargsNonnegativeIntegerOptionIsInvalid(tokens: string[], index: number): boolean {
  const value = xargsNonnegativeIntegerOptionValue(tokens, index);
  return value !== null && !xargsNonnegativeInteger(value);
}

function xargsNonnegativeIntegerOptionValue(tokens: string[], index: number): string | null {
  const token = tokens[index];
  if (token === '--max-procs') return tokens[index + 1] ?? null;
  if (token.startsWith('--max-procs=')) return token.slice('--max-procs='.length);
  if (token === '-P' || token === '-S') return tokens[index + 1] ?? null;
  if (token.startsWith('-P') && token.length > 2) return token.slice(2);
  if (token.startsWith('-S') && token.length > 2) return token.slice(2);

  const inline = xargsInlineShortOptionArgument(token, '-P')
    || xargsInlineShortOptionArgument(token, '-S');
  if (inline) return inline;
  const trailingOption = xargsTrailingShortOptionWithSeparatedArgument(token);
  return trailingOption === '-P' || trailingOption === '-S' ? tokens[index + 1] ?? null : null;
}

function xargsNonnegativeInteger(value: string): boolean {
  return /^\d+$/.test(value);
}
