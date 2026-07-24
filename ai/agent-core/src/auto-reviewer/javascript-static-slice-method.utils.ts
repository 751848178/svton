import {
  identifierChar,
  readDecimalInteger,
  skipWhitespace,
} from './javascript-static-decimal-code.utils';
import { readQuotedLiteral } from './interpreter-script-token.utils';
import type { JsStaticValue } from './javascript-static-string.utils';

type StaticSliceMethod = 'slice' | 'substring' | 'substr';

export function readJsSliceMethodChain(
  source: string,
  startValue: JsStaticValue,
): JsStaticValue | null {
  let result = startValue;

  while (true) {
    const method = readSliceMethodArgsStart(source, result.endIndex + 1);
    if (!method) return result;

    const sliced = readSliceMethodValue(source, result.value, method);
    if (!sliced) return null;
    result = sliced;
  }
}

function readSliceMethodArgsStart(
  source: string,
  startIndex: number,
): { name: StaticSliceMethod; argsStart: number } | null {
  let cursor = skipWhitespace(source, startIndex);
  if (source[cursor] === '?' && source[cursor + 1] === '.') {
    cursor = skipWhitespace(source, cursor + 2);
    return source[cursor] === '['
      ? readBracketSliceMethodArgsStart(source, cursor)
      : readNamedSliceMethodArgsStart(source, cursor);
  }

  if (source[cursor] === '.') {
    return readNamedSliceMethodArgsStart(source, skipWhitespace(source, cursor + 1));
  }

  return readBracketSliceMethodArgsStart(source, cursor);
}

function readNamedSliceMethodArgsStart(
  source: string,
  startIndex: number,
): { name: StaticSliceMethod; argsStart: number } | null {
  const name = readSliceMethodName(source, startIndex);
  if (!name) return null;
  const argsStart = readSliceCallArgsStart(source, startIndex + name.length);
  return argsStart ? { name, argsStart } : null;
}

function readBracketSliceMethodArgsStart(
  source: string,
  startIndex: number,
): { name: StaticSliceMethod; argsStart: number } | null {
  let cursor = startIndex;
  if (source[cursor] !== '[') return null;
  const key = readStaticSliceMethodKey(source, cursor + 1);
  if (!key) return null;

  cursor = skipWhitespace(source, key.endIndex);
  if (source[cursor] !== ']') return null;
  const argsStart = readSliceCallArgsStart(source, cursor + 1);
  return argsStart ? { name: key.name, argsStart } : null;
}

function readSliceCallArgsStart(source: string, startIndex: number): number | null {
  let cursor = skipWhitespace(source, startIndex);
  if (source[cursor] === '?' && source[cursor + 1] === '.') {
    cursor = skipWhitespace(source, cursor + 2);
  }
  return source[cursor] === '(' ? cursor + 1 : null;
}

function readStaticSliceMethodKey(
  source: string,
  startIndex: number,
): { name: StaticSliceMethod; endIndex: number } | null {
  let value = '';
  let cursor = startIndex;

  while (true) {
    const part = readStaticSliceMethodKeyPart(source, cursor);
    if (!part) return null;
    value += part.value;

    cursor = skipWhitespace(source, part.endIndex + 1);
    if (source[cursor] !== '+') break;
    cursor = skipWhitespace(source, cursor + 1);
  }

  const name = readStaticSliceMethodName(value);
  return name ? { name, endIndex: cursor } : null;
}

function readStaticSliceMethodKeyPart(
  source: string,
  startIndex: number,
): { value: string; endIndex: number } | null {
  return readQuotedLiteral(source, startIndex) ?? readNoSubstitutionTemplateKey(source, startIndex);
}

function readNoSubstitutionTemplateKey(
  source: string,
  startIndex: number,
): { value: string; endIndex: number } | null {
  let cursor = skipWhitespace(source, startIndex);
  if (source[cursor] !== '`') return null;

  let value = '';
  for (let index = cursor + 1; index < source.length; index += 1) {
    const char = source[index];
    if (char === '`' && source[index - 1] !== '\\') return { value, endIndex: index };
    if (char === '$' && source[index + 1] === '{') return null;
    if (char === '\\' && source[index + 1]) {
      value += source[index + 1];
      index += 1;
      continue;
    }
    value += char;
  }

  return null;
}

function readSliceMethodValue(
  source: string,
  receiver: string,
  method: { name: StaticSliceMethod; argsStart: number },
): JsStaticValue | null {
  let cursor = skipWhitespace(source, method.argsStart);
  const start = readDecimalInteger(source, cursor);
  if (!start) return null;
  cursor = skipWhitespace(source, start.endIndex + 1);

  if (source[cursor] === ')') {
    return { value: receiver[method.name](start.value), endIndex: cursor };
  }
  if (source[cursor] !== ',') return null;

  cursor = skipWhitespace(source, cursor + 1);
  const end = readDecimalInteger(source, cursor);
  if (!end) return null;
  cursor = skipWhitespace(source, end.endIndex + 1);
  if (method.name === 'substring' && end.value < start.value) return null;

  return source[cursor] === ')'
    ? { value: readSliceValue(receiver, method.name, start.value, end.value), endIndex: cursor }
    : null;
}

function readSliceMethodName(source: string, startIndex: number): StaticSliceMethod | null {
  if (source.startsWith('slice', startIndex) && !identifierChar(source[startIndex + 5])) {
    return 'slice';
  }
  if (source.startsWith('substring', startIndex) && !identifierChar(source[startIndex + 9])) {
    return 'substring';
  }
  if (source.startsWith('substr', startIndex) && !identifierChar(source[startIndex + 6])) {
    return 'substr';
  }
  return null;
}

function readStaticSliceMethodName(value: string): StaticSliceMethod | null {
  return value === 'slice' || value === 'substring' || value === 'substr' ? value : null;
}

function readSliceValue(
  receiver: string,
  method: StaticSliceMethod,
  start: number,
  endOrLength: number,
): string {
  return method === 'substr'
    ? receiver.substr(start, endOrLength)
    : receiver[method](start, endOrLength);
}
