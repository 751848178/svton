import { isEscaped, readSubstitutionCommand } from './process-substitution.utils';

export function inputProcessSubstitutionCommandsForStdinRedirect(segment: string): string[] {
  const commands: string[] = [];
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < segment.length - 2; index += 1) {
    const char = segment[index];
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (
      char !== '<'
      || segment[index + 1] === '<'
      || !hasDefaultRedirectBoundaryBefore(segment, index)
      || isEscaped(segment, index)
    ) continue;

    let cursor = index + 1;
    while (/\s/.test(segment[cursor] ?? '')) cursor += 1;
    if (segment[cursor] !== '<' || segment[cursor + 1] !== '(') continue;

    const command = readSubstitutionCommand(segment, cursor + 2);
    if (command) commands.push(command);
  }

  return commands;
}

function hasDefaultRedirectBoundaryBefore(segment: string, index: number): boolean {
  const before = segment[index - 1] ?? '';
  return !before || /[\s|;&(]/.test(before);
}
