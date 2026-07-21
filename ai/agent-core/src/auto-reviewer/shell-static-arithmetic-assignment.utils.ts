export type StaticArithmeticAssignmentOperator =
  | '=' | '+=' | '-=' | '*=' | '/=' | '%='
  | '<<=' | '>>=' | '&=' | '^=' | '|=';

export interface StaticArithmeticAssignmentTarget {
  length: number;
  name: string;
  operator: StaticArithmeticAssignmentOperator;
}

export function readStaticArithmeticAssignmentTarget(
  expression: string,
): StaticArithmeticAssignmentTarget | null {
  const match = expression.match(/^([A-Za-z_]\w*)\s*(<<=|>>=|\+=|-=|\*=|\/=|%=|&=|\^=|\|=|=(?!=))/);
  if (!match) return null;
  return { length: match[0].length, name: match[1], operator: match[2] as StaticArithmeticAssignmentOperator };
}

export function staticArithmeticAssignmentValue(
  current: number,
  right: number,
  operator: StaticArithmeticAssignmentOperator,
): number | null {
  if (operator === '=') return right;
  if (operator === '+=') return current + right;
  if (operator === '-=') return current - right;
  if (operator === '*=') return current * right;
  if (operator === '/=') return right === 0 ? null : Math.trunc(current / right);
  if (operator === '%=') return right === 0 ? null : current % right;
  if (operator === '<<=' || operator === '>>=') return staticArithmeticShiftAssignmentValue(current, right, operator);
  if (operator === '&=') return current & right;
  return operator === '^=' ? current ^ right : current | right;
}

function staticArithmeticShiftAssignmentValue(
  current: number,
  right: number,
  operator: '<<=' | '>>=',
): number | null {
  if (right < 0) return null;
  const value = operator === '<<=' ? current * (2 ** right) : Math.trunc(current / (2 ** right));
  return Number.isFinite(value) ? value : null;
}
