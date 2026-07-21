export interface ArithmeticExpansionToken {
  endIndex: number;
  expression: string;
}

export function readArithmeticExpansionToken(
  token: string,
  startIndex: number,
): ArithmeticExpansionToken | null {
  if (token[startIndex] !== '$' || token[startIndex + 1] !== '(' || token[startIndex + 2] !== '(') {
    return null;
  }

  let quote: '"' | "'" | null = null;
  let groupDepth = 0;

  for (let index = startIndex + 3; index < token.length; index += 1) {
    const char = token[index];
    if (quote) {
      if (char === quote) quote = null;
      if (quote === '"' && char === '\\' && token[index + 1]) index += 1;
      continue;
    }

    if (char === '\\') {
      if (token[index + 1]) index += 1;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    const backtickEndIndex = backtickCommandSubstitutionEndIndex(token, index);
    if (backtickEndIndex >= 0) {
      index = backtickEndIndex;
      continue;
    }

    if (char === '(') groupDepth += 1;
    if (char !== ')') continue;
    if (groupDepth > 0) {
      groupDepth -= 1;
      continue;
    }
    if (token[index + 1] === ')') {
      return { expression: token.slice(startIndex + 3, index), endIndex: index + 1 };
    }
  }

  return null;
}

function backtickCommandSubstitutionEndIndex(token: string, index: number): number {
  if (token[index] !== '`') return -1;

  for (let endIndex = index + 1; endIndex < token.length; endIndex += 1) {
    if (token[endIndex] === '\\' && token[endIndex + 1]) {
      endIndex += 1;
      continue;
    }
    if (token[endIndex] === '`') return endIndex;
  }

  return -1;
}
