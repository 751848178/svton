const CONTROL_COMMAND_PREFIXES = new Set([
  'if',
  'then',
  'elif',
  'else',
  'while',
  'until',
  'do',
  '!',
]);

export function stripShellControlCommandPrefix(command: string): string {
  let current = command.trimStart();

  for (let depth = 0; depth < CONTROL_COMMAND_PREFIXES.size; depth += 1) {
    const match = current.match(/^(\S+)(?:\s+|$)/);
    if (!match || !CONTROL_COMMAND_PREFIXES.has(match[1])) return current;
    current = current.slice(match[0].length).trimStart();
  }

  return current;
}
