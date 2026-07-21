export interface ShellWhileUntilLoopCommand {
  kind: 'while' | 'until';
  condition: string;
  body: string;
}

const WHILE_UNTIL_LOOP_PATTERN = /^(while|until)\s+([\s\S]*?)(?:;|\n)\s*do\s+([\s\S]*?)(?:;|\n)\s*done$/;

export function shellWhileUntilLoopStatement(statement: string): ShellWhileUntilLoopCommand | null {
  const match = statement.trim().match(WHILE_UNTIL_LOOP_PATTERN);
  if (!match) return null;

  return {
    kind: match[1] as 'while' | 'until',
    condition: match[2].trim(),
    body: match[3].trim(),
  };
}

export function isShellWhileUntilLoopStatement(statement: string): boolean {
  return shellWhileUntilLoopStatement(statement) !== null;
}
