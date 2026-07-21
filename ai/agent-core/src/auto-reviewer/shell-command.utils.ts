import { readAnsiCQuotedToken } from './shell-ansi-quote.utils';
import { readDoubleQuotedEscape } from './shell-quote-escape.utils';

const SHELL_GROUP_CLOSERS = new Map([
  ['(', ')'],
  ['{', '}'],
]);

export function splitShellSegments(
  command: string,
  isSeparator: (char: string) => boolean,
): string[] {
  const segments: string[] = [];
  let segment = '';
  let quote: '"' | "'" | null = null;
  const groupClosers: string[] = [];

  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    if (quote) {
      const escaped = readDoubleQuotedEscape(command, index, quote);
      if (escaped) {
        segment += escaped.value;
        index = escaped.endIndex;
        continue;
      }
      segment += char;
      if (char === quote) quote = null;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      segment += char;
      continue;
    }

    if (char === '\\') {
      segment += char;
      if (command[index + 1]) {
        index += 1;
        segment += command[index];
      }
      continue;
    }

    const groupCloser = SHELL_GROUP_CLOSERS.get(char);
    if (groupCloser) {
      groupClosers.push(groupCloser);
      segment += char;
      continue;
    }

    if (char === groupClosers[groupClosers.length - 1]) {
      groupClosers.pop();
      segment += char;
      continue;
    }

    if (groupClosers.length === 0 && isSeparator(char)) {
      if (segment.trim()) segments.push(segment);
      segment = '';
      continue;
    }

    segment += char;
  }

  if (segment.trim()) segments.push(segment);
  return segments;
}

export function splitShellWords(segment: string): string[] {
  const tokens: string[] = [];
  let token = '';
  let quote: '"' | "'" | null = null;

  const trimmed = segment.trim();
  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index];
    if (quote) {
      const escaped = readDoubleQuotedEscape(trimmed, index, quote);
      if (escaped) {
        token += escaped.value;
        index = escaped.endIndex;
        continue;
      }
      token += char;
      if (char === quote) quote = null;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      token += char;
      continue;
    }

    if (char === '\\') {
      token += char;
      if (trimmed[index + 1]) {
        index += 1;
        token += trimmed[index];
      }
      continue;
    }

    if (/\s/.test(char)) {
      if (token) {
        tokens.push(token);
        token = '';
      }
      continue;
    }

    token += char;
  }

  if (token) tokens.push(token);
  return tokens;
}

export function unquoteShellToken(token: string): string {
  if (
    (token.startsWith('"') && token.endsWith('"'))
    || (token.startsWith("'") && token.endsWith("'"))
  ) {
    return token.slice(1, -1);
  }
  return token;
}

export function normalizeShellWordToken(token: string): string {
  let normalized = '';
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < token.length; index += 1) {
    const char = token[index];
    if (quote) {
      if (char === quote) {
        quote = null;
        continue;
      }

      if (quote === '"' && char === '\\') {
        const next = token[index + 1];
        if (next && ['$', '`', '"', '\\'].includes(next)) {
          normalized += next;
          index += 1;
          continue;
        }
      }

      normalized += char;
      continue;
    }

    const ansiQuoted = readAnsiCQuotedToken(token, index);
    if (ansiQuoted) {
      normalized += ansiQuoted.value;
      index = ansiQuoted.endIndex;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === '\\') {
      const next = token[index + 1];
      if (next) {
        normalized += next;
        index += 1;
        continue;
      }
    }

    normalized += char;
  }

  return normalized;
}

export function getShellTokenBasename(token: string): string {
  return normalizeShellWordToken(token).split('/').pop() ?? '';
}
