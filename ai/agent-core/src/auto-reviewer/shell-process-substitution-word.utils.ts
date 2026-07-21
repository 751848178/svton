export function splitShellWordsWithProcessSubstitutions(segment: string): string[] {
  const tokens: string[] = [];
  let token = '';
  let quote: '"' | "'" | null = null;
  let commandSubstitutionDepth = 0;
  let processSubstitutionDepth = 0;
  const trimmed = segment.trim();

  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index];
    if (quote) {
      token += char;
      if (char === quote) quote = null;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      token += char;
      continue;
    }

    if (char === '\\') {
      token += char;
      if (trimmed[index + 1]) token += trimmed[++index];
      continue;
    }

    if (processSubstitutionDepth > 0) {
      if (char === '(') processSubstitutionDepth += 1;
      if (char === ')') processSubstitutionDepth -= 1;
      token += char;
      continue;
    }

    if (commandSubstitutionDepth > 0) {
      if (char === '$' && trimmed[index + 1] === '(') {
        commandSubstitutionDepth += 1;
        token += '$(';
        index += 1;
        continue;
      }
      if (char === ')') commandSubstitutionDepth -= 1;
      token += char;
      continue;
    }

    if (char === '$' && trimmed[index + 1] === '(') {
      commandSubstitutionDepth = 1;
      token += '$(';
      index += 1;
      continue;
    }

    if ((char === '<' || char === '>') && trimmed[index + 1] === '(') {
      processSubstitutionDepth = 1;
      token += `${char}(`;
      index += 1;
      continue;
    }

    if (/\s/.test(char)) {
      if (token) tokens.push(token);
      token = '';
      continue;
    }

    token += char;
  }

  if (token) tokens.push(token);
  return tokens;
}
