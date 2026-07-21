import {
  JS_NAME_PATTERN,
  readJsStaticStringExpression as readJsStaticStringExpressionValue,
  readJsStaticStringLiteral,
  type JsStaticValue,
} from './javascript-static-string.utils';

export type JsStaticState = {
  strings: Map<string, string>;
  arrays: Map<string, string[]>;
};

export type { JsStaticValue };

type JsStaticArray = {
  values: string[];
  endIndex: number;
};

export function jsStaticStateBefore(code: string, beforeIndex: number): JsStaticState {
  const state: JsStaticState = { strings: new Map(), arrays: new Map() };
  for (const statement of code.slice(0, beforeIndex).split(/[;\n]/)) updateJsStaticState(statement, state);
  return state;
}

export function readJsStaticStringExpression(expression: string, state: JsStaticState): string | null {
  return readJsStaticStringExpressionValue(
    expression,
    0,
    (name) => state.strings.get(name),
    assignmentValueConsumed,
  )?.value ?? null;
}

export function readJsStaticStringValue(
  source: string,
  startIndex: number,
  state: JsStaticState,
): JsStaticValue | null {
  return readJsStaticStringExpressionValue(
    source,
    startIndex,
    (name) => state.strings.get(name),
    simpleValueBoundary,
  );
}

export function readJsStaticArrayValue(
  source: string,
  startIndex: number,
  state: JsStaticState,
): string[] | null {
  const literal = readJsStaticArrayLiteral(source, startIndex, state, simpleValueBoundary);
  if (literal) return literal.values;

  const reference = readIdentifierReference(source, startIndex, simpleValueBoundary);
  return reference ? state.arrays.get(reference.value) ?? null : null;
}

function updateJsStaticState(statement: string, state: JsStaticState): void {
  const assignment = statement.match(new RegExp(
    `^\\s*(?:(?:const|let|var)\\s+)?(${JS_NAME_PATTERN})\\s*=\\s*(.+?)\\s*$`,
  ));
  if (!assignment) return;

  const name = assignment[1];
  const value = assignment[2];
  const literal = readJsStaticStringExpressionValue(value, 0, (name) => state.strings.get(name), assignmentValueConsumed);
  if (literal) {
    state.strings.set(name, literal.value);
    state.arrays.delete(name);
    return;
  }

  const array = readJsStaticArrayLiteral(value, 0, state, assignmentValueConsumed);
  if (array) {
    state.arrays.set(name, array.values);
    state.strings.delete(name);
    return;
  }

  state.strings.delete(name);
  state.arrays.delete(name);
}

function readJsStaticArrayLiteral(
  source: string,
  startIndex: number,
  state: JsStaticState,
  boundary: (source: string, index: number) => boolean,
): JsStaticArray | null {
  let cursor = startIndex;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  if (source[cursor] !== '[') return null;
  cursor += 1;

  const values: string[] = [];
  while (cursor < source.length) {
    while (/\s/.test(source[cursor] ?? '')) cursor += 1;
    if (source[cursor] === ']') break;

    const value = readJsStaticArrayElement(source, cursor, state);
    if (!value) return null;
    values.push(value.value);
    cursor = value.endIndex + 1;

    while (/\s/.test(source[cursor] ?? '')) cursor += 1;
    if (source[cursor] === ',') {
      cursor += 1;
      continue;
    }
    if (source[cursor] === ']') break;
    return null;
  }

  if (source[cursor] !== ']' || values.length === 0) return null;
  return boundary(source, cursor + 1) ? { values, endIndex: cursor } : null;
}

function readJsStaticArrayElement(
  source: string,
  startIndex: number,
  state: JsStaticState,
): JsStaticValue | null {
  return readJsStaticStringExpressionValue(
    source,
    startIndex,
    (name) => state.strings.get(name),
    arrayElementBoundary,
  );
}

function readIdentifierReference(
  source: string,
  startIndex: number,
  boundary: (source: string, index: number) => boolean,
): JsStaticValue | null {
  let cursor = startIndex;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;

  const match = source.slice(cursor).match(new RegExp(`^(${JS_NAME_PATTERN})`));
  if (!match) return null;

  const endIndex = cursor + match[1].length;
  return boundary(source, endIndex) ? { value: match[1], endIndex: endIndex - 1 } : null;
}

function assignmentValueConsumed(source: string, index: number): boolean {
  let cursor = index;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  return cursor >= source.length;
}

function simpleValueBoundary(source: string, index: number): boolean {
  let cursor = index;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  return source[cursor] === ')' || source[cursor] === ',';
}

function arrayElementBoundary(source: string, index: number): boolean {
  let cursor = index;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  return source[cursor] === ']' || source[cursor] === ',';
}
