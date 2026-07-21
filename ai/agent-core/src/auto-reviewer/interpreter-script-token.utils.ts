import { normalizeShellWordToken } from './shell-command.utils';

export function inlineScriptOption(tokens: string[], optionName: string, allowInline: boolean): string {
  for (let index = 1; index < tokens.length; index += 1) {
    const token = normalizeShellWordToken(tokens[index]);
    if (token === optionName) return normalizeShellWordToken(tokens[index + 1] ?? '');
    if (allowInline && token.startsWith(optionName) && token.length > optionName.length) {
      return token.slice(optionName.length);
    }
    if (token.startsWith('-')) continue;
    return '';
  }

  return '';
}

export function readQuotedLiteral(source: string, startIndex: number): { value: string; endIndex: number } | null {
  let cursor = startIndex;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  const quote = source[cursor];
  if (quote !== '"' && quote !== "'") return null;

  let value = '';
  for (let index = cursor + 1; index < source.length; index += 1) {
    const char = source[index];
    if (char === quote && source[index - 1] !== '\\') return { value, endIndex: index };
    if (char === '\\' && source[index + 1]) {
      value += source[index + 1];
      index += 1;
      continue;
    }
    value += char;
  }

  return null;
}

export function quotedStringEndIndex(source: string, startIndex: number): number | null {
  const quote = source[startIndex];
  if (quote !== '"' && quote !== "'" && quote !== '`') return null;

  for (let index = startIndex + 1; index < source.length; index += 1) {
    const char = source[index];
    if (char === quote && source[index - 1] !== '\\') return index;
    if (char === '\\' && source[index + 1]) index += 1;
  }

  return null;
}

export function callEndIndex(source: string, startIndex: number): number {
  let depth = 0;
  for (let index = startIndex; index < source.length; index += 1) {
    const quotedEnd = quotedStringEndIndex(source, index);
    if (quotedEnd !== null) {
      index = quotedEnd;
      continue;
    }

    const char = source[index];
    if (char === '(' || char === '[' || char === '{') depth += 1;
    if (char !== ')' && char !== ']' && char !== '}') continue;
    if (char === ')' && depth === 0) return index;
    if (depth > 0) depth -= 1;
  }

  return source.length;
}

export function escapedFunctionPattern(functionName: string): string {
  return functionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function isPythonCommand(name: string): boolean {
  return /^python(?:\d+(?:\.\d+)*)?$/.test(name);
}
