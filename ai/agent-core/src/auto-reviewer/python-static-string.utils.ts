import { PYTHON_NAME_PATTERN, pythonSimpleAssignmentPattern } from './python-assignment-pattern.utils';
import { readPythonStringLiteral } from './python-string-literal.utils';

export type PythonStaticStringAssignment = {
  name: string;
  value: string | null;
  endIndex: number;
};

export type PythonStaticStringReference = {
  value: string;
  endIndex: number;
};

export function pythonStaticStringAssignments(code: string): PythonStaticStringAssignment[] {
  const assignments: PythonStaticStringAssignment[] = [];
  const pattern = pythonSimpleAssignmentPattern();

  for (const match of code.matchAll(pattern)) {
    const valueStart = Number(match.index) + match[0].length;
    const literal = readPythonStringLiteral(code, valueStart);
    const literalEnd = literal ? literal.endIndex + 1 : valueStart;
    const value = literal && pythonAssignmentBoundary(code, literalEnd) ? literal.value : null;
    assignments.push({
      name: match[1],
      value,
      endIndex: literalEnd,
    });
  }

  return assignments;
}

export function readPythonStaticStringReference(
  source: string,
  startIndex: number,
  assignments: PythonStaticStringAssignment[],
): PythonStaticStringReference | null {
  let cursor = startIndex;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;

  const match = source.slice(cursor).match(new RegExp(`^(${PYTHON_NAME_PATTERN})`));
  if (!match) return null;

  const nameEnd = cursor + match[1].length;
  if (!pythonSimpleArgumentBoundary(source, nameEnd)) return null;

  const assignment = [...assignments]
    .reverse()
    .find((candidate) => candidate.name === match[1] && candidate.endIndex <= cursor);
  return assignment?.value ? { value: assignment.value, endIndex: nameEnd - 1 } : null;
}

export function readPythonStaticStringArgument(
  source: string,
  startIndex: number,
  assignments: PythonStaticStringAssignment[],
): PythonStaticStringReference | null {
  let cursor = startIndex;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  if (source[cursor] === '(') return readParenthesizedPythonStaticStringArgument(source, cursor, assignments);

  const literal = readPythonStringLiteral(source, cursor);
  if (literal) {
    return pythonSimpleArgumentBoundary(source, literal.endIndex + 1) ? literal : null;
  }

  return readPythonStaticStringReference(source, cursor, assignments);
}

function readParenthesizedPythonStaticStringArgument(
  source: string,
  startIndex: number,
  assignments: PythonStaticStringAssignment[],
): PythonStaticStringReference | null {
  const inner = readPythonStaticStringArgument(source, startIndex + 1, assignments);
  if (!inner) return null;

  let cursor = inner.endIndex + 1;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  if (source[cursor] !== ')' || !pythonSimpleArgumentBoundary(source, cursor + 1)) return null;

  return { value: inner.value, endIndex: cursor };
}

export function pythonSimpleArgumentBoundary(source: string, index: number): boolean {
  let cursor = index;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  return source[cursor] === ')' || source[cursor] === ']' || source[cursor] === ',';
}

function pythonAssignmentBoundary(source: string, index: number): boolean {
  let cursor = index;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  return !source[cursor] || source[cursor] === ';' || source[cursor] === '\n';
}
