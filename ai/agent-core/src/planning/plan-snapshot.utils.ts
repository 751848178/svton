import type { Plan, PlanStep } from './types';

export function clonePlanStep(step: PlanStep): PlanStep {
  return {
    ...step,
    dependencies: step.dependencies ? [...step.dependencies] : undefined,
  };
}

export function clonePlan(plan: Plan): Plan {
  return {
    ...plan,
    steps: plan.steps.map(clonePlanStep),
  };
}
