import { readQuotedLiteral } from './interpreter-script-token.utils';
import {
  identifierChar,
  readDecimalInteger,
  skipWhitespace,
} from './javascript-static-decimal-code.utils';
import {
  readStaticCodeApplyArguments,
  readStaticCodeBindArguments,
  readStaticCodeCallArgumentStartIndex,
} from './javascript-static-code-wrapper.utils';

type StaticStringValue = {
  value: string;
  endIndex: number;
};

export function readJsStringFromCharCodeCall(source: string, startIndex: number): StaticStringValue | null {
  let cursor = skipWhitespace(source, startIndex);
  if (!source.startsWith('String', cursor) || identifierChar(source[cursor + 6])) return null;
  cursor = skipWhitespace(source, cursor + 6);

  const method = readStringCodeMember(source, cursor);
  if (!method) return null;
  cursor = skipWhitespace(source, method.endIndex + 1);

  const bindArguments = readStaticCodeBindArguments(source, cursor);
  if (bindArguments) return readCodeStringValue(method.value, bindArguments.codes, bindArguments.endIndex);

  const applyArguments = readStaticCodeApplyArguments(source, cursor);
  if (applyArguments) return readCodeStringValue(method.value, applyArguments.codes, applyArguments.endIndex);

  const argumentStart = readStaticCodeCallArgumentStartIndex(source, cursor);
  if (argumentStart === null) return null;
  cursor = argumentStart;

  const codes: number[] = [];
  while (cursor < source.length) {
    cursor = skipWhitespace(source, cursor);
    if (source[cursor] === ')') {
      return codes.length > 0
        ? readCodeStringValue(method.value, codes, cursor)
        : null;
    }

    const code = readDecimalInteger(source, cursor);
    if (!code) return null;
    codes.push(code.value);
    cursor = skipWhitespace(source, code.endIndex + 1);

    if (source[cursor] === ',') {
      cursor += 1;
      continue;
    }
    if (source[cursor] === ')') {
      return readCodeStringValue(method.value, codes, cursor);
    }
    return null;
  }

  return null;
}

function readStringCodeMember(
  source: string,
  startIndex: number,
): { value: 'fromCharCode' | 'fromCodePoint'; endIndex: number } | null {
  const cursor = skipWhitespace(source, startIndex);
  if (source[cursor] === '.') return readStringCodeMethod(source, skipWhitespace(source, cursor + 1));
  if (source.startsWith('?.[', cursor)) return readBracketStringCodeMethod(source, cursor + 2);
  if (source.startsWith('?.', cursor)) return readStringCodeMethod(source, skipWhitespace(source, cursor + 2));
  return readBracketStringCodeMethod(source, cursor);
}

function readBracketStringCodeMethod(
  source: string,
  startIndex: number,
): { value: 'fromCharCode' | 'fromCodePoint'; endIndex: number } | null {
  if (source[startIndex] !== '[') return null;

  const key = readBracketStaticStringKey(source, startIndex + 1);
  if (!key) return null;

  const method = stringCodeMethodForKey(key.value);
  return method ? { value: method, endIndex: key.endIndex } : null;
}

function readStringCodeMethod(
  source: string,
  startIndex: number,
): { value: 'fromCharCode' | 'fromCodePoint'; endIndex: number } | null {
  if (source.startsWith('fromCharCode', startIndex) && !identifierChar(source[startIndex + 12])) {
    return { value: 'fromCharCode', endIndex: startIndex + 11 };
  }
  if (source.startsWith('fromCodePoint', startIndex) && !identifierChar(source[startIndex + 13])) {
    return { value: 'fromCodePoint', endIndex: startIndex + 12 };
  }
  return null;
}

function stringCodeMethodForKey(value: string): 'fromCharCode' | 'fromCodePoint' | null {
  if (value === 'fromCharCode') return 'fromCharCode';
  return value === 'fromCodePoint' ? 'fromCodePoint' : null;
}

function readBracketStaticStringKey(source: string, startIndex: number): { value: string; endIndex: number } | null {
  let cursor = startIndex;
  let value = '';
  while (cursor < source.length) {
    const literal = readQuotedLiteral(source, cursor);
    if (!literal) return null;
    value += literal.value;

    cursor = skipWhitespace(source, literal.endIndex + 1);
    if (source[cursor] === ']') return { value, endIndex: cursor };
    if (source[cursor] !== '+') return null;
    cursor += 1;
  }

  return null;
}

function readCodeStringValue(
  method: 'fromCharCode' | 'fromCodePoint',
  codes: number[],
  endIndex: number,
): StaticStringValue | null {
  if (method === 'fromCodePoint' && codes.some((code) => code > 0x10ffff)) return null;
  const value = method === 'fromCharCode'
    ? String.fromCharCode(...codes)
    : String.fromCodePoint(...codes);
  return { value, endIndex };
}
