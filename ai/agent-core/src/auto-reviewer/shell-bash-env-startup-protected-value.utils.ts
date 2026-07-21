import { readBacktickCommandSubstitution, readDollarCommandSubstitution } from './command-substitution-embedded-token.utils';
import { shellVariableReplacement } from './shell-static-variable-replacement.utils';

export interface ProtectedStartupValue {
  value: string;
  hasProtectedShellSyntax: boolean;
}

export function substituteBashEnvStartupVariables(
  value: string,
  variables: Map<string, string>,
): ProtectedStartupValue {
  const entries = [...variables.entries()].sort((left, right) => right[0].length - left[0].length);
  let output = '';
  let quote: '"' | "'" | null = null;
  let hasProtectedShellSyntax = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
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
      if (value[index + 1]) output += value[++index];
      continue;
    }

    const commandSubstitution = readDollarCommandSubstitution(value, index)
      ?? readBacktickCommandSubstitution(value, index);
    if (commandSubstitution) {
      output += value.slice(index, commandSubstitution.endIndex + 1);
      index = commandSubstitution.endIndex;
      continue;
    }

    const replacement = shellVariableReplacement(value, index, entries);
    if (replacement) {
      hasProtectedShellSyntax ||= bashEnvProtectedValueHasShellSyntax(replacement.value);
      output += `\x01${replacement.value}\x02`;
      index += replacement.length - 1;
      continue;
    }
    if (value[index + 1] === '{') {
      const endIndex = value.indexOf('}', index + 2);
      if (endIndex !== -1) {
        output += value.slice(index, endIndex + 1);
        index = endIndex;
        continue;
      }
    }

    output += char;
  }

  return { value: output, hasProtectedShellSyntax };
}

export function bashEnvProtectedValueHasShellSyntax(value: string): boolean {
  return /[$`;&|<>\s]/.test(value);
}
