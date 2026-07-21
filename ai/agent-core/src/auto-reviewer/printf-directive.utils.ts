export type PrintfConversion = 's' | 'b' | 'c';
export type PrintfModifier = number | 'argument';

export type PrintfDirective = {
  conversion: PrintfConversion;
  endIndex: number;
  width?: PrintfModifier;
  precision?: PrintfModifier;
};

const PRINTF_FLAG_CHARS = new Set(['#', '0', '-', ' ', '+']);

export function readPrintfDirective(format: string, index: number): PrintfDirective | null {
  let cursor = skipPrintfFlags(format, index + 1);
  const widthResult = readPrintfModifier(format, cursor);
  const width = widthResult?.modifier;
  cursor = widthResult?.endIndex ?? cursor;

  let precision: PrintfModifier | undefined;
  if (format[cursor] === '.') {
    const precisionResult = readPrintfModifier(format, cursor + 1);
    if (!precisionResult) return null;
    precision = precisionResult.modifier;
    cursor = precisionResult.endIndex;
  }

  const conversion = format[cursor];
  if (conversion !== 's' && conversion !== 'b' && conversion !== 'c') return null;

  return { conversion, endIndex: cursor, width, precision };
}

function skipPrintfFlags(format: string, index: number): number {
  let cursor = index;
  while (PRINTF_FLAG_CHARS.has(format[cursor])) cursor += 1;
  return cursor;
}

function readPrintfModifier(format: string, index: number): { modifier: PrintfModifier; endIndex: number } | null {
  if (format[index] === '*') {
    return { modifier: 'argument', endIndex: index + 1 };
  }

  const numberText = format.slice(index).match(/^\d+/)?.[0];
  if (numberText === undefined) return null;

  return {
    modifier: Number.parseInt(numberText, 10),
    endIndex: index + numberText.length,
  };
}
