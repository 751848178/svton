import type { Plan, PlanProgress } from './types';

export function createEmptyPlanProgress(): PlanProgress {
  return {
    total: 0,
    completed: 0,
    failed: 0,
    pending: 0,
    inProgress: 0,
    skipped: 0,
  };
}

export function calculatePlanProgress(plan: Plan): PlanProgress {
  return {
    total: plan.steps.length,
    completed: plan.steps.filter((step) => step.status === 'completed').length,
    failed: plan.steps.filter((step) => step.status === 'failed').length,
    pending: plan.steps.filter((step) => step.status === 'pending').length,
    inProgress: plan.steps.filter((step) => step.status === 'in_progress').length,
    skipped: plan.steps.filter((step) => step.status === 'skipped').length,
  };
}
