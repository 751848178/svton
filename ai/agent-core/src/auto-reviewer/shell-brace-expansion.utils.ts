type BraceExpansion = {
  start: number;
  end: number;
  alternatives: string[];
};

export function braceExpandedShellTokens(token: string): string[] {
  const expansion = findUnquotedBraceExpansion(token);
  if (!expansion) return [token];

  const prefix = token.slice(0, expansion.start);
  const suffix = token.slice(expansion.end + 1);
  return expansion.alternatives.flatMap((alternative) => (
    braceExpandedShellTokens(`${prefix}${alternative}${suffix}`)
  ));
}

function findUnquotedBraceExpansion(token: string): BraceExpansion | null {
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < token.length; index += 1) {
    const char = token[index];
    if (quote) {
      if (char === '\\' && quote === '"' && token[index + 1]) index += 1;
      else if (char === quote) quote = null;
      continue;
    }

    if (char === '$' && token[index + 1] === "'") {
      quote = "'";
      index += 1;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '\\' && token[index + 1]) {
      index += 1;
      continue;
    }
    if (char === '{' && token[index - 1] !== '$') {
      const expansion = readBraceExpansion(token, index);
      if (expansion) return expansion;
    }
  }

  return null;
}

function readBraceExpansion(token: string, start: number): BraceExpansion | null {
  const alternatives: string[] = [];
  let current = '';
  let depth = 0;
  let quote: '"' | "'" | null = null;

  for (let index = start + 1; index < token.length; index += 1) {
    const char = token[index];
    if (quote) {
      current += char;
      if (char === '\\' && quote === '"' && token[index + 1]) {
        current += token[index + 1];
        index += 1;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '$' && token[index + 1] === "'") {
      current += "$'";
      quote = "'";
      index += 1;
      continue;
    }
    if (char === '"' || char === "'") {
      current += char;
      quote = char;
      continue;
    }
    if (char === '\\' && token[index + 1]) {
      current += `${char}${token[index + 1]}`;
      index += 1;
      continue;
    }
    if (char === '{' && token[index - 1] !== '$') {
      depth += 1;
      current += char;
      continue;
    }
    if (char === '}') {
      if (depth > 0) {
        depth -= 1;
        current += char;
        continue;
      }
      alternatives.push(current);
      return alternatives.length > 1 ? { start, end: index, alternatives } : null;
    }
    if (char === ',' && depth === 0) {
      alternatives.push(current);
      current = '';
      continue;
    }
    current += char;
  }

  return null;
}
