import {
  matchesStaticArithmeticBitwiseOperator,
  readStaticArithmeticEqualityOperator,
  readStaticArithmeticLogicalOperator,
  readStaticArithmeticPowerOperator,
  readStaticArithmeticRelationalOperator,
  readStaticArithmeticShiftOperator,
  staticArithmeticBitwiseValue,
  staticArithmeticLogicalValue,
  staticArithmeticPowerValue,
  staticArithmeticRelationalValue,
} from './shell-static-arithmetic-operator.utils';
import { readStaticArithmeticAssignmentTarget, staticArithmeticAssignmentValue } from './shell-static-arithmetic-assignment.utils';
import { readStaticArithmeticMutationToken } from './shell-static-arithmetic-mutation.utils';
import { expandStaticArithmeticParameters } from './shell-static-arithmetic-parameter.utils';
import { readStaticArithmeticPrimaryToken } from './shell-static-arithmetic-primary.utils';
import { withStaticArithmeticVariableSnapshot } from './shell-static-arithmetic-state.utils';

export function staticArithmeticValue(
  expression: string,
  variables: Map<string, string> = new Map(),
  resolvingVariables: Set<string> = new Set(),
): string | null {
  const expandedExpression = expandStaticArithmeticParameters(expression, variables);
  if (expandedExpression === null) return null;
  if (expandedExpression.trim() === '') return '0';

  const parser = new ArithmeticParser(expandedExpression, new Map(variables), resolvingVariables); const value = parser.parseExpression();
  return value !== null && parser.atEnd() ? String(value) : null;
}

class ArithmeticParser {
  private index = 0;
  constructor(private readonly expression: string, private readonly variables: Map<string, string>, private readonly resolvingVariables: Set<string>) {}

  parseExpression(): number | null { return this.parseComma(); }

  atEnd(): boolean { this.skipWhitespace(); return this.index === this.expression.length; }
  private parseComma(): number | null {
    let value = this.parseAssignment(); if (value === null) return null;
    for (;;) { this.skipWhitespace(); if (this.expression[this.index] !== ',') return value; this.index += 1; value = this.parseAssignment(); if (value === null) return null; }
  }
  private parseAssignment(): number | null {
    this.skipWhitespace(); const target = readStaticArithmeticAssignmentTarget(this.expression.slice(this.index));
    if (!target) return this.parseConditional();
    this.index += target.length; const right = this.parseAssignment(); const current = target.operator === '=' ? 0 : readStaticArithmeticPrimaryToken(target.name, this.variables, this.resolvingVariables, staticArithmeticValue)?.value;
    const value = right === null || current === undefined ? null : staticArithmeticAssignmentValue(current, right, target.operator);
    if (value !== null) this.variables.set(target.name, String(value)); return value;
  }
  private parseConditional(): number | null {
    const condition = this.parseLogicalOr(); if (condition === null) return null;
    this.skipWhitespace(); if (this.expression[this.index] !== '?') return condition;
    this.index += 1; const whenTrue = this.parseBranch(this.parseExpression, condition !== 0); this.skipWhitespace();
    if (whenTrue === null || this.expression[this.index] !== ':') return null;
    this.index += 1; const whenFalse = this.parseBranch(this.parseConditional, condition === 0);
    return whenFalse === null ? null : condition !== 0 ? whenTrue : whenFalse;
  }
  private parseBranch(parseValue: () => number | null, applyEffects: boolean): number | null { return applyEffects ? parseValue.call(this) : withStaticArithmeticVariableSnapshot(this.variables, () => parseValue.call(this)); }
  private parseLogicalOr(): number | null { return this.parseLogical(() => this.parseLogicalAnd(), '||'); }
  private parseLogicalAnd(): number | null { return this.parseLogical(() => this.parseBitwiseOr(), '&&'); }
  private parseLogical(nextValue: () => number | null, operator: '&&' | '||'): number | null {
    let value = nextValue();
    if (value === null) return null;
    for (;;) {
      this.skipWhitespace();
      if (readStaticArithmeticLogicalOperator(this.expression.slice(this.index)) !== operator) return value;
      this.index += 2;
      const applyEffects = operator === '&&' ? value !== 0 : value === 0;
      const right = applyEffects ? nextValue() : withStaticArithmeticVariableSnapshot(this.variables, nextValue); if (right === null) return null;
      value = staticArithmeticLogicalValue(value, right, operator);
    }
  }
  private parseBitwiseOr(): number | null { return this.parseBitwise(() => this.parseBitwiseXor(), '|'); }
  private parseBitwiseXor(): number | null { return this.parseBitwise(() => this.parseBitwiseAnd(), '^'); }
  private parseBitwiseAnd(): number | null { return this.parseBitwise(() => this.parseEquality(), '&'); }
  private parseBitwise(nextValue: () => number | null, operator: '|' | '^' | '&'): number | null {
    let value = nextValue();
    if (value === null) return null;
    for (;;) {
      this.skipWhitespace();
      if (!matchesStaticArithmeticBitwiseOperator(this.expression.slice(this.index), operator)) return value;
      this.index += 1;
      const right = nextValue(); if (right === null) return null;
      value = staticArithmeticBitwiseValue(value, right, operator);
    }
  }
  private parseEquality(): number | null {
    let value = this.parseRelational();
    if (value === null) return null;
    for (;;) {
      this.skipWhitespace();
      const operator = readStaticArithmeticEqualityOperator(this.expression.slice(this.index));
      if (!operator) return value;
      this.index += 2;
      const right = this.parseRelational(); if (right === null) return null;
      value = operator === '==' ? Number(value === right) : Number(value !== right);
    }
  }
  private parseRelational(): number | null {
    let value = this.parseShift();
    if (value === null) return null;
    for (;;) {
      this.skipWhitespace();
      const operator = readStaticArithmeticRelationalOperator(this.expression.slice(this.index));
      if (!operator) return value;
      this.index += operator.length;
      const right = this.parseShift(); if (right === null) return null;
      value = staticArithmeticRelationalValue(value, right, operator);
    }
  }
  private parseShift(): number | null {
    let value = this.parseAdditive();
    if (value === null) return null;
    for (;;) {
      this.skipWhitespace();
      const operator = readStaticArithmeticShiftOperator(this.expression.slice(this.index));
      if (!operator) return value;
      this.index += 2;
      const right = this.parseAdditive();
      if (right === null || right < 0) return null;
      value = operator === '<<' ? value * (2 ** right) : Math.trunc(value / (2 ** right));
    }
  }

  private parseAdditive(): number | null {
    let value = this.parseTerm();
    if (value === null) return null;
    for (;;) {
      this.skipWhitespace();
      const operator = this.expression[this.index];
      if (operator !== '+' && operator !== '-') return value;
      this.index += 1;
      const right = this.parseTerm();
      if (right === null) return null;
      value = operator === '+' ? value + right : value - right;
    }
  }

  private parseTerm(): number | null {
    let value = this.parsePower();
    if (value === null) return null;
    for (;;) {
      this.skipWhitespace();
      const operator = this.expression[this.index];
      if (!operator || !'*/%'.includes(operator)) return value;
      this.index += 1;
      const right = this.parsePower();
      if (right === null || right === 0) return null;
      if (operator === '*') value *= right;
      else if (operator === '/') value = Math.trunc(value / right);
      else value %= right;
    }
  }

  private parsePower(): number | null {
    const value = this.parseFactor(); this.skipWhitespace();
    if (value === null || !readStaticArithmeticPowerOperator(this.expression.slice(this.index))) return value;
    this.index += 2; const right = this.parsePower();
    return right === null ? null : staticArithmeticPowerValue(value, right);
  }

  private parseFactor(): number | null {
    this.skipWhitespace();
    const mutation = readStaticArithmeticMutationToken(this.expression.slice(this.index), this.variables, this.resolvingVariables, staticArithmeticValue);
    if (mutation) { this.index += mutation.length; return mutation.value; }
    const operator = this.expression[this.index];
    if (operator === '+' || operator === '-' || operator === '~' || operator === '!') {
      this.index += 1;
      const value = this.parseFactor();
      if (value === null) return null;
      if (operator === '-') return -value;
      if (operator === '~') return ~value;
      return operator === '!' ? Number(value === 0) : value;
    }

    if (operator === '(') {
      this.index += 1;
      const value = this.parseExpression();
      this.skipWhitespace();
      if (value === null || this.expression[this.index] !== ')') return null;
      this.index += 1;
      return value;
    }

    const token = readStaticArithmeticPrimaryToken(
      this.expression.slice(this.index),
      this.variables,
      this.resolvingVariables,
      staticArithmeticValue,
    );
    if (!token) return null;
    this.index += token.length;
    return token.value;
  }

  private skipWhitespace(): void { while (/\s/.test(this.expression[this.index] ?? '')) this.index += 1; }
}
