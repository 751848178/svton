import { skipRubyWhitespace } from './ruby-static-syntax.utils';

export function readUnsignedStaticInteger(
  source: string,
  startIndex: number,
): { value: number; endIndex: number } | null {
  const cursor = skipRubyWhitespace(source, startIndex);
  const literal = source.slice(cursor);
  const baseMatch = literal.match(
    /^0([bB][01](?:_?[01])*|[dD]\d(?:_?\d)*|[oO][0-7](?:_?[0-7])*|[xX][\da-fA-F](?:_?[\da-fA-F])*)/,
  );
  if (baseMatch) return parsedBaseInteger(baseMatch[1], cursor + baseMatch[0].length);

  const legacyOctalMatch = literal.match(/^0(?:_?[0-7])+/);
  if (legacyOctalMatch) {
    return parsedInteger(legacyOctalMatch[0], 8, cursor + legacyOctalMatch[0].length);
  }

  const match = literal.match(/^(\d(?:_?\d)*)/);
  return match ? parsedInteger(match[1], 10, cursor + match[1].length) : null;
}

function parsedBaseInteger(literal: string, endIndex: number): { value: number; endIndex: number } {
  const prefix = literal[0].toLowerCase();
  const radix = prefix === 'b' ? 2 : prefix === 'd' ? 10 : prefix === 'o' ? 8 : 16;
  return parsedInteger(literal.slice(1), radix, endIndex);
}

function parsedInteger(
  literal: string,
  radix: number,
  endIndex: number,
): { value: number; endIndex: number } {
  return { value: Number.parseInt(literal.replaceAll('_', ''), radix), endIndex };
}
