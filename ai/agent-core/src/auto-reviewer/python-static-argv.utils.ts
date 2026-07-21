import { readPythonStringLiteral } from './python-string-literal.utils';
import {
  pythonStaticStringAssignments,
  readPythonStaticStringReference,
  type PythonStaticStringAssignment,
} from './python-static-string.utils';

const PYTHON_NAME_PATTERN = '[A-Za-z_][A-Za-z0-9_]*';

export type PythonStaticArgvAssignment = {
  name: string;
  tokens: string[] | null;
  endIndex: number;
};

export type PythonArgvLiteral = {
  tokens: string[];
  endIndex: number;
};

export function pythonStaticArgvAssignments(
  code: string,
  staticStringAssignments = pythonStaticStringAssignments(code),
): PythonStaticArgvAssignment[] {
  const assignments: PythonStaticArgvAssignment[] = [];
  const pattern = new RegExp(`(?:^|[;\\n])\\s*(${PYTHON_NAME_PATTERN})\\s*=\\s*`, 'g');

  for (const match of code.matchAll(pattern)) {
    const valueStart = Number(match.index) + match[0].length;
    const literal = readPythonArgvListLiteral(code, valueStart, staticStringAssignments);
    assignments.push({
      name: match[1],
      tokens: literal?.tokens ?? null,
      endIndex: literal?.endIndex ?? valueStart,
    });
  }

  return assignments;
}

export function readPythonStaticArgvReference(
  source: string,
  startIndex: number,
  assignments: PythonStaticArgvAssignment[],
): string[] | null {
  let cursor = startIndex;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;

  const match = source.slice(cursor).match(new RegExp(`^(${PYTHON_NAME_PATTERN})`));
  if (!match) return null;

  const nameEnd = cursor + match[1].length;
  if (!pythonSimpleArgumentBoundary(source, nameEnd)) return null;

  const assignment = [...assignments]
    .reverse()
    .find((candidate) => candidate.name === match[1] && candidate.endIndex <= cursor);
  return assignment?.tokens ? [...assignment.tokens] : null;
}

export function readPythonArgvListLiteral(
  source: string,
  startIndex: number,
  staticStringAssignments: PythonStaticStringAssignment[],
): PythonArgvLiteral | null {
  let cursor = startIndex;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;

  const closer = source[cursor] === '[' ? ']' : source[cursor] === '(' ? ')' : null;
  if (!closer) return null;
  cursor += 1;

  const tokens: string[] = [];
  while (cursor < source.length) {
    while (/\s/.test(source[cursor] ?? '')) cursor += 1;
    if (source[cursor] === closer) break;

    const value = readPythonArgvElement(source, cursor, staticStringAssignments);
    if (!value) return null;
    tokens.push(value.value);
    cursor = value.endIndex + 1;

    while (/\s/.test(source[cursor] ?? '')) cursor += 1;
    if (source[cursor] === ',') {
      cursor += 1;
      continue;
    }
    if (source[cursor] === closer) break;
    return null;
  }

  if (source[cursor] !== closer || tokens.length === 0) return null;
  return { tokens, endIndex: cursor + 1 };
}

function readPythonArgvElement(
  source: string,
  startIndex: number,
  staticStringAssignments: PythonStaticStringAssignment[],
): { value: string; endIndex: number } | null {
  const literal = readPythonStringLiteral(source, startIndex);
  if (literal) return literal;
  return readPythonStaticStringReference(source, startIndex, staticStringAssignments);
}

function pythonSimpleArgumentBoundary(source: string, index: number): boolean {
  let cursor = index;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  return source[cursor] === ')' || source[cursor] === ',';
}
