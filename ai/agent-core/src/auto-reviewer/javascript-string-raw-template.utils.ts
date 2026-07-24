import type { JsStaticValue } from './javascript-static-string.utils';
import { readJsStaticTemplateLiteral } from './javascript-template-literal.utils';

type JsStaticExpressionReader = Parameters<typeof readJsStaticTemplateLiteral>[2];

export function readJsStringRawTemplateLiteral(
  source: string,
  startIndex: number,
  readExpression?: JsStaticExpressionReader,
): JsStaticValue | null {
  let cursor = startIndex;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;

  if (!source.startsWith('String', cursor) || isJsIdentifierChar(source[cursor + 'String'.length])) {
    return null;
  }
  cursor += 'String'.length;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  if (source[cursor] !== '.') return null;
  cursor += 1;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  if (!source.startsWith('raw', cursor) || isJsIdentifierChar(source[cursor + 'raw'.length])) {
    return null;
  }
  cursor += 'raw'.length;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  return readExpression ? readJsStaticTemplateLiteral(source, cursor, readExpression, { rawEscapes: true }) : null;
}

function isJsIdentifierChar(value: string | undefined): boolean {
  return Boolean(value && /[A-Za-z0-9_$]/.test(value));
}
