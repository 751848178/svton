export function evaluatedBitwiseValue(left: number, operator: string, right: number): number | null {
  const minInt32 = -2147483648;
  const maxInt32 = 2147483647;
  if (left < minInt32 || left > maxInt32 || right < minInt32 || right > maxInt32) return null;
  if (operator === '&') return left & right;
  return operator === '^' ? left ^ right : left | right;
}

export function evaluatedBitwiseNotValue(value: number): number | null {
  const minInt32 = -2147483648;
  const maxInt32 = 2147483647;
  return value < minInt32 || value > maxInt32 ? null : ~value;
}

export function evaluatedShiftValue(left: number, operator: string, right: number): number | null {
  if (right < 0) return evaluatedShiftValue(left, operator === '<<' ? '>>' : '<<', -right);

  const factor = 2 ** right;
  const value = operator === '<<' ? left * factor : Math.floor(left / factor);
  return Number.isSafeInteger(value) ? value : null;
}

export function evaluatedTermValue(left: number, operator: string, right: number): number | null {
  if (operator === '*') return left * right;
  if (right === 0) return null;
  return operator === '/' ? Math.floor(left / right) : left - Math.floor(left / right) * right;
}
