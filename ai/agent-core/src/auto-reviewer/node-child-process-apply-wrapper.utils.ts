import { nextCommaIndex } from './interpreter-literal-list.utils';
import { escapedFunctionPattern } from './interpreter-script-token.utils';
import { readJsStaticStringExpression } from './javascript-static-string.utils';
import { jsStaticStateBefore, type JsStaticValue } from './javascript-static-value.utils';

export function nodeChildProcessApplyArgumentArrayStartIndexes(
  code: string,
  functionNames: string[],
): number[] {
  return functionNames.flatMap((functionName) => {
    const pattern = new RegExp(
      `(?:^|[^A-Za-z0-9_$])${escapedFunctionPattern(functionName)}\\s*\\.\\s*apply\\s*(?:\\?\\.\\s*)?\\(`,
      'g',
    );
    return [...code.matchAll(pattern)]
      .map((match) => secondApplyArgumentStart(code, Number(match.index) + match[0].length))
      .filter((start): start is number => start !== null);
  });
}

export function readNodeApplyArrayCommandString(code: string, arrayStart: number): string | null {
  return readNodeApplyArrayCommandValue(code, arrayStart)?.value ?? null;
}

export function readNodeApplyArrayCommandValue(code: string, arrayStart: number): JsStaticValue | null {
  let cursor = arrayStart;
  while (/\s/.test(code[cursor] ?? '')) cursor += 1;
  if (code[cursor] !== '[') return null;

  const state = jsStaticStateBefore(code, arrayStart);
  return readJsStaticStringExpression(
    code,
    cursor + 1,
    (name) => state.strings.get(name),
    applyArrayElementBoundary,
  );
}

function secondApplyArgumentStart(code: string, receiverStart: number): number | null {
  const comma = nextCommaIndex(code, receiverStart);
  return comma >= 0 ? comma + 1 : null;
}

function applyArrayElementBoundary(source: string, index: number): boolean {
  let cursor = index;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  return source[cursor] === ',' || source[cursor] === ']';
}
