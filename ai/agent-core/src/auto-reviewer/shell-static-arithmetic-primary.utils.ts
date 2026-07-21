import { readStaticArithmeticIntegerToken } from './shell-static-arithmetic-integer.utils';
import { readStaticArithmeticVariableToken } from './shell-static-arithmetic-variable.utils';

export type StaticArithmeticEvaluator = (
  expression: string,
  variables: Map<string, string>,
  resolvingVariables: Set<string>,
) => string | null;

export function readStaticArithmeticPrimaryToken(
  expression: string,
  variables: Map<string, string>,
  resolvingVariables: Set<string>,
  evaluate: StaticArithmeticEvaluator,
): { length: number; value: number } | null {
  const integerToken = readStaticArithmeticIntegerToken(expression);
  if (integerToken) return integerToken;

  return readStaticArithmeticVariableToken(
    expression,
    variables,
    resolvingVariables,
    evaluate,
  );
}
