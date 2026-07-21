export function splitUnquotedIfsExpansionTokens(tokens: string[]): string[] {
  return tokens.flatMap(splitUnquotedIfsExpansionToken);
}

function splitUnquotedIfsExpansionToken(token: string): string[] {
  const fields: string[] = [];
  let field = '';
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < token.length; index += 1) {
    const char = token[index];
    if (quote) {
      field += char;
      if (quote === '"' && char === '\\' && token[index + 1]) {
        index += 1;
        field += token[index];
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      field += char;
      continue;
    }
    if (char === '\\' && token[index + 1]) {
      field += char;
      index += 1;
      field += token[index];
      continue;
    }

    const markerLength = ifsMarkerLengthAt(token, index);
    if (markerLength > 0) {
      if (field) fields.push(field);
      field = '';
      index += markerLength - 1;
      continue;
    }

    field += char;
  }

  if (field) fields.push(field);
  return fields;
}

function ifsMarkerLengthAt(token: string, index: number): number {
  if (token.startsWith('${IFS}', index)) return '${IFS}'.length;
  if (token.startsWith('$IFS', index) && !isShellNameChar(token[index + '$IFS'.length] ?? '')) {
    return '$IFS'.length;
  }
  return 0;
}

function isShellNameChar(char: string): boolean {
  return /^[A-Za-z0-9_]$/.test(char);
}
