#!/usr/bin/env node
import assert from "node:assert/strict";
import { extractPositiveHistoryContext } from "./parity-history-context.mjs";

const AC_MAPPING = {
  "AC-E2E-007": [
    "preflight",
    "intake-draft",
    "intake-connect",
    "intake-analyze",
    "intake-contract",
    "intake-review",
    "intake-finalize",
  ],
  "AC-E2E-008": ["intake-finalize", "baselines-verified"],
  "AC-E2E-009": [
    "env-r1-current",
    "env-targets",
    "env-save-r2-staging",
    "env-save-r2-production",
  ],
  "AC-E2E-010": ["release-order"],
  "AC-E2E-011": ["build"],
  "AC-E2E-012": ["staging-deploy"],
  "AC-E2E-013": [
    "production-preview",
    "production-confirm",
    "approval-list",
    "approval-review",
    "production-execute",
  ],
  "AC-E2E-014": ["production-current-version", "release-run-final"],
  "AC-E2E-015": ["final-site-http"],
};

const valid = positiveDocument();
assert.deepEqual(failedChecks(valid), []);

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
  document.ac["AC-E2E-007"].sourceSteps.reverse();
});
assert.ok(failedChecks({}).length > 0, "empty payload must fail");

process.stdout.write("history positive context self-test passed\n");

function rejects(label, mutate) {
  const document = structuredClone(valid);
  mutate(document);
  assert.equal(acceptanceCheck(document).pass, false, label);
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

function positiveDocument() {
  const steps = {};
  for (const name of new Set(Object.values(AC_MAPPING).flat())) {
    steps[name] = passedStep();
  }
  steps.build.result = {
    buildRunId: "build",
    manifestId: "manifest",
    manifestDigest: `sha256:${"a".repeat(64)}`,
  };
  steps["staging-deploy"].result = { deploymentRunId: "staging-run" };
  steps["baselines-verified"].result = {
    stagingId: "staging",
    productionId: "production",
  };
  steps["production-current-version"].result = {
    stagingCurrent: "staging-version",
    currentEnvironmentVersionId: "production-version",
  };
  steps["env-save-r2-production"].result = {
    id: "config-2",
    snapshot: { routeSnapshot: { domains: ["example.test"] } },
  };
  steps["env-targets"].result = {
    production: { current: { targetRef: "target" } },
  };
  const ac = Object.fromEntries(
    Object.entries(AC_MAPPING).map(([id, sourceSteps]) => [
      id,
      {
        ok: true,
        sourceSteps,
        checkNames: sourceSteps.map((step) => `${step}:verified`),
      },
    ]),
  );
  return {
    status: "passed",
    capturedAt: "2026-08-08T00:00:00.000Z",
    stack: { pinnedCommit: "a".repeat(40) },
    context: { teamId: "team", projectId: "project", orderId: "order" },
    ac,
    steps,
  };
}

function passedStep() {
  return {
    ok: true,
    status: "passed",
    verified: true,
    checks: [{ name: "verified", pass: true }],
    result: {},
  };
}
