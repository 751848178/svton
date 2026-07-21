export function readStaticArithmeticEqualityOperator(expression: string): '==' | '!=' | null {
  if (expression.startsWith('==')) return '==';
  return expression.startsWith('!=') ? '!=' : null;
}

export function readStaticArithmeticRelationalOperator(
  expression: string,
): '<=' | '>=' | '<' | '>' | null {
  if (expression.startsWith('<=')) return '<=';
  if (expression.startsWith('>=')) return '>=';
  if (expression[0] === '<' && expression[1] !== '<') return '<';
  return expression[0] === '>' && expression[1] !== '>' ? '>' : null;
}

export function staticArithmeticRelationalValue(
  left: number,
  right: number,
  operator: '<=' | '>=' | '<' | '>',
): number {
  if (operator === '<') return Number(left < right);
  if (operator === '>') return Number(left > right);
  return operator === '<=' ? Number(left <= right) : Number(left >= right);
}

export function readStaticArithmeticBitwiseOrOperator(expression: string): boolean {
  return expression[0] === '|' && expression[1] !== '|';
}

export function readStaticArithmeticBitwiseAndOperator(expression: string): boolean {
  return expression[0] === '&' && expression[1] !== '&';
}

export function matchesStaticArithmeticBitwiseOperator(
  expression: string,
  operator: '|' | '^' | '&',
): boolean {
  if (operator === '|') return readStaticArithmeticBitwiseOrOperator(expression);
  if (operator === '&') return readStaticArithmeticBitwiseAndOperator(expression);
  return expression[0] === '^';
}

export function staticArithmeticBitwiseValue(left: number, right: number, operator: '|' | '^' | '&'): number {
  if (operator === '|') return left | right;
  return operator === '^' ? left ^ right : left & right;
}

export function readStaticArithmeticLogicalOperator(expression: string): '&&' | '||' | null {
  if (expression.startsWith('&&')) return '&&';
  return expression.startsWith('||') ? '||' : null;
}

export function staticArithmeticLogicalValue(left: number, right: number, operator: '&&' | '||'): number {
  if (operator === '&&') return Number(left !== 0 && right !== 0);
  return Number(left !== 0 || right !== 0);
}

export function readStaticArithmeticPowerOperator(expression: string): boolean {
  return expression.startsWith('**');
}

export function staticArithmeticPowerValue(left: number, right: number): number | null {
  if (right < 0) return null;
  const value = left ** right;
  return Number.isFinite(value) ? Math.trunc(value) : null;
}

export function readStaticArithmeticShiftOperator(expression: string): '<<' | '>>' | null {
  if (expression.startsWith('<<')) return '<<';
  return expression.startsWith('>>') ? '>>' : null;
}
