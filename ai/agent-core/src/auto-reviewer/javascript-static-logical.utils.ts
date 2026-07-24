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

export function readJsStaticLogicalExpression(
  source: string,
  startIndex: number,
  valueForName: (name: string) => string | undefined,
  readStaticString: StaticStringReader,
  boundary: (source: string, index: number) => boolean,
): StaticStringValue | null {
  const left = readBooleanLiteral(source, startIndex);
  if (!left) return null;

  const operator = readLogicalOperator(source, left.endIndex + 1);
  if (!operator) return null;

  if ((operator.value === '&&' && !left.value) || (operator.value === '||' && left.value)) {
    return null;
  }

  return readStaticString(source, operator.endIndex + 1, valueForName, boundary);
}

function readBooleanLiteral(source: string, startIndex: number): { value: boolean; endIndex: number } | null {
  const cursor = skipWhitespace(source, startIndex);
  if (source.startsWith('true', cursor) && booleanLiteralBoundary(source, cursor + 4)) {
    return { value: true, endIndex: cursor + 3 };
  }
  if (source.startsWith('false', cursor) && booleanLiteralBoundary(source, cursor + 5)) {
    return { value: false, endIndex: cursor + 4 };
  }
  return null;
}

function readLogicalOperator(source: string, startIndex: number): { value: '&&' | '||'; endIndex: number } | null {
  const cursor = skipWhitespace(source, startIndex);
  if (source.startsWith('&&', cursor)) return { value: '&&', endIndex: cursor + 1 };
  if (source.startsWith('||', cursor)) return { value: '||', endIndex: cursor + 1 };
  return null;
}

function booleanLiteralBoundary(source: string, index: number): boolean {
  return !/[A-Za-z0-9_$]/.test(source[index] ?? '');
}

function skipWhitespace(source: string, index: number): number {
  let cursor = index;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  return cursor;
}
