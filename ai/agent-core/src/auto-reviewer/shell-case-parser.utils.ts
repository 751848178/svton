export interface ShellCaseBranch {
  patterns: string[];
  body: string;
}

export interface ShellCaseCommand {
  subject: string;
  branches: ShellCaseBranch[];
}

const CASE_STATEMENT_PATTERN = /^case\s+([\s\S]*?)\s+in\b([\s\S]*)\besac$/;

export function shellCaseStatement(statement: string): ShellCaseCommand | null {
  const match = statement.trim().match(CASE_STATEMENT_PATTERN);
  if (!match) return null;

  const [, subject, branchesText] = match;
  const branches = shellCaseBranches(branchesText.trim());
  return branches.length > 0 ? { subject: subject.trim(), branches } : null;
}

export function isShellCaseStatement(statement: string): boolean {
  return shellCaseStatement(statement) !== null;
}

export function matchingStaticCaseBranch(
  command: ShellCaseCommand,
  subject: string,
): ShellCaseBranch | null | undefined {
  for (const branch of command.branches) {
    let unknown = false;
    for (const pattern of branch.patterns) {
      const matched = staticCasePatternMatches(subject, pattern);
      if (matched === true) return branch;
      if (matched === null) unknown = true;
    }
    if (unknown) return null;
  }

  return undefined;
}

function shellCaseBranches(branchesText: string): ShellCaseBranch[] {
  const branches: ShellCaseBranch[] = [];
  let remaining = branchesText;

  while (remaining.trim()) {
    const patternEnd = firstUnquotedPatternEnd(remaining);
    if (patternEnd < 0) break;

    const patternText = remaining.slice(0, patternEnd).trim();
    const bodyAndRest = remaining.slice(patternEnd + 1);
    const terminator = firstUnquotedBranchTerminator(bodyAndRest);
    const body = bodyAndRest.slice(0, terminator?.index).trim();
    branches.push({ patterns: splitCasePatterns(patternText), body });
    if (!terminator) break;
    remaining = bodyAndRest.slice(terminator.index + terminator.length);
  }

  return branches.filter((branch) => branch.patterns.length > 0);
}

function firstUnquotedPatternEnd(text: string): number {
  return firstUnquotedIndex(text, (value, index) => value[index] === ')');
}

function firstUnquotedBranchTerminator(text: string): { index: number; length: number } | null {
  const index = firstUnquotedIndex(text, (value, offset) => value.startsWith(';;', offset));
  return index < 0 ? null : { index, length: 2 };
}

function splitCasePatterns(patternText: string): string[] {
  return splitUnquoted(patternText, '|').map((pattern) => pattern.trim()).filter(Boolean);
}

function staticCasePatternMatches(subject: string, pattern: string): boolean | null {
  if (pattern === '*') return true;
  if (!/^[A-Za-z0-9_./?*+-]+$/.test(pattern)) return null;

  const regex = new RegExp(`^${escapeRegex(pattern).replaceAll('\\*', '.*').replaceAll('\\?', '.')}$`);
  return regex.test(subject);
}

function escapeRegex(value: string): string {
  return value.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
}

function splitUnquoted(text: string, separator: string): string[] {
  const segments: string[] = [];
  let segment = '';
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      segment += char;
      if (char === quote) quote = null;
      if (char === '\\') segment += text[++index] ?? '';
      continue;
    }

    if (char === '"' || char === "'") quote = char;
    if (char === separator) {
      segments.push(segment);
      segment = '';
      continue;
    }
    if (char === '\\') {
      segment += char;
      segment += text[++index] ?? '';
      continue;
    }
    segment += char;
  }

  segments.push(segment);
  return segments;
}

function firstUnquotedIndex(
  text: string,
  predicate: (text: string, index: number) => boolean,
  visit?: (char: string) => void,
): number {
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      visit?.(char);
      if (char === quote) quote = null;
      if (char === '\\') {
        index += 1;
        visit?.(text[index] ?? '');
      }
      continue;
    }

    if (char === '"' || char === "'") quote = char;
    if (predicate(text, index)) return index;
    if (char === '\\') {
      visit?.(char);
      index += 1;
      visit?.(text[index] ?? '');
      continue;
    }
    visit?.(char);
  }

  return -1;
}
