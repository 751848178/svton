import {
  type ShellCommandListSegment,
  type ShellCommandListSeparator,
  splitShellCommandListSegmentItems,
} from './shell-command-list.utils';

export interface StaticAssignmentCommandStatement {
  statement: string;
  operatorBefore: ShellCommandListSeparator | null;
}

export function splitStaticAssignmentCommandStatements(command: string): StaticAssignmentCommandStatement[] {
  const segments = splitShellCommandListSegmentItems(command);
  const statements: StaticAssignmentCommandStatement[] = [];

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index].command;
    if (!isIfSegment(segment)) {
      statements.push({
        statement: segment,
        operatorBefore: segments[index].separatorBefore,
      });
      continue;
    }

    const grouped = [segments[index]];
    let depth = 1;
    while (index + 1 < segments.length && depth > 0) {
      index += 1;
      const next = segments[index].command;
      if (isIfSegment(next)) depth += 1;
      if (isFiSegment(next)) depth -= 1;
      grouped.push(segments[index]);
    }

    statements.push({
      statement: joinStatementSegments(grouped),
      operatorBefore: segments[index - grouped.length + 1].separatorBefore,
    });
  }

  return statements;
}

function isIfSegment(segment: string): boolean {
  return /^\s*(?:!\s+)*if\b/.test(segment);
}

function isFiSegment(segment: string): boolean {
  return /^\s*fi\b/.test(segment);
}

function joinStatementSegments(segments: ShellCommandListSegment[]): string {
  return segments.map((segment, index) => {
    if (index === 0 || !segment.separatorBefore) return segment.command;
    return `${segment.separatorBefore} ${segment.command}`;
  }).join(' ');
}
