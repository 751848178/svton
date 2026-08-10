import assert from "node:assert/strict";
import {
  assertParityVersionHistoryRecords,
  buildParityVersionHistoryRecords,
  parityHistoryOrderCreatedAt,
} from "./parity-seed-version-history-records.mjs";
import { parityHistoryArtifactItem } from "./parity-seed-version-history.mjs";
import {
  parityHistoryApprovalData,
  parityHistoryDeploymentData,
} from "./parity-seed-version-history-data.mjs";

const ids = {
  buildPrevA: "build-a",
  buildPrevB: "build-b",
  manifestPrevA: "manifest-a",
  manifestPrevB: "manifest-b",
  stagingDeployPrevA: "staging-deploy-a",
  stagingDeployPrevB: "staging-deploy-b",
  stagingEnvVersionPrevA: "staging-version-a",
  stagingEnvVersionPrevB: "staging-version-b",
  approvalPrevA: "approval-a",
  approvalPrevB: "approval-b",
  releasePrevA: "release-a",
  releasePrevB: "release-b",
  deployPrevA: "production-deploy-a",
  deployPrevB: "production-deploy-b",
  envVersionPrevA: "production-version-a",
  envVersionPrevB: "production-version-b",
};

const records = buildParityVersionHistoryRecords({
  ids,
  pinnedCommit: "a".repeat(40),
  digestA: `sha256:${"a".repeat(64)}`,
  digestB: `sha256:${"b".repeat(64)}`,
  capturedAt: new Date("2026-08-09T00:00:00.000Z"),
});

assert.equal(records.length, 2);
assert.equal(records[0].kind, "deploy");
assert.equal(records[1].kind, "upgrade");
assert.equal(records[0].productionDeploymentId, "production-deploy-a");
assert.equal(records[1].releaseRunId, "release-b");
assert.notEqual(records[0].inputHash, records[1].inputHash);
assert.ok(records[0].effectiveAt < records[1].effectiveAt);
assert.ok(parityHistoryOrderCreatedAt(records) < records[0].effectiveAt);
assert.deepEqual(parityHistoryArtifactItem(records[0]), {
  id: records[0].manifestItemId,
  manifestId: records[0].manifestId,
  componentKey: "project-bundle",
  artifactType: "zip",
  uri: "release-artifact://build-a/bundle.zip",
  digest: records[0].digest,
  metadata: { seededBaseline: true },
});

const scope = { teamId: "team", projectId: "project" };
const staging = parityHistoryDeploymentData(
  { ...ids, user: "user", envStaging: "staging" },
  scope,
  records[0],
  "staging",
);
const approval = parityHistoryApprovalData(
  {
    ...ids,
    user: "user",
    project: "project",
    orderPrev: "order",
    envProduction: "production",
    envStaging: "staging",
  },
  scope,
  records[0],
);
assert.equal(staging.result.manifestId, records[0].manifestId);
assert.equal(staging.result.manifestDigest, records[0].digest);
assert.equal(approval.metadata.snapshot.projectId, "project");
assert.equal(approval.metadata.snapshot.environment.id, "production");
assert.equal(
  approval.metadata.snapshot.stagingProof.finishedAt,
  records[0].effectiveAt.toISOString(),
);

const collision = records.map((entry) => ({ ...entry }));
collision[1].approvalId = collision[0].approvalId;
assert.throws(
  () => assertParityVersionHistoryRecords(collision),
  /approvalId identities must be nonempty and distinct/,
);

process.stdout.write("parity seed version history self-test passed\n");
