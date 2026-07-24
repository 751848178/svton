import { skipWhitespace } from './javascript-static-decimal-code.utils';
import {
  readJsCallArgumentStart,
  readJsIdentifierNameEndIndex,
  readJsStaticMemberNameEndIndex,
} from './javascript-static-member-access.utils';
import { readJsStaticStringList } from './javascript-static-string-list.utils';
import { readJsStringPrototypeConcatBind } from './javascript-string-prototype-concat-bind.utils';
import type { JsStaticValue } from './javascript-static-string.utils';

type JsStaticStringReader = (
  source: string,
  startIndex: number,
  valueForName: (name: string) => string | undefined,
  boundary: (source: string, index: number) => boolean,
) => JsStaticValue | null;

export function readJsStringPrototypeConcatCall(
  source: string,
  startIndex: number,
  valueForName: (name: string) => string | undefined,
  readExpression: JsStaticStringReader,
): JsStaticValue | null {
  const concatEnd = readStringPrototypeConcatEndIndex(source, startIndex);
  if (concatEnd === null) return null;

  return readConcatCall(source, concatEnd, valueForName, readExpression)
    ?? readConcatApply(source, concatEnd, valueForName, readExpression)
    ?? readJsStringPrototypeConcatBind(source, concatEnd, valueForName, readExpression, readStringPrototypeConcatEndIndex);
}

export function readStringPrototypeConcatEndIndex(source: string, startIndex: number): number | null {
  let cursor = readJsIdentifierNameEndIndex(source, startIndex, 'String');
  if (cursor === null) return null;
  cursor = readJsStaticMemberNameEndIndex(source, cursor, 'prototype');
  if (cursor === null) return null;
  return readJsStaticMemberNameEndIndex(source, cursor, 'concat');
}

function readConcatCall(
  source: string,
  startIndex: number,
  valueForName: (name: string) => string | undefined,
  readExpression: JsStaticStringReader,
): JsStaticValue | null {
  const callEnd = readJsStaticMemberNameEndIndex(source, startIndex, 'call');
  if (callEnd === null) return null;

  const receiverStart = readJsCallArgumentStart(source, callEnd);
  if (receiverStart === null) return null;

  const receiver = readExpression(source, receiverStart, valueForName, commaOrClosingParenBoundary);
  if (!receiver) return null;

  let cursor = skipWhitespace(source, receiver.endIndex + 1);
  if (source[cursor] === ')') return { value: receiver.value, endIndex: cursor };
  if (source[cursor] !== ',') return null;

  const args = readConcatArgumentsUntilParen(source, cursor + 1, valueForName, readExpression);
  return args ? { value: receiver.value + args.value, endIndex: args.endIndex } : null;
}

function readConcatApply(
  source: string,
  startIndex: number,
  valueForName: (name: string) => string | undefined,
  readExpression: JsStaticStringReader,
): JsStaticValue | null {
  const applyEnd = readJsStaticMemberNameEndIndex(source, startIndex, 'apply');
  if (applyEnd === null) return null;

  const receiverStart = readJsCallArgumentStart(source, applyEnd);
  if (receiverStart === null) return null;

  const receiver = readExpression(source, receiverStart, valueForName, commaBoundary);
  if (!receiver) return null;

  const comma = skipWhitespace(source, receiver.endIndex + 1);
  if (source[comma] !== ',') return null;

  const args = readConcatApplyArgumentArray(source, comma + 1, valueForName, readExpression);
  if (!args) return null;

  const close = skipWhitespace(source, args.endIndex + 1);
  return source[close] === ')' ? { value: receiver.value + args.value, endIndex: close } : null;
}

function readConcatArgumentsUntilParen(
  source: string,
  startIndex: number,
  valueForName: (name: string) => string | undefined,
  readExpression: JsStaticStringReader,
): JsStaticValue | null {
  return readJsStaticStringList(source, startIndex, valueForName, readExpression, ')');
}

function readConcatApplyArgumentArray(
  source: string,
  startIndex: number,
  valueForName: (name: string) => string | undefined,
  readExpression: JsStaticStringReader,
): JsStaticValue | null {
  let cursor = skipWhitespace(source, startIndex);
  if (source[cursor] !== '[') return null;
  cursor += 1;

  const args = readJsStaticStringList(source, cursor, valueForName, readExpression, ']');
  return args ? args : null;
}

function commaBoundary(source: string, index: number): boolean {
  return source[skipWhitespace(source, index)] === ',';
}

function commaOrClosingParenBoundary(source: string, index: number): boolean {
  const cursor = skipWhitespace(source, index);
  return source[cursor] === ',' || source[cursor] === ')';
}
