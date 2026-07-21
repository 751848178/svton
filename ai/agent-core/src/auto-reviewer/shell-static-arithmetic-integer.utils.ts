export interface StaticArithmeticIntegerToken {
  length: number;
  value: number;
}

export function readStaticArithmeticIntegerToken(expression: string): StaticArithmeticIntegerToken | null {
  const baseInteger = readBaseIntegerToken(expression);
  if (baseInteger) return baseInteger;

  const hexInteger = readHexIntegerToken(expression);
  if (hexInteger) return hexInteger;
  if (hasInvalidOctalIntegerPrefix(expression)) return null;

  return readOctalIntegerToken(expression) ?? readDecimalIntegerToken(expression);
}

function readBaseIntegerToken(expression: string): StaticArithmeticIntegerToken | null {
  const match = expression.match(/^(\d+)#([0-9A-Za-z@_]+)/);
  if (!match) return null;

  const base = Number(match[1]);
  if (base < 2 || base > 64) return null;

  const value = staticBaseIntegerValue(match[2], base);
  return value === null ? null : { value, length: match[0].length };
}

function readHexIntegerToken(expression: string): StaticArithmeticIntegerToken | null {
  const match = expression.match(/^0[xX]([0-9A-Fa-f]+)/);
  return match ? { value: Number.parseInt(match[1], 16), length: match[0].length } : null;
}

function readOctalIntegerToken(expression: string): StaticArithmeticIntegerToken | null {
  const match = expression.match(/^0[0-7]+/);
  return match ? { value: Number.parseInt(match[0], 8), length: match[0].length } : null;
}

function hasInvalidOctalIntegerPrefix(expression: string): boolean {
  const match = expression.match(/^0[0-9]+/);
  return !!match && /[89]/.test(match[0]);
}

function readDecimalIntegerToken(expression: string): StaticArithmeticIntegerToken | null {
  const match = expression.match(/^\d+/);
  return match ? { value: Number(match[0]), length: match[0].length } : null;
}

function staticBaseIntegerValue(digits: string, base: number): number | null {
  let value = 0;
  for (const char of digits) {
    const digit = staticBaseIntegerDigitValue(char, base);
    if (digit === null || digit >= base) return null;
    value = value * base + digit;
  }

  return value;
}

function staticBaseIntegerDigitValue(char: string, base: number): number | null {
  if (/[0-9]/.test(char)) return char.charCodeAt(0) - 48;
  if (/[a-z]/.test(char)) return char.charCodeAt(0) - 87;
  if (/[A-Z]/.test(char)) {
    return base <= 36 ? char.charCodeAt(0) - 55 : char.charCodeAt(0) - 29;
  }
  if (char === '@') return 62;
  if (char === '_') return 63;

  return null;
}
