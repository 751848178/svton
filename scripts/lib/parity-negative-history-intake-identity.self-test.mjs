#!/usr/bin/env node
import assert from "node:assert/strict";
import { historyStepChecks } from "./parity-history-e2e-evidence.mjs";
import { validateTrustedHistoryBase } from "./parity-negative-history-base-identity.mjs";
import { historyDocumentFixture } from "./parity-negative-history-contract-fixture.mjs";
import { trustedIntakeContextValid } from "./parity-negative-history-intake-identity.mjs";

const valid = historyDocumentFixture();
assert.equal(trustedIntakeContextValid(valid.context), true);
assert.equal(
  validateTrustedHistoryBase(valid.steps["base-state-rows"], valid.context)
    .repositoryIdentityId,
  "identity",
);

for (const [label, mutate] of [
  ["review hash", (context) => (context.reviewSnapshotHash = "not-a-hash")],
  ["local port", (context) => (context.finalSitePort = 80)],
  [
    "service alias",
    (context) =>
      (context.applicationContracts[0].production.id =
        context.applicationContracts[0].staging.id),
  ],
  [
    "extra contract key",
    (context) => (context.applicationContracts[0].untrusted = true),
  ],
]) {
  const document = historyDocumentFixture();
  mutate(document.context);
  document.steps["base-state-rows"].result.expected = structuredClone(
    document.context,
  );
  const step = document.steps["base-state-rows"];
  step.checks = historyStepChecks("base-state-rows", step.result);
  assert.throws(
    () => validateTrustedHistoryBase(step, document.context),
    /intake-context/,
    label,
  );
}

process.stdout.write("negative history intake identity self-test passed\n");
