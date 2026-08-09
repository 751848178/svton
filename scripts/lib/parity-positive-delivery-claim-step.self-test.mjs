import assert from "node:assert/strict";
import { positiveDeliveryClaimChecks } from "./parity-positive-delivery-claim-step.mjs";

const expected = {
  projectId: "fresh-project",
  stagingEnvId: "fresh-staging",
  productionEnvId: "fresh-production",
  analysisRunId: "analysis-1",
  reviewSnapshotId: "review-1",
  reviewSnapshotHash: "a".repeat(64),
  repositoryIdentityId: "identity-1",
};
const valid = {
  projectId: expected.projectId,
  summaryProjectId: expected.projectId,
  stagingEnvId: expected.stagingEnvId,
  productionEnvId: expected.productionEnvId,
  repositoryDefaultBranch: "main",
  projectType: "web_application",
  architecture: "monorepo",
  componentCount: 2,
  resourceScopes: [1, 1, 1, 1],
  environmentBindings: 2,
  applicationContracts: [{}, {}],
  priorEnvironmentVersions: 4,
  identityReadback: [1, 0, 1, 1],
  frozenIdentity: {
    finalization: {
      analysisRunId: expected.analysisRunId,
      resultSnapshot: {
        projectId: expected.projectId,
        reviewSnapshotId: expected.reviewSnapshotId,
        reviewSnapshotHash: expected.reviewSnapshotHash,
      },
    },
    reviewSnapshot: {
      id: expected.reviewSnapshotId,
      snapshotHash: expected.reviewSnapshotHash,
      projectId: expected.projectId,
      runId: expected.analysisRunId,
    },
    project: {
      onboardingStatus: "ready",
      repositoryIdentity: {
        id: expected.repositoryIdentityId,
        currentRevisionId: "identity-revision-1",
      },
    },
  },
};

assert.equal(
  positiveDeliveryClaimChecks(valid, expected).every((item) => item.pass),
  true,
);
for (const mutate of [
  (value) => {
    value.summaryProjectId = "seed-project";
  },
  (value) => {
    value.componentCount = null;
  },
  (value) => {
    value.identityReadback = [2, 1, 1, 1];
  },
  (value) => {
    value.frozenIdentity.reviewSnapshot.snapshotHash = "b".repeat(64);
  },
]) {
  const changed = structuredClone(valid);
  mutate(changed);
  assert.equal(
    positiveDeliveryClaimChecks(changed, expected).some((item) => !item.pass),
    true,
  );
}
process.stdout.write("positive delivery claim step self-test passed\n");
