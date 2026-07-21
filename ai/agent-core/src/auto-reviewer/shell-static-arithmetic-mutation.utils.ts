import {
  readStaticArithmeticVariableToken,
  type StaticArithmeticExpressionResolver,
} from './shell-static-arithmetic-variable.utils';

export function readStaticArithmeticMutationToken(
  expression: string,
  variables: Map<string, string>,
  resolvingVariables: Set<string>,
  resolveExpression: StaticArithmeticExpressionResolver,
): { length: number; value: number } | null {
  return readPrefixMutation(expression, variables, resolvingVariables, resolveExpression)
    ?? readPostfixMutation(expression, variables, resolvingVariables, resolveExpression);
}

function readPrefixMutation(
  expression: string,
  variables: Map<string, string>,
  resolvingVariables: Set<string>,
  resolveExpression: StaticArithmeticExpressionResolver,
): { length: number; value: number } | null {
  const match = expression.match(/^(\+\+|--)([A-Za-z_]\w*)/);
  if (!match) return null;
  const current = readVariableValue(match[2], variables, resolvingVariables, resolveExpression);
  if (current === null) return null;
  const value = match[1] === '++' ? current + 1 : current - 1;
  variables.set(match[2], String(value));
  return { length: match[0].length, value };
}

function readPostfixMutation(
  expression: string,
  variables: Map<string, string>,
  resolvingVariables: Set<string>,
  resolveExpression: StaticArithmeticExpressionResolver,
): { length: number; value: number } | null {
  const match = expression.match(/^([A-Za-z_]\w*)(\+\+|--)/);
  if (!match) return null;
  const current = readVariableValue(match[1], variables, resolvingVariables, resolveExpression);
  if (current === null) return null;
  variables.set(match[1], String(match[2] === '++' ? current + 1 : current - 1));
  return { length: match[0].length, value: current };
}

function readVariableValue(
  name: string,
  variables: Map<string, string>,
  resolvingVariables: Set<string>,
  resolveExpression: StaticArithmeticExpressionResolver,
): number | null {
  return readStaticArithmeticVariableToken(name, variables, resolvingVariables, resolveExpression)?.value ?? null;
}
