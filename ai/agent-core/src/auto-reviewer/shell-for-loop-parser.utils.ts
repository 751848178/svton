export interface StaticForLoopCommand {
  variableName: string;
  valuesText: string;
  body: string;
}

const STATIC_FOR_LOOP_PATTERN = /\bfor\s+([A-Za-z_]\w*)\s+in\s+([\s\S]*?)(?:;|\n)\s*do\s+([\s\S]*?)(?:;|\n)\s*done\b/g;
const STATIC_FOR_LOOP_STATEMENT_PATTERN = /^for\s+([A-Za-z_]\w*)\s+in\s+([\s\S]*?)(?:;|\n)\s*do\s+([\s\S]*?)(?:;|\n)\s*done$/;

export function staticForLoopCommands(command: string): StaticForLoopCommand[] {
  return [...command.matchAll(STATIC_FOR_LOOP_PATTERN)].map(staticForLoopCommandFromMatch);
}

export function staticForLoopStatement(statement: string): StaticForLoopCommand | null {
  const match = statement.trim().match(STATIC_FOR_LOOP_STATEMENT_PATTERN);
  return match ? staticForLoopCommandFromMatch(match) : null;
}

export function isStaticForLoopStatement(statement: string): boolean {
  return staticForLoopStatement(statement) !== null;
}

function staticForLoopCommandFromMatch(match: RegExpMatchArray): StaticForLoopCommand {
  const [, variableName, valuesText, body] = match;
  return { variableName, valuesText, body };
}
