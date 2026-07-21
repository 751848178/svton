import { readPythonStringLiteral } from './python-string-literal.utils';

const PYTHON_NAME_PATTERN = '[A-Za-z_][A-Za-z0-9_]*';

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
  const pattern = new RegExp(`(?:^|[;\\n])\\s*(${PYTHON_NAME_PATTERN})\\s*=\\s*`, 'g');

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

function pythonSimpleArgumentBoundary(source: string, index: number): boolean {
  let cursor = index;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  return source[cursor] === ')' || source[cursor] === ']' || source[cursor] === ',';
}

function pythonAssignmentBoundary(source: string, index: number): boolean {
  let cursor = index;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  return !source[cursor] || source[cursor] === ';' || source[cursor] === '\n';
}
