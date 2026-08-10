export const RUNTIME_LABELS = Object.freeze({
  revision: "org.opencontainers.image.revision",
  tree: "io.svton.devpilot.source-tree-sha256",
  runtime: "io.svton.devpilot.runtime-id",
  goal: "io.svton.devpilot.goal-id",
  owner: "io.svton.devpilot.cleanup-owner-token",
});

export function assertRuntimeImageLabels(labels, expected) {
  if (!labels || typeof labels !== "object" || Array.isArray(labels)) {
    throw provenanceError("labels-type");
  }
  for (const [field, label] of Object.entries(RUNTIME_LABELS)) {
    if (labels[label] !== expected[field]) {
      throw provenanceError(`${field}-mismatch`);
    }
  }
  return true;
}

export function expectedRuntimeImageLabels(runtime) {
  return Object.freeze({
    revision: runtime.sourceRevision,
    tree: runtime.sourceTreeSha256,
    runtime: runtime.runtimeId,
    goal: runtime.goalId,
    owner: runtime.cleanupOwnerToken,
  });
}

function provenanceError(reason) {
  return new Error(`PARITY_RUNTIME_PROVENANCE_INVALID: ${reason}`);
}
