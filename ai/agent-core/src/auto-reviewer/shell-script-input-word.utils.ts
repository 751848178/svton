import { commandSubstitutionOutputToken } from './command-substitution-token.utils';
import { normalizeShellWordToken } from './shell-command.utils';

export function scriptInputWordCommandString(token: string): string {
  return commandSubstitutionOutputToken(token)
    || normalizeShellWordToken(token).trim();
}
