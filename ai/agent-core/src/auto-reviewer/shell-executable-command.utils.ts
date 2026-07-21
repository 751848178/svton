import { archWrapperTokens } from './arch-wrapper-token.utils';
import { caffeinateWrapperTokens } from './caffeinate-wrapper-token.utils';
import { firstEnvCommandTokens } from './env-command-token.utils';
import { launchctlWrapperTokens } from './launchctl-wrapper-token.utils';
import { sandboxExecWrapperTokens } from './sandbox-exec-wrapper-token.utils';
import { scriptWrapperTokens } from './script-wrapper-token.utils';
import { getShellTokenBasename, unquoteShellToken } from './shell-command.utils';
import { timeWrapperTokens } from './time-wrapper-token.utils';
import { xcrunWrapperTokens } from './xcrun-wrapper-token.utils';

const COMMAND_WRAPPER_OPTIONS = new Set(['-p']);
const BUILTIN_EXECUTABLE_WRAPPERS = new Set(['builtin', 'command', 'exec']);
const SIMPLE_WRAPPERS = new Set(['nohup']);
const OPTION_WRAPPERS = new Set(['sudo', 'doas', 'exec', 'setsid', 'time', 'nice']);
const WRAPPER_TERMINATING_OPTIONS = new Map([
  ['nice', new Set(['--help', '--version'])],
  ['sudo', new Set(['-V', '--help', '--version', '-v', '--validate', '-l', '--list', '-e', '--edit'])],
]);
const SUDO_SHORT_MODE_OPTIONS = new Set(['v', 'l', 'e']);
const SUDO_SHORT_OPTIONS_WITH_ARGUMENT = new Set(['C', 'D', 'R', 'T', 'U', 'g', 'h', 'p', 'u']);
const WRAPPER_OPTIONS_WITH_ARGUMENT = new Set([
  '-u',
  '--user',
  '-g',
  '--group',
  '-h',
  '--host',
  '-p',
  '--prompt',
  '-C',
  '-T',
  '-D',
  '--chdir',
  '--adjustment',
  '-o',
  '--output',
  '-f',
  '--format',
  '-a',
]);
const MAX_WRAPPER_DEPTH = 8;

export function shellExecutableCommandTokens(
  tokens: string[],
  depth = 0,
  allowShellKeywordTime = true,
): string[] {
  if (depth > MAX_WRAPPER_DEPTH) return [];

  const firstName = getShellTokenBasename(tokens[0] ?? '');
  if (firstName === 'env') return shellExecutableCommandTokens(firstEnvCommandTokens(tokens), depth + 1, false);
  if (firstName === 'busybox') return shellExecutableCommandTokens(busyboxAppletTokens(tokens), depth + 1, false);
  if (firstName === 'builtin') return shellExecutableCommandTokens(builtinWrapperTokens(tokens), depth + 1, false);
  if (firstName === 'command') return shellExecutableCommandTokens(commandWrapperTokens(tokens), depth + 1, false);
  if (firstName === 'arch') return shellExecutableCommandTokens(archWrapperTokens(tokens), depth + 1, false);
  if (firstName === 'caffeinate') return shellExecutableCommandTokens(caffeinateWrapperTokens(tokens), depth + 1, false);
  if (firstName === 'launchctl') return shellExecutableCommandTokens(launchctlWrapperTokens(tokens), depth + 1, false);
  if (firstName === 'sandbox-exec') return shellExecutableCommandTokens(sandboxExecWrapperTokens(tokens), depth + 1, false);
  if (firstName === 'script') return shellExecutableCommandTokens(scriptWrapperTokens(tokens), depth + 1, false);
  if (firstName === 'xcrun') return shellExecutableCommandTokens(xcrunWrapperTokens(tokens), depth + 1, false);
  if (firstName === 'time') return shellExecutableCommandTokens(
    timeWrapperTokens(tokens, allowShellKeywordTime && tokens[0] === 'time'),
    depth + 1,
    false,
  );
  if (SIMPLE_WRAPPERS.has(firstName)) return shellExecutableCommandTokens(tokens.slice(1), depth + 1, false);
  if (OPTION_WRAPPERS.has(firstName)) {
    return shellExecutableCommandTokens(skipLeadingOptions(tokens, 1, firstName), depth + 1, false);
  }
  return tokens;
}

function builtinWrapperTokens(tokens: string[]): string[] {
  const builtinName = getShellTokenBasename(tokens[1] ?? '');
  return BUILTIN_EXECUTABLE_WRAPPERS.has(builtinName) ? tokens.slice(1) : [];
}

function busyboxAppletTokens(tokens: string[]): string[] {
  const applet = unquoteShellToken(tokens[1] ?? '');
  return applet && !applet.startsWith('-') ? tokens.slice(1) : [];
}

function commandWrapperTokens(tokens: string[]): string[] {
  for (let index = 1; index < tokens.length; index += 1) {
    const token = unquoteShellToken(tokens[index]);
    if (token === '--') return tokens.slice(index + 1);
    if (COMMAND_WRAPPER_OPTIONS.has(token)) continue;
    if (token.startsWith('-')) return [];
    return tokens.slice(index);
  }

  return [];
}

function skipLeadingOptions(tokens: string[], startIndex: number, wrapper: string): string[] {
  for (let index = startIndex; index < tokens.length; index += 1) {
    const token = unquoteShellToken(tokens[index]);
    if (token === '--') return tokens.slice(index + 1);
    if (wrapperOptionTerminates(token, wrapper)) return [];
    if (wrapperOptionArgumentInvalid(token, unquoteShellToken(tokens[index + 1] ?? ''), wrapper)) return [];
    if (optionConsumesNextToken(token, wrapper)) {
      index += 1;
      continue;
    }
    if (token.startsWith('-')) continue;
    return tokens.slice(index);
  }

  return [];
}

function optionConsumesNextToken(token: string, wrapper: string): boolean {
  if (token.includes('=')) return false;
  if (wrapper === 'time') return token === '-o' || token === '--output';
  if (wrapper === 'nice') return token === '-n' || token === '--adjustment';
  return WRAPPER_OPTIONS_WITH_ARGUMENT.has(token);
}

function wrapperOptionTerminates(token: string, wrapper: string): boolean {
  if (WRAPPER_TERMINATING_OPTIONS.get(wrapper)?.has(token)) return true;
  return wrapper === 'sudo' && sudoShortModeOptionTerminates(token);
}

function wrapperOptionArgumentInvalid(token: string, nextToken: string, wrapper: string): boolean {
  if (wrapper !== 'nice') return false;
  if (token === '-n' || token === '--adjustment') return !isNiceAdjustmentValue(nextToken);
  if (token.startsWith('-n') && !token.startsWith('--') && token.length > 2) {
    return !isNiceAdjustmentValue(token.slice(2));
  }
  if (token.startsWith('--adjustment=')) {
    return !isNiceAdjustmentValue(token.slice('--adjustment='.length));
  }
  return false;
}

function isNiceAdjustmentValue(value: string): boolean {
  return /^[+-]?\d+$/.test(value);
}

function sudoShortModeOptionTerminates(token: string): boolean {
  if (!token.startsWith('-') || token.startsWith('--') || token.length <= 2) return false;

  for (const char of token.slice(1)) {
    if (SUDO_SHORT_MODE_OPTIONS.has(char)) return true;
    if (SUDO_SHORT_OPTIONS_WITH_ARGUMENT.has(char)) return false;
  }

  return false;
}
