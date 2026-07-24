import { readQuotedLiteral } from './interpreter-script-token.utils';
import {
  identifierChar,
  readDecimalInteger,
  readDecimalIntegerArray,
  skipWhitespace,
} from './javascript-static-decimal-code.utils';

export type StaticCodeArguments = {
  codes: number[];
  endIndex: number;
};

export function readStaticCodeBindArguments(
  source: string,
  startIndex: number,
): StaticCodeArguments | null {
  const bindEnd = readWrapperMemberEndIndex(source, startIndex, 'bind');
  if (bindEnd === null) return null;

  let cursor = readCallArgumentStartIndex(source, bindEnd);
  if (cursor === null) return null;

  const receiverEnd = readNullReceiverEndIndex(source, cursor);
  if (receiverEnd === null) return null;

  cursor = skipWhitespace(source, receiverEnd + 1);
  if (source[cursor] === ')') return readImmediateInvocationCodeArguments(source, cursor);
  if (source[cursor] !== ',') return null;

  const codes = readDecimalIntegerListUntilParen(source, cursor + 1);
  if (!codes) return null;

  const callStart = skipWhitespace(source, codes.endIndex + 1);
  if (source[callStart] !== '(') return null;

  const callEnd = skipWhitespace(source, callStart + 1);
  if (source[callEnd] === ')') return { codes: codes.values, endIndex: callEnd };

  const invocationCodes = readDecimalIntegerListUntilParen(source, callEnd);
  return invocationCodes
    ? { codes: [...codes.values, ...invocationCodes.values], endIndex: invocationCodes.endIndex }
    : null;
}

function readImmediateInvocationCodeArguments(source: string, bindCloseIndex: number): StaticCodeArguments | null {
  const callStart = skipWhitespace(source, bindCloseIndex + 1);
  if (source[callStart] !== '(') return null;

  const callEnd = skipWhitespace(source, callStart + 1);
  if (source[callEnd] === ')') return null;

  const invocationCodes = readDecimalIntegerListUntilParen(source, callEnd);
  return invocationCodes ? { codes: invocationCodes.values, endIndex: invocationCodes.endIndex } : null;
}

export function readStaticCodeApplyArguments(
  source: string,
  startIndex: number,
): StaticCodeArguments | null {
  const applyEnd = readWrapperMemberEndIndex(source, startIndex, 'apply');
  if (applyEnd === null) return null;

  const receiverStart = readCallArgumentStartIndex(source, applyEnd);
  if (receiverStart === null) return null;

  const receiverEnd = readNullReceiverEndIndex(source, receiverStart);
  if (receiverEnd === null) return null;

  const comma = skipWhitespace(source, receiverEnd + 1);
  if (source[comma] !== ',') return null;

  const array = readDecimalIntegerArray(source, comma + 1);
  if (!array) return null;

  const close = skipWhitespace(source, array.endIndex + 1);
  return source[close] === ')' ? { codes: array.values, endIndex: close } : null;
}

export function readStaticCodeCallArgumentStartIndex(source: string, startIndex: number): number | null {
  const cursor = skipWhitespace(source, startIndex);
  if (source[cursor] === '(') return cursor + 1;
  if (source.startsWith('?.(', cursor)) return cursor + 3;

  const callEnd = readWrapperMemberEndIndex(source, cursor, 'call');
  if (callEnd === null) return null;
  const receiverStart = readCallArgumentStartIndex(source, callEnd);
  if (receiverStart === null) return null;

  const receiverEnd = readNullReceiverEndIndex(source, receiverStart);
  if (receiverEnd === null) return null;

  const comma = skipWhitespace(source, receiverEnd + 1);
  return source[comma] === ',' ? comma + 1 : null;
}

function readWrapperMemberEndIndex(
  source: string,
  startIndex: number,
  memberName: 'call' | 'apply' | 'bind',
): number | null {
  const cursor = skipWhitespace(source, startIndex);
  if (source[cursor] === '.') {
    return readDotWrapperMemberEndIndex(source, cursor + 1, memberName);
  }
  if (source.startsWith('?.[', cursor)) {
    return readBracketWrapperMemberEndIndex(source, cursor + 2, memberName);
  }
  if (source.startsWith('?.', cursor)) {
    return readDotWrapperMemberEndIndex(source, cursor + 2, memberName);
  }

  return readBracketWrapperMemberEndIndex(source, cursor, memberName);
}

function readDotWrapperMemberEndIndex(
  source: string,
  startIndex: number,
  memberName: 'call' | 'apply' | 'bind',
): number | null {
  const memberStart = skipWhitespace(source, startIndex);
  return source.startsWith(memberName, memberStart) && !identifierChar(source[memberStart + memberName.length])
    ? skipWhitespace(source, memberStart + memberName.length)
    : null;
}

function readBracketWrapperMemberEndIndex(
  source: string,
  startIndex: number,
  memberName: 'call' | 'apply' | 'bind',
): number | null {
  if (source[startIndex] !== '[') return null;

  const key = readBracketStaticWrapperKey(source, startIndex + 1);
  if (!key || key.value !== memberName) return null;
  return skipWhitespace(source, key.endIndex + 1);
}

function readBracketStaticWrapperKey(source: string, startIndex: number): { value: string; endIndex: number } | null {
  let cursor = startIndex;
  let value = '';
  while (cursor < source.length) {
    const literal = readQuotedLiteral(source, cursor);
    if (!literal) return null;
    value += literal.value;

    cursor = skipWhitespace(source, literal.endIndex + 1);
    if (source[cursor] === ']') return { value, endIndex: cursor };
    if (source[cursor] !== '+') return null;
    cursor = skipWhitespace(source, cursor + 1);
  }

  return null;
}

function readDecimalIntegerListUntilParen(
  source: string,
  startIndex: number,
): { values: number[]; endIndex: number } | null {
  let cursor = startIndex;
  const values: number[] = [];
  while (cursor < source.length) {
    cursor = skipWhitespace(source, cursor);

    const code = readDecimalInteger(source, cursor);
    if (!code) return null;
    values.push(code.value);
    cursor = skipWhitespace(source, code.endIndex + 1);

    if (source[cursor] === ',') {
      cursor += 1;
      continue;
    }
    if (source[cursor] === ')') return { values, endIndex: cursor };
    return null;
  }

  return null;
}

function readCallArgumentStartIndex(source: string, startIndex: number): number | null {
  if (source[startIndex] === '(') return startIndex + 1;
  return source.startsWith('?.(', startIndex) ? startIndex + 3 : null;
}

function readNullReceiverEndIndex(source: string, startIndex: number): number | null {
  const cursor = skipWhitespace(source, startIndex);
  return source.startsWith('null', cursor) && !identifierChar(source[cursor + 4])
    ? cursor + 3
    : null;
}
