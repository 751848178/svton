import { getShellTokenBasename, unquoteShellToken } from './shell-command.utils';
import { xargsLiteralArgumentToken } from './xargs-literal-argument-token.utils';
import { xargsShortOptionClusterHasFlag } from './xargs-short-option.utils';

type OptionEndIndex = (tokens: string[], index: number) => number;

export function xargsLiteralReplacementIndexes(
  commandTokens: string[],
  xargsTokens: string[],
  optionEndIndex: OptionEndIndex,
): Set<number> | undefined {
  if (!xargsUsesLiteralInputDelimiter(xargsTokens, optionEndIndex)) return undefined;
  const commandStringIndexes = xargsShellCommandStringIndexes(commandTokens);
  return new Set(commandTokens.map((_, index) => index).filter((index) => !commandStringIndexes.has(index)));
}

export function xargsLiteralInputTargets(
  xargsTokens: string[],
  targets: string[],
  optionEndIndex: OptionEndIndex,
): string[] {
  return xargsUsesLiteralInputDelimiter(xargsTokens, optionEndIndex)
    ? targets.map(xargsLiteralArgumentToken)
    : targets;
}

function xargsUsesLiteralInputDelimiter(tokens: string[], optionEndIndex: OptionEndIndex): boolean {
  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === '--' || !token.startsWith('-')) return false;
    if (token === '-0' || token === '--null' || xargsShortOptionClusterHasFlag(token, '0')) return true;
    if (token === '-d' || token === '--delimiter' || token.startsWith('-d') || token.startsWith('--delimiter=')) return true;
    index = optionEndIndex(tokens, index);
  }
  return false;
}

function xargsShellCommandStringIndexes(tokens: string[]): Set<number> {
  const shellIndex = tokens.findIndex((token) => (
    ['ash', 'bash', 'dash', 'sh', 'zsh'].includes(getShellTokenBasename(unquoteShellToken(token)))
  ));
  const indexes = new Set<number>();
  if (shellIndex < 0) return indexes;
  for (let index = shellIndex + 1; index < tokens.length - 1; index += 1) {
    const token = unquoteShellToken(tokens[index]);
    if (token === '-c' || (/^-[^-]/.test(token) && token.includes('c'))) {
      indexes.add(index + 1);
      return indexes;
    }
    if (token === '--' || !token.startsWith('-')) return indexes;
  }
  return indexes;
}
