type StaticStringValue = {
  value: string;
  endIndex: number;
};

type StaticStringReader = (
  source: string,
  startIndex: number,
  valueForName: (name: string) => string | undefined,
  boundary: (source: string, index: number) => boolean,
) => StaticStringValue | null;

export function readJsStaticConditionalExpression(
  source: string,
  startIndex: number,
  valueForName: (name: string) => string | undefined,
  readStaticString: StaticStringReader,
  boundary: (source: string, index: number) => boolean,
): StaticStringValue | null {
  const condition = readBooleanLiteralCondition(source, startIndex);
  if (!condition) return null;

  let cursor = skipWhitespace(source, condition.endIndex + 1);
  if (source[cursor] !== '?') return null;
  cursor += 1;

  const whenTrue = readStaticString(source, cursor, valueForName, trueBranchBoundary);
  if (!whenTrue) return null;

  cursor = skipWhitespace(source, whenTrue.endIndex + 1);
  if (source[cursor] !== ':') return null;
  cursor += 1;

  const whenFalse = readStaticString(source, cursor, valueForName, boundary);
  if (!whenFalse) return null;

  return {
    value: condition.value ? whenTrue.value : whenFalse.value,
    endIndex: whenFalse.endIndex,
  };
}

function readBooleanLiteralCondition(source: string, startIndex: number): { value: boolean; endIndex: number } | null {
  const cursor = skipWhitespace(source, startIndex);
  if (source.startsWith('true', cursor) && booleanLiteralBoundary(source, cursor + 4)) {
    return { value: true, endIndex: cursor + 3 };
  }
  if (source.startsWith('false', cursor) && booleanLiteralBoundary(source, cursor + 5)) {
    return { value: false, endIndex: cursor + 4 };
  }
  return null;
}

function trueBranchBoundary(source: string, index: number): boolean {
  return source[skipWhitespace(source, index)] === ':';
}

function booleanLiteralBoundary(source: string, index: number): boolean {
  return !/[A-Za-z0-9_$]/.test(source[index] ?? '');
}

function skipWhitespace(source: string, index: number): number {
  let cursor = index;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  return cursor;
}
