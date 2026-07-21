import { splitShellAssignmentPrefixes } from './shell-assignment-prefix.utils';
import { unquoteShellToken } from './shell-command.utils';

export function moveLeadingFdInputRedirectsAfterCommand(tokens: string[]): string[] {
  const { assignmentPrefixes, commandTokens } = splitShellAssignmentPrefixes(tokens);
  const leadingRedirects: string[] = [];
  let index = 0;

  for (;;) {
    const endIndex = fdInputRedirectEndIndex(commandTokens, index);
    if (endIndex === null) break;
    leadingRedirects.push(...commandTokens.slice(index, endIndex));
    index = endIndex;
  }

  if (leadingRedirects.length === 0 || index >= commandTokens.length) return tokens;
  return [
    ...assignmentPrefixes,
    commandTokens[index],
    ...leadingRedirects,
    ...commandTokens.slice(index + 1),
  ];
}

function fdInputRedirectEndIndex(tokens: string[], index: number): number | null {
  const word = unquoteShellToken(tokens[index] ?? '');
  if (/^\d+<<<$/.test(word) && tokens[index + 1]) return index + 2;
  if (/^\d+<<<.+/.test(word)) return index + 1;
  if (/^\d+<<-?$/.test(word) && tokens[index + 1]) return index + 2;
  if (/^\d+<<-?[^<].*/.test(word)) return index + 1;
  if (/^\d+<$/.test(word) && tokens[index + 1]) return index + 2;
  if (/^\d+<[^<].*/.test(word)) return index + 1;
  return null;
}
