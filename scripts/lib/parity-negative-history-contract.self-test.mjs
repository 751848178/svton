#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadNegativeHistoryContext } from "./parity-negative-e2e-context.mjs";
import { parseNegativeHistoryEvidence } from "./parity-negative-history-contract.mjs";
import { HISTORY_AC_MAPPING } from "./parity-history-e2e-evidence.mjs";
import {
  acceptanceFromSteps,
  historyDocumentFixture,
} from "./parity-negative-history-contract-fixture.mjs";

const document = historyDocumentFixture();
const bytes = Buffer.from(JSON.stringify(document));
const parsed = parseNegativeHistoryEvidence(bytes, historyInput(bytes));
assert.equal(parsed.historyContractValid, true);
assert.equal(parsed.historyIdentityGraphValid, true);
assert.equal(parsed.manifestM1, document.context.manifestId);
assert.equal(parsed.manifestM2, document.steps["build-2"].result.manifestId);
assert.equal(parsed.productionReleaseRunR1, "release-1");

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

const canonicalSteps = [...new Set(Object.values(HISTORY_AC_MAPPING).flat())];
for (const stepName of canonicalSteps) {
  rejectHistory(`coherent claim substitution: ${stepName}`, (value) => {
    value.steps[stepName].checks = [
      { name: "claim", pass: true, actual: true, expected: true },
    ];
    value.ac = acceptanceFromSteps(value.steps);
  });
}

for (const [label, mutate] of [
  ["canonical check order", (value) => value.steps["build-2"].checks.reverse()],
  [
    "canonical check actual",
    (value) => (value.steps.login.checks[0].actual = "claimed"),
  ],
  [
    "canonical check expected",
    (value) => (value.steps.login.checks[0].expected = "claimed"),
  ],
  [
    "canonical check missing field",
    (value) => delete value.steps.login.checks[0].actual,
  ],
  [
    "canonical check extra field",
    (value) => (value.steps.login.checks[0].claim = true),
  ],
  [
    "semantic result drift",
    (value) => (value.steps.login.result.source = "claimed"),
  ],
  [
    "base step claim substitution",
    (value) =>
      (value.steps["base-state-rows"].checks = [
        { name: "claim", pass: true, actual: true, expected: true },
      ]),
  ],
]) {
  rejectHistory(label, (value) => {
    mutate(value);
    value.ac = acceptanceFromSteps(value.steps);
  });
}

const productionChecks = document.steps["production-upgrade-execute"].checks;
assert.ok(
  new Set(productionChecks.map((item) => item.name)).size <
    productionChecks.length,
  "valid canonical duplicate names must be exercised",
);

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
  const value = historyDocumentFixture();
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
