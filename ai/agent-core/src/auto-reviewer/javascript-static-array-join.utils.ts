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

export function readJsStaticArrayJoinExpression(
  source: string,
  startIndex: number,
  valueForName: (name: string) => string | undefined,
  readStaticString: StaticStringReader,
  boundary: (source: string, index: number) => boolean,
): StaticStringValue | null {
  const array = readStaticStringArray(source, startIndex, valueForName, readStaticString);
  if (!array) return null;

  const joinStart = readJoinCallStartIndex(source, array.endIndex + 1);
  if (joinStart === null) return null;

  const separator = readStaticString(source, joinStart, valueForName, closingParenBoundary);
  if (!separator) return null;

  const cursor = skipWhitespace(source, separator.endIndex + 1);
  return source[cursor] === ')' && boundary(source, cursor + 1)
    ? { value: array.values.join(separator.value), endIndex: cursor }
    : null;
}

function readStaticStringArray(
  source: string,
  startIndex: number,
  valueForName: (name: string) => string | undefined,
  readStaticString: StaticStringReader,
): { values: string[]; endIndex: number } | null {
  let cursor = skipWhitespace(source, startIndex);
  if (source[cursor] !== '[') return null;
  cursor += 1;

  const values: string[] = [];
  while (cursor < source.length) {
    cursor = skipWhitespace(source, cursor);
    if (source[cursor] === ']') return values.length > 0 ? { values, endIndex: cursor } : null;

    const value = readStaticString(source, cursor, valueForName, arrayElementBoundary);
    if (!value) return null;
    values.push(value.value);

    cursor = skipWhitespace(source, value.endIndex + 1);
    if (source[cursor] === ',') {
      cursor += 1;
      continue;
    }
    if (source[cursor] === ']') return { values, endIndex: cursor };
    return null;
  }

  return null;
}

function readJoinCallStartIndex(source: string, startIndex: number): number | null {
  let cursor = skipWhitespace(source, startIndex);
  if (source[cursor] !== '.') return null;
  cursor = skipWhitespace(source, cursor + 1);
  if (!source.startsWith('join', cursor) || /[A-Za-z0-9_$]/.test(source[cursor + 4] ?? '')) return null;
  cursor = skipWhitespace(source, cursor + 4);
  return source[cursor] === '(' ? cursor + 1 : null;
}

function arrayElementBoundary(source: string, index: number): boolean {
  const cursor = skipWhitespace(source, index);
  return source[cursor] === ',' || source[cursor] === ']';
}

function closingParenBoundary(source: string, index: number): boolean {
  return source[skipWhitespace(source, index)] === ')';
}

function skipWhitespace(source: string, index: number): number {
  let cursor = index;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  return cursor;
}
