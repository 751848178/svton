import { getShellTokenBasename, unquoteShellToken } from './shell-command.utils';
import { shellExecutableCommandTokens } from './shell-executable-command.utils';

type TokenPredicate = (token: string) => boolean;

const STDOUT_TARGETS = new Set(['-', '/dev/stdout', '/dev/fd/1', '/proc/self/fd/1']);

export function commandTokensStartWithFetchStdout(
  tokens: string[],
  tokenResolvesToFetch: TokenPredicate,
): boolean {
  const executableTokens = shellExecutableCommandTokens(tokens);
  const first = executableTokens[0] ?? '';
  if (!tokenResolvesToFetch(first)) return false;

  const commandName = getShellTokenBasename(first);
  if (commandName === 'curl') return curlWritesResponseToStdout(executableTokens.slice(1));
  if (commandName === 'wget') return wgetWritesResponseToStdout(executableTokens.slice(1));

  return true;
}

function curlWritesResponseToStdout(tokens: string[]): boolean {
  for (let index = 0; index < tokens.length; index += 1) {
    const token = unquoteShellToken(tokens[index]);
    if (token === '--output') return outputTargetIsStdout(tokens[index + 1] ?? '');
    if (token.startsWith('--output=')) return outputTargetIsStdout(token.slice('--output='.length));
    if (token === '--remote-name' || token === '-O') return false;

    const shortOutput = shortOptionValue(token, 'o', tokens[index + 1] ?? '');
    if (shortOutput !== null) return outputTargetIsStdout(shortOutput);
    if (shortOptionValue(token, 'O', '') !== null) return false;
  }

  return true;
}

function wgetWritesResponseToStdout(tokens: string[]): boolean {
  for (let index = 0; index < tokens.length; index += 1) {
    const token = unquoteShellToken(tokens[index]);
    if (token === '--output-document') return outputTargetIsStdout(tokens[index + 1] ?? '');
    if (token.startsWith('--output-document=')) return outputTargetIsStdout(token.slice('--output-document='.length));

    const shortOutput = shortOptionValue(token, 'O', tokens[index + 1] ?? '');
    if (shortOutput !== null) return outputTargetIsStdout(shortOutput);
  }

  return false;
}

function outputTargetIsStdout(token: string): boolean {
  return STDOUT_TARGETS.has(unquoteShellToken(token));
}

function shortOptionValue(token: string, option: string, nextToken: string): string | null {
  if (!token.startsWith('-') || token.startsWith('--')) return null;

  const optionIndex = token.indexOf(option, 1);
  if (optionIndex < 0) return null;

  const inlineValue = token.slice(optionIndex + 1);
  return inlineValue || unquoteShellToken(nextToken);
}
