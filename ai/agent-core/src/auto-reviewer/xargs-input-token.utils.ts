import { xargsBatchOption, type XargsBatchOption } from './xargs-batch-option.utils';
import { xargsDelimiterInputBatches } from './xargs-delimiter-input-token.utils';
import { xargsInputBeforeEof } from './xargs-eof-option.utils';
import { xargsReplacementLineBatches, xargsReplacementLines } from './xargs-replacement-line.utils';

type OptionEndIndex = (tokens: string[], index: number) => number;
export function xargsInputArgumentTokens(
  tokens: string[],
  stdinToken: string,
  optionEndIndex: OptionEndIndex,
  replacementMarker: string,
  lineBatches = false,
  replacementBatchOption: XargsBatchOption | null = null,
  replacementPreBatchOption: XargsBatchOption | null = null,
): string[] {
  return xargsInputArgumentBatches(
    tokens,
    stdinToken,
    optionEndIndex,
    replacementMarker,
    lineBatches,
    replacementBatchOption,
    replacementPreBatchOption,
  ).flat();
}

export function xargsInputArgumentBatches(
  tokens: string[],
  stdinToken: string,
  optionEndIndex: OptionEndIndex,
  replacementMarker: string,
  lineBatches = false,
  replacementBatchOption: XargsBatchOption | null = null,
  replacementPreBatchOption: XargsBatchOption | null = null,
): string[][] {
  const delimiterBatches = xargsDelimiterInputBatches(
    tokens,
    stdinToken,
    optionEndIndex,
    replacementMarker,
    replacementBatchOption,
  );
  if (delimiterBatches) return delimiterBatches;

  const input = xargsInputBeforeEof(tokens, stdinToken, optionEndIndex);
  if (!input) return [];
  if (replacementMarker) return xargsReplacementInputBatches(input, replacementBatchOption, replacementPreBatchOption);

  const batchOption = xargsBatchOption(tokens, optionEndIndex);
  if (batchOption?.kind === 'max-lines') return xargsDefaultInputLineBatches(input, batchOption.size);
  if (lineBatches) return xargsDefaultInputLineBatches(input, 1);

  const defaultTokens = xargsDefaultInputTokens(input);
  return defaultTokens.length > 0 ? [defaultTokens] : [];
}

function xargsReplacementInputBatches(input: string, batchOption: XargsBatchOption | null, preBatchOption: XargsBatchOption | null): string[][] {
  const replacementLines = xargsReplacementLines(input);
  if (batchOption?.kind === 'max-lines') {
    return xargsDefaultInputLineBatches(replacementLines.join('\n'), batchOption.size).map((batch) => [batch.join(' ')]);
  }
  if (batchOption?.kind === 'max-args') return xargsDefaultInputTokens(replacementLines.join('\n')).map((token) => [token]);
  if (preBatchOption?.kind === 'max-args') return xargsPreReplacementMaxArgsBatches(replacementLines, preBatchOption.size);
  return xargsReplacementLineBatches(input);
}

function xargsPreReplacementMaxArgsBatches(lines: string[], batchSize: number): string[][] {
  return lines.flatMap((line) => {
    const lineTokens = xargsDefaultInputTokens(line);
    const batches: string[][] = [];
    for (let index = 0; index < lineTokens.length; index += batchSize) {
      batches.push([lineTokens.slice(index, index + batchSize).join(' ')]);
    }
    return batches;
  });
}

function xargsDefaultInputTokens(input: string): string[] {
  const tokens: string[] = [];
  let token = '';
  let quote: '"' | "'" | null = null;
  let hasToken = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quote) {
      if (char === quote) {
        quote = null;
        hasToken = true;
        continue;
      }
      token += char;
      hasToken = true;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      hasToken = true;
      continue;
    }
    const escaped = escapedXargsChar(input, index);
    if (escaped) {
      token += escaped.char;
      index = escaped.index;
      hasToken = true;
      continue;
    }
    if (/\s/.test(char)) {
      if (hasToken) tokens.push(token);
      token = '';
      hasToken = false;
      continue;
    }
    token += char;
    hasToken = true;
  }

  if (quote) return [];
  if (hasToken) tokens.push(token);
  return tokens;
}

function xargsDefaultInputLineBatches(input: string, batchSize: number): string[][] {
  const lines = xargsLogicalInputLines(input);
  const batches: string[][] = [];

  for (let index = 0; index < lines.length; index += batchSize) {
    const batch = xargsDefaultInputTokens(lines.slice(index, index + batchSize).join('\n'));
    if (batch.length > 0) batches.push(batch);
  }

  return batches;
}

function xargsLogicalInputLines(input: string): string[] {
  const lines: string[] = [];
  let current = '';
  let continuing = false;

  for (const rawLine of input.split('\n')) {
    if (!rawLine.trim() && !continuing) continue;

    const continues = / +$/.test(rawLine);
    const line = continues ? rawLine.replace(/ +$/, '') : rawLine;
    current = current ? `${current}\n${line}` : line;

    if (continues) {
      continuing = true;
      continue;
    }

    if (current.trim()) lines.push(current);
    current = '';
    continuing = false;
  }

  if (current.trim()) lines.push(current);
  return lines;
}

function escapedXargsChar(input: string, index: number): { char: string; index: number } | null {
  if (input[index] !== '\\') return null;
  const next = input[index + 1];
  return next ? { char: next, index: index + 1 } : { char: '\\', index };
}
