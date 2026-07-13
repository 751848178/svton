export function shellQuote(value: string): string {
  if (/^[A-Za-z0-9@%+=:,./_-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export function readSafeGitRefs(
  base?: string,
  head?: string,
): { base?: string; head?: string; error?: string } {
  if ((base !== undefined && isUnsafeGitRef(base)) || (head !== undefined && isUnsafeGitRef(head))) {
    return { error: 'Error: invalid git ref: refs must not be empty or start with "-".' };
  }
  return { base, head };
}

function isUnsafeGitRef(value: string): boolean {
  return value.length === 0 || value.startsWith('-');
}
