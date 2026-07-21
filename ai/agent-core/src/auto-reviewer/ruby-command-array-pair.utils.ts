import { callEndIndex, escapedFunctionPattern, readQuotedLiteral } from './interpreter-script-token.utils';
import { readLiteralList } from './interpreter-literal-list.utils';

export function rubyCommandArrayPairArguments(code: string, functionNames: string[]): string[][] {
  return functionNames
    .flatMap((functionName) => callStartIndexes(code, functionName))
    .map((callStart) => rubyPairCommandTokens(code, callStart))
    .filter((tokens) => tokens.length > 1);
}

function rubyPairCommandTokens(code: string, callStart: number): string[] {
  const commandPair = readCommandArrayPair(code, callStart);
  if (!commandPair) return [];

  const args = readLiteralList(code, nextArgumentCommaIndex(code, commandPair.endIndex + 1, callStart) + 1) ?? [];
  return [commandPair.command, ...args];
}

function callStartIndexes(code: string, functionName: string): number[] {
  return [...code.matchAll(new RegExp(`(?:^|[^A-Za-z0-9_$])${escapedFunctionPattern(functionName)}\\s*\\(`, 'g'))]
    .map((match) => Number(match.index) + match[0].length);
}

function readCommandArrayPair(source: string, startIndex: number): { command: string; endIndex: number } | null {
  let cursor = startIndex;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  if (source[cursor] !== '[') return null;

  const command = readQuotedLiteral(source, cursor + 1);
  if (!command) return null;

  cursor = skipWhitespace(source, command.endIndex + 1);
  if (source[cursor] !== ',') return null;

  const argv0 = readQuotedLiteral(source, cursor + 1);
  if (!argv0) return null;

  cursor = skipWhitespace(source, argv0.endIndex + 1);
  return source[cursor] === ']' ? { command: command.value, endIndex: cursor } : null;
}

function nextArgumentCommaIndex(source: string, startIndex: number, callStart: number): number {
  const commaIndex = source.indexOf(',', startIndex);
  const endIndex = callEndIndex(source, callStart);
  return commaIndex >= 0 && commaIndex < endIndex ? commaIndex : -1;
}

function skipWhitespace(source: string, startIndex: number): number {
  let cursor = startIndex;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  return cursor;
}
