export function assertNoPreexistingActiveRuns(runs) {
  if (!Array.isArray(runs)) throw ownershipError("inventory-type");
  for (const run of runs) {
    if (
      !run ||
      typeof run.id !== "string" ||
      !["awaiting_approval", "running"].includes(run.status)
    ) {
      throw ownershipError("inventory-row");
    }
  }
  if (runs.length > 0) {
    throw ownershipError(
      `foreign-active-runs:${runs.map(({ id }) => id).join(",")}`,
    );
  }
  return Object.freeze({ canceledStaleRuns: 0, runningReleaseRuns: 0 });
}

function ownershipError(reason) {
  return new Error(`PARITY_NEGATIVE_RUN_OWNERSHIP_INVALID: ${reason}`);
}
