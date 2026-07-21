export type NormalizedPlanStepInput = {
  title: string;
  description: string;
  dependencies?: string[];
};

export type NormalizedPlanStepStatus = 'completed' | 'failed' | 'skipped' | 'in_progress';

const PLAN_STEP_STATUSES: NormalizedPlanStepStatus[] = [
  'completed',
  'failed',
  'skipped',
  'in_progress',
];

export function normalizePlanTitle(value: unknown): { title: string | null; error: string | null } {
  if (typeof value !== 'string') {
    return { title: null, error: 'Error: "title" is required and must be a string.' };
  }
  const title = value.trim();
  return title
    ? { title, error: null }
    : { title: null, error: 'Error: "title" is required and must be a non-empty string.' };
}

export function normalizeRequiredPlanString(
  value: unknown,
  fieldName: string,
): { value: string | null; error: string | null } {
  if (typeof value !== 'string') {
    return { value: null, error: `Error: "${fieldName}" is required and must be a string.` };
  }
  const normalized = value.trim();
  return normalized
    ? { value: normalized, error: null }
    : {
      value: null,
      error: `Error: "${fieldName}" is required and must be a non-empty string.`,
    };
}

export function normalizePlanUpdateStatus(
  value: unknown,
): { status: NormalizedPlanStepStatus | null; error: string | null } {
  const normalized = normalizeRequiredPlanString(value, 'status');
  if (normalized.error || !normalized.value) {
    return {
      status: null,
      error: 'Error: "status" must be one of: completed, failed, skipped, in_progress.',
    };
  }
  if (!PLAN_STEP_STATUSES.includes(normalized.value as NormalizedPlanStepStatus)) {
    return {
      status: null,
      error: 'Error: "status" must be one of: completed, failed, skipped, in_progress.',
    };
  }
  return { status: normalized.value as NormalizedPlanStepStatus, error: null };
}

export function normalizeOptionalPlanResult(
  value: unknown,
): { result: string | undefined; error: string | null } {
  if (value === undefined) return { result: undefined, error: null };
  if (typeof value !== 'string') {
    return { result: undefined, error: 'Error: "result" must be a string.' };
  }
  const result = value.trim();
  return { result: result || undefined, error: null };
}

export function normalizePlanSteps(
  value: unknown,
): { steps: NormalizedPlanStepInput[] | null; error: string | null } {
  if (!Array.isArray(value) || value.length === 0) {
    return {
      steps: null,
      error: 'Error: "steps" is required and must be a non-empty array of { title, description } objects.',
    };
  }

  const steps: NormalizedPlanStepInput[] = [];
  for (const step of value) {
    const normalized = normalizePlanStep(step);
    if (!normalized) {
      return {
        steps: null,
        error: 'Error: "steps" must contain objects with non-empty string "title", non-empty string "description", and optional non-empty string[] "dependencies".',
      };
    }
    steps.push(normalized);
  }
  if (!dependenciesAreExecutable(steps)) {
    return {
      steps: null,
      error: 'Error: "steps" dependencies must reference existing step ids and cannot reference the same step.',
    };
  }
  return { steps, error: null };
}

function normalizePlanStep(step: unknown): NormalizedPlanStepInput | null {
  if (!step || typeof step !== 'object') return null;
  const candidate = step as {
    title?: unknown;
    description?: unknown;
    dependencies?: unknown;
  };
  if (typeof candidate.title !== 'string' || typeof candidate.description !== 'string') {
    return null;
  }
  const title = candidate.title.trim();
  const description = candidate.description.trim();
  if (!title || !description) return null;
  const dependencies = normalizeDependencies(candidate.dependencies);
  if (dependencies === null) return null;
  return dependencies.length > 0
    ? { title, description, dependencies }
    : { title, description };
}

function normalizeDependencies(value: unknown): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const dependencies = value.map((dependency) => (
    typeof dependency === 'string' ? dependency.trim() : ''
  ));
  return dependencies.every((dependency) => dependency.length > 0)
    ? dependencies
    : null;
}

function dependenciesAreExecutable(steps: NormalizedPlanStepInput[]): boolean {
  const stepIds = new Set(steps.map((_step, index) => `step_${index + 1}`));

  const referencesAreValid = steps.every((step, index) => (
    !step.dependencies || step.dependencies.every((dependency) => (
      dependency !== `step_${index + 1}` && stepIds.has(dependency)
    ))
  ));
  return referencesAreValid && !dependencyGraphHasCycle(steps);
}

function dependencyGraphHasCycle(steps: NormalizedPlanStepInput[]): boolean {
  const stepsById = new Map(steps.map((step, index) => [`step_${index + 1}`, step]));
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (stepId: string): boolean => {
    if (visiting.has(stepId)) return true;
    if (visited.has(stepId)) return false;

    visiting.add(stepId);
    const step = stepsById.get(stepId);
    const hasCycle = (step?.dependencies ?? []).some(visit);
    visiting.delete(stepId);
    visited.add(stepId);
    return hasCycle;
  };

  return Array.from(stepsById.keys()).some(visit);
}
