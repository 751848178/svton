import { readQuotedLiteral } from './interpreter-script-token.utils';
import { skipWhitespace } from './javascript-static-decimal-code.utils';

export function readJsStaticMemberKey(
  source: string,
  startIndex: number,
): { value: string; endIndex: number } | null {
  let cursor = startIndex;
  let value = '';

  while (cursor < source.length) {
    const part = readStaticMemberKeyPart(source, cursor);
    if (!part) return null;
    value += part.value;

    cursor = skipWhitespace(source, part.endIndex + 1);
    if (source[cursor] === ']') return { value, endIndex: cursor };
    if (source[cursor] !== '+') return null;
    cursor = skipWhitespace(source, cursor + 1);
  }

  return null;
}

function readStaticMemberKeyPart(
  source: string,
  startIndex: number,
): { value: string; endIndex: number } | null {
  return readQuotedLiteral(source, startIndex) ?? readNoSubstitutionTemplateKey(source, startIndex);
}

function readNoSubstitutionTemplateKey(
  source: string,
  startIndex: number,
): { value: string; endIndex: number } | null {
  let cursor = skipWhitespace(source, startIndex);
  if (source[cursor] !== '`') return null;

  let value = '';
  for (let index = cursor + 1; index < source.length; index += 1) {
    const char = source[index];
    if (char === '`' && source[index - 1] !== '\\') return { value, endIndex: index };
    if (char === '$' && source[index + 1] === '{') return null;
    if (char === '\\' && source[index + 1]) {
      value += source[index + 1];
      index += 1;
      continue;
    }
    value += char;
  }

  return null;
}
