#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { extractPositiveHistoryContext } from "./parity-history-context.mjs";
import {
  expectedPositiveContext,
  passedStep,
  positiveDocument,
} from "./parity-history-context.fixture.mjs";
import {
  POSITIVE_ACCEPTANCE_IDS,
  POSITIVE_AC_MAPPING,
} from "./parity-positive-e2e-contract.mjs";

const valid = positiveDocument();
assert.deepEqual(failedChecks(valid), []);
assert.deepEqual(POSITIVE_ACCEPTANCE_IDS, [
  "AC-E2E-007",
  "AC-E2E-008",
  "AC-E2E-009",
  "AC-E2E-010",
  "AC-E2E-011",
  "AC-E2E-012",
  "AC-E2E-013",
  "AC-E2E-014",
  "AC-E2E-015",
]);
assert.equal(Object.isFrozen(POSITIVE_AC_MAPPING), true);
for (const steps of Object.values(POSITIVE_AC_MAPPING)) {
  assert.equal(Object.isFrozen(steps), true);
  assert.ok(steps.length > 0 && new Set(steps).size === steps.length);
}
assert.deepEqual(
  extractPositiveHistoryContext(valid, "b".repeat(64)).context,
  expectedPositiveContext("b".repeat(64)),
);

for (const acId of POSITIVE_ACCEPTANCE_IDS) {
  rejects(`coherent substitution ${acId}`, (document) => {
    document.steps.fake = passedStep();
    document.ac[acId].sourceSteps = ["fake"];
    document.ac[acId].checkNames = ["fake:verified"];
  });
}
rejects("all ACs use fake step", (document) => {
  document.steps.fake = passedStep();
  for (const entry of Object.values(document.ac)) {
    entry.sourceSteps = ["fake"];
    entry.checkNames = ["fake:verified"];
  }
});

rejects("only one AC", (document) => {
  document.ac = { "AC-E2E-007": document.ac["AC-E2E-007"] };
});
rejects("missing one AC", (document) => {
  delete document.ac["AC-E2E-015"];
});
rejects("wrong AC ID", (document) => {
  document.ac["AC-E2E-999"] = document.ac["AC-E2E-015"];
  delete document.ac["AC-E2E-015"];
});
rejects("extra AC ID", (document) => {
  document.ac["AC-E2E-999"] = structuredClone(document.ac["AC-E2E-015"]);
});
rejects("source step missing", (document) => {
  delete document.steps.build;
});
rejects("source step ok false", (document) => {
  document.steps.build.ok = false;
});
rejects("source step status failed", (document) => {
  document.steps.build.status = "failed";
});
rejects("source step unverified", (document) => {
  document.steps.build.verified = false;
});
rejects("source step zero checks", (document) => {
  document.steps.build.checks = [];
});
rejects("source step failed check", (document) => {
  document.steps.build.checks[0].pass = false;
});
rejects("checkNames mismatch", (document) => {
  document.ac["AC-E2E-011"].checkNames = ["build:claimed"];
});
rejects("sourceSteps mismatch", (document) => {
  const entry = document.ac["AC-E2E-007"];
  entry.sourceSteps.reverse();
  entry.checkNames = entry.sourceSteps.map((step) => `${step}:verified`);
});
rejects("sourceSteps missing canonical step", (document) => {
  const entry = document.ac["AC-E2E-007"];
  entry.sourceSteps = entry.sourceSteps.slice(0, -1);
  entry.checkNames = entry.sourceSteps.map((step) => `${step}:verified`);
});
rejects("sourceSteps extra passed step", (document) => {
  const entry = document.ac["AC-E2E-011"];
  document.steps.fake = passedStep();
  entry.sourceSteps.push("fake");
  entry.checkNames.push("fake:verified");
});
rejects("legacy coherent top-level acceptance", (document) => {
  for (const acId of POSITIVE_ACCEPTANCE_IDS) document.ac[acId] = { ok: true };
});
rejectsCheck(
  "invalid capturedAt",
  (document) => {
    document.capturedAt = "invalid";
  },
  "positiveEvidenceCapturedAt",
);
rejectsCheck(
  "missing required context ID",
  (document) => {
    delete document.context.teamId;
  },
  "dynamicContextIds",
);
assert.ok(failedChecks({}).length > 0, "empty payload must fail");

const producer = await readFile(
  new URL("../parity-positive-e2e.mjs", import.meta.url),
  "utf8",
);
const consumer = await readFile(
  new URL("./parity-history-context.mjs", import.meta.url),
  "utf8",
);
for (const source of [producer, consumer]) {
  assert.match(source, /parity-positive-e2e-contract\.mjs/);
  assert.match(source, /POSITIVE_AC_MAPPING/);
}
assert.doesNotMatch(producer, /const AC_MAPPING\s*=/);

process.stdout.write("history positive context self-test passed\n");

function rejects(label, mutate) {
  const document = structuredClone(valid);
  mutate(document);
  assert.equal(acceptanceCheck(document).pass, false, label);
}

function rejectsCheck(label, mutate, checkName) {
  const document = structuredClone(valid);
  mutate(document);
  const check = extractPositiveHistoryContext(
    document,
    "b".repeat(64),
  ).checks.find((item) => item.name === checkName);
  assert.equal(check.pass, false, label);
}

function failedChecks(document) {
  return extractPositiveHistoryContext(document, "b".repeat(64)).checks.filter(
    (item) => !item.pass,
  );
}

function acceptanceCheck(document) {
  return extractPositiveHistoryContext(document, "b".repeat(64)).checks.find(
    (item) => item.name === "positiveEvidenceAcceptance",
  );
}
