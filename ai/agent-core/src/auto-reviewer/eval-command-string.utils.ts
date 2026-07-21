import { getShellTokenBasename, normalizeShellWordToken, unquoteShellToken } from './shell-command.utils';
import { splitShellAssignmentPrefixes } from './shell-assignment-prefix.utils';
import { splitUnquotedIfsExpansionTokens } from './shell-ifs-word-splitting.utils';

export interface EvalCommandInvocation {
  assignmentPrefixes: string[];
  command: string;
  wrapper: 'builtin' | 'command' | null;
}

export function evalCommandString(tokens: string[]): string {
  const invocation = evalCommandInvocation(tokens);
  if (!invocation?.command) return '';

  return invocation.assignmentPrefixes.length > 0
    ? `${invocation.assignmentPrefixes.join('; ')}; ${invocation.command}`
    : invocation.command;
}

export function evalCommandInvocation(tokens: string[]): EvalCommandInvocation | null {
  const { assignmentPrefixes, commandTokens } = splitShellAssignmentPrefixes(tokens);
  const shellWords = splitUnquotedIfsExpansionTokens(commandTokens);
  const location = evalCommandLocation(shellWords);
  if (!location) return null;

  const startIndex = unquoteShellToken(shellWords[location.index + 1] ?? '') === '--'
    ? location.index + 2
    : location.index + 1;
  return {
    assignmentPrefixes,
    command: shellWords.slice(startIndex).map(normalizeShellWordToken).join(' ').trim(),
    wrapper: location.wrapper,
  };
}

interface EvalCommandLocation {
  index: number;
  wrapper: 'builtin' | 'command' | null;
}

function evalCommandLocation(tokens: string[]): EvalCommandLocation | null {
  let index = 0;
  let wrapper: EvalCommandLocation['wrapper'] = null;

  while (index < tokens.length) {
    const commandName = getShellTokenBasename(tokens[index] ?? '');
    if (commandName === 'eval') return { index, wrapper };
    if (commandName === 'builtin') {
      wrapper = 'builtin';
      index += 1;
      continue;
    }
    if (commandName !== 'command') return null;

    const commandIndex = commandWrapperCommandIndex(tokens, index);
    if (commandIndex < 0) return null;
    wrapper = 'command';
    index = commandIndex;
  }

  return null;
}

function commandWrapperCommandIndex(tokens: string[], startIndex: number): number {
  let index = startIndex + 1;
  for (; index < tokens.length; index += 1) {
    const option = unquoteShellToken(tokens[index]);
    if (option === '--') return index + 1;
    if (!option.startsWith('-')) return index;
    if (option !== '-p') return -1;
  }
  return -1;
}
