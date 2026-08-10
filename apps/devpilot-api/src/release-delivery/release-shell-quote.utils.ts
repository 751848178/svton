export function quoteReleaseShell(value: string) {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}
