import { callEndIndex, escapedFunctionPattern } from './interpreter-script-token.utils';
import { nextCommaIndex } from './interpreter-literal-list.utils';

export type NodeChildProcessBindPartialCall = {
  boundArgumentStart: number;
  invocationArgumentStart: number;
};

export function nodeChildProcessBindImmediateArgumentStartIndexes(
  code: string,
  functionNames: string[],
): number[] {
  return functionNames.flatMap((functionName) => {
    const pattern = new RegExp(
      `(?:^|[^A-Za-z0-9_$])${escapedFunctionPattern(functionName)}\\s*\\.\\s*bind\\s*(?:\\?\\.\\s*)?\\(`,
      'g',
    );
    return [...code.matchAll(pattern)]
      .filter((match) => bindCallIsImmediatelyInvoked(code, Number(match.index) + match[0].length))
      .map((match) => bindArgumentStart(code, Number(match.index) + match[0].length))
      .filter((start): start is number => start !== null);
  });
}

export function nodeChildProcessReceiverBindCallArgumentStartIndexes(
  code: string,
  functionNames: string[],
): number[] {
  return functionNames.flatMap((functionName) => {
    const pattern = new RegExp(
      `(?:^|[^A-Za-z0-9_$])${escapedFunctionPattern(functionName)}\\s*\\.\\s*bind\\s*(?:\\?\\.\\s*)?\\(`,
      'g',
    );
    return [...code.matchAll(pattern)]
      .filter((match) => bindCallHasOnlyReceiver(code, Number(match.index) + match[0].length))
      .map((match) => bindInvocationArgumentStart(code, Number(match.index) + match[0].length))
      .filter((start): start is number => start !== null);
  });
}

export function nodeChildProcessBindPartialCalls(
  code: string,
  functionNames: string[],
): NodeChildProcessBindPartialCall[] {
  return functionNames.flatMap((functionName) => {
    const pattern = new RegExp(
      `(?:^|[^A-Za-z0-9_$])${escapedFunctionPattern(functionName)}\\s*\\.\\s*bind\\s*(?:\\?\\.\\s*)?\\(`,
      'g',
    );
    return [...code.matchAll(pattern)].flatMap((match) => {
      const receiverStart = Number(match.index) + match[0].length;
      const boundArgumentStart = bindArgumentStart(code, receiverStart);
      const invocationArgumentStart = bindInvocationArgumentStart(code, receiverStart);
      return boundArgumentStart !== null && invocationArgumentStart !== null
        ? [{ boundArgumentStart, invocationArgumentStart }]
        : [];
    });
  });
}

function bindArgumentStart(code: string, receiverStart: number): number | null {
  const comma = nextCommaIndex(code, receiverStart);
  return comma >= 0 ? comma + 1 : null;
}

function bindCallHasOnlyReceiver(code: string, receiverStart: number): boolean {
  return nextCommaIndex(code, receiverStart) < 0;
}

function bindCallIsImmediatelyInvoked(code: string, receiverStart: number): boolean {
  let cursor = bindInvocationArgumentStart(code, receiverStart);
  if (cursor === null) return false;

  while (/\s/.test(code[cursor] ?? '')) cursor += 1;
  return code[cursor] === ')';
}

function bindInvocationArgumentStart(code: string, receiverStart: number): number | null {
  let cursor = callEndIndex(code, receiverStart) + 1;
  while (/\s/.test(code[cursor] ?? '')) cursor += 1;
  return code[cursor] === '(' ? cursor + 1 : null;
}
