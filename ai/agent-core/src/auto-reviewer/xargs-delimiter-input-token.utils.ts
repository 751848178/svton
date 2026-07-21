import { parseXargsDelimiterToken } from './xargs-delimiter.utils';
import { xargsBatchOption, type XargsBatchOption } from './xargs-batch-option.utils';
import { xargsTargetsBeforeEof } from './xargs-eof-option.utils';
import {
  xargsInlineShortOptionArgument,
  xargsShortOptionClusterHasFlag,
  xargsTrailingShortOptionWithSeparatedArgument,
} from './xargs-short-option.utils';

type OptionEndIndex = (tokens: string[], index: number) => number;

export function xargsDelimiterInputBatches(
  tokens: string[],
  stdinToken: string,
  optionEndIndex: OptionEndIndex,
  replacementMarker: string,
  replacementBatchOption: XargsBatchOption | null,
): string[][] | null {
  const delimiter = xargsInputDelimiter(tokens, optionEndIndex);
  if (delimiter === undefined) return null;

  const splitTargets = stdinToken.split(delimiter).filter(Boolean);
  const targets = replacementMarker
    ? splitTargets
    : xargsTargetsBeforeEof(tokens, splitTargets, optionEndIndex);
  if (targets.length === 0) return [];
  if (replacementMarker) return xargsDelimiterReplacementBatches(targets, replacementBatchOption);

  const batchOption = xargsBatchOption(tokens, optionEndIndex);
  return batchOption?.kind === 'max-lines'
    ? xargsDelimiterTargetBatches(targets, batchOption.size)
    : [targets];
}

function xargsDelimiterReplacementBatches(
  targets: string[],
  batchOption: XargsBatchOption | null,
): string[][] {
  return batchOption?.kind === 'max-lines'
    ? xargsDelimiterTargetBatches(targets, batchOption.size).map((batch) => [batch.join(' ')])
    : [targets];
}

function xargsDelimiterTargetBatches(targets: string[], size: number): string[][] {
  const batches: string[][] = [];
  for (let index = 0; index < targets.length; index += size) {
    batches.push(targets.slice(index, index + size));
  }
  return batches;
}

function xargsInputDelimiter(tokens: string[], optionEndIndex: OptionEndIndex): string | undefined {
  let delimiter: string | undefined;

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === '--') return delimiter;
    if (!token.startsWith('-')) return delimiter;
    if (token === '-0' || token.startsWith('-0') || token === '--null'
      || xargsShortOptionClusterHasFlag(token, '0')) {
      delimiter = '\0';
    }
    const customDelimiter = xargsDelimiterOptionValue(tokens, index);
    if (customDelimiter !== undefined) delimiter = customDelimiter;
    index = optionEndIndex(tokens, index);
  }

  return delimiter;
}

function xargsDelimiterOptionValue(tokens: string[], index: number): string | undefined {
  const token = tokens[index];
  if (token === '-d' || token === '--delimiter') {
    return tokens[index + 1] ? parseXargsDelimiterToken(tokens[index + 1]) : undefined;
  }
  if (token.startsWith('-d') && token.length > 2) return parseXargsDelimiterToken(token.slice(2));
  if (token.startsWith('--delimiter=')) return parseXargsDelimiterToken(token.slice('--delimiter='.length));
  const shortDelimiter = xargsInlineShortOptionArgument(token, '-d');
  if (shortDelimiter) return parseXargsDelimiterToken(shortDelimiter);
  if (xargsTrailingShortOptionWithSeparatedArgument(token) === '-d') {
    return tokens[index + 1] ? parseXargsDelimiterToken(tokens[index + 1]) : undefined;
  }
  return undefined;
}
