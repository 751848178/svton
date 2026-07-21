import { commandSubstitutionOutputTokenResult } from './command-substitution-token.utils';
import { normalizeShellWordToken } from './shell-command.utils';
import { shellVariableReplacement } from './shell-static-variable-replacement.utils';

export function staticShellWordValue(token: string): string | null {
  const embeddedCommandSubstitutionValue = staticEmbeddedCommandSubstitutionShellWordValue(token);
  if (embeddedCommandSubstitutionValue !== undefined) return embeddedCommandSubstitutionValue;

  const commandSubstitutionValue = staticCommandSubstitutionShellWordValue(token);
  if (commandSubstitutionValue !== null) return commandSubstitutionValue;

  const value = normalizeShellWordToken(token);
  return staticLiteralShellWordValue(value);
}

function staticCommandSubstitutionShellWordValue(token: string): string | null {
  const outputToken = commandSubstitutionOutputTokenResult(token);
  return outputToken ? staticLiteralShellWordValue(outputToken.token) : null;
}

function staticEmbeddedCommandSubstitutionShellWordValue(token: string): string | null | undefined {
  let value = '';
  let quote: '"' | "'" | null = null;
  let literalStart = 0;
  let foundSubstitution = false;

  for (let index = 0; index < token.length; index += 1) {
    const char = token[index];
    if (quote === "'") {
      if (char === quote) quote = null;
      continue;
    }

    if (char === '\\') {
      if (token[index + 1]) index += 1;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = quote === char ? null : char;
      continue;
    }

    const substitution = readStaticCommandSubstitution(token, index);
    if (!substitution) continue;

    const literal = staticLiteralChunkValue(token.slice(literalStart, index));
    const substitutionValue = staticCommandSubstitutionShellWordValue(substitution.token);
    if (literal === null || substitutionValue === null) return null;

    value += literal + substitutionValue;
    foundSubstitution = true;
    index = substitution.endIndex;
    literalStart = substitution.endIndex + 1;
  }

  if (!foundSubstitution) return undefined;

  const trailingLiteral = staticLiteralChunkValue(token.slice(literalStart));
  if (trailingLiteral === null) return null;
  return staticLiteralShellWordValue(value + trailingLiteral);
}

function staticLiteralChunkValue(token: string): string | null {
  return staticLiteralShellWordValue(normalizeShellWordToken(token));
}

function readStaticCommandSubstitution(
  token: string,
  index: number,
): { token: string; endIndex: number } | null {
  if (token[index] === '`') return readBacktickCommandSubstitution(token, index);
  if (token[index] !== '$' || token[index + 1] !== '(') return null;

  const endIndex = findCommandSubstitutionEnd(token, index);
  return endIndex === -1 ? null : { token: token.slice(index, endIndex + 1), endIndex };
}

function readBacktickCommandSubstitution(
  token: string,
  index: number,
): { token: string; endIndex: number } | null {
  for (let endIndex = index + 1; endIndex < token.length; endIndex += 1) {
    if (token[endIndex] === '\\') {
      if (token[endIndex + 1]) endIndex += 1;
      continue;
    }
    if (token[endIndex] === '`') return { token: token.slice(index, endIndex + 1), endIndex };
  }

  return null;
}

function findCommandSubstitutionEnd(token: string, startIndex: number): number {
  let depth = 1;
  let quote: '"' | "'" | null = null;

  for (let index = startIndex + 2; index < token.length; index += 1) {
    const char = token[index];
    if (quote) {
      if (char === quote) quote = null;
      if (char === '\\' && token[index + 1]) index += 1;
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

    if (char === '$' && token[index + 1] === '(') {
      depth += 1;
      index += 1;
      continue;
    }

    if (char !== ')') continue;
    depth -= 1;
    if (depth === 0) return index;
  }

  return -1;
}

function staticLiteralShellWordValue(value: string): string | null {
  return /[$`*?[\]{}()<>|&;]/.test(value) ? null : value;
}

export function substituteStaticShellVariables(
  command: string,
  variables: Map<string, string>,
  unsetNames: Set<string> = new Set(),
): string {
  let output = '';
  let quote: '"' | "'" | null = null;
  const entries = [...variables.entries()].sort((left, right) => right[0].length - left[0].length);
  const unsetEntries = [...unsetNames].sort((left, right) => right.length - left.length);

  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    if (quote === "'") {
      output += char;
      if (char === quote) quote = null;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = quote === char ? null : char;
      output += char;
      continue;
    }

    if (char === '\\') {
      output += char;
      if (command[index + 1]) output += command[++index];
      continue;
    }

    const replacement = shellVariableReplacement(command, index, entries, unsetEntries);
    if (replacement) {
      output += replacement.value;
      index += replacement.length - 1;
      continue;
    }

    output += char;
  }

  return output;
}
