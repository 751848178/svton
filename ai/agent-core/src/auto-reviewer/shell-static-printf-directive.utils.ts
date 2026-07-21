import { decodePrintfPercentBToken } from './printf-percent-b-token.utils';

export type StaticPrintfConversion = {
  conversion: 'b' | 'c' | 's';
  leftAlign: boolean;
  precision?: StaticPrintfSize;
  width?: StaticPrintfSize;
};
type StaticPrintfSize = { kind: 'argument' } | { kind: 'literal'; value: number };
export type StaticPrintfDirectivePart = string | StaticPrintfConversion;

export function isStaticPrintfConversion(
  part: StaticPrintfDirectivePart,
): part is StaticPrintfConversion {
  return typeof part === 'object';
}

export function renderStaticPrintfConversion(
  part: StaticPrintfConversion,
  args: string[],
  argIndex: number,
): { value: string; nextArgIndex: number } | null {
  const width = staticPrintfSizeValue(part.width, args, argIndex);
  if (!width) return null;

  const precision = staticPrintfSizeValue(part.precision, args, width.nextArgIndex);
  if (!precision) return null;

  let nextArgIndex = precision.nextArgIndex;
  const value = args[nextArgIndex++] ?? '';
  const rendered = applyStaticPrintfWidth(
    applyStaticPrintfPrecision(staticPrintfConversionValue(part.conversion, value), part, precision.value),
    part,
    width.value,
  );

  return { value: rendered, nextArgIndex };
}

export function readStaticPrintfDirective(
  format: string,
  index: number,
): { part: StaticPrintfDirectivePart; endIndex: number } | null {
  let cursor = index + 1;
  if (format[cursor] === '%') return { part: '%', endIndex: cursor };

  let leftAlign = false;
  while (isStaticPrintfFlag(format[cursor])) {
    if (format[cursor] === '-') leftAlign = true;
    cursor += 1;
  }

  const width = readStaticPrintfSize(format, cursor);
  if (width) cursor = width.endIndex + 1;

  let precision: StaticPrintfSize | undefined;
  if (format[cursor] === '.') {
    const parsedPrecision = readStaticPrintfSize(format, cursor + 1);
    precision = parsedPrecision?.size ?? { kind: 'literal', value: 0 };
    cursor = parsedPrecision ? parsedPrecision.endIndex + 1 : cursor + 1;
  }

  const conversion = format[cursor];
  return isStaticPrintfConversionChar(conversion)
    ? {
      part: {
        conversion,
        leftAlign,
        precision,
        width: width?.size,
      },
      endIndex: cursor,
    }
    : null;
}

function staticPrintfSizeValue(
  size: StaticPrintfSize | undefined,
  args: string[],
  argIndex: number,
): { value?: number; nextArgIndex: number } | null {
  if (!size) return { nextArgIndex: argIndex };
  if (size.kind === 'literal') return { value: size.value, nextArgIndex: argIndex };

  const value = Number.parseInt(args[argIndex] ?? '', 10);
  return Number.isFinite(value) ? { value, nextArgIndex: argIndex + 1 } : null;
}

function staticPrintfConversionValue(
  conversion: StaticPrintfConversion['conversion'],
  value: string,
): string {
  if (conversion === 'c') return value[0] ?? '';
  return conversion === 'b' ? decodePrintfPercentBToken(value) : value;
}

function applyStaticPrintfPrecision(
  value: string,
  part: StaticPrintfConversion,
  precision: number | undefined,
): string {
  if (precision === undefined || precision < 0 || part.conversion === 'c') return value;
  return value.slice(0, precision);
}

function applyStaticPrintfWidth(
  value: string,
  part: StaticPrintfConversion,
  width: number | undefined,
): string {
  if (width === undefined) return value;

  const size = Math.abs(width);
  if (value.length >= size) return value;

  const padding = ' '.repeat(size - value.length);
  return part.leftAlign || width < 0 ? `${value}${padding}` : `${padding}${value}`;
}

function readStaticPrintfSize(
  format: string,
  index: number,
): { size: StaticPrintfSize; endIndex: number } | null {
  if (format[index] === '*') return { size: { kind: 'argument' }, endIndex: index };

  const digits = format.slice(index).match(/^[0-9]+/)?.[0];
  return digits
    ? {
      size: { kind: 'literal', value: Number.parseInt(digits, 10) },
      endIndex: index + digits.length - 1,
    }
    : null;
}

function isStaticPrintfConversionChar(char: string): char is StaticPrintfConversion['conversion'] {
  return char === 'b' || char === 'c' || char === 's';
}

function isStaticPrintfFlag(char: string | undefined): boolean {
  return char !== undefined && ['#', ' ', '+', '-', '0'].includes(char);
}
