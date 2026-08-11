export interface FrozenProductionCandidate {
  candidateHash: string;
  releaseOrderId: string;
  manifestId: string;
}

export function frozenProductionCandidate(
  value: unknown,
  expected?: { releaseOrderId?: string; manifestId?: string },
): FrozenProductionCandidate | null {
  const candidate = record(record(value).productionCandidate);
  const parsed =
    typeof candidate.candidateHash === 'string' &&
    /^[a-f0-9]{64}$/.test(candidate.candidateHash) &&
    typeof candidate.releaseOrderId === 'string' &&
    typeof candidate.manifestId === 'string'
      ? (candidate as unknown as FrozenProductionCandidate)
      : null;
  if (!parsed) return null;
  if (expected?.releaseOrderId && parsed.releaseOrderId !== expected.releaseOrderId) return null;
  if (expected?.manifestId && parsed.manifestId !== expected.manifestId) return null;
  return parsed;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
