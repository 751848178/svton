import { xargsInputArgumentBatches, xargsInputArgumentTokens } from './xargs-input-token.utils';
import {
  xargsBatchOptionAfter,
  xargsBatchOptionBefore,
  type XargsBatchOption,
} from './xargs-batch-option.utils';
import { xargsMaxArgsBatches } from './xargs-max-args.utils';
import {
  expandXargsBsdReplacementTokens,
  expandXargsReplacementTokens,
} from './xargs-replacement-token.utils';
import {
  isXargsReplaceOption,
  xargsHasLineReplacementOption,
  xargsReplacementMode,
} from './xargs-replacement-marker.utils';
import {
  xargsInlineShortOptionArgument,
  xargsTrailingShortOptionWithSeparatedArgument,
} from './xargs-short-option.utils';
import { xargsLiteralInputTargets, xargsLiteralReplacementIndexes } from './xargs-literal-input-target.utils';
import { xargsHasInvalidOption } from './xargs-invalid-option.utils';
import type { XargsReplacementMode } from './xargs-replacement-marker.utils';

const XARGS_OPTIONS_WITH_ARGUMENT = new Set([
  '-a',
  '-d',
  '-E',
  '-I',
  '-J',
  '-L',
  '-n',
  '-P',
  '-s',
  '--arg-file',
  '--delimiter',
  '--max-args',
  '--max-chars',
  '--max-procs',
  '--process-slot-var',
]);

export function xargsAppendsStdinArguments(tokens: string[]): boolean {
  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === '--') return true;
    if (!token.startsWith('-')) return true;
    if (isXargsReplaceOption(token)) return false;
    index = xargsOptionEndIndex(tokens, index);
  }

  return true;
}

export function xargsStdinArgumentTokens(tokens: string[], stdinToken: string): string[] {
  if (xargsHasInvalidOption(tokens, xargsOptionEndIndex)) return [];
  const mode = xargsReplacementMode(tokens, xargsOptionEndIndex);
  const replacementBatchOptions = xargsLineReplacementBatchOptions(tokens, mode);
  return xargsInputArgumentTokens(
    tokens,
    stdinToken,
    xargsOptionEndIndex,
    mode?.kind === 'line' ? mode.marker : '',
    xargsHasLineReplacementOption(tokens, xargsOptionEndIndex),
    replacementBatchOptions.after,
    replacementBatchOptions.before,
  );
}

export function xargsStdinArgumentBatches(tokens: string[], stdinToken: string): string[][] {
  if (xargsHasInvalidOption(tokens, xargsOptionEndIndex)) return [];
  const mode = xargsReplacementMode(tokens, xargsOptionEndIndex);
  const replacementBatchOptions = xargsLineReplacementBatchOptions(tokens, mode);
  return xargsInputArgumentBatches(
    tokens,
    stdinToken,
    xargsOptionEndIndex,
    mode?.kind === 'line' ? mode.marker : '',
    xargsHasLineReplacementOption(tokens, xargsOptionEndIndex),
    replacementBatchOptions.after,
    replacementBatchOptions.before,
  );
}

export function xargsCommandTokenVariants(
  commandTokens: string[],
  xargsTokens: string[],
  stdinTargets: string[],
): string[][] {
  return xargsCommandTokenBatchVariants(commandTokens, xargsTokens, [stdinTargets]);
}

export function xargsCommandTokenBatchVariants(
  commandTokens: string[],
  xargsTokens: string[],
  stdinBatches: string[][],
): string[][] {
  if (xargsHasInvalidOption(xargsTokens, xargsOptionEndIndex)) return [];
  const mode = xargsReplacementMode(xargsTokens, xargsOptionEndIndex);
  if (mode?.kind === 'bsd' && mode.marker) {
    return stdinBatches.flatMap((stdinTargets) => xargsMaxArgsBatches(xargsTokens, stdinTargets, xargsOptionEndIndex))
      .map((targets) => expandXargsBsdReplacementTokens(commandTokens, mode.marker, targets));
  }

  if (mode?.kind === 'line' && !xargsAppendsStdinArguments(xargsTokens) && mode.marker) {
    const literalIndexes = xargsLiteralReplacementIndexes(commandTokens, xargsTokens, xargsOptionEndIndex);
    return stdinBatches.flatMap((batch) => (
      batch.map((target) => expandXargsReplacementTokens(commandTokens, mode.marker, target, literalIndexes))
    ));
  }

  return stdinBatches.flatMap((stdinTargets) => xargsMaxArgsBatches(xargsTokens, stdinTargets, xargsOptionEndIndex))
    .map((targets) => [...commandTokens, ...xargsLiteralInputTargets(xargsTokens, targets, xargsOptionEndIndex)]);
}

export function firstXargsCommandIndex(tokens: string[]): number {
  let optionsEnded = false;

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!optionsEnded && token === '--') {
      optionsEnded = true;
      continue;
    }

    if (!optionsEnded && token.startsWith('-')) {
      if (xargsHasInvalidOption(tokens.slice(0, index + 1), xargsOptionEndIndex)) {
        return -1;
      }
      index = xargsOptionEndIndex(tokens, index);
      continue;
    }

    return index;
  }

  return -1;
}

export function xargsOptionEndIndex(tokens: string[], index: number): number {
  const token = tokens[index];
  const inlineArgument = xargsInlineOptionArgument(token);
  if (inlineArgument) return processSubstitutionEndIndex(tokens, index, inlineArgument);
  if (xargsTrailingShortOptionWithSeparatedArgument(token)) {
    if (!tokens[index + 1]) return index;
    return processSubstitutionEndIndex(tokens, index + 1, tokens[index + 1]);
  }
  if (!XARGS_OPTIONS_WITH_ARGUMENT.has(token)) return index;
  if (!tokens[index + 1]) return index;
  return processSubstitutionEndIndex(tokens, index + 1, tokens[index + 1]);
}

function xargsInlineOptionArgument(token: string): string {
  const option = [...XARGS_OPTIONS_WITH_ARGUMENT].find((candidate) => token.startsWith(`${candidate}=`));
  if (option) return token.slice(option.length + 1);
  return xargsInlineShortOptionArgument(token);
}

function processSubstitutionEndIndex(tokens: string[], index: number, source: string): number {
  let token = source;
  let endIndex = index;
  while (endIndex + 1 < tokens.length && isUnclosedProcessSubstitution(token)) {
    endIndex += 1;
    token += ` ${tokens[endIndex]}`;
  }
  return endIndex;
}

function isUnclosedProcessSubstitution(token: string): boolean {
  const trimmed = token.trim();
  return trimmed.startsWith('<(') && !trimmed.endsWith(')');
}

function xargsLineReplacementBatchOptions(
  tokens: string[],
  mode: XargsReplacementMode | null,
): { after: XargsBatchOption | null; before: XargsBatchOption | null } {
  if (mode?.kind !== 'line') return { after: null, before: null };
  return {
    after: xargsBatchOptionAfter(tokens, xargsOptionEndIndex, mode.index),
    before: xargsBatchOptionBefore(tokens, xargsOptionEndIndex, mode.index),
  };
}
