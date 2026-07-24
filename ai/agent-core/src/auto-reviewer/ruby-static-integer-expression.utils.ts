import { readUnsignedStaticInteger } from './ruby-static-integer-literal.utils';
import {
  evaluatedBitwiseNotValue,
  evaluatedBitwiseValue,
  evaluatedShiftValue,
  evaluatedTermValue,
} from './ruby-static-integer-operator.utils';
import { skipRubyWhitespace } from './ruby-static-syntax.utils';
import { readRubyStaticStringLengthInteger } from './ruby-static-string-length-integer.utils';

export { skipRubyWhitespace } from './ruby-static-syntax.utils';

export function readStaticIntegerExpression(source: string, startIndex: number): { value: number; endIndex: number } | null {
  return readStaticIntegerBitwiseXorOrExpression(source, startIndex);
}

function readStaticIntegerBitwiseXorOrExpression(source: string, startIndex: number): { value: number; endIndex: number } | null {
  const firstAnd = readStaticIntegerBitwiseAndExpression(source, startIndex);
  if (!firstAnd) return null;

  let value = firstAnd.value;
  let endIndex = firstAnd.endIndex;
  while (true) {
    const operatorIndex = skipRubyWhitespace(source, endIndex);
    const operator = source[operatorIndex];
    if (operator !== '^' && operator !== '|') return { value, endIndex };

    const right = readStaticIntegerBitwiseAndExpression(source, operatorIndex + 1);
    if (!right) return null;
    const nextValue = evaluatedBitwiseValue(value, operator, right.value);
    if (nextValue === null) return null;
    value = nextValue;
    endIndex = right.endIndex;
  }
}

function readStaticIntegerBitwiseAndExpression(source: string, startIndex: number): { value: number; endIndex: number } | null {
  const firstShift = readStaticIntegerShiftExpression(source, startIndex);
  if (!firstShift) return null;

  let value = firstShift.value;
  let endIndex = firstShift.endIndex;
  while (true) {
    const operatorIndex = skipRubyWhitespace(source, endIndex);
    if (source[operatorIndex] !== '&' || source[operatorIndex + 1] === '&') return { value, endIndex };

    const right = readStaticIntegerShiftExpression(source, operatorIndex + 1);
    if (!right) return null;
    const nextValue = evaluatedBitwiseValue(value, '&', right.value);
    if (nextValue === null) return null;
    value = nextValue;
    endIndex = right.endIndex;
  }
}

function readStaticIntegerShiftExpression(source: string, startIndex: number): { value: number; endIndex: number } | null {
  const firstSum = readStaticIntegerSum(source, startIndex);
  if (!firstSum) return null;

  let value = firstSum.value;
  let endIndex = firstSum.endIndex;
  while (true) {
    const operatorIndex = skipRubyWhitespace(source, endIndex);
    const operator = source.slice(operatorIndex, operatorIndex + 2);
    if (operator !== '<<' && operator !== '>>') return { value, endIndex };

    const right = readStaticIntegerSum(source, operatorIndex + 2);
    if (!right) return null;
    const nextValue = evaluatedShiftValue(value, operator, right.value);
    if (nextValue === null) return null;
    value = nextValue;
    endIndex = right.endIndex;
  }
}

function readStaticIntegerSum(source: string, startIndex: number): { value: number; endIndex: number } | null {
  const firstTerm = readStaticIntegerTerm(source, startIndex);
  if (!firstTerm) return null;

  let value = firstTerm.value;
  let endIndex = firstTerm.endIndex;
  while (true) {
    const operatorIndex = skipRubyWhitespace(source, endIndex);
    const operator = source[operatorIndex];
    if (operator !== '+' && operator !== '-') return { value, endIndex };

    const right = readStaticIntegerTerm(source, operatorIndex + 1);
    if (!right) return null;
    value = operator === '+' ? value + right.value : value - right.value;
    endIndex = right.endIndex;
  }
}

function readStaticIntegerTerm(source: string, startIndex: number): { value: number; endIndex: number } | null {
  const firstPower = readStaticIntegerPower(source, startIndex);
  if (!firstPower) return null;

  let value = firstPower.value;
  let endIndex = firstPower.endIndex;
  while (true) {
    const operatorIndex = skipRubyWhitespace(source, endIndex);
    const operator = source[operatorIndex];
    if (operator !== '*' && operator !== '/' && operator !== '%') return { value, endIndex };

    const right = readStaticIntegerPower(source, operatorIndex + 1);
    if (!right) return null;
    const nextValue = evaluatedTermValue(value, operator, right.value);
    if (nextValue === null) return null;
    value = nextValue;
    endIndex = right.endIndex;
  }
}

function readStaticIntegerPower(source: string, startIndex: number): { value: number; endIndex: number } | null {
  const base = readSignedStaticIntegerPowerBase(source, startIndex);
  if (!base) return null;

  const operatorIndex = skipRubyWhitespace(source, base.endIndex);
  if (source.slice(operatorIndex, operatorIndex + 2) !== '**') {
    return { value: base.sign * base.value, endIndex: base.endIndex };
  }

  const exponent = readStaticIntegerPower(source, operatorIndex + 2);
  if (!exponent || exponent.value < 0) return null;

  const value = base.value ** exponent.value;
  return Number.isSafeInteger(value) ? { value: base.sign * value, endIndex: exponent.endIndex } : null;
}

function readSignedStaticIntegerPowerBase(source: string, startIndex: number): { sign: number; value: number; endIndex: number } | null {
  let cursor = skipRubyWhitespace(source, startIndex);
  let sign = 1;
  while (source[cursor] === '+' || source[cursor] === '-') {
    if (source[cursor] === '-') sign *= -1;
    cursor = skipRubyWhitespace(source, cursor + 1);
  }

  const base = readStaticIntegerPowerBase(source, cursor);
  return base ? { sign, value: base.value, endIndex: base.endIndex } : null;
}

function readStaticIntegerPowerBase(source: string, startIndex: number): { value: number; endIndex: number } | null {
  const cursor = skipRubyWhitespace(source, startIndex);
  if (source[cursor] === '~') return readBitwiseNotStaticIntegerPowerBase(source, cursor + 1);
  const stringLength = readRubyStaticStringLengthInteger(source, cursor);
  if (stringLength) return stringLength;
  return source[cursor] === '(' ? readParenthesizedStaticInteger(source, cursor) :
    readUnsignedStaticInteger(source, cursor);
}

function readBitwiseNotStaticIntegerPowerBase(source: string, startIndex: number): { value: number; endIndex: number } | null {
  const base = readSignedBitwiseNotStaticIntegerPowerBase(source, startIndex);
  if (!base) return null;

  const value = evaluatedBitwiseNotValue(base.value);
  return value === null ? null : { value, endIndex: base.endIndex };
}

function readSignedBitwiseNotStaticIntegerPowerBase(source: string, startIndex: number): { value: number; endIndex: number } | null {
  let cursor = skipRubyWhitespace(source, startIndex);
  let sign = 1;
  let signCount = 0;
  let hasMinus = false;
  while (source[cursor] === '+' || source[cursor] === '-') {
    if (source[cursor] === '-') {
      sign *= -1;
      hasMinus = true;
    }
    signCount += 1;
    cursor = skipRubyWhitespace(source, cursor + 1);
  }

  const base = readStaticIntegerPowerBase(source, cursor);
  const operatorIndex = base ? skipRubyWhitespace(source, base.endIndex) : cursor;
  if (base && sign === -1 && hasMinus && source.slice(operatorIndex, operatorIndex + 2) === '**') {
    const exponent = readStaticIntegerPower(source, operatorIndex + 2);
    if (!exponent || exponent.value < 0) return null;
    const value = base.value ** exponent.value;
    return Number.isSafeInteger(value) ? { value: -value, endIndex: exponent.endIndex } : null;
  }
  if (base && sign === 1 && hasMinus && source.slice(operatorIndex, operatorIndex + 2) === '**') {
    const exponent = readStaticIntegerPower(source, operatorIndex + 2);
    if (!exponent || exponent.value < 0) return null;
    const value = base.value ** exponent.value;
    return Number.isSafeInteger(value) ? { value, endIndex: exponent.endIndex } : null;
  }
  return base && (signCount === 0 || signCount === 1 || !hasMinus || source.slice(operatorIndex, operatorIndex + 2) !== '**')
    ? { value: sign * base.value, endIndex: base.endIndex }
    : null;
}

function readParenthesizedStaticInteger(source: string, startIndex: number): { value: number; endIndex: number } | null {
  const value = readStaticIntegerExpression(source, startIndex + 1);
  if (!value) return null;

  const closeIndex = skipRubyWhitespace(source, value.endIndex);
  return source[closeIndex] === ')' ? { value: value.value, endIndex: closeIndex + 1 } : null;
}
