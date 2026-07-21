import { getShellTokenBasename, unquoteShellToken } from './shell-command.utils';
import { splitShellAssignmentPrefixes } from './shell-assignment-prefix.utils';
import { nextShellGlobOptionTokenEnabled } from './shell-glob-state.utils';
import {
  bashOptionArgument,
  isBashCommandStringSkippingOption,
  isBashCommandStringOption,
  isInvalidBashOptionArgument,
  isInvalidBashOptionWord,
} from './shell-bash-invocation-option.utils';

const SHELL_OPTIONS_WITH_ARGUMENT = new Set([
  '-O',
  '+O',
  '-o',
  '--init-file',
  '--rcfile',
]);

export interface ShellCommandStringInvocation {
  commandString: string;
  argv0: string;
  positionalArgs: string[];
  extglobEnabled: boolean;
  globEnabled: boolean;
}

function shellOptionNeedsArgument(token: string, shellName: string): boolean {
  if (shellName === 'bash') return Boolean(bashOptionArgument(token));
  if (SHELL_OPTIONS_WITH_ARGUMENT.has(token)) return true;
  return token.startsWith('--init-file=') || token.startsWith('--rcfile=');
}

function isCommandStringOption(token: string, shellName: string): boolean {
  if (shellName === 'bash') return isBashCommandStringOption(token);
  if (token === '-c') return true;
  if (!token.startsWith('-') || token.startsWith('--')) return false;

  return token.slice(1).includes('c');
}

export function firstShellCommandString(
  tokens: string[],
  tokenResolvesToShell: (token: string) => boolean,
): string {
  return firstShellCommandStringInvocation(tokens, tokenResolvesToShell).commandString;
}

export function firstShellCommandStringInvocation(
  tokens: string[],
  tokenResolvesToShell: (token: string) => boolean,
): ShellCommandStringInvocation {
  const shellIndex = tokens.findIndex(tokenResolvesToShell);
  if (shellIndex < 0) return emptyInvocation();
  const shellName = getShellTokenBasename(tokens[shellIndex] ?? '');

  let optionWithArgument = '';
  let extglobEnabled = false;
  let globEnabled = true;
  for (let index = shellIndex + 1; index < tokens.length; index += 1) {
    const token = unquoteShellToken(tokens[index]);
    if (optionWithArgument) {
      const bashArgument = shellName === 'bash' ? bashOptionArgument(optionWithArgument) : null;
      if (bashArgument && isInvalidBashOptionArgument(bashArgument, token)) return emptyInvocation();
      if (optionWithArgument === '-O' && token === 'extglob') extglobEnabled = true;
      if (optionWithArgument === '+O' && token === 'extglob') extglobEnabled = false;
      optionWithArgument = '';
      continue;
    }

    globEnabled = nextShellGlobOptionTokenEnabled(token, globEnabled);
    if (token === '--' || token === '-') return emptyInvocation();
    if (isBashNonExecutingOrInvalidOption(token, shellName)) return emptyInvocation();
    if (isCommandStringOption(token, shellName)) {
      if (index + 1 >= tokens.length) return emptyInvocation();
      const commandString = withAssignmentPrefixCommandString(
        tokens.slice(0, shellIndex),
        unquoteShellToken(tokens[index + 1] ?? ''),
      );
      return {
        commandString,
        argv0: tokens[index + 2] ?? '',
        positionalArgs: tokens.slice(index + 3),
        extglobEnabled,
        globEnabled,
      };
    }
    if (shellOptionNeedsArgument(token, shellName)) {
      optionWithArgument = token.includes('=') ? '' : token;
      continue;
    }
    if (!token.startsWith('-') && !token.startsWith('+')) return emptyInvocation();
  }

  return emptyInvocation();
}

function isBashNonExecutingOrInvalidOption(token: string, shellName: string): boolean {
  return shellName === 'bash'
    && (isBashCommandStringSkippingOption(token) || isInvalidBashOptionWord(token));
}

function withAssignmentPrefixCommandString(prefixTokens: string[], commandString: string): string {
  const { assignmentPrefixes } = splitShellAssignmentPrefixes(prefixTokens);
  return assignmentPrefixes.length > 0
    ? `${assignmentPrefixes.join('; ')}; ${commandString}`
    : commandString;
}

function emptyInvocation(): ShellCommandStringInvocation {
  return {
    commandString: '',
    argv0: '',
    positionalArgs: [],
    extglobEnabled: false,
    globEnabled: true,
  };
}
