import { unquoteShellToken } from './shell-command.utils';

const CAFFEINATE_FLAG_CHARS = new Set(['d', 'i', 's', 'u']);
const CAFFEINATE_ARGUMENT_CHARS = new Set(['t', 'w']);

type OptionConsumeResult = 'same-token' | 'next-token' | 'invalid';

export function caffeinateWrapperTokens(tokens: string[]): string[] {
  for (let index = 1; index < tokens.length; index += 1) {
    const token = unquoteShellToken(tokens[index]);
    if (token === '--') return tokens.slice(index + 1);
    if (!token.startsWith('-')) return tokens.slice(index);

    const consumeResult = caffeinateOptionConsumeResult(token, unquoteShellToken(tokens[index + 1] ?? ''));
    if (consumeResult === 'invalid') return [];
    if (consumeResult === 'next-token') index += 1;
  }

  return [];
}

function caffeinateOptionConsumeResult(token: string, nextToken: string): OptionConsumeResult {
  if (!token.startsWith('-') || token.startsWith('--') || token.length < 2) return 'invalid';

  const chars = token.slice(1);
  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index];
    if (CAFFEINATE_FLAG_CHARS.has(char)) continue;
    if (!CAFFEINATE_ARGUMENT_CHARS.has(char)) return 'invalid';

    const inlineValue = chars.slice(index + 1);
    if (inlineValue) return caffeinateNumericArgumentIsValid(inlineValue) ? 'same-token' : 'invalid';
    return caffeinateNumericArgumentIsValid(nextToken) ? 'next-token' : 'invalid';
  }

  return 'same-token';
}

function caffeinateNumericArgumentIsValid(value: string): boolean {
  return /^\d+$/.test(value);
}
