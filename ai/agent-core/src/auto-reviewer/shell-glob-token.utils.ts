export function hasUnquotedShellGlob(token: string, extglobEnabled = false): boolean {
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
    if ((char === '@' || char === '+' || char === '!') && token[index + 1] === '(') {
      if (extglobEnabled) return true;
      index = skipExtglobLikeGroup(token, index + 1);
      continue;
    }
    if (char === '*' || char === '?' || char === '[') return true;
  }

  return false;
}

function skipExtglobLikeGroup(token: string, openIndex: number): number {
  let depth = 0;
  for (let index = openIndex; index < token.length; index += 1) {
    if (token[index] === '(') depth += 1;
    if (token[index] === ')') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return openIndex;
}
