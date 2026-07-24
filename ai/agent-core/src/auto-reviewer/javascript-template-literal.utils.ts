import type { JsStaticValue } from './javascript-static-string.utils';

type JsStaticExpressionReader = (
  source: string,
  startIndex: number,
  valueForName: (name: string) => string | undefined,
  boundary: (source: string, index: number) => boolean,
) => JsStaticValue | null;

export function readJsStaticTemplateLiteral(
  source: string,
  startIndex: number,
  readExpression: JsStaticExpressionReader,
  options: { rawEscapes?: boolean } = {},
): JsStaticValue | null {
  let cursor = startIndex;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  if (source[cursor] !== '`') return null;

  let value = '';
  for (let index = cursor + 1; index < source.length; index += 1) {
    const char = source[index];
    if (char === '`' && source[index - 1] !== '\\') return { value, endIndex: index };

    if (char === '$' && source[index + 1] === '{') {
      const expression = readExpression(source, index + 2, () => undefined, closingBraceBoundary);
      if (!expression) return null;
      const closeIndex = skipWhitespace(source, expression.endIndex + 1);
      if (source[closeIndex] !== '}') return null;
      value += expression.value;
      index = closeIndex;
      continue;
    }

    if (char === '\\' && source[index + 1]) {
      value += options.rawEscapes ? char + source[index + 1] : source[index + 1];
      index += 1;
      continue;
    }

    value += char;
  }

  return null;
}

function closingBraceBoundary(source: string, index: number): boolean {
  const cursor = skipWhitespace(source, index);
  return source[cursor] === '}';
}

function skipWhitespace(source: string, startIndex: number): number {
  let cursor = startIndex;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  return cursor;
}
