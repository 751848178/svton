import { firstEnvCommandTokens } from './env-command-token.utils';
import { getShellTokenBasename, unquoteShellToken } from './shell-command.utils';
import { SHELL_COMMANDS } from './shell-command-name.constants';
import { isShellStdinPath } from './shell-stdin-path.utils';
import {
  bashOptionArgument,
  isInvalidBashOptionArgument,
  isNonExecutingBashOption,
  type PendingBashOptionArgument,
} from './shell-bash-invocation-option.utils';

const SHELL_COMMAND_STRING_OPTIONS = new Set(['-c', '--command']);
const SHELL_OPTIONS_WITH_ARGUMENT = new Set(['-O', '+O', '-o', '+o', '--init-file', '--rcfile']);

export interface ShellScriptInvocation {
  operand: string;
  readsStdin: boolean;
  stdinOption: boolean;
}

type TokensStartWithShell = (tokens: string[]) => boolean;

function shellCommandIndex(tokens: string[]): number {
  return tokens.findIndex((token) => SHELL_COMMANDS.has(getShellTokenBasename(token)));
}

function shellInvocationTokens(tokens: string[]): string[] {
  return getShellTokenBasename(tokens[0] ?? '') === 'env' ? firstEnvCommandTokens(tokens) : tokens;
}

function isShellStdinOption(word: string): boolean {
  return !word.startsWith('--') && word.slice(1).includes('s');
}

function shellOptionNeedsArgument(word: string): boolean {
  return SHELL_OPTIONS_WITH_ARGUMENT.has(word);
}

function shellOptionArgument(shellName: string, word: string): PendingBashOptionArgument | null {
  if (shellName === 'bash') return bashOptionArgument(word);
  if (word === '-o') return 'enable-shell-option';
  if (word === '+o') return 'disable-shell-option';
  return shellOptionNeedsArgument(word) ? 'skip' : null;
}

function isInvalidShellOptionArgument(shellName: string, option: PendingBashOptionArgument, word: string): boolean {
  if (shellName === 'bash') return isInvalidBashOptionArgument(option, word);
  return option !== 'skip' && (word.startsWith('-') || word.startsWith('+'));
}

function isGenericNonExecutingShellOption(word: string): boolean {
  return !word.startsWith('--') && word.startsWith('-') && word.slice(1).includes('n');
}

function isNonExecutingShellOption(shellName: string, word: string): boolean {
  return shellName === 'bash' ? isNonExecutingBashOption(word) : isGenericNonExecutingShellOption(word);
}

function nonExecutingShellInvocation(stdinOption: boolean): ShellScriptInvocation {
  return {
    operand: '',
    readsStdin: false,
    stdinOption,
  };
}

function isInputRedirectToken(word: string): boolean {
  return word === '<'
    || word === '<<<'
    || word.startsWith('<<<')
    || /^<<-?/.test(word);
}

export function shellScriptInvocation(
  tokens: string[],
  tokensStartWithShell: TokensStartWithShell,
): ShellScriptInvocation | null {
  if (!tokensStartWithShell(tokens)) return null;

  const shellTokens = shellInvocationTokens(tokens);
  const commandIndex = shellCommandIndex(shellTokens);
  if (commandIndex < 0) return null;
  const shellName = getShellTokenBasename(shellTokens[commandIndex]);

  let stdinOption = false;
  let parsingOptions = true;
  let optionWithArgument: PendingBashOptionArgument | null = null;

  for (let index = commandIndex + 1; index < shellTokens.length; index += 1) {
    const word = unquoteShellToken(shellTokens[index]);
    if (isInputRedirectToken(word)) break;

    if (optionWithArgument) {
      if (isInvalidShellOptionArgument(shellName, optionWithArgument, word)) return nonExecutingShellInvocation(stdinOption);
      if (optionWithArgument === 'enable-shell-option' && word === 'noexec') return nonExecutingShellInvocation(stdinOption);
      optionWithArgument = null;
      continue;
    }

    if (parsingOptions) {
      if (SHELL_COMMAND_STRING_OPTIONS.has(word)) return null;
      if (isNonExecutingShellOption(shellName, word)) return nonExecutingShellInvocation(stdinOption);
      const pendingOption = shellOptionArgument(shellName, word);
      if (pendingOption) {
        optionWithArgument = pendingOption;
        continue;
      }
      if (word === '--') {
        parsingOptions = false;
        continue;
      }
      if (word === '-') {
        parsingOptions = false;
        continue;
      }
      if (word.startsWith('-') && word !== '-') {
        stdinOption ||= isShellStdinOption(word);
        continue;
      }
    }

    if (!stdinOption) {
      return {
        operand: word,
        readsStdin: isShellStdinPath(word),
        stdinOption,
      };
    }
  }

  return {
    operand: '',
    readsStdin: true,
    stdinOption,
  };
}
