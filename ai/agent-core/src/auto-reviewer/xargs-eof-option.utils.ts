import { unquoteShellToken } from './shell-command.utils';
import {
  xargsInlineShortOptionArgument,
  xargsTrailingShortOptionWithSeparatedArgument,
} from './xargs-short-option.utils';

type OptionEndIndex = (tokens: string[], index: number) => number;

export function xargsInputBeforeEof(
  tokens: string[],
  stdinToken: string,
  optionEndIndex: OptionEndIndex,
): string {
  const eof = xargsEofString(tokens, optionEndIndex);
  if (!eof) return stdinToken;

  const lines = stdinToken.split('\n');
  const eofIndex = lines.findIndex((line) => line === eof);
  return eofIndex < 0 ? stdinToken : lines.slice(0, eofIndex).join('\n');
}

export function xargsTargetsBeforeEof(
  tokens: string[],
  targets: string[],
  optionEndIndex: OptionEndIndex,
): string[] {
  const eof = xargsEofString(tokens, optionEndIndex);
  if (!eof) return targets;

  const eofIndex = targets.findIndex((target) => target === eof);
  return eofIndex < 0 ? targets : targets.slice(0, eofIndex);
}

function xargsEofString(tokens: string[], optionEndIndex: OptionEndIndex): string {
  let eof = '';

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === '--') return eof;
    if (!token.startsWith('-')) return eof;

    const nextEof = xargsEofStringAt(tokens, index);
    if (nextEof !== null) eof = nextEof;
    index = optionEndIndex(tokens, index);
  }
  return eof;
}

function xargsEofStringAt(tokens: string[], index: number): string | null {
  const token = tokens[index];
  if (token === '-E') return eofArgument(tokens[index + 1] ?? '');
  if (token.startsWith('-E') && token.length > 2) return eofArgument(token.slice(2));
  if (token === '-e' || token === '--eof') return '';
  if (token.startsWith('-e') && token.length > 2) return eofArgument(token.slice(2));
  if (token.startsWith('--eof=')) return eofArgument(token.slice('--eof='.length));

  return xargsClusteredEofString(tokens, index);
}

function xargsClusteredEofString(tokens: string[], index: number): string | null {
  const token = tokens[index];
  const inline = xargsInlineShortOptionArgument(token, '-E');
  if (inline) return eofArgument(inline);
  if (xargsTrailingShortOptionWithSeparatedArgument(token) === '-E') {
    return eofArgument(tokens[index + 1] ?? '');
  }
  return null;
}

function eofArgument(token: string): string {
  return token ? unquoteShellToken(token) : '';
}
