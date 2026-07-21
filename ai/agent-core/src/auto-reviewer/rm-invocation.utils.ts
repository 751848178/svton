import {
  commandSubstitutionTokenResolvesToCommand,
  expandLeadingCommandSubstitutionTokens,
} from './command-substitution-token.utils';
import { getShellTokenBasename, normalizeShellWordToken } from './shell-command.utils';
import { shellExecutableCommandTokens } from './shell-executable-command.utils';
import { splitUnquotedIfsExpansionTokens } from './shell-ifs-word-splitting.utils';

const RM_COMMANDS = new Set(['rm']);
const MAX_RM_WRAPPER_DEPTH = 8;
const RM_TERMINATING_LONG_OPTIONS = new Set(['--help', '--version']);
const RM_LONG_OPTIONS_WITHOUT_DELETE_EFFECT = new Set([
  '--one-file-system',
  '--no-preserve-root',
  '--verbose',
  '--dir',
]);
const RM_LONG_OPTIONS_WITH_OPTIONAL_ARGUMENT = new Set(['--interactive', '--preserve-root']);
const RM_LONG_OPTION_FLAGS = new Map([
  ['--force', 'f'],
  ['--recursive', 'r'],
]);

export function dangerousRmInvocations(tokens: string[]): Array<{ targets: string[] }> {
  const commandTokens = rmCommandTokens(splitUnquotedIfsExpansionTokens(tokens));
  if (commandTokens.length === 0) return [];

  const targets = dangerousRmTargetsAfterToken(commandTokens, 0);
  return targets ? [{ targets }] : [];
}

function rmCommandTokens(tokens: string[], depth = 0): string[] {
  if (depth > MAX_RM_WRAPPER_DEPTH) return [];

  const first = tokens[0];
  if (!first) return [];
  if (isRmExecutableToken(first)) return tokens;

  const substitutionTokens = expandLeadingCommandSubstitutionTokens(tokens);
  if (substitutionTokens !== tokens) return rmCommandTokens(substitutionTokens, depth + 1);

  const executableTokens = shellExecutableCommandTokens(tokens);
  if (executableTokens !== tokens) return rmCommandTokens(executableTokens, depth + 1);

  return [];
}

function dangerousRmTargetsAfterToken(tokens: string[], index: number): string[] | null {
  const targets: string[] = [];
  let flags = '';
  let cursor = index + 1;
  let option = normalizeShellWordToken(tokens[cursor] ?? '');

  while (cursor < tokens.length && option.startsWith('-') && option !== '--') {
    if (option.startsWith('--')) {
      const longOptionFlags = rmLongOptionFlags(option);
      if (longOptionFlags === null) return null;
      flags += longOptionFlags;
    } else {
      flags += option.slice(1);
    }
    cursor += 1;
    option = normalizeShellWordToken(tokens[cursor] ?? '');
  }

  if (option === '--') cursor += 1;
  if (!/[rR]/.test(flags) || !flags.includes('f')) return null;

  for (; cursor < tokens.length; cursor += 1) {
    if (tokens[cursor] !== '--') targets.push(tokens[cursor]);
  }

  return targets;
}

function isRmExecutableToken(token: string): boolean {
  return getShellTokenBasename(token) === 'rm'
    || commandSubstitutionTokenResolvesToCommand(token, RM_COMMANDS);
}

function rmLongOptionFlags(option: string): string | null {
  if (RM_TERMINATING_LONG_OPTIONS.has(option)) return null;
  const optionName = option.split('=', 1)[0] ?? option;
  if (RM_LONG_OPTION_FLAGS.has(optionName)) {
    return option.includes('=') ? null : RM_LONG_OPTION_FLAGS.get(optionName) ?? '';
  }
  if (RM_LONG_OPTIONS_WITHOUT_DELETE_EFFECT.has(optionName)) return option.includes('=') ? null : '';
  return RM_LONG_OPTIONS_WITH_OPTIONAL_ARGUMENT.has(optionName) ? '' : null;
}
