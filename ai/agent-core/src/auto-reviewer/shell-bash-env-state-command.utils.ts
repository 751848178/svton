import { getShellTokenBasename, unquoteShellToken } from './shell-command.utils';

type DeclarationCommandOptions = {
  allowLocalDeclarations?: boolean;
};

const DECLARATION_COMMANDS = new Set(['declare', 'export', 'readonly', 'typeset']);
const STATE_COMMANDS = new Set(['set', 'unset']);
const COMMAND_PRESERVING_OPTIONS = new Set(['-p']);
const COMMAND_QUERY_OPTIONS = new Set(['-v', '-V']);
const MAX_STATE_WRAPPER_DEPTH = 8;

export function bashEnvStateCommandTokens(
  tokens: string[],
  options: DeclarationCommandOptions,
  depth = 0,
): string[] {
  if (depth > MAX_STATE_WRAPPER_DEPTH) return [];

  const commandName = getShellTokenBasename(tokens[0] ?? '');
  if (isBashEnvStateCommand(commandName, options)) return tokens;
  if (commandName === 'command') return commandWrapperStateTokens(tokens, options, depth + 1);
  if (commandName === 'builtin') {
    return bashEnvStateCommandTokens(tokens.slice(1), options, depth + 1);
  }

  return [];
}

function commandWrapperStateTokens(
  tokens: string[],
  options: DeclarationCommandOptions,
  depth: number,
): string[] {
  for (let index = 1; index < tokens.length; index += 1) {
    const word = unquoteShellToken(tokens[index]);
    if (word === '--') {
      return bashEnvStateCommandTokens(tokens.slice(index + 1), options, depth);
    }
    if (COMMAND_QUERY_OPTIONS.has(word)) return [];
    if (COMMAND_PRESERVING_OPTIONS.has(word)) continue;
    if (word.startsWith('-')) return [];
    return bashEnvStateCommandTokens(tokens.slice(index), options, depth);
  }

  return [];
}

function isBashEnvStateCommand(
  commandName: string,
  options: DeclarationCommandOptions,
): boolean {
  return STATE_COMMANDS.has(commandName) || isBashEnvDeclarationCommand(commandName, options);
}

function isBashEnvDeclarationCommand(
  commandName: string,
  options: DeclarationCommandOptions,
): boolean {
  return DECLARATION_COMMANDS.has(commandName)
    || (options.allowLocalDeclarations === true && commandName === 'local');
}
