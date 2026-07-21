import { hereDocCommandStrings, stripHereDocBodies } from './shell-here-doc-command.utils';
import { literalCommandOutputToken } from './literal-command-output.utils';
import {
  inputProcessSubstitutionCommands,
  inputProcessSubstitutionCommandsForFdRedirect,
} from './process-substitution.utils';
import { fdScriptInputCommandStrings } from './shell-fd-script-input-command.utils';
import { getShellTokenBasename, unquoteShellToken } from './shell-command.utils';
import { shellRedirectionCommandTokens } from './shell-redirection-command.utils';
import { shellScriptInvocation } from './shell-script-invocation.utils';
import { scriptInputWordCommandString } from './shell-script-input-word.utils';
import { splitUnquotedIfsExpansionTokens } from './shell-ifs-word-splitting.utils';
import { isShellStdinPath, shellFdPathNumber } from './shell-stdin-path.utils';
import { staticAssignmentCommandStrings } from './shell-static-assignment-command.utils';

const SHELL_SOURCE_COMMANDS = new Set(['source', '.']);

function hereStringScriptCommandStrings(tokens: string[]): string[] {
  const scripts: string[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const word = unquoteShellToken(token);
    if (word === '<<<') {
      const script = scriptInputWordCommandString(tokens[index + 1] ?? '');
      if (script) scripts.push(script);
      index += 1;
      continue;
    }

    if (token.startsWith('<<<')) {
      const script = scriptInputWordCommandString(token.slice(3));
      if (script) scripts.push(script);
    }
  }

  return scripts;
}

export { stripHereDocBodies } from './shell-here-doc-command.utils';

function sourceReadsStdin(tokens: string[]): boolean {
  if (!SHELL_SOURCE_COMMANDS.has(getShellTokenBasename(tokens[0] ?? ''))) return false;
  return tokens.slice(1).some(isShellStdinPath);
}

function sourceReadsProcessSubstitution(tokens: string[]): boolean {
  if (!SHELL_SOURCE_COMMANDS.has(getShellTokenBasename(tokens[0] ?? ''))) return false;
  return firstOperand(tokens, 1).startsWith('<(');
}

function sourceScriptFileOperand(tokens: string[]): string {
  return SHELL_SOURCE_COMMANDS.has(getShellTokenBasename(tokens[0] ?? '')) ? firstOperand(tokens, 1) : '';
}

function redirectsInputFromProcessSubstitution(tokens: string[]): boolean {
  return tokens.some((token, index) => {
    const word = unquoteShellToken(token);
    const next = unquoteShellToken(tokens[index + 1] ?? '');
    return word === '<' && next.startsWith('<(');
  });
}

function shellReadsStdin(tokens: string[], tokensStartWithShell: (tokens: string[]) => boolean): boolean {
  return shellScriptInvocation(tokens, tokensStartWithShell)?.readsStdin ?? false;
}

function shellReadsProcessSubstitution(tokens: string[], tokensStartWithShell: (tokens: string[]) => boolean): boolean {
  const invocation = shellScriptInvocation(tokens, tokensStartWithShell);
  return Boolean(invocation && !invocation.stdinOption && invocation.operand.startsWith('<('));
}

function shellScriptFileOperand(
  tokens: string[],
  tokensStartWithShell: (tokens: string[]) => boolean,
): string {
  const invocation = shellScriptInvocation(tokens, tokensStartWithShell);
  return invocation && !invocation.stdinOption ? invocation.operand : '';
}

function shellReadsInputProcessSubstitutionRedirect(
  tokens: string[],
  tokensStartWithShell: (tokens: string[]) => boolean,
): boolean {
  const invocation = shellScriptInvocation(tokens, tokensStartWithShell);
  return Boolean(invocation?.readsStdin && redirectsInputFromProcessSubstitution(tokens));
}

function sourceReadsInputProcessSubstitutionRedirect(tokens: string[]): boolean {
  return sourceReadsStdin(tokens) && redirectsInputFromProcessSubstitution(tokens);
}

function scriptFileFd(
  tokens: string[],
  tokensStartWithShell: (tokens: string[]) => boolean,
): number | null {
  const fd = shellFdPathNumber(
    shellScriptFileOperand(tokens, tokensStartWithShell) || sourceScriptFileOperand(tokens),
  );
  return fd === 0 ? null : fd;
}

function fdRedirectProcessCommands(
  segment: string,
  tokens: string[],
  tokensStartWithShell: (tokens: string[]) => boolean,
): string[] {
  const fd = scriptFileFd(tokens, tokensStartWithShell);
  return fd === null ? [] : inputProcessSubstitutionCommandsForFdRedirect(segment, fd);
}

function fdRedirectInputScripts(
  segment: string,
  tokens: string[],
  tokensStartWithShell: (tokens: string[]) => boolean,
): string[] {
  const fd = scriptFileFd(tokens, tokensStartWithShell);
  return fd === null ? [] : fdScriptInputCommandStrings(segment, tokens, fd);
}

function firstOperand(tokens: string[], startIndex: number): string {
  for (let index = Math.max(startIndex, 0); index < tokens.length; index += 1) {
    const word = unquoteShellToken(tokens[index]);
    if (isInputRedirectToken(word)) break;
    if (word.startsWith('-')) continue;
    return word;
  }

  return '';
}

function isInputRedirectToken(word: string): boolean {
  return word === '<'
    || word === '<<<'
    || word.startsWith('<<<')
    || /^<<-?/.test(word);
}

export function shellScriptInputCommandStrings(
  segment: string,
  tokens: string[],
  tokensStartWithShell: (tokens: string[]) => boolean,
): string[] {
  const shellWords = splitUnquotedIfsExpansionTokens(tokens);
  const commandTokens = shellRedirectionCommandTokens(shellWords);
  const canReadScriptFile = shellReadsProcessSubstitution(shellWords, tokensStartWithShell)
    || sourceReadsProcessSubstitution(shellWords)
    || shellReadsInputProcessSubstitutionRedirect(commandTokens, tokensStartWithShell)
    || sourceReadsInputProcessSubstitutionRedirect(commandTokens);
  const canReadStdin = shellReadsStdin(commandTokens, tokensStartWithShell)
    || sourceReadsStdin(commandTokens);

  const processScripts = (canReadScriptFile ? inputProcessSubstitutionCommands(segment) : [])
    .concat(fdRedirectProcessCommands(segment, shellWords, tokensStartWithShell));
  const stdinScripts = canReadStdin
    ? hereStringScriptCommandStrings(commandTokens).concat(hereDocCommandStrings(segment))
    : [];

  const scripts = processScripts
    .map(literalCommandOutputToken)
    .concat(stdinScripts)
    .concat(fdRedirectInputScripts(segment, shellWords, tokensStartWithShell))
    .concat(fdRedirectInputScripts(segment, commandTokens, tokensStartWithShell))
    .filter(Boolean);

  return scripts.concat(scripts.flatMap(staticAssignmentCommandStrings));
}
