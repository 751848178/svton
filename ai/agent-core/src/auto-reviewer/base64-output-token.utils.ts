import { stdinPassthroughOutputToken } from './cat-output-token.utils';
import { unquoteShellToken } from './shell-command.utils';

export function base64OutputToken(tokens: string[]): string | null {
  const optionState = base64DecodeOptionState();
  const input = stdinPassthroughOutputToken(tokens, {
    acceptExtraToken: optionState.acceptToken,
    isComplete: optionState.isComplete,
  });
  return input === null || !optionState.decodes() ? null : decodeBase64(input);
}

function base64DecodeOptionState(): {
  acceptToken: (token: string) => boolean;
  decodes: () => boolean;
  isComplete: () => boolean;
} {
  let decode = false;
  return {
    acceptToken: (token: string): boolean => {
      const word = unquoteShellToken(token);
      if (word === '-d' || word === '-D' || word === '--decode') {
        decode = true;
        return true;
      }
      return word === '--';
    },
    decodes: (): boolean => decode,
    isComplete: (): boolean => true,
  };
}

function decodeBase64(input: string): string | null {
  const normalized = input.replace(/\s/g, '');
  if (!normalized || /[^A-Za-z0-9+/=]/.test(normalized)) return null;
  if (normalized.length % 4 === 1) return null;

  try {
    return Buffer.from(normalized, 'base64').toString('utf8');
  } catch {
    return null;
  }
}
