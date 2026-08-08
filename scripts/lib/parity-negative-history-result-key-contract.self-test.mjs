#!/usr/bin/env node
import assert from "node:assert/strict";
import { HISTORY_RESULT_KEY_INVENTORY } from "./parity-negative-history-result-key-inventory.mjs";
import { historyDocumentFixture } from "./parity-negative-history-contract-fixture.mjs";
import { rejectIdentity } from "./parity-negative-history-identity-test-support.mjs";
import { validateHistoryResultKeys } from "./parity-negative-history-result-key-contract.mjs";

const document = historyDocumentFixture();
for (const [step, expectedKeys] of Object.entries(
  HISTORY_RESULT_KEY_INVENTORY,
)) {
  assert.deepEqual(
    Object.keys(document.steps[step].result).sort(),
    expectedKeys,
    step,
  );
}
validateHistoryResultKeys(document.steps);

for (const [step, expectedKeys] of Object.entries(
  HISTORY_RESULT_KEY_INVENTORY,
)) {
  const withUnknown = historyDocumentFixture();
  withUnknown.steps[step].result[`unknown-${step}`] = true;
  assert.throws(
    () => validateHistoryResultKeys(withUnknown.steps),
    undefined,
    `unknown:${step}`,
  );
  const withMissing = historyDocumentFixture();
  delete withMissing.steps[step].result[expectedKeys[0]];
  assert.throws(
    () => validateHistoryResultKeys(withMissing.steps),
    undefined,
    `missing:${step}`,
  );
  rejectIdentity(
    `rejects after canonical regeneration: ${step}`,
    (value) => {
      value.steps[step].result[`unknown-${step}`] = true;
    },
    [step],
  );
}

process.stdout.write("negative history result key contract self-test passed\n");
