import { escapedFunctionPattern } from './interpreter-script-token.utils';

export function nodeChildProcessOptionalCallStartIndexes(code: string, functionNames: string[]): number[] {
  return functionNames.flatMap((functionName) => {
    const pattern = new RegExp(
      `(?:^|[^A-Za-z0-9_$])${escapedFunctionPattern(functionName)}\\s*\\?\\.\\s*\\(`,
      'g',
    );
    return [...code.matchAll(pattern)]
      .map((match) => Number(match.index) + match[0].length);
  });
}
