export function planTargetMetadata(planId: string): Record<string, unknown> {
  return { planId };
}

export function planStepTargetMetadata(
  planId: string,
  stepId: string,
  status: string,
): Record<string, unknown> {
  return { planId, stepId, status };
}

export function missingPlanStepTargetMetadata(
  planId: string,
  stepId: string,
  status: string,
  availableStepIds: string[],
): Record<string, unknown> {
  return {
    ...planStepTargetMetadata(planId, stepId, status),
    availableStepIds,
  };
}
