import { literalCommandOutputToken } from './literal-command-output.utils';
import {
  xargsOptionEndIndex,
  xargsStdinArgumentBatches,
} from './xargs-command.utils';
import { xargsHasInvalidOption } from './xargs-invalid-option.utils';
import {
  xargsInlineShortOptionArgument,
  xargsTrailingShortOptionWithSeparatedArgument,
} from './xargs-short-option.utils';

const XARGS_ARG_FILE_OPTIONS = new Set(['-a', '--arg-file']);

export function xargsArgFileArgumentTokens(tokens: string[]): string[] | null {
  return xargsArgFileArgumentBatches(tokens)?.flat() ?? null;
}

export function xargsArgFileArgumentBatches(tokens: string[]): string[][] | null {
  if (xargsHasInvalidOption(tokens, xargsOptionEndIndex)) return [];

  let batches: string[][] | null = null;

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === '--') break;
    if (!token.startsWith('-')) break;

    const inlineSource = inlineArgFileSource(token);
    if (inlineSource !== null) {
      const source = readInlineArgFileSource(tokens, index, inlineSource);
      batches = staticArgFileBatches(source.token, tokens) ?? [];
      index = source.endIndex;
      continue;
    }
    if (!XARGS_ARG_FILE_OPTIONS.has(token)) {
      if (xargsTrailingShortOptionWithSeparatedArgument(token) === '-a') {
        const source = readArgFileSource(tokens, index + 1);
        batches = source ? staticArgFileBatches(source.token, tokens) ?? [] : [];
        index = source?.endIndex ?? index;
        continue;
      }
      index = xargsOptionEndIndex(tokens, index);
      continue;
    }

    const source = readArgFileSource(tokens, index + 1);
    batches = source ? staticArgFileBatches(source.token, tokens) ?? [] : [];
    index = source?.endIndex ?? index;
  }

  return batches;
}

function inlineArgFileSource(token: string): string | null {
  if (token.startsWith('--arg-file=')) return token.slice('--arg-file='.length);
  return xargsInlineShortOptionArgument(token, '-a') || null;
}

function readInlineArgFileSource(
  tokens: string[],
  index: number,
  source: string,
): { token: string; endIndex: number } {
  let token = source;
  let endIndex = index;
  while (
    token.trim().startsWith('<(')
    && endIndex + 1 < tokens.length
    && processSubstitutionCommand(token) === ''
  ) {
    endIndex += 1;
    token += ` ${tokens[endIndex]}`;
  }
  return { token, endIndex };
}

function readArgFileSource(tokens: string[], index: number): { token: string; endIndex: number } | null {
  const first = tokens[index];
  if (!first) return null;
  if (!first.trim().startsWith('<(')) return { token: first, endIndex: index };

  let token = first;
  let endIndex = index;
  while (endIndex + 1 < tokens.length && processSubstitutionCommand(token) === '') {
    endIndex += 1;
    token += ` ${tokens[endIndex]}`;
  }
  return { token, endIndex };
}

function staticArgFileBatches(source: string, xargsTokens: string[]): string[][] | null {
  const command = processSubstitutionCommand(source);
  if (!command) return null;

  const output = literalCommandOutputToken(command);
  return output ? xargsStdinArgumentBatches(xargsTokens, output) : [];
}

function processSubstitutionCommand(source: string): string {
  const trimmed = source.trim();
  return trimmed.startsWith('<(') && trimmed.endsWith(')') ? trimmed.slice(2, -1) : '';
}
