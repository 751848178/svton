const SHELL_GROUP_CLOSERS = new Map([
  ['(', ')'],
  ['{', '}'],
]);
const MAX_SHELL_GROUP_UNWRAP_DEPTH = 5;

interface ShellGroupUnwrapOptions {
  stripTrailingTerminator?: boolean;
}

function unwrapShellGroupOnce(command: string, options: ShellGroupUnwrapOptions): string {
  const trimmed = command.trim();
  const opener = trimmed[0];
  const closer = opener ? SHELL_GROUP_CLOSERS.get(opener) : undefined;
  if (!closer) return command;

  const inner = trimmed.slice(1).trim();
  if (!inner.endsWith(closer)) return command;

  const unwrapped = inner.slice(0, -1).trim();
  return opener === '{' && options.stripTrailingTerminator
    ? unwrapped.replace(/;$/, '').trim()
    : unwrapped;
}

export function unwrapShellGroupCommand(
  command: string,
  options: ShellGroupUnwrapOptions = {},
): string {
  let current = command;
  for (let depth = 0; depth < MAX_SHELL_GROUP_UNWRAP_DEPTH; depth += 1) {
    const next = unwrapShellGroupOnce(current, options);
    if (next === current) return current;
    current = next;
  }

  return current;
}
