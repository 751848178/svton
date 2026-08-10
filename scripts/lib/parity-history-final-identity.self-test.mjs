#!/usr/bin/env node
import assert from "node:assert/strict";
import { finalProductionIdentityFromHistory } from "./parity-history-final-identity.mjs";

const document = {
  status: "passed",
  context: {
    teamId: "team-1",
    projectId: "project-1",
    productionEnvId: "production-1",
  },
  steps: {
    "production-recovery-execute": {
      status: "passed",
      verified: true,
      result: {
        status: "completed",
        environmentId: "production-1",
        expectedEnvironmentId: "production-1",
        releaseRunId: "release-recovery-1",
        expectedReleaseRunId: "release-recovery-1",
        deploymentRunId: "deployment-recovery-1",
        newEnvironmentVersion: {
          id: "version-recovery-1",
          kind: "recovery",
          deploymentRunId: "deployment-recovery-1",
        },
      },
    },
  },
};
assert.deepEqual(finalProductionIdentityFromHistory(document), {
  teamId: "team-1",
  projectId: "project-1",
  environmentId: "production-1",
  releaseRunId: "release-recovery-1",
  deploymentRunId: "deployment-recovery-1",
  environmentVersionId: "version-recovery-1",
});

for (const mutate of [
  (value) => {
    value.status = "failed";
  },
  (value) => {
    value.steps["production-recovery-execute"].result.environmentId =
      "other-environment";
  },
  (value) => {
    value.steps["production-recovery-execute"].result.expectedReleaseRunId =
      "other-release";
  },
  (value) => {
    value.steps[
      "production-recovery-execute"
    ].result.newEnvironmentVersion.deploymentRunId = "other-deployment";
  },
]) {
  const changed = structuredClone(document);
  mutate(changed);
  assert.throws(
    () => finalProductionIdentityFromHistory(changed),
    /HISTORY_FINAL_IDENTITY_INVALID/,
  );
}

process.stdout.write("history final production identity self-test passed\n");
