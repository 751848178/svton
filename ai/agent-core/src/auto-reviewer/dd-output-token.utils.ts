import {
  stdinPassthroughHereDocOutputToken,
  stdinPassthroughOutputToken,
} from './cat-output-token.utils';
import { unquoteShellToken } from './shell-command.utils';

const DD_COMMANDS = new Set(['dd']);

export function ddOutputToken(tokens: string[]): string | null {
  return stdinPassthroughOutputToken(tokens, { acceptExtraToken: acceptsDdExtraToken });
}

export function ddHereDocOutputToken(command: string): string | null {
  return stdinPassthroughHereDocOutputToken(command, DD_COMMANDS, {
    acceptExtraToken: acceptsDdExtraToken,
  });
}

function acceptsDdExtraToken(token: string): boolean {
  const word = unquoteShellToken(token);
  return word === 'status=none' || word === 'status=noxfer';
}
