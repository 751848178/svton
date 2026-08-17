import { hashCanonicalReleaseValue } from "./release-canonical-hash.utils";
import type { ReleaseStagingWorkloadSnapshot } from "./release-staging-workload.types";

export function parseExactReleaseWorkloadSnapshot(
  value: unknown,
): ReleaseStagingWorkloadSnapshot | null {
  const snapshot = record(value);
  if (snapshot.version !== 1 || !Array.isArray(snapshot.services)) return null;
  if (![snapshot.environmentId, snapshot.manifestId, snapshot.manifestDigest,
    snapshot.inputHash].every(nonEmptyString)) return null;
  for (const value of snapshot.services) {
    const service = record(value);
    const { stateHash, ...state } = service;
    if (!nonEmptyString(stateHash) ||
      stateHash !== hashCanonicalReleaseValue(state)) return null;
  }
  const { inputHash, ...state } = snapshot;
  return inputHash === hashCanonicalReleaseValue(state)
    ? snapshot as unknown as ReleaseStagingWorkloadSnapshot
    : null;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
