import { nextCommaIndex } from './interpreter-literal-list.utils';
import { escapedFunctionPattern } from './interpreter-script-token.utils';

export function nodeChildProcessCallWrapperArgumentStartIndexes(
  code: string,
  functionNames: string[],
): number[] {
  return functionNames.flatMap((functionName) => {
    const pattern = new RegExp(
      `(?:^|[^A-Za-z0-9_$])${escapedFunctionPattern(functionName)}\\s*\\.\\s*call\\s*(?:\\?\\.\\s*)?\\(`,
      'g',
    );
    return [...code.matchAll(pattern)]
      .map((match) => callWrapperArgumentStart(code, Number(match.index) + match[0].length))
      .filter((start): start is number => start !== null);
  });
}

function callWrapperArgumentStart(code: string, receiverStart: number): number | null {
  const comma = nextCommaIndex(code, receiverStart);
  return comma >= 0 ? comma + 1 : null;
}
