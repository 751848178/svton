interface AnsiCQuotedToken {
  endIndex: number;
  value: string;
}

const SIMPLE_ANSI_ESCAPES = new Map([
  ['a', '\x07'],
  ['b', '\b'],
  ['e', '\x1b'],
  ['E', '\x1b'],
  ['f', '\f'],
  ['n', '\n'],
  ['r', '\r'],
  ['t', '\t'],
  ['v', '\v'],
  ['\\', '\\'],
  ["'", "'"],
  ['"', '"'],
  ['?', '?'],
]);

function isHexDigit(char: string): boolean {
  return /^[0-9a-fA-F]$/.test(char);
}

function isOctalDigit(char: string): boolean {
  return /^[0-7]$/.test(char);
}

function codePointFromDigits(digits: string, radix: number): string {
  const codePoint = Number.parseInt(digits, radix);
  if (!Number.isFinite(codePoint)) return '';

  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return '';
  }
}

function readDigits(
  token: string,
  startIndex: number,
  maxLength: number,
  matchesDigit: (char: string) => boolean,
): { digits: string; endIndex: number } {
  let digits = '';
  let endIndex = startIndex - 1;

  for (
    let index = startIndex;
    index < token.length && digits.length < maxLength && matchesDigit(token[index]);
    index += 1
  ) {
    digits += token[index];
    endIndex = index;
  }

  return { digits, endIndex };
}

function readEscapedAnsiChar(token: string, slashIndex: number): { endIndex: number; value: string } {
  const escaped = token[slashIndex + 1];
  if (!escaped) return { endIndex: slashIndex, value: '\\' };

  const simple = SIMPLE_ANSI_ESCAPES.get(escaped);
  if (simple !== undefined) return { endIndex: slashIndex + 1, value: simple };

  if (escaped === 'x') {
    const { digits, endIndex } = readDigits(token, slashIndex + 2, 2, isHexDigit);
    return digits
      ? { endIndex, value: codePointFromDigits(digits, 16) }
      : { endIndex: slashIndex + 1, value: escaped };
  }

  if (escaped === 'u' || escaped === 'U') {
    const maxLength = escaped === 'u' ? 4 : 8;
    const { digits, endIndex } = readDigits(token, slashIndex + 2, maxLength, isHexDigit);
    return digits
      ? { endIndex, value: codePointFromDigits(digits, 16) }
      : { endIndex: slashIndex + 1, value: escaped };
  }

  if (isOctalDigit(escaped)) {
    const { digits, endIndex } = readDigits(token, slashIndex + 1, 3, isOctalDigit);
    return { endIndex, value: codePointFromDigits(digits, 8) };
  }

  return { endIndex: slashIndex + 1, value: escaped };
}

export function readAnsiCQuotedToken(token: string, startIndex: number): AnsiCQuotedToken | null {
  if (token[startIndex] !== '$' || token[startIndex + 1] !== "'") return null;

  let value = '';
  for (let index = startIndex + 2; index < token.length; index += 1) {
    const char = token[index];
    if (char === "'") return { endIndex: index, value };

    if (char === '\\') {
      const escaped = readEscapedAnsiChar(token, index);
      value += escaped.value;
      index = escaped.endIndex;
      continue;
    }

    value += char;
  }

  return null;
}
