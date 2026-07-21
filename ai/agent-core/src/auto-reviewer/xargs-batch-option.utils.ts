import {
  xargsInlineShortOptionArgument,
  xargsShortOptionClusterHasOption,
  xargsTrailingShortOptionWithSeparatedArgument,
} from './xargs-short-option.utils';

type OptionEndIndex = (tokens: string[], index: number) => number;

export type XargsBatchOption = {
  kind: 'max-args' | 'max-lines';
  size: number;
};

export function xargsBatchOption(
  tokens: string[],
  optionEndIndex: OptionEndIndex,
): XargsBatchOption | null {
  let option: XargsBatchOption | null = null;

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === '--') return option;
    if (!token.startsWith('-')) return option;

    option = xargsBatchOptionAt(tokens, index) ?? option;
    index = optionEndIndex(tokens, index);
  }

  return option;
}

export function xargsBatchOptionAfter(
  tokens: string[],
  optionEndIndex: OptionEndIndex,
  afterIndex: number,
): XargsBatchOption | null {
  let option: XargsBatchOption | null = null;

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === '--') return option;
    if (!token.startsWith('-')) return option;

    const candidate = xargsBatchOptionAt(tokens, index);
    if (candidate && index > afterIndex) option = candidate;
    index = optionEndIndex(tokens, index);
  }

  return option;
}

export function xargsBatchOptionBefore(
  tokens: string[],
  optionEndIndex: OptionEndIndex,
  beforeIndex: number,
): XargsBatchOption | null {
  let option: XargsBatchOption | null = null;

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (index >= beforeIndex || token === '--') return option;
    if (!token.startsWith('-')) return option;

    option = xargsBatchOptionAt(tokens, index) ?? option;
    index = optionEndIndex(tokens, index);
  }

  return option;
}

function xargsBatchOptionAt(tokens: string[], index: number): XargsBatchOption | null {
  const maxArgs = xargsMaxArgsValue(tokens, index);
  if (maxArgs !== null) return batchOption('max-args', maxArgs);

  const maxLines = xargsMaxLinesValue(tokens, index);
  if (maxLines !== null) return batchOption('max-lines', maxLines);
  return null;
}

function xargsMaxArgsValue(tokens: string[], index: number): string | null {
  const token = tokens[index];
  if (token === '-n' || token === '--max-args') return tokens[index + 1] ?? '';
  if (token.startsWith('-n') && token.length > 2) return token.slice(2);
  if (token.startsWith('--max-args=')) return token.slice('--max-args='.length);

  const inline = xargsInlineShortOptionArgument(token, '-n');
  if (inline) return inline;
  if (xargsTrailingShortOptionWithSeparatedArgument(token) === '-n') return tokens[index + 1] ?? '';
  return null;
}

function xargsMaxLinesValue(tokens: string[], index: number): string | null {
  const token = tokens[index];
  if (token === '-L') return tokens[index + 1] ?? '';
  if (token.startsWith('-L') && token.length > 2) return token.slice(2);
  if (token === '-l' || token === '--max-lines') return '1';
  if (token.startsWith('-l') && token.length > 2) return token.slice(2);
  if (token.startsWith('--max-lines=')) return token.slice('--max-lines='.length);

  const inline = xargsInlineShortOptionArgument(token, '-L')
    || xargsInlineShortOptionArgument(token, '-l');
  if (inline) return inline;
  if (xargsShortOptionClusterHasOption(token, '-l')) return '1';
  if (xargsTrailingShortOptionWithSeparatedArgument(token) === '-L') return tokens[index + 1] ?? '';
  return null;
}

function batchOption(kind: XargsBatchOption['kind'], value: string): XargsBatchOption | null {
  const size = positiveInteger(value);
  return size > 0 ? { kind, size } : null;
}

function positiveInteger(value: string): number {
  if (!/^\d+$/.test(value)) return 0;
  const parsed = Number.parseInt(value, 10);
  return parsed > 0 ? parsed : 0;
}
