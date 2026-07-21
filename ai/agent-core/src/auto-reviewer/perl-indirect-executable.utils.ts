import { escapedFunctionPattern, readQuotedLiteral } from './interpreter-script-token.utils';
import { readLiteralList } from './interpreter-literal-list.utils';

export function perlIndirectExecutableArguments(code: string, functionNames: string[]): string[][] {
  return functionNames
    .flatMap((functionName) => callStartIndexes(code, functionName))
    .map((callStart) => perlIndirectCommandTokens(code, callStart))
    .filter((tokens) => tokens.length > 1);
}

function perlIndirectCommandTokens(code: string, callStart: number): string[] {
  const executable = readIndirectExecutable(code, callStart);
  if (!executable) return [];

  const args = readLiteralList(code, executable.endIndex + 1) ?? [];
  return args.length > 1 ? [executable.value, ...args.slice(1)] : [];
}

function callStartIndexes(code: string, functionName: string): number[] {
  return [...code.matchAll(new RegExp(`(?:^|[^A-Za-z0-9_$])${escapedFunctionPattern(functionName)}\\s*\\{`, 'g'))]
    .map((match) => Number(match.index) + match[0].length);
}

function readIndirectExecutable(source: string, startIndex: number): { value: string; endIndex: number } | null {
  const executable = readQuotedLiteral(source, startIndex);
  if (!executable) return null;

  let cursor = executable.endIndex + 1;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  return source[cursor] === '}' ? { value: executable.value, endIndex: cursor } : null;
}
