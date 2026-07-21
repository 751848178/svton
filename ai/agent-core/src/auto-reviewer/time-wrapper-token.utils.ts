import { unquoteShellToken } from './shell-command.utils';

const EXTERNAL_TIME_TERMINATING_OPTIONS = new Set(['--help', '--version']);
const EXTERNAL_TIME_LONG_OPTIONS = new Set(['--append', '--portability', '--quiet', '--verbose']);
const EXTERNAL_TIME_LONG_OPTIONS_WITH_ARGUMENT = new Set(['--format', '--output']);
const EXTERNAL_TIME_SHORT_OPTIONS = new Set(['a', 'h', 'l', 'p', 'q', 'v']);
const EXTERNAL_TIME_SHORT_OPTIONS_WITH_ARGUMENT = new Set(['f', 'o']);

type TimeOptionAction = 'valid' | 'consume-next' | 'invalid';

export function timeWrapperTokens(tokens: string[], shellKeyword: boolean): string[] {
  if (!shellKeyword) return externalTimeWrapperTokens(tokens);

  let consumedPortableOption = false;
  for (let index = 1; index < tokens.length; index += 1) {
    const token = unquoteShellToken(tokens[index]);
    if (token === '-p' && !consumedPortableOption) {
      consumedPortableOption = true;
      continue;
    }
    if (token.startsWith('-')) return [];
    return tokens.slice(index);
  }

  return [];
}

function externalTimeWrapperTokens(tokens: string[]): string[] {
  for (let index = 1; index < tokens.length; index += 1) {
    const token = unquoteShellToken(tokens[index]);
    if (token === '--') return tokens.slice(index + 1);
    if (EXTERNAL_TIME_TERMINATING_OPTIONS.has(token)) return [];

    const action = externalTimeOptionAction(token);
    if (action === 'invalid') return [];
    if (action === 'consume-next') {
      index += 1;
      continue;
    }
    if (token.startsWith('-')) continue;
    return tokens.slice(index);
  }

  return [];
}

function externalTimeOptionAction(token: string): TimeOptionAction {
  if (token.startsWith('--')) return externalTimeLongOptionAction(token);
  if (!token.startsWith('-') || token.length === 1) return 'valid';

  const chars = token.slice(1);
  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index];
    if (EXTERNAL_TIME_SHORT_OPTIONS.has(char)) continue;
    if (!EXTERNAL_TIME_SHORT_OPTIONS_WITH_ARGUMENT.has(char)) return 'invalid';
    return index === chars.length - 1 ? 'consume-next' : 'valid';
  }

  return 'valid';
}

function externalTimeLongOptionAction(token: string): TimeOptionAction {
  const [name] = token.split('=', 1);
  if (EXTERNAL_TIME_LONG_OPTIONS_WITH_ARGUMENT.has(name)) return token.includes('=') ? 'valid' : 'consume-next';
  if (EXTERNAL_TIME_LONG_OPTIONS.has(name)) return token.includes('=') ? 'invalid' : 'valid';
  return 'invalid';
}
