import type { PlanningManager } from '../../planning/manager';
import type { Plan } from '../../planning/types';

export function buildPlanProgressMetadata(pm: PlanningManager, plan: Plan) {
  return {
    planId: plan.id,
    title: plan.title,
    progress: pm.getProgress(plan.id),
    steps: plan.steps.map((step) => ({
      id: step.id,
      title: step.title,
      status: step.status,
    })),
  };
}
