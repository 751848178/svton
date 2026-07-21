const SHELL_ASSIGNMENT_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

function isShellAssignmentToken(token: string): boolean {
  return shellAssignmentPrefixName(token) !== null;
}

export function shellAssignmentPrefixName(token: string): string | null {
  const equalsIndex = token.indexOf('=');
  if (equalsIndex <= 0) return null;

  const name = token.slice(0, token[equalsIndex - 1] === '+' ? equalsIndex - 1 : equalsIndex);
  return SHELL_ASSIGNMENT_NAME_PATTERN.test(name) ? name : null;
}

export function splitShellAssignmentPrefixes(tokens: string[]): {
  assignmentPrefixes: string[];
  commandTokens: string[];
} {
  const commandIndex = tokens.findIndex((token) => !isShellAssignmentToken(token));
  return commandIndex >= 0
    ? { assignmentPrefixes: tokens.slice(0, commandIndex), commandTokens: tokens.slice(commandIndex) }
    : { assignmentPrefixes: tokens, commandTokens: [] };
}

export function withoutShellAssignmentPrefixes(tokens: string[]): string[] {
  return splitShellAssignmentPrefixes(tokens).commandTokens;
}
