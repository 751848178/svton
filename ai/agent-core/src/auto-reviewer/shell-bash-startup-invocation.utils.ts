import { getShellTokenBasename, unquoteShellToken } from './shell-command.utils';
import {
  bashOptionArgument,
  isBashCommandStringOption,
  isInteractiveBashOption,
  isInvalidBashOptionWord,
  isInvalidBashOptionArgument,
  isNonExecutingBashOption,
  isPosixBashOption,
  isPrivilegedBashOption,
  isStartupSkippingShellOption,
  type PendingBashOptionArgument,
} from './shell-bash-invocation-option.utils';

type TokenResolvesToShell = (token: string) => boolean;

export function bashReadsStartupFile(
  tokens: string[],
  tokenResolvesToShell: TokenResolvesToShell,
): boolean {
  const shellIndex = tokens.findIndex(tokenResolvesToShell);
  const shellToken = tokens[shellIndex] ?? '';
  if (shellIndex < 0 || getShellTokenBasename(shellToken) !== 'bash') return false;

  let optionWithArgument: PendingBashOptionArgument | null = null;
  for (let index = shellIndex + 1; index < tokens.length; index += 1) {
    const word = unquoteShellToken(tokens[index]);
    if (optionWithArgument) {
      if (isInvalidBashOptionArgument(optionWithArgument, word)) return false;
      if (optionWithArgument === 'enable-shell-option' && isStartupSkippingShellOption(word)) return false;
      optionWithArgument = null;
      continue;
    }

    if (isInteractiveBashOption(word)) return false;
    if (isPrivilegedBashOption(word)) return false;
    if (isPosixBashOption(word)) return false;
    if (isNonExecutingBashOption(word)) return false;
    if (isBashCommandStringOption(word)) return index + 1 < tokens.length;
    const optionArgument = bashOptionArgument(word);
    if (optionArgument) {
      optionWithArgument = optionArgument;
      continue;
    }
    if (isInvalidBashOptionWord(word)) return false;
    if (word === '--' || word === '-') return true;
    if (word.startsWith('-') || word.startsWith('+')) continue;
    return true;
  }

  return !optionWithArgument;
}
