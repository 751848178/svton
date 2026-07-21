import { readDoubleQuotedEscape } from './shell-quote-escape.utils';

const SHELL_GROUP_CLOSERS = new Map([
  ['(', ')'],
  ['{', '}'],
]);

const SHELL_LOOP_OPENERS = new Set(['for', 'select', 'while', 'until']);

export type ShellCommandListSeparator = ';' | '&' | '&&' | '||';

export interface ShellCommandListSegment {
  command: string;
  separatorBefore: ShellCommandListSeparator | null;
}

export function splitShellCommandListSegments(command: string): string[] {
  return splitShellCommandListSegmentItems(command).map((segment) => segment.command);
}

export function splitShellCommandListSegmentItems(command: string): ShellCommandListSegment[] {
  const segments: ShellCommandListSegment[] = [];
  let segment = '';
  let separatorBefore: ShellCommandListSeparator | null = null;
  let word = '';
  let wordStartedAtCommandPosition = true;
  let commandWordExpected = true;
  let quote: '"' | "'" | null = null;
  const groupClosers: string[] = [];
  let pendingLoopOpeners = 0;
  let loopDepth = 0;
  let pendingCaseOpeners = 0;
  let pendingCaseSubjectSeen = false;
  let caseDepth = 0;

  const flushWord = () => {
    if (!word) return;

    if (groupClosers.length === 0) {
      if (wordStartedAtCommandPosition && SHELL_LOOP_OPENERS.has(word)) {
        pendingLoopOpeners += 1;
      } else if (pendingLoopOpeners > 0 && word === 'do') {
        loopDepth += pendingLoopOpeners;
        pendingLoopOpeners = 0;
      } else if (wordStartedAtCommandPosition && loopDepth > 0 && word === 'done') {
        loopDepth -= 1;
      } else if (wordStartedAtCommandPosition && word === 'case') {
        pendingCaseOpeners += 1;
        pendingCaseSubjectSeen = false;
      } else if (pendingCaseOpeners > 0 && pendingCaseSubjectSeen && word === 'in') {
        caseDepth += pendingCaseOpeners;
        pendingCaseOpeners = 0;
        pendingCaseSubjectSeen = false;
      } else if (wordStartedAtCommandPosition && caseDepth > 0 && word === 'esac') {
        caseDepth -= 1;
      } else if (pendingCaseOpeners > 0) {
        pendingCaseSubjectSeen = true;
      }
      commandWordExpected = false;
    }

    word = '';
  };

  const appendWordChar = (char: string) => {
    if (!word) wordStartedAtCommandPosition = commandWordExpected;
    word += char;
  };
  const markPendingCaseSubject = () => {
    if (pendingCaseOpeners > 0 && !pendingCaseSubjectSeen) pendingCaseSubjectSeen = true;
  };

  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    if (quote) {
      const escaped = readDoubleQuotedEscape(command, index, quote);
      if (escaped) {
        segment += escaped.value;
        if (word) word += escaped.value;
        index = escaped.endIndex;
        continue;
      }
      segment += char;
      if (word) word += char;
      if (char === quote) quote = null;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      segment += char;
      if (word) word += char;
      else {
        markPendingCaseSubject();
        commandWordExpected = false;
      }
      continue;
    }

    if (char === '\\') {
      segment += char;
      if (word) word += char;
      else {
        markPendingCaseSubject();
        commandWordExpected = false;
      }
      if (command[index + 1]) {
        index += 1;
        segment += command[index];
        if (word) word += command[index];
      }
      continue;
    }

    const groupCloser = SHELL_GROUP_CLOSERS.get(char);
    if (groupCloser) {
      flushWord();
      groupClosers.push(groupCloser);
      segment += char;
      continue;
    }

    if (char === groupClosers[groupClosers.length - 1]) {
      flushWord();
      groupClosers.pop();
      segment += char;
      continue;
    }

    if (char === '!' && commandWordExpected) {
      segment += char;
      continue;
    }

    if (isShellKeywordChar(char)) {
      appendWordChar(char);
      segment += char;
      continue;
    }

    flushWord();

    const separator = readCommandListSeparator(command, index);
    if (groupClosers.length === 0 && separator) {
      if (loopDepth === 0 && pendingLoopOpeners === 0 && caseDepth === 0 && pendingCaseOpeners === 0) {
        if (segment.trim()) segments.push({ command: segment, separatorBefore });
        segment = '';
        separatorBefore = separator.value;
      } else {
        segment += command.slice(index, index + separator.length);
      }
      commandWordExpected = true;
      index += separator.length - 1;
      continue;
    }

    if (!/\s/.test(char)) {
      markPendingCaseSubject();
      commandWordExpected = false;
    }
    segment += char;
  }

  flushWord();
  if (segment.trim()) segments.push({ command: segment, separatorBefore });
  return segments;
}

function readCommandListSeparator(
  command: string,
  index: number,
): { value: ShellCommandListSeparator; length: number } | null {
  const char = command[index];
  if (char === ';' || char === '\n') return { value: ';', length: 1 };
  if (char === '&' && !['|', '<', '>'].includes(command[index - 1] ?? '')) {
    return command[index + 1] === '&'
      ? { value: '&&', length: 2 }
      : { value: '&', length: 1 };
  }
  if (char === '|' && command[index + 1] === '|') return { value: '||', length: 2 };
  return null;
}

function isShellKeywordChar(char: string): boolean {
  return /[A-Za-z0-9_]/.test(char);
}
