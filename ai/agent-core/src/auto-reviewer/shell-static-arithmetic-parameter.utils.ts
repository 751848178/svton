type ArithmeticParameterOperator = ':-' | '-' | ':=' | '=' | ':+' | '+' | ':?' | '?';

export function expandStaticArithmeticParameters(
  expression: string,
  variables: Map<string, string>,
): string | null {
  return expandStaticArithmeticParametersAtDepth(expression, variables, 0);
}

function expandStaticArithmeticParametersAtDepth(
  expression: string,
  variables: Map<string, string>,
  depth: number,
): string | null {
  if (depth > 4) return null;

  let output = '';
  for (let index = 0; index < expression.length; index += 1) {
    const braced = readBracedArithmeticParameter(expression, index, variables, depth);
    if (braced) {
      output += braced.value;
      index += braced.length - 1;
      continue;
    }

    const unbraced = readUnbracedArithmeticParameter(expression, index, variables);
    if (unbraced) {
      output += unbraced.value;
      index += unbraced.length - 1;
      continue;
    }

    output += expression[index];
  }

  return output;
}

function readBracedArithmeticParameter(
  expression: string,
  index: number,
  variables: Map<string, string>,
  depth: number,
): { value: string; length: number } | null {
  if (expression[index] !== '$' || expression[index + 1] !== '{') return null;

  const nameMatch = expression.slice(index + 2).match(/^([A-Za-z_]\w*)/);
  if (!nameMatch) return null;

  const name = nameMatch[1];
  const operatorIndex = index + 2 + name.length;
  if (expression[operatorIndex] === '}') {
    return { value: variables.get(name) ?? '', length: operatorIndex - index + 1 };
  }

  const operator = arithmeticParameterOperator(expression, operatorIndex);
  if (!operator) return null;

  const wordStart = operatorIndex + operator.length;
  const endIndex = expression.indexOf('}', wordStart);
  if (endIndex === -1) return null;

  const word = expression.slice(wordStart, endIndex);
  const value = arithmeticParameterValue(name, operator, word, variables, depth);
  return value === null ? null : { value, length: endIndex - index + 1 };
}

function readUnbracedArithmeticParameter(
  expression: string,
  index: number,
  variables: Map<string, string>,
): { value: string; length: number } | null {
  if (expression[index] !== '$') return null;

  const match = expression.slice(index + 1).match(/^([A-Za-z_]\w*)/);
  if (!match) return null;
  return { value: variables.get(match[1]) ?? '', length: match[1].length + 1 };
}

function arithmeticParameterValue(
  name: string,
  operator: ArithmeticParameterOperator,
  word: string,
  variables: Map<string, string>,
  depth: number,
): string | null {
  const knownValue = variables.get(name);
  const isSet = knownValue !== undefined;
  const isNonEmpty = knownValue !== undefined && knownValue !== '';

  if (operator === ':-') return isNonEmpty ? knownValue : arithmeticParameterWordValue(word, variables, depth);
  if (operator === '-') return isSet ? knownValue : arithmeticParameterWordValue(word, variables, depth);
  if (operator === ':=') {
    const defaultValue = arithmeticParameterWordValue(word, variables, depth);
    return defaultValue === null
      ? null
      : assignArithmeticParameterDefault(name, isNonEmpty, defaultValue, knownValue, variables);
  }
  if (operator === '=') {
    const defaultValue = arithmeticParameterWordValue(word, variables, depth);
    return defaultValue === null
      ? null
      : assignArithmeticParameterDefault(name, isSet, defaultValue, knownValue, variables);
  }
  if (operator === ':+') return isNonEmpty ? arithmeticParameterWordValue(word, variables, depth) : '';
  if (operator === '+') return isSet ? arithmeticParameterWordValue(word, variables, depth) : '';
  if (operator === ':?') return isNonEmpty ? knownValue : null;
  return isSet ? knownValue : null;
}

function arithmeticParameterWordValue(
  word: string,
  variables: Map<string, string>,
  depth: number,
): string | null {
  return expandStaticArithmeticParametersAtDepth(word, variables, depth + 1);
}

function assignArithmeticParameterDefault(
  name: string,
  keepKnownValue: boolean,
  defaultValue: string,
  knownValue: string | undefined,
  variables: Map<string, string>,
): string {
  if (keepKnownValue) return knownValue ?? '';
  variables.set(name, defaultValue);
  return defaultValue;
}

function arithmeticParameterOperator(expression: string, index: number): ArithmeticParameterOperator | null {
  if (expression.startsWith(':-', index)) return ':-';
  if (expression.startsWith(':=', index)) return ':=';
  if (expression.startsWith(':+', index)) return ':+';
  if (expression.startsWith(':?', index)) return ':?';
  if (expression[index] === '-') return '-';
  if (expression[index] === '=') return '=';
  if (expression[index] === '+') return '+';
  return expression[index] === '?' ? '?' : null;
}
