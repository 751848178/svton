import {
  readPythonStaticStringReference,
  type PythonStaticStringAssignment,
} from './python-static-string.utils';
import { readPythonStringLiteral } from './python-string-literal.utils';

const PYTHON_NAME_PATTERN = '[A-Za-z_][A-Za-z0-9_]*';

export type PythonStaticTruthyAssignment = {
  name: string;
  value: boolean | null;
  endIndex: number;
};

type PythonStaticTruthyReference = {
  value: boolean;
  endIndex: number;
};

export function pythonStaticTruthyAssignments(code: string): PythonStaticTruthyAssignment[] {
  const assignments: PythonStaticTruthyAssignment[] = [];
  const pattern = new RegExp(`(?:^|[;\\n])\\s*(${PYTHON_NAME_PATTERN})\\s*=\\s*`, 'g');

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
  let cursor = startIndex;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;

  const stringLiteral = readPythonStringLiteral(source, cursor);
  if (stringLiteral) return stringLiteral.value.length > 0;

  const stringReference = readPythonStaticStringReference(source, cursor, staticStringAssignments);
  if (stringReference) return stringReference.value.length > 0;

  const truthyReference = readPythonStaticTruthyReference(source, cursor, staticTruthyAssignments);
  if (truthyReference) return truthyReference.value;

  if (source.startsWith('True', cursor) && pythonSimpleValueBoundary(source, cursor + 4)) return true;
  if (source.startsWith('False', cursor) && pythonSimpleValueBoundary(source, cursor + 5)) return false;
  if (source.startsWith('None', cursor) && pythonSimpleValueBoundary(source, cursor + 4)) return false;

  const integer = source.slice(cursor).match(/^[+-]?\d+/);
  if (!integer) return false;
  const endIndex = cursor + integer[0].length;
  return pythonSimpleValueBoundary(source, endIndex) && Number.parseInt(integer[0], 10) !== 0;
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
    : { value: assignment.value, endIndex: nameEnd - 1 };
}

function readPythonStaticTruthyAssignmentValue(
  source: string,
  startIndex: number,
): { value: boolean; endIndex: number } | null {
  let cursor = startIndex;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;

  const stringLiteral = readPythonStringLiteral(source, cursor);
  if (stringLiteral) return { value: stringLiteral.value.length > 0, endIndex: stringLiteral.endIndex + 1 };

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
