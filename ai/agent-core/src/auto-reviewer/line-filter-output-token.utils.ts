import { stdinPassthroughOutputToken } from './cat-output-token.utils';
import { getShellTokenBasename, unquoteShellToken } from './shell-command.utils';

const PASSTHROUGH_LINE_COUNTS = new Set(['1']);
const TAIL_PASSTHROUGH_LINE_COUNTS = new Set(['1', '+1']);

export function lineFilterOutputToken(tokens: string[]): string | null {
  const commandName = getShellTokenBasename(tokens[0] ?? '');
  if (commandName !== 'head' && commandName !== 'tail') return null;

  const optionState = lineFilterOptionState(commandName);
  return stdinPassthroughOutputToken(tokens, {
    acceptExtraToken: optionState.acceptToken,
    isComplete: optionState.isComplete,
  });
}

function lineFilterOptionState(commandName: 'head' | 'tail'): {
  acceptToken: (token: string) => boolean;
  isComplete: () => boolean;
} {
  let pendingLineCount = false;
  return {
    acceptToken: (token: string): boolean => {
      const word = unquoteShellToken(token);
      if (pendingLineCount) {
        pendingLineCount = false;
        return isPassthroughLineCount(commandName, word);
      }
      if (word === '--') return true;
      if (word === '-n' || word === '--lines') {
        pendingLineCount = true;
        return true;
      }
      if (word.startsWith('--lines=')) {
        return isPassthroughLineCount(commandName, word.slice('--lines='.length));
      }
      if (/^-\d+$/.test(word)) return isPassthroughLineCount(commandName, word.slice(1));
      if (/^-n[+]?\d+$/.test(word)) return isPassthroughLineCount(commandName, word.slice(2));
      return false;
    },
    isComplete: (): boolean => !pendingLineCount,
  };
}

function isPassthroughLineCount(commandName: 'head' | 'tail', value: string): boolean {
  const counts = commandName === 'tail' ? TAIL_PASSTHROUGH_LINE_COUNTS : PASSTHROUGH_LINE_COUNTS;
  return counts.has(value);
}
