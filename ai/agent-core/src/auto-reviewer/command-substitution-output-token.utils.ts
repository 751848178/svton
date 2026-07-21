import { commandSubstitutionOutputToken } from './command-substitution-token.utils';
import { splitShellWords } from './shell-command.utils';

export function commandSubstitutionOutputTokens(token: string): string[] {
  if (token.startsWith("'") && token.endsWith("'")) return [token];

  const outputToken = commandSubstitutionOutputToken(token);
  if (!outputToken) return [token];
  if (token.startsWith('"') && token.endsWith('"')) return [outputToken];

  const outputTokens = splitShellWords(outputToken);
  return outputTokens.length > 0 ? outputTokens : [token];
}
