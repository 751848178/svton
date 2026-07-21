export function withStaticArithmeticVariableSnapshot<T>(
  variables: Map<string, string>,
  evaluate: () => T,
): T {
  const snapshot = new Map(variables);
  const value = evaluate();
  variables.clear();
  for (const [name, variableValue] of snapshot.entries()) variables.set(name, variableValue);
  return value;
}
