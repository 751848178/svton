import { skipWhitespace } from './javascript-static-decimal-code.utils';
import {
  readJsCallArgumentStart,
  readJsStaticMemberNameEndIndex,
} from './javascript-static-member-access.utils';
import {
  commaOrListCloseBoundary,
  readJsStaticStringList,
} from './javascript-static-string-list.utils';
import type { JsStaticValue } from './javascript-static-string.utils';

type JsStaticStringReader = (
  source: string,
  startIndex: number,
  valueForName: (name: string) => string | undefined,
  boundary: (source: string, index: number) => boolean,
) => JsStaticValue | null;

type ConcatTargetEndReader = (source: string, startIndex: number) => number | null;

export function readJsStringPrototypeConcatBind(
  source: string,
  startIndex: number,
  valueForName: (name: string) => string | undefined,
  readExpression: JsStaticStringReader,
  readConcatTargetEndIndex: ConcatTargetEndReader,
): JsStaticValue | null {
  const bindEnd = readJsStaticMemberNameEndIndex(source, startIndex, 'bind');
  if (bindEnd === null) return null;

  return readDirectConcatBind(source, bindEnd, valueForName, readExpression)
    ?? readConcatBindCall(source, bindEnd, valueForName, readExpression, readConcatTargetEndIndex)
    ?? readConcatBindApply(source, bindEnd, valueForName, readExpression, readConcatTargetEndIndex);
}

function readDirectConcatBind(
  source: string,
  bindEnd: number,
  valueForName: (name: string) => string | undefined,
  readExpression: JsStaticStringReader,
): JsStaticValue | null {
  const receiverStart = readJsCallArgumentStart(source, bindEnd);
  if (receiverStart === null) return null;

  const receiver = readExpression(source, receiverStart, valueForName, commaOrClosingParenBoundary);
  if (!receiver) return null;

  const bound = readConcatArgumentsAfterFirst(source, receiver, valueForName, readExpression, ')');
  return bound ? readBoundInvocation(source, bound, valueForName, readExpression) : null;
}

function readConcatBindCall(
  source: string,
  bindEnd: number,
  valueForName: (name: string) => string | undefined,
  readExpression: JsStaticStringReader,
  readConcatTargetEndIndex: ConcatTargetEndReader,
): JsStaticValue | null {
  const callEnd = readJsStaticMemberNameEndIndex(source, bindEnd, 'call');
  if (callEnd === null) return null;

  const targetStart = readJsCallArgumentStart(source, callEnd);
  if (targetStart === null) return null;

  const receiverStart = readConcatTargetCommaEnd(source, targetStart, readConcatTargetEndIndex);
  if (receiverStart === null) return null;

  const receiver = readExpression(source, receiverStart, valueForName, commaOrClosingParenBoundary);
  if (!receiver) return null;

  const bound = readConcatArgumentsAfterFirst(source, receiver, valueForName, readExpression, ')');
  return bound ? readBoundInvocation(source, bound, valueForName, readExpression) : null;
}

function readConcatBindApply(
  source: string,
  bindEnd: number,
  valueForName: (name: string) => string | undefined,
  readExpression: JsStaticStringReader,
  readConcatTargetEndIndex: ConcatTargetEndReader,
): JsStaticValue | null {
  const applyEnd = readJsStaticMemberNameEndIndex(source, bindEnd, 'apply');
  if (applyEnd === null) return null;

  const targetStart = readJsCallArgumentStart(source, applyEnd);
  if (targetStart === null) return null;

  const arrayStart = readConcatTargetCommaEnd(source, targetStart, readConcatTargetEndIndex);
  if (arrayStart === null) return null;

  const bound = readConcatArgumentArray(source, arrayStart, valueForName, readExpression);
  if (!bound) return null;

  const close = skipWhitespace(source, bound.endIndex + 1);
  return source[close] === ')'
    ? readBoundInvocation(source, { value: bound.value, endIndex: close }, valueForName, readExpression)
    : null;
}

function readConcatTargetCommaEnd(
  source: string,
  startIndex: number,
  readConcatTargetEndIndex: ConcatTargetEndReader,
): number | null {
  const targetEnd = readConcatTargetEndIndex(source, startIndex);
  if (targetEnd === null) return null;

  const comma = skipWhitespace(source, targetEnd);
  return source[comma] === ',' ? comma + 1 : null;
}

function readConcatArgumentArray(
  source: string,
  startIndex: number,
  valueForName: (name: string) => string | undefined,
  readExpression: JsStaticStringReader,
): JsStaticValue | null {
  const cursor = skipWhitespace(source, startIndex);
  if (source[cursor] !== '[') return null;

  const receiver = readExpression(source, cursor + 1, valueForName, commaOrListCloseBoundary(']'));
  return receiver
    ? readConcatArgumentsAfterFirst(source, receiver, valueForName, readExpression, ']')
    : null;
}

function readConcatArgumentsAfterFirst(
  source: string,
  first: JsStaticValue,
  valueForName: (name: string) => string | undefined,
  readExpression: JsStaticStringReader,
  closeChar: ')' | ']',
): JsStaticValue | null {
  const cursor = skipWhitespace(source, first.endIndex + 1);
  if (source[cursor] === closeChar) return { value: first.value, endIndex: cursor };
  if (source[cursor] !== ',') return null;

  const args = readJsStaticStringList(source, cursor + 1, valueForName, readExpression, closeChar);
  return args ? { value: first.value + args.value, endIndex: args.endIndex } : null;
}

function readBoundInvocation(
  source: string,
  bound: JsStaticValue,
  valueForName: (name: string) => string | undefined,
  readExpression: JsStaticStringReader,
): JsStaticValue | null {
  const invocationStart = readJsCallArgumentStart(source, bound.endIndex + 1);
  if (invocationStart === null) return null;

  const invocation = readJsStaticStringList(source, invocationStart, valueForName, readExpression, ')');
  return invocation ? { value: bound.value + invocation.value, endIndex: invocation.endIndex } : null;
}

function commaOrClosingParenBoundary(source: string, index: number): boolean {
  const cursor = skipWhitespace(source, index);
  return source[cursor] === ',' || source[cursor] === ')';
}
