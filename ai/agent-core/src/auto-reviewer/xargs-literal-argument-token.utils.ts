export function xargsLiteralArgumentToken(value: string): string {
  return [...value].map((char) => {
    if (char === '\\') return '\\'.repeat(4);
    if (char === '"' || char === "'") return `${'\\'.repeat(3)}${char}`;
    return char;
  }).join('');
}
