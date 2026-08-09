import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { checkedStep, finishEvidence } from "./parity-e2e-evidence.mjs";
import {
  NEGATIVE_AC_MAPPING,
  negativeStepChecks,
} from "./parity-negative-e2e-evidence.mjs";

async function mustReject(name, result) {
  const evidence = { status: "running", steps: {} };
  await assert.rejects(
    checkedStep(
      evidence,
      name,
      async () => result,
      (value) => negativeStepChecks(name, value),
    ),
    (error) => error.code === "E2E_ASSERTION_FAILED",
  );
}

function mustPass(name, result) {
  const failed = negativeStepChecks(name, result).filter(
    (check) => check.pass !== true,
  );
  assert.deepEqual(failed, [], `${name} should pass canonical result`);
}

const driftRejection = {
  status: 422,
  code: 422,
  message: "Production ReleaseRun 未批准、已使用或输入已漂移",
  dbDeploymentRunWithRun: 0,
  currentPointerUnchanged: true,
};
mustPass("ac-029-old-confirm-execute-rejected", driftRejection);
await mustReject("ac-029-old-confirm-execute-rejected", {
  ...driftRejection,
  code: undefined,
});

const approvalRejection = {
  executeStatus: 422,
  code: 422,
  dbDeploymentRunWithRun: 0,
  approvalStatus: "rejected",
  runStatusBeforeCleanup: "awaiting_approval",
  runCanceled: true,
};
mustPass("ac-030-rejected-approval", approvalRejection);
mustPass("ac-030-expired-approval", {
  ...approvalRejection,
  approvalStatus: "approved",
  approvalExpired: true,
});
mustPass("ac-030-consumed-approval", {
  ...approvalRejection,
  approvalStatus: "approved",
  approvalConsumedAtSet: true,
});
await mustReject("ac-030-rejected-approval", {
  ...approvalRejection,
  code: undefined,
});

const sameKeyConcurrency = {
  ok: true,
  firstStatus: 201,
  secondStatus: 201,
  releaseRunCount: 1,
};
mustPass("ac-031-same-idempotency-key", sameKeyConcurrency);
await mustReject("ac-031-same-idempotency-key", {
  ...sameKeyConcurrency,
  ok: false,
  firstStatus: 200,
  secondStatus: 200,
});

const differentKeyConcurrency = {
  ok: true,
  firstStatus: 201,
  secondStatus: 409,
  effectiveReleaseRunCount: 1,
  environmentMaxOneRunEnforced: true,
  winnerRunId: "release-run-winner",
  winnerApprovalId: "approval-winner",
};
mustPass("ac-031-different-idempotency-keys", differentKeyConcurrency);
await mustReject("ac-031-different-idempotency-keys", {
  ...differentKeyConcurrency,
  ok: false,
  firstStatus: 200,
});

await mustReject("ac-024-build-no-repo-rejected", {
  status: 200,
  code: "RELEASE_GATE_BLOCKED",
  decisionAllowed: false,
  decisionBlockers: ["C01"],
  decisionStage: "build",
  decisionConsumedAtNull: true,
  dbBuildRunDelta: 0,
});
await mustReject("ac-027-cross-order-manifest", {
  status: 404,
  dbDeploymentRunDelta: 1,
});
await mustReject("ac-035-secret-scan", {
  requiredArtifactCount: 0,
  missingRequiredArtifacts: [],
  unexpectedHits: 0,
  passed: true,
});
await mustReject("ac-035-secret-scan", {
  requiredArtifactCount: 9,
  missingRequiredArtifacts: [],
  unexpectedHits: 1,
  passed: false,
});
await mustReject("ac-028-restore-digest", { restored: true });
await mustReject("history-context", {
  status: "passed",
  projectId: "parity-project-0001",
  orderId: "parity-order-0001",
  sourceSha256: "a".repeat(64),
  historyAcceptanceIds: Array.from(
    { length: 8 },
    (_, index) => `WRONG-${index}`,
  ),
  historyAcceptancePassed: true,
  manifestM1: "m1",
  manifestM2: "m2",
  manifestM1Digest: `sha256:${"a".repeat(64)}`,
  manifestM2Digest: `sha256:${"b".repeat(64)}`,
  crossOrderManifestId: "cross",
});

const incomplete = { status: "running", steps: {} };
assert.throws(
  () => finishEvidence(incomplete, NEGATIVE_AC_MAPPING),
  (error) => error.code === "E2E_ASSERTION_FAILED",
);
assert.equal(Object.keys(NEGATIVE_AC_MAPPING).length, 12);
for (const name of new Set(Object.values(NEGATIVE_AC_MAPPING).flat())) {
  const checks = negativeStepChecks(name, {});
  assert.ok(checks.length > 0, `${name} must emit checks`);
  assert.ok(
    checks.some((item) => item.pass !== true),
    `${name} must reject an empty result`,
  );
}

const driver = await readFile(
  resolve("scripts/parity-negative-e2e.mjs"),
  "utf8",
);
const driverSteps = [...driver.matchAll(/await step\("([^"]+)"/g)].map(
  (match) => match[1],
);
const mappedSteps = new Set(Object.values(NEGATIVE_AC_MAPPING).flat());
assert.equal(driverSteps.length, 46);
assert.equal(new Set(driverSteps).size, driverSteps.length);
assert.deepEqual([...new Set(driverSteps)].sort(), [...mappedSteps].sort());
assert.doesNotMatch(driver, /\bok:\s*true\b/);
assert.doesNotMatch(driver, /evidence\.status\s*=\s*["']passed["']/);
assert.match(driver, /finishEvidence\(evidence, NEGATIVE_AC_MAPPING\)/);
process.stdout.write("negative e2e evidence self-test passed\n");
