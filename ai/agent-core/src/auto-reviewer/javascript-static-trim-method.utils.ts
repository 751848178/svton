import {
  identifierChar,
  skipWhitespace,
} from './javascript-static-decimal-code.utils';
import { readQuotedLiteral } from './interpreter-script-token.utils';
import type { JsStaticValue } from './javascript-static-string.utils';

type StaticTrimMethod = 'trim' | 'trimStart' | 'trimEnd';

export function readJsTrimMethodChain(
  source: string,
  startValue: JsStaticValue,
): JsStaticValue | null {
  let result = startValue;

  while (true) {
    const method = readTrimMethodCall(source, result.endIndex + 1);
    if (!method) return result;

    result = { value: readTrimValue(result.value, method.name), endIndex: method.endIndex };
  }
}

function readTrimMethodCall(
  source: string,
  startIndex: number,
): { name: StaticTrimMethod; endIndex: number } | null {
  let cursor = skipWhitespace(source, startIndex);
  if (source[cursor] === '?' && source[cursor + 1] === '.') {
    cursor = skipWhitespace(source, cursor + 2);
    return source[cursor] === '['
      ? readBracketTrimMethodCall(source, cursor)
      : readNamedTrimMethodCall(source, cursor);
  }

  if (source[cursor] === '.') {
    return readNamedTrimMethodCall(source, skipWhitespace(source, cursor + 1));
  }

  return readBracketTrimMethodCall(source, cursor);
}

function readNamedTrimMethodCall(
  source: string,
  startIndex: number,
): { name: StaticTrimMethod; endIndex: number } | null {
  const name = readTrimMethodName(source, startIndex);
  if (!name) return null;
  const endIndex = readEmptyTrimCallEnd(source, startIndex + name.length);
  return endIndex === null ? null : { name, endIndex };
}

function readBracketTrimMethodCall(
  source: string,
  startIndex: number,
): { name: StaticTrimMethod; endIndex: number } | null {
  let cursor = startIndex;
  if (source[cursor] !== '[') return null;
  const key = readStaticTrimMethodKey(source, cursor + 1);
  if (!key) return null;

  cursor = skipWhitespace(source, key.endIndex);
  if (source[cursor] !== ']') return null;
  const endIndex = readEmptyTrimCallEnd(source, cursor + 1);
  return endIndex === null ? null : { name: key.name, endIndex };
}

function readStaticTrimMethodKey(
  source: string,
  startIndex: number,
): { name: StaticTrimMethod; endIndex: number } | null {
  let value = '';
  let cursor = startIndex;

  while (true) {
    const part = readStaticTrimMethodKeyPart(source, cursor);
    if (!part) return null;
    value += part.value;

    cursor = skipWhitespace(source, part.endIndex + 1);
    if (source[cursor] !== '+') break;
    cursor = skipWhitespace(source, cursor + 1);
  }

  const name = readStaticTrimMethodName(value);
  return name ? { name, endIndex: cursor } : null;
}

function readStaticTrimMethodKeyPart(
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

function readEmptyTrimCallEnd(source: string, startIndex: number): number | null {
  let cursor = skipWhitespace(source, startIndex);
  if (source[cursor] === '?' && source[cursor + 1] === '.') {
    cursor = skipWhitespace(source, cursor + 2);
  }
  if (source[cursor] !== '(') return null;

  cursor = skipWhitespace(source, cursor + 1);
  return source[cursor] === ')' ? cursor : null;
}

function readTrimMethodName(source: string, startIndex: number): StaticTrimMethod | null {
  if (source.startsWith('trimStart', startIndex) && !identifierChar(source[startIndex + 9])) {
    return 'trimStart';
  }
  if (source.startsWith('trimEnd', startIndex) && !identifierChar(source[startIndex + 7])) {
    return 'trimEnd';
  }
  if (source.startsWith('trim', startIndex) && !identifierChar(source[startIndex + 4])) {
    return 'trim';
  }
  return null;
}

function readStaticTrimMethodName(value: string): StaticTrimMethod | null {
  return value === 'trim' || value === 'trimStart' || value === 'trimEnd' ? value : null;
}

function readTrimValue(value: string, method: StaticTrimMethod): string {
  if (method === 'trimStart') return value.trimStart();
  if (method === 'trimEnd') return value.trimEnd();
  return value.trim();
}
