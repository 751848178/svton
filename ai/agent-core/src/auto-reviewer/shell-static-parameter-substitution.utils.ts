type ParameterSubstitutionMode = 'first' | 'all' | 'prefix' | 'suffix';

interface StaticParameterSubstitution {
  mode: ParameterSubstitutionMode;
  pattern: string;
  replacement: string;
  endIndex: number;
}

export function bracedParameterSubstitutionReplacement(
  command: string,
  index: number,
  value: string,
  operatorIndex: number,
): { value: string; length: number } | null {
  const substitution = staticParameterSubstitution(command, operatorIndex);
  if (!substitution) return null;

  return {
    value: substitutedValue(value, substitution),
    length: substitution.endIndex - index + 1,
  };
}

function staticParameterSubstitution(
  command: string,
  operatorIndex: number,
): StaticParameterSubstitution | null {
  const operator = substitutionOperator(command, operatorIndex);
  if (!operator) return null;

  const endIndex = command.indexOf('}', operator.patternStart);
  if (endIndex === -1) return null;

  const separatorIndex = command.indexOf('/', operator.patternStart);
  const hasReplacement = separatorIndex !== -1 && separatorIndex < endIndex;
  const patternEnd = hasReplacement ? separatorIndex : endIndex;
  const pattern = command.slice(operator.patternStart, patternEnd);
  const replacement = hasReplacement ? command.slice(separatorIndex + 1, endIndex) : '';
  if (!staticLiteralSubstitutionPattern(pattern) || !staticLiteralSubstitutionReplacement(replacement)) return null;

  return { mode: operator.mode, pattern, replacement, endIndex };
}

function substitutionOperator(
  command: string,
  operatorIndex: number,
): { mode: ParameterSubstitutionMode; patternStart: number } | null {
  if (command.startsWith('//', operatorIndex)) return { mode: 'all', patternStart: operatorIndex + 2 };
  if (command.startsWith('/#', operatorIndex)) return { mode: 'prefix', patternStart: operatorIndex + 2 };
  if (command.startsWith('/%', operatorIndex)) return { mode: 'suffix', patternStart: operatorIndex + 2 };
  return command[operatorIndex] === '/' ? { mode: 'first', patternStart: operatorIndex + 1 } : null;
}

function staticLiteralSubstitutionPattern(pattern: string): boolean {
  return pattern !== '' && !/[$`*?[\]{}()<>|&;'"\\/]/.test(pattern);
}

function staticLiteralSubstitutionReplacement(replacement: string): boolean {
  return !/[$`*?[\]{}()<>|&;'"\\]/.test(replacement);
}

function substitutedValue(value: string, substitution: StaticParameterSubstitution): string {
  const { mode, pattern, replacement } = substitution;
  if (mode === 'all') return value.split(pattern).join(replacement);
  if (mode === 'prefix') return value.startsWith(pattern) ? `${replacement}${value.slice(pattern.length)}` : value;
  if (mode === 'suffix') return value.endsWith(pattern) ? `${value.slice(0, value.length - pattern.length)}${replacement}` : value;

  const matchIndex = value.indexOf(pattern);
  return matchIndex === -1
    ? value
    : `${value.slice(0, matchIndex)}${replacement}${value.slice(matchIndex + pattern.length)}`;
}
