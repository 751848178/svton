import { unquoteShellToken } from './shell-command.utils';
import { xargsLiteralArgumentToken } from './xargs-literal-argument-token.utils';

export function expandXargsReplacementTokens(
  tokens: string[],
  marker: string,
  replacement: string,
  literalReplacementIndexes?: Set<number>,
): string[] {
  return tokens.map((token, index) => {
    const shellWord = unquoteShellToken(token);
    const value = literalReplacementIndexes?.has(index)
      ? xargsLiteralArgumentToken(replacement)
      : replacement;
    return shellWord.includes(marker) ? shellWord.split(marker).join(value) : token;
  });
}

export function expandXargsBsdReplacementTokens(
  tokens: string[],
  marker: string,
  replacements: string[],
): string[] {
  let replaced = false;

  const expanded = tokens.flatMap((token) => {
    const shellWord = unquoteShellToken(token);
    if (!shellWord.includes(marker)) return [token];
    replaced = true;
    return shellWord === marker
      ? replacements
      : [shellWord.split(marker).join(replacements.join(' '))];
  });

  return replaced ? expanded : [...tokens, ...replacements];
}
