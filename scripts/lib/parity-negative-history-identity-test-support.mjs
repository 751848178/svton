import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { historyStepChecks } from "./parity-history-e2e-evidence.mjs";
import { parseNegativeHistoryEvidence } from "./parity-negative-history-contract.mjs";
import {
  acceptanceFromSteps,
  historyDocumentFixture,
} from "./parity-negative-history-contract-fixture.mjs";
import { historyAnchorFixture } from "./parity-negative-history-staging-fixture.mjs";

export function fixtureAnchors(document) {
  return historyAnchorFixture(document.context);
}

export function parseHistory(document) {
  const bytes = Buffer.from(JSON.stringify(document));
  return parseNegativeHistoryEvidence(bytes, {
    evidencePath: "/explicit/history.json",
    expectedSha256: createHash("sha256").update(bytes).digest("hex"),
    capturedNotBefore: "2026-08-08T00:00:00Z",
    capturedNotAfter: "2026-08-08T01:00:00Z",
    nowMs: Date.parse("2026-08-08T02:00:00Z"),
  });
}

export function rejectIdentity(label, mutate, refreshed = []) {
  const document = historyDocumentFixture();
  mutate(document, fixtureAnchors(document));
  for (const name of refreshed) {
    const step = document.steps[name];
    step.checks = historyStepChecks(name, step.result);
    assert.deepEqual(
      step.checks.filter((item) => item.pass !== true),
      [],
      `${label} must stay canonically self-consistent at ${name}`,
    );
  }
  document.ac = acceptanceFromSteps(document.steps);
  assert.throws(() => parseHistory(document), undefined, label);
}
