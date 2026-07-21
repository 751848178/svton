import type { AutomationTrigger } from './types';

export function resolveAutomationNextRun(
  trigger: AutomationTrigger,
  computeNextRun: (trigger: AutomationTrigger) => number,
): number {
  validateAutomationTrigger(trigger);
  const nextRunAt = computeNextRun(trigger);
  assertAutomationTriggerHasFutureRun(trigger, nextRunAt);
  return nextRunAt;
}

function validateAutomationTrigger(trigger: AutomationTrigger): void {
  if (trigger.type === 'interval') {
    if (!Number.isInteger(trigger.minutes) || (trigger.minutes ?? 0) <= 0) {
      throw new Error('Interval trigger minutes must be a positive integer.');
    }
    return;
  }

  if (trigger.type !== 'cron') return;

  if (!trigger.expression || !isValidCronExpression(trigger.expression)) {
    throw new Error('Invalid cron expression.');
  }
}

function assertAutomationTriggerHasFutureRun(
  trigger: AutomationTrigger,
  nextRunAt: number,
): void {
  if (trigger.type === 'cron' && nextRunAt === 0) {
    throw new Error('Invalid cron expression.');
  }
}

function isValidCronExpression(expression: string): boolean {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return false;

  return validateCronField(fields[0], 0, 59)
    && validateCronField(fields[1], 0, 23)
    && validateCronField(fields[2], 1, 31)
    && validateCronField(fields[3], 1, 12)
    && validateCronField(fields[4], 0, 6);
}

function validateCronField(field: string, min: number, max: number): boolean {
  if (field.trim().length === 0) return false;

  return field.split(',').every((part) => validateCronPart(part, min, max));
}

function validateCronPart(part: string, min: number, max: number): boolean {
  const [rangePart, stepPart] = part.split('/');
  if (!rangePart || part.split('/').length > 2) return false;

  if (stepPart !== undefined) {
    const step = Number(stepPart);
    if (!Number.isInteger(step) || step <= 0) return false;
  }

  if (rangePart === '*') return true;

  if (rangePart.includes('-')) {
    const [loRaw, hiRaw] = rangePart.split('-');
    const lo = Number(loRaw);
    const hi = Number(hiRaw);
    return Number.isInteger(lo)
      && Number.isInteger(hi)
      && lo <= hi
      && lo >= min
      && hi <= max;
  }

  const value = Number(rangePart);
  return Number.isInteger(value) && value >= min && value <= max;
}
