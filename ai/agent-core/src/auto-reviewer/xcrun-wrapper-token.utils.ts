import { unquoteShellToken } from './shell-command.utils';

const XCRUN_FLAGS = new Set(['--kill-cache', '--log', '--no-cache', '--run', '--verbose', '-k', '-l', '-n', '-r', '-v']);
const XCRUN_OPTIONS_WITH_ARGUMENT = new Set(['--sdk', '--toolchain']);
const XCRUN_NON_EXECUTING_OPTIONS = new Set([
  '--find',
  '--help',
  '--show-sdk-build-version',
  '--show-sdk-path',
  '--show-sdk-platform-path',
  '--show-sdk-platform-version',
  '--show-sdk-version',
  '--show-toolchain-path',
  '--version',
  '-f',
  '-h',
]);

export function xcrunWrapperTokens(tokens: string[]): string[] {
  for (let index = 1; index < tokens.length; index += 1) {
    const token = unquoteShellToken(tokens[index]);
    if (token === '--') return tokens.slice(index + 1);
    if (xcrunOptionTerminates(token)) return [];
    if (xcrunOptionConsumesNext(token)) {
      index += 1;
      continue;
    }
    if (XCRUN_FLAGS.has(token) || xcrunInlineArgumentOption(token)) continue;
    if (token.startsWith('-')) return [];
    return tokens.slice(index);
  }

  return [];
}

function xcrunOptionTerminates(token: string): boolean {
  if (XCRUN_NON_EXECUTING_OPTIONS.has(token)) return true;
  return [...XCRUN_NON_EXECUTING_OPTIONS].some((option) => token.startsWith(`${option}=`));
}

function xcrunOptionConsumesNext(token: string): boolean {
  return XCRUN_OPTIONS_WITH_ARGUMENT.has(token);
}

function xcrunInlineArgumentOption(token: string): boolean {
  return [...XCRUN_OPTIONS_WITH_ARGUMENT].some((option) => token.startsWith(`${option}=`));
}
