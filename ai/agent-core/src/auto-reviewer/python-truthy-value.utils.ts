import { PYTHON_NAME_PATTERN, pythonSimpleAssignmentPattern } from './python-assignment-pattern.utils';
import { readPythonCollectionTruthyValue } from './python-collection-truthy.utils';
import {
  readPythonStaticStringReference,
  type PythonStaticStringAssignment,
} from './python-static-string.utils';
import { readPythonStringLiteral } from './python-string-literal.utils';

export type PythonStaticTruthyAssignment = {
  name: string;
  value: boolean | null;
  endIndex: number;
};

type PythonStaticTruthyReference = {
  value: boolean;
  endIndex: number;
};

type PythonTruthyValueRead = {
  value: boolean;
  endIndex: number;
};

export function pythonStaticTruthyAssignments(code: string): PythonStaticTruthyAssignment[] {
  const assignments: PythonStaticTruthyAssignment[] = [];
  const pattern = pythonSimpleAssignmentPattern();

  for (const match of code.matchAll(pattern)) {
    const valueStart = Number(match.index) + match[0].length;
    const staticValue = readPythonStaticTruthyAssignmentValue(code, valueStart);
    const value = staticValue && pythonAssignmentBoundary(code, staticValue.endIndex)
      ? staticValue.value
      : null;
    assignments.push({
      name: match[1],
      value,
      endIndex: staticValue?.endIndex ?? valueStart,
    });
  }

  return assignments;
}

export function readTruthyPythonValue(
  source: string,
  startIndex: number,
  staticStringAssignments: PythonStaticStringAssignment[],
  staticTruthyAssignments: PythonStaticTruthyAssignment[] = [],
): boolean {
  const value = readPythonTruthyValue(source, startIndex, staticStringAssignments, staticTruthyAssignments);
  return value !== null && pythonSimpleValueBoundary(source, value.endIndex) ? value.value : false;
}

function readPythonTruthyValue(
  source: string,
  startIndex: number,
  staticStringAssignments: PythonStaticStringAssignment[],
  staticTruthyAssignments: PythonStaticTruthyAssignment[],
): PythonTruthyValueRead | null {
  const cursor = skipPythonWhitespace(source, startIndex);

  if (source[cursor] === '(') {
    const collection = readPythonCollectionTruthyValue(source, cursor);
    if (collection) return collection;

    const inner = readPythonTruthyValue(source, cursor + 1, staticStringAssignments, staticTruthyAssignments);
    if (!inner) return null;
    const closeIndex = skipPythonWhitespace(source, inner.endIndex);
    return source[closeIndex] === ')' ? { value: inner.value, endIndex: closeIndex + 1 } : null;
  }

  const notValue = readPythonNotValue(source, cursor, staticStringAssignments, staticTruthyAssignments);
  if (notValue) return notValue;

  const boolCall = readPythonBoolCallValue(source, cursor, staticStringAssignments, staticTruthyAssignments);
  if (boolCall) return boolCall;

  const collection = readPythonCollectionTruthyValue(source, cursor);
  if (collection) return collection;

  const stringLiteral = readPythonStringLiteral(source, cursor);
  if (stringLiteral) return { value: stringLiteral.value.length > 0, endIndex: stringLiteral.endIndex + 1 };

  const stringReference = readPythonStaticStringReference(source, cursor, staticStringAssignments);
  if (stringReference) return { value: stringReference.value.length > 0, endIndex: stringReference.endIndex + 1 };

  const truthyReference = readPythonStaticTruthyReference(source, cursor, staticTruthyAssignments);
  if (truthyReference) return truthyReference;

  if (source.startsWith('True', cursor)) return { value: true, endIndex: cursor + 4 };
  if (source.startsWith('False', cursor)) return { value: false, endIndex: cursor + 5 };
  if (source.startsWith('None', cursor)) return { value: false, endIndex: cursor + 4 };

  const integer = source.slice(cursor).match(/^[+-]?\d+/);
  if (!integer) return null;
  return {
    value: Number.parseInt(integer[0], 10) !== 0,
    endIndex: cursor + integer[0].length,
  };
}

function readPythonNotValue(
  source: string,
  startIndex: number,
  staticStringAssignments: PythonStaticStringAssignment[],
  staticTruthyAssignments: PythonStaticTruthyAssignment[],
): PythonTruthyValueRead | null {
  if (!source.startsWith('not', startIndex)) return null;
  const operandStart = startIndex + 3;
  if (/[A-Za-z0-9_]/.test(source[operandStart] ?? '')) return null;

  const operand = readPythonTruthyValue(source, operandStart, staticStringAssignments, staticTruthyAssignments);
  return operand ? { value: !operand.value, endIndex: operand.endIndex } : null;
}

function readPythonBoolCallValue(
  source: string,
  startIndex: number,
  staticStringAssignments: PythonStaticStringAssignment[],
  staticTruthyAssignments: PythonStaticTruthyAssignment[],
): PythonTruthyValueRead | null {
  if (!source.startsWith('bool', startIndex)) return null;
  const nameEnd = startIndex + 4;
  if (/[A-Za-z0-9_]/.test(source[nameEnd] ?? '')) return null;
  if (isPythonNameShadowedBefore(source, 'bool', startIndex, staticStringAssignments, staticTruthyAssignments)) {
    return null;
  }

  const openIndex = skipPythonWhitespace(source, nameEnd);
  if (source[openIndex] !== '(') return null;

  const inner = readPythonTruthyValue(source, openIndex + 1, staticStringAssignments, staticTruthyAssignments);
  if (!inner) return null;
  const closeIndex = skipPythonWhitespace(source, inner.endIndex);
  return source[closeIndex] === ')' ? { value: inner.value, endIndex: closeIndex + 1 } : null;
}

function isPythonNameShadowedBefore(
  source: string,
  name: string,
  startIndex: number,
  staticStringAssignments: PythonStaticStringAssignment[],
  staticTruthyAssignments: PythonStaticTruthyAssignment[],
): boolean {
  const declaration = new RegExp(`(?:^|[;\\n])\\s*(?:def|class)\\s+${name}\\b`, 'g');
  for (const match of source.slice(0, startIndex).matchAll(declaration)) {
    if (match) return true;
  }

  return staticStringAssignments.some((assignment) => assignment.name === name && assignment.endIndex <= startIndex) ||
    staticTruthyAssignments.some((assignment) => assignment.name === name && assignment.endIndex <= startIndex);
}

function readPythonStaticTruthyReference(
  source: string,
  startIndex: number,
  assignments: PythonStaticTruthyAssignment[],
): PythonStaticTruthyReference | null {
  let cursor = startIndex;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;

  const match = source.slice(cursor).match(new RegExp(`^(${PYTHON_NAME_PATTERN})`));
  if (!match) return null;

  const nameEnd = cursor + match[1].length;
  if (!pythonSimpleValueBoundary(source, nameEnd)) return null;

  const assignment = [...assignments]
    .reverse()
    .find((candidate) => candidate.name === match[1] && candidate.endIndex <= cursor);
  return assignment?.value === null || assignment?.value === undefined
    ? null
    : { value: assignment.value, endIndex: nameEnd };
}

function readPythonStaticTruthyAssignmentValue(
  source: string,
  startIndex: number,
): { value: boolean; endIndex: number } | null {
  return readPythonTruthyValue(source, startIndex, [], []);
}

function skipPythonWhitespace(source: string, startIndex: number): number {
  let cursor = startIndex;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  return cursor;
}

function pythonSimpleValueBoundary(source: string, index: number): boolean {
  let cursor = index;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  return source[cursor] === ')' || source[cursor] === ',';
}

function pythonAssignmentBoundary(source: string, index: number): boolean {
  let cursor = index;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  return !source[cursor] || source[cursor] === ';' || source[cursor] === '\n';
}
