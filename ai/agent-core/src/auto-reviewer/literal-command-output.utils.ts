import { base64OutputToken } from './base64-output-token.utils';
import { catHereDocOutputToken, catOutputToken } from './cat-output-token.utils';
import { ddHereDocOutputToken, ddOutputToken } from './dd-output-token.utils';
import { echoOutputToken } from './echo-output-token.utils';
import { firstEnvCommandTokens } from './env-command-token.utils';
import { lineFilterOutputToken } from './line-filter-output-token.utils';
import { printfOutputTokenResult } from './printf-output-token.utils';
import { teeHereDocOutputToken, teeOutputToken } from './tee-output-token.utils';
import {
  getShellTokenBasename,
  splitShellWords,
  unquoteShellToken,
} from './shell-command.utils';
import { unwrapShellGroupCommand } from './shell-group-command.utils';

const COMMAND_LITERAL_OPTIONS = new Set(['-p']);
const ATTACHED_HERE_STRING_COMMANDS = new Set(['base64', 'cat', 'dd', 'head', 'tail', 'tee']);
const MAX_COMMAND_WRAPPER_DEPTH = 8;
export type LiteralCommandOutputTokenResult = { token: string };

export function firstNonOptionToken(tokens: string[], startIndex: number): string {
  for (let index = startIndex; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (unquoteShellToken(token).startsWith('-')) continue;
    return token;
  }

  return '';
}

function evalCommandTokens(tokens: string[]): string[] {
  const startIndex = unquoteShellToken(tokens[1] ?? '') === '--' ? 2 : 1;
  const evaluated = tokens.slice(startIndex).map(unquoteShellToken).join(' ').trim();
  return evaluated ? splitShellWords(evaluated) : [];
}

function commandWrapperTokens(tokens: string[]): string[] {
  let current = tokens;
  for (let depth = 0; current.length > 0 && depth < MAX_COMMAND_WRAPPER_DEPTH; depth += 1) {
    const firstName = getShellTokenBasename(current[0]);
    if (firstName === 'builtin') {
      current = current.slice(1);
      continue;
    }
    if (firstName === 'env') {
      current = firstEnvCommandTokens(current);
      continue;
    }
    if (firstName === 'exec') {
      current = current.slice(1);
      continue;
    }
    if (firstName === 'eval') {
      current = evalCommandTokens(current);
      continue;
    }
    if (firstName !== 'command') return current;

    let index = 1;
    for (; index < current.length; index += 1) {
      const token = unquoteShellToken(current[index]);
      if (token === '--') {
        index += 1;
        break;
      }
      if (COMMAND_LITERAL_OPTIONS.has(token)) continue;
      if (token.startsWith('-')) return [];
      break;
    }

    current = current.slice(index);
  }

  return [];
}

export function literalCommandOutputToken(command: string): string {
  return literalCommandOutputTokenResult(command)?.token ?? '';
}

export function literalCommandOutputTokenResult(command: string): LiteralCommandOutputTokenResult | null {
  const unwrappedCommand = unwrapShellGroupCommand(command, { stripTrailingTerminator: true });
  const catHereDocToken = catHereDocOutputToken(unwrappedCommand);
  if (catHereDocToken !== null) return { token: catHereDocToken };
  const ddHereDocToken = ddHereDocOutputToken(unwrappedCommand);
  if (ddHereDocToken !== null) return { token: ddHereDocToken };
  const teeHereDocToken = teeHereDocOutputToken(unwrappedCommand);
  if (teeHereDocToken !== null) return { token: teeHereDocToken };

  const tokens = splitAttachedHereStringToken(
    commandWrapperTokens(
      splitShellWords(unwrappedCommand),
    ),
  );
  const first = tokens[0];
  if (!first) return null;

  const firstName = getShellTokenBasename(first);
  if (firstName === 'base64') {
    const token = base64OutputToken(tokens);
    return token === null ? null : { token };
  }
  if (firstName === 'cat') {
    const token = catOutputToken(tokens);
    return token === null ? null : { token };
  }
  if (firstName === 'dd') {
    const token = ddOutputToken(tokens);
    return token === null ? null : { token };
  }
  if (firstName === 'echo') return { token: echoOutputToken(tokens) };
  if (firstName === 'head' || firstName === 'tail') {
    const token = lineFilterOutputToken(tokens);
    return token === null ? null : { token };
  }
  if (firstName === 'printf') return printfOutputTokenResult(tokens);
  if (firstName === 'tee') {
    const token = teeOutputToken(tokens);
    return token === null ? null : { token };
  }

  return null;
}

function splitAttachedHereStringToken(tokens: string[]): string[] {
  const first = tokens[0];
  const operatorIndex = unquoteShellToken(first ?? '').indexOf('<<<');
  if (!first || operatorIndex <= 0) return tokens;

  const commandToken = first.slice(0, operatorIndex);
  if (!ATTACHED_HERE_STRING_COMMANDS.has(getShellTokenBasename(commandToken))) return tokens;

  return [commandToken, first.slice(operatorIndex), ...tokens.slice(1)];
}
