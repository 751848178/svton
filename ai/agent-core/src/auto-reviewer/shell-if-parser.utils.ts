import { getShellTokenBasename, normalizeShellWordToken, splitShellWords } from './shell-command.utils';
import {
  type ShellCommandListSeparator,
  splitShellCommandListSegmentItems,
  splitShellCommandListSegments,
} from './shell-command-list.utils';

export interface ShellIfCommand {
  condition: string;
  thenBody: string;
  elseBody: string;
}

export function shellIfStatement(statement: string): ShellIfCommand | null {
  const segments = splitShellCommandListSegmentItems(statement)
    .map((segment) => ({ ...segment, command: segment.command.trim() }))
    .filter((segment) => segment.command);
  const [first] = segments;
  if (!first || !/^if\b/.test(first.command)) return null;

  let phase: 'condition' | 'then' | 'else' = 'condition';
  const condition = [first.command.replace(/^if\b/, '').trim()];
  const thenSegments: string[] = [];
  const elseSegments: string[] = [];

  for (const segment of segments.slice(1)) {
    if (/^then\b/.test(segment.command)) {
      phase = 'then';
      pushKeywordRemainder(segment.command, /^then\b/, thenSegments);
      continue;
    }
    if (/^else\b/.test(segment.command)) {
      phase = 'else';
      pushKeywordRemainder(segment.command, /^else\b/, elseSegments);
      continue;
    }
    if (/^fi\b/.test(segment.command)) return {
      condition: joinShellParts(condition),
      thenBody: joinShellParts(thenSegments),
      elseBody: joinShellParts(elseSegments),
    };

    if (phase === 'condition') pushShellPart(condition, segment.separatorBefore, segment.command);
    else if (phase === 'then') pushShellPart(thenSegments, segment.separatorBefore, segment.command);
    else pushShellPart(elseSegments, segment.separatorBefore, segment.command);
  }

  return null;
}

export function isShellIfStatement(statement: string): boolean {
  return shellIfStatement(statement) !== null;
}

export function staticShellIfConditionResult(condition: string): boolean | null {
  const segments = splitShellCommandListSegments(condition);
  if (segments.length !== 1) return null;

  const tokens = splitShellWords(segments[0]).map(normalizeShellWordToken);
  const command = getShellTokenBasename(tokens[0] ?? '');
  if (command === 'true' || command === ':') return true;
  if (command === 'false') return false;
  if (command === 'test') return staticShellTestResult(tokens.slice(1));
  if (tokens[0] === '[' && tokens.at(-1) === ']') return staticShellTestResult(tokens.slice(1, -1));
  return null;
}

function staticShellTestResult(tokens: string[]): boolean | null {
  if (tokens.some((token) => /[$`*?[\]{}()<>|&;]/.test(token))) return null;
  if (tokens.length === 1) return tokens[0].length > 0;
  if (tokens.length === 2 && tokens[0] === '-n') return tokens[1].length > 0;
  if (tokens.length === 2 && tokens[0] === '-z') return tokens[1].length === 0;
  if (tokens.length === 2 && tokens[0] === '!') {
    const result = staticShellTestResult(tokens.slice(1));
    return result === null ? null : !result;
  }
  if (tokens.length === 3 && ['=', '==', '!='].includes(tokens[1])) {
    return tokens[1] === '!=' ? tokens[0] !== tokens[2] : tokens[0] === tokens[2];
  }
  return null;
}

function pushKeywordRemainder(segment: string, prefix: RegExp, target: string[]): void {
  const remainder = segment.replace(prefix, '').trim();
  pushShellPart(target, null, remainder);
}

function pushShellPart(
  target: string[],
  separator: ShellCommandListSeparator | null,
  command: string,
): void {
  if (!command) return;
  const prefix = separator ? `${separator} ` : '';
  target.push(`${prefix}${command}`);
}

function joinShellParts(parts: string[]): string {
  return parts.filter(Boolean).join(' ');
}
