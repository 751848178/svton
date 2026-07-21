import { shellCaseStatement } from './shell-case-parser.utils';
import { splitShellSegments } from './shell-command.utils';

export function shellCaseBranchCommandStrings(command: string): string[] {
  const caseCommand = shellCaseStatement(command);
  if (caseCommand) {
    return caseCommand.branches.map((branch) => branch.body).filter(Boolean);
  }

  return splitShellSegments(command, (char) => /[;&\n]/.test(char))
    .map(shellCaseBranchCommandString)
    .filter(Boolean);
}

function shellCaseBranchCommandString(statement: string): string {
  const trimmed = statement.trim();
  if (!trimmed || trimmed === 'esac') return '';

  const caseMatch = trimmed.match(/^case\b[\s\S]*?\bin\b([\s\S]*)$/);
  const branch = (caseMatch?.[1] ?? trimmed).trim();
  const patternEnd = firstUnquotedPatternEnd(branch);
  if (patternEnd < 0) return '';

  const pattern = branch.slice(0, patternEnd);
  if (!caseMatch && hasUnquotedWhitespace(pattern)) return '';

  return branch.slice(patternEnd + 1).trim();
}

function firstUnquotedPatternEnd(text: string): number {
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (char === quote) quote = null;
      if (char === '\\') index += 1;
      continue;
    }

    if (char === '"' || char === "'") quote = char;
    if (char === ')') return index;
    if (char === '\\') index += 1;
  }

  return -1;
}

function hasUnquotedWhitespace(text: string): boolean {
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (char === quote) quote = null;
      if (char === '\\') index += 1;
      continue;
    }

    if (char === '"' || char === "'") quote = char;
    if (/\s/.test(char)) return true;
  }

  return false;
}
