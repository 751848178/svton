export type StaticArithmeticExpressionResolver = (
  expression: string,
  variables: Map<string, string>,
  resolvingVariables: Set<string>,
) => string | null;

export interface StaticArithmeticVariableToken {
  length: number;
  value: number;
}

export function readStaticArithmeticVariableToken(
  expression: string,
  variables: Map<string, string>,
  resolvingVariables: Set<string>,
  resolveExpression: StaticArithmeticExpressionResolver,
): StaticArithmeticVariableToken | null {
  const match = expression.match(/^[A-Za-z_]\w*/);
  if (!match) return null;

  const value = variables.get(match[0]);
  if (value === undefined || value === '') return { value: 0, length: match[0].length };
  if (/^[-+]?\d+$/.test(value)) return { value: Number(value), length: match[0].length };
  if (resolvingVariables.has(match[0])) return null;

  resolvingVariables.add(match[0]);
  const resolved = resolveExpression(value, variables, resolvingVariables);
  resolvingVariables.delete(match[0]);
  return resolved === null ? null : { value: Number(resolved), length: match[0].length };
}
