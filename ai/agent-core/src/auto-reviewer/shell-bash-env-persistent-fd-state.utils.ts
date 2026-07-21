import { bashEnvFdStartupCommandStrings } from './shell-bash-env-fd-startup-command.utils';
import { splitShellAssignmentPrefixes } from './shell-assignment-prefix.utils';
import { getShellTokenBasename, unquoteShellToken } from './shell-command.utils';
import { type BashEnvState } from './shell-bash-env-static-variable.utils';
import { shellFdPathNumber } from './shell-stdin-path.utils';

interface ExecInputRedirect {
  fd: number;
  endIndex: number;
}

export function bashEnvPersistentFdStartupCommandStrings(
  state: BashEnvState,
  startupValue: string,
): string[] {
  const fd = shellFdPathNumber(startupValue);
  return fd === null ? [] : state.fdScripts.get(fd) ?? [];
}

export function applyBashEnvPersistentFdState(
  statement: string,
  tokens: string[],
  state: BashEnvState,
): void {
  const redirects = statefulExecInputRedirects(tokens);
  if (!redirects) return;

  for (const fd of new Set(redirects.map((redirect) => redirect.fd))) {
    const scripts = bashEnvFdStartupCommandStrings(statement, `/dev/fd/${fd}`, statement);
    if (scripts.length > 0) state.fdScripts.set(fd, scripts);
    else state.fdScripts.delete(fd);
  }
}

function statefulExecInputRedirects(tokens: string[]): ExecInputRedirect[] | null {
  const { commandTokens } = splitShellAssignmentPrefixes(tokens);
  if (getShellTokenBasename(commandTokens[0] ?? '') !== 'exec') return null;

  const redirects: ExecInputRedirect[] = [];
  for (let index = 1; index < commandTokens.length;) {
    const redirect = readInputRedirect(commandTokens, index);
    if (!redirect) return null;
    redirects.push(redirect);
    index = redirect.endIndex;
  }

  return redirects.length > 0 ? redirects : null;
}

function readInputRedirect(tokens: string[], index: number): ExecInputRedirect | null {
  const word = unquoteShellToken(tokens[index] ?? '');
  const fd = inputRedirectFd(word);
  if (fd === null) return null;
  if (/^\d*<&-$/.test(word)) return { fd, endIndex: index + 1 };
  if (/^\d*(?:<<<|<<-?|<)$/.test(word)) {
    return tokens[index + 1] ? { fd, endIndex: index + 2 } : null;
  }
  return { fd, endIndex: index + 1 };
}

function inputRedirectFd(word: string): number | null {
  const match = word.match(/^(\d*)(?:<<<|<<-?|<)/);
  if (!match) return null;
  return match[1] ? Number.parseInt(match[1], 10) : 0;
}
