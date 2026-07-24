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

export function readJsStaticNullishExpression(
  source: string,
  startIndex: number,
  valueForName: (name: string) => string | undefined,
  readStaticString: StaticStringReader,
  boundary: (source: string, index: number) => boolean,
): StaticStringValue | null {
  const nullEnd = readNullLiteralEndIndex(source, startIndex);
  if (nullEnd === null) return null;

  const operatorEnd = readNullishOperatorEndIndex(source, nullEnd + 1);
  if (operatorEnd === null) return null;

  return readStaticString(source, operatorEnd + 1, valueForName, boundary);
}

function readNullLiteralEndIndex(source: string, startIndex: number): number | null {
  const cursor = skipWhitespace(source, startIndex);
  return source.startsWith('null', cursor) && literalBoundary(source, cursor + 4)
    ? cursor + 3
    : null;
}

function readNullishOperatorEndIndex(source: string, startIndex: number): number | null {
  const cursor = skipWhitespace(source, startIndex);
  return source.startsWith('??', cursor) ? cursor + 1 : null;
}

function literalBoundary(source: string, index: number): boolean {
  return !/[A-Za-z0-9_$]/.test(source[index] ?? '');
}

function skipWhitespace(source: string, index: number): number {
  let cursor = index;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  return cursor;
}
