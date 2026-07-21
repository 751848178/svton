import { xargsBatchOption } from './xargs-batch-option.utils';

type OptionEndIndex = (tokens: string[], index: number) => number;

export function xargsMaxArgsBatches(
  tokens: string[],
  stdinTargets: string[],
  optionEndIndex: OptionEndIndex,
): string[][] {
  const batchSize = xargsMaxArgsBatchSize(tokens, optionEndIndex);
  if (!batchSize || stdinTargets.length <= batchSize) return [stdinTargets];

  const batches: string[][] = [];
  for (let index = 0; index < stdinTargets.length; index += batchSize) {
    batches.push(stdinTargets.slice(index, index + batchSize));
  }
  return batches;
}

function xargsMaxArgsBatchSize(tokens: string[], optionEndIndex: OptionEndIndex): number {
  const option = xargsBatchOption(tokens, optionEndIndex);
  return option?.kind === 'max-args' ? option.size : 0;
}
