import {
  xargsInlineShortOptionArgument,
  xargsShortOptionClusterHasOption,
  xargsTrailingShortOptionWithSeparatedArgument,
} from './xargs-short-option.utils';

type OptionEndIndex = (tokens: string[], index: number) => number;
export type XargsReplacementMode = { kind: 'line' | 'bsd'; marker: string; index: number };

export function xargsReplacementMode(
  tokens: string[],
  optionEndIndex: OptionEndIndex,
): XargsReplacementMode | null {
  let mode: XargsReplacementMode | null = null;

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === '--' || !token.startsWith('-')) return mode;

    const marker = xargsLineReplacementMarkerAt(tokens, index);
    if (marker !== null) mode = { kind: 'line', marker, index };

    const bsdMarker = xargsBsdReplacementMarkerAt(tokens, index);
    if (bsdMarker !== null) mode = { kind: 'bsd', marker: bsdMarker, index };

    index = optionEndIndex(tokens, index);
  }

  return mode;
}

export function xargsHasLineReplacementOption(tokens: string[], optionEndIndex: OptionEndIndex): boolean {
  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === '--' || !token.startsWith('-')) return false;

    if (xargsLineReplacementMarkerAt(tokens, index) !== null) return true;
    index = optionEndIndex(tokens, index);
  }

  return false;
}

export function isXargsReplaceOption(token: string): boolean {
  return token === '-I'
    || token === '-i'
    || token === '-J'
    || token === '--replace'
    || token.startsWith('-I')
    || token.startsWith('-i')
    || token.startsWith('-J')
    || token.startsWith('--replace=')
    || xargsInlineShortOptionArgument(token, '-I') !== ''
    || xargsInlineShortOptionArgument(token, '-i') !== ''
    || xargsInlineShortOptionArgument(token, '-J') !== ''
    || xargsTrailingShortOptionWithSeparatedArgument(token) === '-I'
    || xargsTrailingShortOptionWithSeparatedArgument(token) === '-J'
    || xargsShortOptionClusterHasOption(token, '-i');
}

function xargsLineReplacementMarkerAt(tokens: string[], index: number): string | null {
  const token = tokens[index];
  if (token === '-I') return tokens[index + 1] ?? '';
  if (token.startsWith('-I') && token.length > 2) return token.slice(2);
  if (token === '-i') return '{}';
  if (token.startsWith('-i') && token.length > 2) return token.slice(2);

  return xargsClusteredLineReplacementMarker(tokens, index);
}

function xargsClusteredLineReplacementMarker(tokens: string[], index: number): string | null {
  const token = tokens[index];
  const inlineMarker = xargsInlineShortOptionArgument(token, '-I')
    || xargsInlineShortOptionArgument(token, '-i');
  if (inlineMarker) return inlineMarker;
  if (xargsTrailingShortOptionWithSeparatedArgument(token) === '-I') return tokens[index + 1] ?? '';
  if (xargsShortOptionClusterHasOption(token, '-i')) return '{}';
  if (token === '--replace') return '{}';
  return token.startsWith('--replace=') ? token.slice('--replace='.length) : null;
}

function xargsBsdReplacementMarkerAt(tokens: string[], index: number): string | null {
  const token = tokens[index];
  if (token === '-J') return tokens[index + 1] ?? '';
  if (token.startsWith('-J') && token.length > 2) return token.slice(2);
  const inlineMarker = xargsInlineShortOptionArgument(token, '-J');
  if (inlineMarker) return inlineMarker;
  return xargsTrailingShortOptionWithSeparatedArgument(token) === '-J' ? tokens[index + 1] ?? '' : null;
}
