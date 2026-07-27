export type DeploymentStageEvidence = {
  key: string;
  status: string;
  exitCode?: number;
  durationMs?: number;
  skipReason?: string;
};

export function readDeploymentStageEvidence(result: unknown) {
  if (!isRecord(result)) return new Map<string, DeploymentStageEvidence>();
  const items = Array.isArray(result.stepResults)
    ? result.stepResults
    : Array.isArray(result.steps)
      ? result.steps
      : [];
  return new Map(
    items.flatMap((item) => {
      if (!isRecord(item) || typeof item.key !== 'string') return [];
      const evidence: DeploymentStageEvidence = {
        key: item.key,
        status: readStatus(item),
        exitCode: typeof item.exitCode === 'number' ? item.exitCode : undefined,
        durationMs: typeof item.durationMs === 'number' ? item.durationMs : undefined,
        skipReason: typeof item.skipReason === 'string' ? item.skipReason : undefined,
      };
      return [[evidence.key, evidence] as const];
    }),
  );
}

function readStatus(item: Record<string, unknown>) {
  if (typeof item.status === 'string') return item.status;
  if (item.dryRunSkipped === true) return 'skipped';
  if (item.cancelled === true) return 'cancelled';
  if (item.timedOut === true) return 'failed';
  if (item.exitCode === 0) return 'completed';
  if (typeof item.exitCode === 'number') return 'failed';
  return 'not_started';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
