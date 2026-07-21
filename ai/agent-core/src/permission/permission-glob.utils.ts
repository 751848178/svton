export function matchesPermissionGlob(pattern: string, text: string): boolean {
  return new RegExp(`^${globToRegexSource(pattern)}$`).test(text);
}

function globToRegexSource(pattern: string): string {
  return Array.from(pattern, (char) => {
    if (char === '*') return '.*';
    if (char === '?') return '.';
    return escapeRegexChar(char);
  }).join('');
}

function escapeRegexChar(char: string): string {
  return /[\\^$+?.()|{}\[\]]/.test(char) ? `\\${char}` : char;
}
