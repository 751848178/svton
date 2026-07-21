import type { JsStaticValue } from './javascript-static-string.utils';

export function readJsStringRawTemplateLiteral(source: string, startIndex: number): JsStaticValue | null {
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
  if (source[cursor] !== '`') return null;

  let value = '';
  for (let index = cursor + 1; index < source.length; index += 1) {
    const char = source[index];
    if (char === '$' && source[index + 1] === '{') return null;
    if (char === '`' && source[index - 1] !== '\\') return { value, endIndex: index };
    if (char === '\\' && source[index + 1]) {
      value += char + source[index + 1];
      index += 1;
      continue;
    }
    value += char;
  }

  return null;
}

function isJsIdentifierChar(value: string | undefined): boolean {
  return Boolean(value && /[A-Za-z0-9_$]/.test(value));
}
