export function xargsReplacementLineBatches(input: string): string[][] {
  return xargsReplacementLines(input).map((line) => [line]);
}

export function xargsReplacementLines(input: string): string[] {
  const lines: string[] = [];

  for (const rawLine of input.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    if (xargsLineHasUnclosedQuote(line)) break;
    lines.push(line);
  }

  return lines;
}

function xargsLineHasUnclosedQuote(input: string): boolean {
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '\\') {
      if (index + 1 < input.length) index += 1;
      continue;
    }
    if (char === '"' || char === "'") quote = char;
  }

  return quote !== null;
}
