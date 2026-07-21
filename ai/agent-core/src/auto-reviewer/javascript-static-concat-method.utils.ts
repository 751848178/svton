import type { JsStaticValue } from './javascript-static-string.utils';

type JsStaticStringReader = (
  source: string,
  startIndex: number,
  valueForName: (name: string) => string | undefined,
  boundary: (source: string, index: number) => boolean,
) => JsStaticValue | null;

export function readJsConcatMethodChain(
  source: string,
  startValue: JsStaticValue,
  valueForName: (name: string) => string | undefined,
  readExpression: JsStaticStringReader,
  argumentBoundary: (source: string, index: number) => boolean,
): JsStaticValue | null {
  let result = startValue;

  while (true) {
    const argsStart = readConcatMethodArgsStart(source, result.endIndex + 1);
    if (argsStart === null) return result;

    const args = readConcatMethodArguments(source, argsStart, valueForName, readExpression, argumentBoundary);
    if (!args) return null;
    result = { value: result.value + args.value, endIndex: args.endIndex };
  }
}

function readConcatMethodArgsStart(source: string, startIndex: number): number | null {
  let cursor = startIndex;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  if (source[cursor] !== '.') return null;
  cursor += 1;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  if (!source.startsWith('concat', cursor) || isJsIdentifierChar(source[cursor + 'concat'.length])) {
    return null;
  }
  cursor += 'concat'.length;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  return source[cursor] === '(' ? cursor + 1 : null;
}

function readConcatMethodArguments(
  source: string,
  startIndex: number,
  valueForName: (name: string) => string | undefined,
  readExpression: JsStaticStringReader,
  argumentBoundary: (source: string, index: number) => boolean,
): JsStaticValue | null {
  let cursor = startIndex;
  let value = '';

  while (cursor < source.length) {
    while (/\s/.test(source[cursor] ?? '')) cursor += 1;
    if (source[cursor] === ')') return { value, endIndex: cursor };

    const arg = readExpression(source, cursor, valueForName, argumentBoundary);
    if (!arg) return null;
    value += arg.value;

    cursor = arg.endIndex + 1;
    while (/\s/.test(source[cursor] ?? '')) cursor += 1;
    if (source[cursor] === ',') {
      cursor += 1;
      continue;
    }
    if (source[cursor] === ')') return { value, endIndex: cursor };
    return null;
  }

  return null;
}

function isJsIdentifierChar(value: string | undefined): boolean {
  return Boolean(value && /[A-Za-z0-9_$]/.test(value));
}
