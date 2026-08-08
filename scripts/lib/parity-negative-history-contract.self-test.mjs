#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadNegativeHistoryContext } from "./parity-negative-e2e-context.mjs";
import {
  HISTORY_OBJECTIVE,
  HISTORY_WORKER,
  parseNegativeHistoryEvidence,
} from "./parity-negative-history-contract.mjs";
import { HISTORY_AC_MAPPING } from "./parity-history-e2e-evidence.mjs";

const document = historyDocument();
const bytes = Buffer.from(JSON.stringify(document));
const parsed = parseNegativeHistoryEvidence(bytes, historyInput(bytes));
assert.equal(parsed.historyContractValid, true);
assert.equal(parsed.manifestM1, document.context.manifestId);
assert.equal(parsed.manifestM2, document.steps["build-2"].result.manifestId);

const temporary = await mkdtemp(join(tmpdir(), "f513-history-"));
const evidencePath = join(temporary, "history.json");
await writeFile(evidencePath, bytes);
assert.equal(
  (await loadNegativeHistoryContext({ ...historyInput(bytes), evidencePath }))
    .sourcePath,
  evidencePath,
);
await assert.rejects(loadNegativeHistoryContext({}), /evidencePath/);
await rm(temporary, { recursive: true });

rejectHistory("legacy fixedIds", (value) => {
  value.fixedIds = value.context;
  delete value.context;
});
rejectHistory("wrong SHA", () => {}, { expectedSha256: "0".repeat(64) });
rejectHistory("old capture", (value) => {
  value.capturedAt = "2026-08-07T00:00:00Z";
});
rejectHistory(
  "future capture",
  (value) => {
    value.capturedAt = "2026-08-09T00:00:00Z";
  },
  { capturedNotAfter: "2026-08-10T00:00:00Z" },
);
for (const [label, mutate] of [
  ["wrong worker", (value) => (value.worker = "wrong")],
  ["wrong objective", (value) => (value.objective = "wrong")],
  ["wrong status", (value) => (value.status = "failed")],
  ["extra AC", (value) => (value.ac["AC-E2E-999"] = value.ac["AC-E2E-023"])],
  ["missing AC", (value) => delete value.ac["AC-E2E-023"]],
  [
    "wrong sourceSteps",
    (value) => value.ac["AC-E2E-016"].sourceSteps.reverse(),
  ],
  [
    "wrong checkNames",
    (value) => (value.ac["AC-E2E-016"].checkNames = ["claimed"]),
  ],
  [
    "claimed AC failure",
    (value) => (value.ac["AC-E2E-016"].failures = ["build-2:failed"]),
  ],
  ["empty checks", (value) => (value.steps["build-2"].checks = [])],
  ["failed check", (value) => (value.steps["build-2"].checks[0].pass = false)],
  ["failed base step", (value) => (value.steps["base-state-rows"].ok = false)],
  ["missing context", (value) => delete value.context.teamId],
  ["context/base mismatch", (value) => (value.context.manifestId = "wrong")],
]) {
  rejectHistory(label, mutate);
}

for (const name of [
  "evidencePath",
  "expectedSha256",
  "capturedNotBefore",
  "capturedNotAfter",
]) {
  const input = historyInput(bytes);
  delete input[name];
  assert.throws(() => parseNegativeHistoryEvidence(bytes, input));
}

process.stdout.write("negative history contract self-test passed\n");

function historyDocument() {
  const context = {
    teamId: "team",
    projectId: "project",
    orderId: "order",
    stagingEnvId: "staging",
    productionEnvId: "production",
    buildRunId: "build-1",
    manifestId: "manifest-1",
    manifestDigest: `sha256:${"a".repeat(64)}`,
    stagingDeploymentRunId: "deploy-1",
    stagingCurrentVersionId: "staging-v1",
    productionCurrentVersionId: "production-v1",
    productionConfigRevisionId: "config-1",
    productionTargetRef: "target",
    pinnedCommit: "a".repeat(40),
  };
  const steps = Object.fromEntries(
    [...new Set(Object.values(HISTORY_AC_MAPPING).flat())].map((name) => [
      name,
      passedStep(),
    ]),
  );
  steps["base-state-rows"] = passedStep({
    buildRuns: [{ id: context.buildRunId }],
    manifests: [
      {
        id: context.manifestId,
        digest: context.manifestDigest,
        buildRunId: context.buildRunId,
      },
    ],
    expected: context,
  });
  steps["build-2"].result = {
    status: "succeeded",
    buildRunId: "build-2",
    manifestId: "manifest-2",
    manifestDigest: `sha256:${"b".repeat(64)}`,
  };
  const ac = Object.fromEntries(
    Object.entries(HISTORY_AC_MAPPING).map(([id, sourceSteps]) => [
      id,
      {
        ok: true,
        sourceSteps,
        checkNames: sourceSteps.map((name) => `${name}:verified`),
      },
    ]),
  );
  return {
    worker: HISTORY_WORKER,
    objective: HISTORY_OBJECTIVE,
    status: "passed",
    capturedAt: "2026-08-08T00:00:00Z",
    context,
    steps,
    ac,
  };
}

function passedStep(result = {}) {
  return {
    ok: true,
    status: "passed",
    verified: true,
    checks: [{ name: "verified", pass: true }],
    result,
  };
}

function historyInput(value) {
  return {
    evidencePath: "/explicit/history.json",
    expectedSha256: createHash("sha256").update(value).digest("hex"),
    capturedNotBefore: "2026-08-08T00:00:00Z",
    capturedNotAfter: "2026-08-08T01:00:00Z",
    nowMs: Date.parse("2026-08-08T02:00:00Z"),
  };
}

function rejectHistory(label, mutate, overrides = {}) {
  const value = historyDocument();
  mutate(value);
  const candidate = Buffer.from(JSON.stringify(value));
  assert.throws(
    () =>
      parseNegativeHistoryEvidence(candidate, {
        ...historyInput(candidate),
        ...overrides,
      }),
    undefined,
    label,
  );
}
