import {
  stdinPassthroughHereDocOutputToken,
  stdinPassthroughOutputToken,
} from './cat-output-token.utils';
import { unquoteShellToken } from './shell-command.utils';

const TEE_COMMANDS = new Set(['tee']);

export function teeOutputToken(tokens: string[]): string | null {
  return stdinPassthroughOutputToken(tokens, { acceptExtraToken: teeExtraTokenAcceptor() });
}

export function teeHereDocOutputToken(command: string): string | null {
  return stdinPassthroughHereDocOutputToken(command, TEE_COMMANDS, {
    acceptExtraToken: teeExtraTokenAcceptor(),
  });
}

function teeExtraTokenAcceptor(): (token: string) => boolean {
  let optionsEnded = false;
  return (token: string): boolean => {
    const word = unquoteShellToken(token);
    if (optionsEnded) return true;
    if (word === '--') {
      optionsEnded = true;
      return true;
    }
    if (!word.startsWith('-')) return true;
    return /^-[aip]+$/.test(word)
      || word === '--append'
      || word === '--ignore-interrupts'
      || word === '--output-error'
      || word.startsWith('--output-error=');
  };
}
