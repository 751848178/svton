import { readQuotedLiteral } from './interpreter-script-token.utils';
import type { InterpreterStringLiteral } from './interpreter-quote-like-string.utils';

export type InterpreterStringConcatOperator = '+' | '.' | '<<';
export type InterpreterStringLiteralReader = (
  source: string,
  startIndex: number,
) => InterpreterStringLiteral | null;

type InterpreterStaticStringOptions = {
  literalReaders?: InterpreterStringLiteralReader[];
  methodNames?: string[];
  prependMethodNames?: string[];
  methodArgumentReaders?: InterpreterStringLiteralReader[];
};

export function readStaticInterpreterString(
  source: string,
  startIndex: number,
  operators: InterpreterStringConcatOperator[] = [],
  options: InterpreterStaticStringOptions = {},
): { value: string; endIndex: number } | null {
  const literalReaders = options.literalReaders ?? [];
  const methodNames = options.methodNames ?? [];
  const prependMethodNames = options.prependMethodNames ?? [];
  const methodArgumentReaders = options.methodArgumentReaders ?? literalReaders;
  const first = readInterpreterStringValue(source, startIndex, operators, literalReaders, methodNames, prependMethodNames);
  if (!first) return null;

  let value = first.value;
  let endIndex = first.endIndex;

  while (operators.length > 0 || methodNames.length > 0 || prependMethodNames.length > 0) {
    const method = readInterpreterStringMethodCall(
      source,
      endIndex + 1,
      operators,
      literalReaders,
      methodNames,
      prependMethodNames,
      methodArgumentReaders,
    );
    if (method) {
      value = nextMethodValue(value, method);
      endIndex = method.endIndex;
      continue;
    }

    const concatOperator = readConcatOperator(source, endIndex + 1, operators);
    if (!concatOperator) break;

    const next = readInterpreterStringValue(
      source, concatOperator.endIndex, operators, literalReaders, methodNames, prependMethodNames,
    );
    if (!next) return null;

    value += next.value;
    endIndex = next.endIndex;
  }

  return { value, endIndex };
}

function readInterpreterStringMethodCall(
  source: string,
  startIndex: number,
  operators: InterpreterStringConcatOperator[],
  literalReaders: InterpreterStringLiteralReader[],
  methodNames: string[],
  prependMethodNames: string[],
  methodArgumentReaders: InterpreterStringLiteralReader[],
): (InterpreterStringLiteral & { methodName: string; prepend: boolean }) | null {
  const cursor = skipWhitespace(source, startIndex);
  if (source[cursor] !== '.') return null;

  const methodName = [...methodNames, ...prependMethodNames]
    .find((name) => source.startsWith(name, cursor + 1));
  if (!methodName) return null;
  const prepend = prependMethodNames.includes(methodName);

  let argumentStart = skipWhitespace(source, cursor + methodName.length + 1);
  if (source[argumentStart] !== '(') return null;

  let value = '';
  while (argumentStart < source.length) {
    argumentStart = skipWhitespace(source, argumentStart + 1);
    const argument = readStaticInterpreterString(source, argumentStart, operators, {
      literalReaders: methodArgumentReaders,
      methodNames,
      prependMethodNames,
      methodArgumentReaders,
    });
    if (!argument) return null;
    value += argument.value;

    const nextIndex = skipWhitespace(source, argument.endIndex + 1);
    if (source[nextIndex] === ',') {
      argumentStart = nextIndex;
      continue;
    }
    return source[nextIndex] === ')' ? { value, endIndex: nextIndex, methodName, prepend } : null;
  }

  return null;
}

function nextMethodValue(
  currentValue: string,
  method: InterpreterStringLiteral & { methodName: string; prepend: boolean },
): string {
  if (method.methodName === 'replace') return method.value;
  return method.prepend ? method.value + currentValue : currentValue + method.value;
}

function readInterpreterStringValue(
  source: string,
  startIndex: number,
  operators: InterpreterStringConcatOperator[],
  literalReaders: InterpreterStringLiteralReader[],
  methodNames: string[],
  prependMethodNames: string[],
): InterpreterStringLiteral | null {
  const cursor = skipWhitespace(source, startIndex);
  if (source[cursor] === '(') {
    return readParenthesizedInterpreterString(
      source, cursor, operators, literalReaders, methodNames, prependMethodNames,
    );
  }
  return readInterpreterStringLiteral(source, cursor, literalReaders);
}

function readInterpreterStringLiteral(
  source: string,
  startIndex: number,
  literalReaders: InterpreterStringLiteralReader[],
): InterpreterStringLiteral | null {
  return readQuotedLiteral(source, startIndex) ??
    literalReaders.map((reader) => reader(source, startIndex)).find((literal) => literal !== null) ??
    null;
}

function readParenthesizedInterpreterString(
  source: string,
  startIndex: number,
  operators: InterpreterStringConcatOperator[],
  literalReaders: InterpreterStringLiteralReader[],
  methodNames: string[],
  prependMethodNames: string[],
): InterpreterStringLiteral | null {
  const inner = readStaticInterpreterString(source, startIndex + 1, operators, {
    literalReaders,
    methodNames,
    prependMethodNames,
    methodArgumentReaders: [],
  });
  if (!inner) return null;

  const closeIndex = skipWhitespace(source, inner.endIndex + 1);
  if (
    source[closeIndex] !== ')' ||
    (!interpreterArgumentBoundary(source, closeIndex + 1) &&
      !interpreterConcatBoundary(source, closeIndex + 1, operators))
  ) return null;
  return { value: inner.value, endIndex: closeIndex };
}

function interpreterArgumentBoundary(source: string, index: number): boolean {
  const cursor = skipWhitespace(source, index);
  return cursor >= source.length ||
    source[cursor] === ')' ||
    source[cursor] === ']' ||
    source[cursor] === ',' ||
    source[cursor] === ';' ||
    source[cursor] === '\n';
}

function interpreterConcatBoundary(
  source: string,
  index: number,
  operators: InterpreterStringConcatOperator[],
): boolean {
  return readConcatOperator(source, index, operators) !== null;
}

function readConcatOperator(
  source: string,
  index: number,
  operators: InterpreterStringConcatOperator[],
): { endIndex: number } | null {
  const cursor = skipWhitespace(source, index);
  const operator = operators.find((candidate) => source.startsWith(candidate, cursor));
  return operator ? { endIndex: cursor + operator.length } : null;
}

function skipWhitespace(source: string, startIndex: number): number {
  let cursor = startIndex;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  return cursor;
}
