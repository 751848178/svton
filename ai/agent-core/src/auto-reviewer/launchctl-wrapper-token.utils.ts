import { unquoteShellToken } from './shell-command.utils';

const SUBMIT_ARGUMENT_OPTIONS = new Set(['l', 'p', 'o', 'e']);

type SubmitOptionParseResult = {
  option: string;
  value: string;
  consumesNext: boolean;
} | null;

export function launchctlWrapperTokens(tokens: string[]): string[] {
  const subcommand = unquoteShellToken(tokens[1] ?? '');
  if (subcommand === 'asuser') return launchctlAsuserTokens(tokens);
  if (subcommand === 'bsexec') return launchctlBsexecTokens(tokens);
  if (subcommand === 'submit') return launchctlSubmitTokens(tokens);

  return [];
}

function launchctlAsuserTokens(tokens: string[]): string[] {
  const uid = unquoteShellToken(tokens[2] ?? '');
  if (!/^\d+$/.test(uid)) return [];

  return tokens[3] ? tokens.slice(3) : [];
}

function launchctlBsexecTokens(tokens: string[]): string[] {
  const targetPid = unquoteShellToken(tokens[2] ?? '');
  if (!targetPid) return [];

  return tokens[3] ? tokens.slice(3) : [];
}

function launchctlSubmitTokens(tokens: string[]): string[] {
  let labelSeen = false;
  let programToken = '';

  for (let index = 2; index < tokens.length; index += 1) {
    const token = unquoteShellToken(tokens[index]);
    if (token === '--') return launchctlSubmitCommandTokens(tokens, index + 1, labelSeen, programToken);
    if (!token.startsWith('-')) return launchctlSubmitCommandTokens(tokens, index, labelSeen, programToken);

    const option = parseLaunchctlSubmitOption(tokens[index], tokens[index + 1] ?? '');
    if (!option) return [];
    if (option.option === 'l') labelSeen = true;
    if (option.option === 'p') programToken = option.value;
    if (option.consumesNext) index += 1;
  }

  return [];
}

function parseLaunchctlSubmitOption(token: string, nextToken: string): SubmitOptionParseResult {
  const normalized = unquoteShellToken(token);
  if (!normalized.startsWith('-') || normalized.startsWith('--') || normalized.length < 2) return null;

  const option = normalized[1];
  if (!SUBMIT_ARGUMENT_OPTIONS.has(option)) return null;

  const inlineValue = normalized.slice(2);
  if (inlineValue) return { option, value: inlineValue, consumesNext: false };

  const nextValue = unquoteShellToken(nextToken);
  return nextValue ? { option, value: nextToken, consumesNext: true } : null;
}

function launchctlSubmitCommandTokens(
  tokens: string[],
  commandIndex: number,
  labelSeen: boolean,
  programToken: string,
): string[] {
  if (!labelSeen || !tokens[commandIndex]) return [];
  if (!programToken) return tokens.slice(commandIndex);

  return tokens[commandIndex + 1] ? [programToken, ...tokens.slice(commandIndex + 1)] : [programToken];
}
