import { bracedIndirectShellVariableReplacement } from './shell-static-indirect-variable-replacement.utils';
import { bracedParameterSubstitutionReplacement } from './shell-static-parameter-substitution.utils';

export function shellVariableReplacement(
  command: string,
  index: number,
  variables: [string, string][],
  unsetNames: string[] = [],
): { value: string; length: number } | null {
  if (command[index] !== '$') return null;

  const indirect = bracedIndirectShellVariableReplacement(command, index, variables, unsetNames);
  if (indirect) return indirect;

  for (const [name, value] of variables) {
    const braced = bracedShellVariableReplacement(command, index, name, value);
    if (braced) return braced;
    if (!command.startsWith(name, index + 1)) continue;

    const next = command[index + name.length + 1] ?? '';
    if (!/[A-Za-z0-9_]/.test(next)) return { value, length: name.length + 1 };
  }

  for (const name of unsetNames) {
    const replacement = bracedUnsetAlternateReplacement(command, index, name);
    if (replacement) return replacement;
  }

  return null;
}

function bracedShellVariableReplacement(
  command: string,
  index: number,
  name: string,
  value: string,
): { value: string; length: number } | null {
  const prefix = `\${${name}`;
  if (!command.startsWith(prefix, index)) return null;

  const operatorIndex = index + prefix.length;
  if (command.startsWith('[0]}', operatorIndex)) return { value, length: name.length + 6 };
  if (command[operatorIndex] === '}') return { value, length: name.length + 3 };

  const substitution = bracedParameterSubstitutionReplacement(command, index, value, operatorIndex);
  if (substitution) return substitution;

  const substring = bracedSubstringReplacement(command, index, value, operatorIndex);
  if (substring) return substring;

  const patternRemoval = bracedPatternRemovalReplacement(command, index, value, operatorIndex);
  if (patternRemoval) return patternRemoval;

  const operator = bracedParameterOperator(command, operatorIndex);
  if (!operator) return null;

  const endIndex = command.indexOf('}', operatorIndex + operator.length);
  if (endIndex === -1) return null;
  const length = endIndex - index + 1;
  if (operator === ':+') return { value: value === '' ? '' : command.slice(operatorIndex + 2, endIndex), length };
  if (operator === '+') return { value: command.slice(operatorIndex + 1, endIndex), length };
  if (operator === ':?') return { value: value === '' ? '' : value, length };
  if (operator === '?') return { value, length };
  if (defaultOperatorUsesFallbackForKnownValue(operator, value)) return null;

  return { value, length };
}

type BracedDefaultOperator = ':-' | '-' | ':=' | '=';
type BracedParameterOperator = BracedDefaultOperator | ':+' | '+' | ':?' | '?';
type BracedPatternRemovalOperator = '%' | '%%' | '#' | '##';

function bracedParameterOperator(command: string, index: number): BracedParameterOperator | null {
  if (command.startsWith(':-', index)) return ':-';
  if (command.startsWith(':=', index)) return ':=';
  if (command.startsWith(':+', index)) return ':+';
  if (command.startsWith(':?', index)) return ':?';
  if (command[index] === '=') return '=';
  if (command[index] === '+') return '+';
  if (command[index] === '?') return '?';
  return command[index] === '-' ? '-' : null;
}

function defaultOperatorUsesFallbackForKnownValue(operator: BracedDefaultOperator, value: string): boolean {
  return (operator === ':-' || operator === ':=') && value === '';
}

function bracedSubstringReplacement(
  command: string,
  index: number,
  value: string,
  operatorIndex: number,
): { value: string; length: number } | null {
  const match = command.slice(operatorIndex).match(/^:(?:(\d+)|\s+(-\d+))(?::(\d+))?}/);
  if (!match) return null;

  const offset = Number(match[1] ?? match[2]);
  const start = offset < 0 ? Math.max(value.length + offset, 0) : offset;
  const length = match[3] === undefined ? undefined : Number(match[3]);
  return {
    value: length === undefined ? value.slice(start) : value.slice(start, start + length),
    length: operatorIndex - index + match[0].length,
  };
}

function bracedPatternRemovalReplacement(
  command: string,
  index: number,
  value: string,
  operatorIndex: number,
): { value: string; length: number } | null {
  const operator = bracedPatternRemovalOperator(command, operatorIndex);
  if (!operator) return null;

  const endIndex = command.indexOf('}', operatorIndex + operator.length);
  if (endIndex === -1) return null;

  const pattern = staticLiteralPatternValue(command.slice(operatorIndex + operator.length, endIndex));
  if (pattern === null) return null;

  return {
    value: patternRemovalValue(value, operator, pattern),
    length: endIndex - index + 1,
  };
}

function bracedPatternRemovalOperator(
  command: string,
  index: number,
): BracedPatternRemovalOperator | null {
  if (command.startsWith('%%', index)) return '%%';
  if (command.startsWith('##', index)) return '##';
  if (command[index] === '%') return '%';
  return command[index] === '#' ? '#' : null;
}

function staticLiteralPatternValue(pattern: string): string | null {
  return /[$`*?[\]{}()<>|&;'"\\]/.test(pattern) ? null : pattern;
}

function patternRemovalValue(value: string, operator: BracedPatternRemovalOperator, pattern: string): string {
  if (operator === '%' || operator === '%%') {
    return value.endsWith(pattern) ? value.slice(0, value.length - pattern.length) : value;
  }

  return value.startsWith(pattern) ? value.slice(pattern.length) : value;
}

function bracedUnsetAlternateReplacement(
  command: string,
  index: number,
  name: string,
): { value: string; length: number } | null {
  const prefix = `\${${name}`;
  if (!command.startsWith(prefix, index)) return null;

  const operatorIndex = index + prefix.length;
  const operator = bracedUnsetErrorOrAlternateOperator(command, operatorIndex);
  if (!operator) return null;

  const endIndex = command.indexOf('}', operatorIndex + operator.length);
  return endIndex === -1 ? null : { value: '', length: endIndex - index + 1 };
}

function bracedUnsetErrorOrAlternateOperator(command: string, index: number): ':+' | '+' | ':?' | '?' | null {
  if (command.startsWith(':+', index)) return ':+';
  if (command.startsWith(':?', index)) return ':?';
  if (command[index] === '+') return '+';
  return command[index] === '?' ? '?' : null;
}
