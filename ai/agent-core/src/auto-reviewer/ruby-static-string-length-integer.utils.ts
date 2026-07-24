import { readRubyQuoteLikeStringLiteral } from './interpreter-quote-like-string.utils';
import { readRubyDoubleQuotedEscape } from './ruby-double-quoted-escape.utils';
import { skipRubyWhitespace } from './ruby-static-syntax.utils';

const RUBY_STRING_LENGTH_METHODS = ['bytesize', 'length', 'size'] as const;

export function readRubyStaticStringLengthInteger(
  source: string,
  startIndex: number,
): { value: number; endIndex: number } | null {
  const literal = readRubyStaticStringLengthReceiver(source, startIndex);
  if (!literal) return null;

  const dotIndex = skipRubyWhitespace(source, literal.endIndex);
  if (source[dotIndex] !== '.') return null;

  const method = RUBY_STRING_LENGTH_METHODS.find((candidate) => (
    source.startsWith(candidate, dotIndex + 1) &&
    !/[A-Za-z0-9_]/.test(source[dotIndex + 1 + candidate.length] ?? '')
  ));
  if (!method) return null;

  const endIndex = readOptionalEmptyCallEnd(source, dotIndex + method.length + 1);
  if (endIndex === null) return null;

  return {
    value: method === 'bytesize' ? literal.bytes : literal.characters,
    endIndex,
  };
}

function readOptionalEmptyCallEnd(source: string, startIndex: number): number | null {
  const cursor = skipRubyWhitespace(source, startIndex);
  if (source[cursor] !== '(') return startIndex;

  const closeIndex = skipRubyWhitespace(source, cursor + 1);
  return source[closeIndex] === ')' ? closeIndex + 1 : null;
}

function readRubyStaticStringLengthReceiver(
  source: string,
  startIndex: number,
): { characters: number; bytes: number; endIndex: number } | null {
  const cursor = skipRubyWhitespace(source, startIndex);
  if (source[cursor] === '(') return readParenthesizedRubyStringLengthReceiver(source, cursor);

  const quoteLike = readRubyQuoteLikeStringLiteral(source, cursor);
  if (quoteLike) return stringLengthReceiver(quoteLike.value, quoteLike.endIndex + 1);

  const quote = source[cursor];
  if (quote !== '"' && quote !== "'") return null;

  let value = '';
  for (let index = cursor + 1; index < source.length; index += 1) {
    const char = source[index] ?? '';
    if (char === quote) return stringLengthReceiver(value, index + 1);
    if (char === '\n') return null;
    if (quote === '"' && char === '#' && /[{@$]/.test(source[index + 1] ?? '')) return null;
    if (char === '\\') {
      const escape = quote === '"' ? readRubyDoubleQuotedEscape(source, index) : null;
      if (!escape) return null;
      value += escape.value;
      index = escape.endIndex - 1;
      continue;
    }
    value += char;
  }

  return null;
}

function readParenthesizedRubyStringLengthReceiver(
  source: string,
  startIndex: number,
): { characters: number; bytes: number; endIndex: number } | null {
  const literal = readRubyStaticStringLengthReceiver(source, startIndex + 1);
  if (!literal) return null;

  const closeIndex = skipRubyWhitespace(source, literal.endIndex);
  return source[closeIndex] === ')' ? { ...literal, endIndex: closeIndex + 1 } : null;
}

function stringLengthReceiver(value: string, endIndex: number): { characters: number; bytes: number; endIndex: number } {
  return { characters: value.length, bytes: Buffer.byteLength(value), endIndex };
}
