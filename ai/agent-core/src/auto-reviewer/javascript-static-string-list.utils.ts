import { skipWhitespace } from './javascript-static-decimal-code.utils';

export type JsStaticStringListValue = {
  value: string;
  endIndex: number;
};

export type JsStaticStringListReader = (
  source: string,
  startIndex: number,
  valueForName: (name: string) => string | undefined,
  boundary: (source: string, index: number) => boolean,
) => JsStaticStringListValue | null;

export function readJsStaticStringList(
  source: string,
  startIndex: number,
  valueForName: (name: string) => string | undefined,
  readExpression: JsStaticStringListReader,
  closeChar: ')' | ']',
): JsStaticStringListValue | null {
  let cursor = startIndex;
  let value = '';

  while (cursor < source.length) {
    cursor = skipWhitespace(source, cursor);
    if (source[cursor] === closeChar) return { value, endIndex: cursor };

    const item = readExpression(source, cursor, valueForName, commaOrListCloseBoundary(closeChar));
    if (!item) return null;
    value += item.value;

    cursor = skipWhitespace(source, item.endIndex + 1);
    if (source[cursor] === ',') {
      cursor += 1;
      continue;
    }
    if (source[cursor] === closeChar) return { value, endIndex: cursor };
    return null;
  }

  return null;
}

export function commaOrListCloseBoundary(closeChar: ')' | ']') {
  return (source: string, index: number): boolean => {
    const cursor = skipWhitespace(source, index);
    return source[cursor] === ',' || source[cursor] === closeChar;
  };
}
