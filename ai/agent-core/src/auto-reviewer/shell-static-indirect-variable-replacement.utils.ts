const SHELL_VARIABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function bracedIndirectShellVariableReplacement(
  command: string,
  index: number,
  variables: [string, string][],
  unsetNames: string[],
): { value: string; length: number } | null {
  if (!command.startsWith('${!', index)) return null;

  for (const [name, indirectName] of variables) {
    const prefix = `\${!${name}}`;
    if (!command.startsWith(prefix, index)) continue;
    if (!SHELL_VARIABLE_NAME.test(indirectName)) return null;

    const target = variables.find(([targetName]) => targetName === indirectName);
    if (target) return { value: target[1], length: prefix.length };
    if (unsetNames.includes(indirectName)) return { value: '', length: prefix.length };
    return null;
  }

  return null;
}
