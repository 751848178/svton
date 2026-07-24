import {
  identifierChar,
  skipWhitespace,
} from './javascript-static-decimal-code.utils';
import { readJsStaticMemberKey } from './javascript-static-member-key.utils';

export function readJsStaticMemberNameEndIndex(
  source: string,
  startIndex: number,
  name: string,
): number | null {
  const cursor = skipWhitespace(source, startIndex);
  if (source[cursor] === '.') return readJsIdentifierNameEndIndex(source, cursor + 1, name);
  if (source.startsWith('?.[', cursor)) return readBracketMemberNameEndIndex(source, cursor + 2, name);
  if (source.startsWith('?.', cursor)) return readJsIdentifierNameEndIndex(source, cursor + 2, name);
  return readBracketMemberNameEndIndex(source, cursor, name);
}

export function readJsIdentifierNameEndIndex(
  source: string,
  startIndex: number,
  name: string,
): number | null {
  const cursor = skipWhitespace(source, startIndex);
  return source.startsWith(name, cursor) && !identifierChar(source[cursor + name.length])
    ? cursor + name.length
    : null;
}

export function readJsCallArgumentStart(source: string, startIndex: number): number | null {
  const cursor = skipWhitespace(source, startIndex);
  if (source[cursor] === '(') return cursor + 1;
  return source.startsWith('?.(', cursor) ? cursor + 3 : null;
}

function readBracketMemberNameEndIndex(source: string, startIndex: number, name: string): number | null {
  if (source[startIndex] !== '[') return null;

  const key = readJsStaticMemberKey(source, startIndex + 1);
  return key?.value === name ? skipWhitespace(source, key.endIndex + 1) : null;
}
