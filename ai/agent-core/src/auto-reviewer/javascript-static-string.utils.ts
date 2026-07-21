import { readQuotedLiteral } from './interpreter-script-token.utils';
import { readJsConcatMethodChain } from './javascript-static-concat-method.utils';
import { readJsStringRawTemplateLiteral } from './javascript-string-raw-template.utils';

export const JS_NAME_PATTERN = '[A-Za-z_$][A-Za-z0-9_$]*';

export type JsStaticValue = {
  value: string;
  endIndex: number;
};

export function readJsStaticStringExpression(
  source: string,
  startIndex: number,
  valueForName: (name: string) => string | undefined,
  boundary: (source: string, index: number) => boolean,
): JsStaticValue | null {
  let cursor = startIndex;
  let value = '';
  let endIndex = startIndex - 1;

  while (cursor < source.length) {
    const operand = readJsStaticStringOperand(source, cursor, valueForName);
    if (!operand) return null;
    value += operand.value;
    endIndex = operand.endIndex;

    cursor = operand.endIndex + 1;
    while (/\s/.test(source[cursor] ?? '')) cursor += 1;
    if (source[cursor] !== '+') break;
    cursor += 1;
  }

  return boundary(source, cursor) ? { value, endIndex } : null;
}

export function readJsStaticStringLiteral(source: string, startIndex: number): JsStaticValue | null {
  const quoted = readQuotedLiteral(source, startIndex);
  if (quoted) return quoted;

  let cursor = startIndex;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  if (source[cursor] !== '`') return null;

  let value = '';
  for (let index = cursor + 1; index < source.length; index += 1) {
    const char = source[index];
    if (char === '$' && source[index + 1] === '{') return null;
    if (char === '`' && source[index - 1] !== '\\') return { value, endIndex: index };
    if (char === '\\' && source[index + 1]) {
      value += source[index + 1];
      index += 1;
      continue;
    }
    value += char;
  }

  return null;
}

function readJsStaticStringOperand(
  source: string,
  startIndex: number,
  valueForName: (name: string) => string | undefined,
): JsStaticValue | null {
  const primary = readJsStaticStringPrimaryOperand(source, startIndex, valueForName);
  return primary
    ? readJsConcatMethodChain(source, primary, valueForName, readJsStaticStringExpression, closingParenOrCommaBoundary)
    : null;
}

function readJsStaticStringPrimaryOperand(
  source: string,
  startIndex: number,
  valueForName: (name: string) => string | undefined,
): JsStaticValue | null {
  const parenthesized = readParenthesizedJsStaticStringExpression(source, startIndex, valueForName);
  if (parenthesized) return parenthesized;

  const rawTemplate = readJsStringRawTemplateLiteral(source, startIndex);
  if (rawTemplate) return rawTemplate;

  const literal = readJsStaticStringLiteral(source, startIndex);
  if (literal) return literal;

  const reference = readJsIdentifier(source, startIndex);
  if (!reference) return null;

  const value = valueForName(reference.value);
  return value ? { value, endIndex: reference.endIndex } : null;
}

function readParenthesizedJsStaticStringExpression(
  source: string,
  startIndex: number,
  valueForName: (name: string) => string | undefined,
): JsStaticValue | null {
  let cursor = startIndex;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  if (source[cursor] !== '(') return null;
  cursor += 1;

  let lastExpression: JsStaticValue | null = null;
  while (cursor < source.length) {
    const expression = readJsStaticStringExpression(
      source,
      cursor,
      valueForName,
      closingParenOrCommaBoundary,
    );
    if (!expression) return null;
    lastExpression = expression;

    cursor = expression.endIndex + 1;
    while (/\s/.test(source[cursor] ?? '')) cursor += 1;
    if (source[cursor] === ',') {
      cursor += 1;
      continue;
    }
    if (source[cursor] === ')') {
      return { value: lastExpression.value, endIndex: cursor };
    }
    return null;
  }

  return null;
}

function readJsIdentifier(source: string, startIndex: number): JsStaticValue | null {
  let cursor = startIndex;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;

  const match = source.slice(cursor).match(new RegExp(`^(${JS_NAME_PATTERN})`));
  if (!match) return null;

  return { value: match[1], endIndex: cursor + match[1].length - 1 };
}

function closingParenOrCommaBoundary(source: string, index: number): boolean {
  let cursor = index;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  return source[cursor] === ')' || source[cursor] === ',';
}
