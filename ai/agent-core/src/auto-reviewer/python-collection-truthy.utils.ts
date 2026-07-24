import { readPythonStringLiteral } from './python-string-literal.utils';

type PythonCollectionTruthyValue = {
  value: boolean;
  endIndex: number;
};

const PYTHON_COLLECTION_CLOSERS: Record<string, string> = {
  '(': ')',
  '[': ']',
  '{': '}',
};

export function readPythonCollectionTruthyValue(
  source: string,
  startIndex: number,
): PythonCollectionTruthyValue | null {
  const cursor = skipPythonWhitespace(source, startIndex);
  const opener = source[cursor] ?? '';
  if (!PYTHON_COLLECTION_CLOSERS[opener]) return null;

  const closeIndex = pythonCollectionLiteralEndIndex(source, cursor);
  if (closeIndex < 0) return null;

  const valueStart = skipPythonWhitespace(source, cursor + 1);
  if (opener === '(') {
    if (valueStart === closeIndex) return { value: false, endIndex: closeIndex + 1 };
    return pythonTupleHasTopLevelComma(source, cursor + 1, closeIndex)
      ? { value: true, endIndex: closeIndex + 1 }
      : null;
  }

  return { value: valueStart !== closeIndex, endIndex: closeIndex + 1 };
}

function pythonCollectionLiteralEndIndex(source: string, startIndex: number): number {
  const firstCloser = PYTHON_COLLECTION_CLOSERS[source[startIndex] ?? ''];
  if (!firstCloser) return -1;

  const stack = [firstCloser];
  let cursor = startIndex + 1;
  while (cursor < source.length) {
    const literal = readPythonStringLiteral(source, cursor);
    if (literal) {
      cursor = literal.endIndex + 1;
      continue;
    }

    const char = source[cursor] ?? '';
    const nestedCloser = PYTHON_COLLECTION_CLOSERS[char];
    if (nestedCloser) {
      stack.push(nestedCloser);
    } else if (char === stack[stack.length - 1]) {
      stack.pop();
      if (stack.length === 0) return cursor;
    } else if (char === ')' || char === ']' || char === '}') {
      return -1;
    }
    cursor += 1;
  }

  return -1;
}

function pythonTupleHasTopLevelComma(source: string, startIndex: number, endIndex: number): boolean {
  const stack: string[] = [];
  let cursor = startIndex;
  while (cursor < endIndex) {
    const literal = readPythonStringLiteral(source, cursor);
    if (literal) {
      cursor = literal.endIndex + 1;
      continue;
    }

    const char = source[cursor] ?? '';
    const nestedCloser = PYTHON_COLLECTION_CLOSERS[char];
    if (nestedCloser) {
      stack.push(nestedCloser);
    } else if (stack.length > 0 && char === stack[stack.length - 1]) {
      stack.pop();
    } else if (stack.length === 0 && char === ',') {
      return source.slice(startIndex, cursor).trim().length > 0;
    }
    cursor += 1;
  }

  return false;
}

function skipPythonWhitespace(source: string, startIndex: number): number {
  let cursor = startIndex;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  return cursor;
}
