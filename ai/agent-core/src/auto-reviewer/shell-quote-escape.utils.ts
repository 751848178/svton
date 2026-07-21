export function readDoubleQuotedEscape(
  source: string,
  index: number,
  quote: '"' | "'" | null,
): { value: string; endIndex: number } | null {
  const next = source[index + 1];
  return quote === '"' && source[index] === '\\' && next
    ? { value: `${source[index]}${next}`, endIndex: index + 1 }
    : null;
}
