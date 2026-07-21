export function expandBashStartupTilde(
  value: string,
  variables: Map<string, string>,
  workingDir = '',
): string {
  if ((value === '~+' || value.startsWith('~+/')) && workingDir.startsWith('/')) {
    return `${workingDir}${value.slice(2)}`;
  }
  if (value !== '~' && !value.startsWith('~/')) return value;
  const home = variables.get('HOME');
  return home === undefined ? value : `${home}${value.slice(1)}`;
}

export function bashEnvStartupFilenameHasLiteralShellSyntax(value: string): boolean {
  return /["'\\<>]/.test(value);
}
