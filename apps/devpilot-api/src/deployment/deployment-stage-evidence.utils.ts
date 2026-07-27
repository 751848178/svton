type StepEvidence = {
  key?: unknown;
  status?: unknown;
  exitCode?: unknown;
  dryRunSkipped?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readSteps(value: unknown): StepEvidence[] {
  if (!isRecord(value)) return [];
  const candidates = [value.stepResults, value.steps];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter(isRecord);
    }
  }
  return [];
}

export function readInitializationExecutionStatus(
  result: unknown,
): "completed" | "failed" | "missing" {
  const step = readSteps(result).find((item) => item.key === "initialization");
  if (!step) return "missing";
  if (step.dryRunSkipped === true) return "missing";
  if (step.status === "completed") return "completed";
  if (step.status === "failed") return "failed";
  return step.exitCode === 0 ? "completed" : "failed";
}
