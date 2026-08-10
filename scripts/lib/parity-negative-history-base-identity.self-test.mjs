#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { historyStepChecks } from "./parity-history-e2e-evidence.mjs";
import {
  TRUSTED_BASE_CONTEXT_FIELDS,
  validateTrustedHistoryBase,
} from "./parity-negative-history-base-identity.mjs";
import { parseNegativeHistoryEvidence } from "./parity-negative-history-contract.mjs";
import { historyDocumentFixture } from "./parity-negative-history-contract-fixture.mjs";

const valid = historyDocumentFixture();
const anchors = validateTrustedHistoryBase(
  valid.steps["base-state-rows"],
  valid.context,
);
assert.equal(Object.isFrozen(anchors), true);
assert.equal(Object.isFrozen(anchors.productionRouteSnapshot), true);
assert.equal(anchors.productionReleaseRunId, "release-1");
const parsed = parseHistory(valid);
assert.equal(parsed.historyContractValid, true);
assert.equal(parsed.sourcePath, "/explicit/history.json");
assert.equal(parsed.status, "passed");

const detached = historyDocumentFixture();
const detachedContext = structuredClone(detached.context);
detached.steps["base-state-rows"].result.expected.teamId = "mutated";
assert.deepEqual(detached.context, detachedContext);

for (const key of [
  "sourcePath",
  "sourceSha",
  "sourceSha256",
  "expectedSourceSha256",
  "capturedAt",
  "worker",
  "objective",
  "status",
]) {
  rejectHistory(`extra context key: ${key}`, (document) => {
    document.context[key] = `untrusted-${key}`;
  });
}

for (const field of TRUSTED_BASE_CONTEXT_FIELDS) {
  rejectHistory(`coherent base substitution: ${field}`, (document) => {
    substituteBaseField(document, field, replacementFor(field));
    replayBaseChecks(document);
  });
}

for (const [label, mutate] of [
  ["missing expected field", (base) => delete base.expected.teamId],
  ["extra expected field", (base) => (base.expected.claim = true)],
  ["build status", (base) => (base.buildRuns[0].status = "failed")],
  [
    "build commit",
    (base) => (base.buildRuns[0].sourceCommitSha = "f".repeat(40)),
  ],
  ["staging kind", (base) => (base.stagingVersions[0].kind = "upgrade")],
  [
    "staging manifest",
    (base) => (base.stagingVersions[0].artifactManifestId = "other"),
  ],
  ["production kind", (base) => (base.productionVersions[0].kind = "deploy")],
  [
    "production manifest",
    (base) => (base.productionVersions[0].artifactManifestId = "other"),
  ],
  ["missing release", (base) => delete base.productionVersions[0].releaseRunId],
  ["staging pointer", (base) => (base.environments[0].key = "wrong")],
  [
    "duplicate staging version",
    (base) =>
      base.stagingVersions.push(structuredClone(base.stagingVersions[0])),
  ],
  [
    "duplicate production version",
    (base) =>
      base.productionVersions.push(structuredClone(base.productionVersions[0])),
  ],
  [
    "duplicate environment",
    (base) => base.environments.push(structuredClone(base.environments[0])),
  ],
  [
    "duplicate unrelated version",
    (base) =>
      base.stagingVersions.push(
        { id: "extra", kind: "deploy" },
        { id: "extra", kind: "deploy" },
      ),
  ],
]) {
  rejectHistory(label, (document) => {
    mutate(document.steps["base-state-rows"].result);
    replayBaseChecks(document);
  });
}

for (const [label, mutate] of [
  ["environment alias", aliasEnvironments],
  ["current version alias", aliasCurrentVersions],
  ["cross-array version duplicate", duplicateCrossArrayVersion],
]) {
  rejectHistory(label, (document) => {
    mutate(document);
    replayBaseChecks(document);
  });
}

process.stdout.write("negative history base identity self-test passed\n");

function parseHistory(document) {
  const bytes = Buffer.from(JSON.stringify(document));
  return parseNegativeHistoryEvidence(bytes, {
    evidencePath: "/explicit/history.json",
    expectedSha256: createHash("sha256").update(bytes).digest("hex"),
    capturedNotBefore: "2026-08-08T00:00:00Z",
    capturedNotAfter: "2026-08-08T01:00:00Z",
    nowMs: Date.parse("2026-08-08T02:00:00Z"),
  });
}

function replayBaseChecks(document) {
  const step = document.steps["base-state-rows"];
  step.checks = historyStepChecks("base-state-rows", step.result);
  assert.deepEqual(
    step.checks.filter((item) => item.pass !== true),
    [],
    "adversarial mutation must remain canonically self-consistent",
  );
}

function replacementFor(field) {
  if (field === "manifestDigest") return `sha256:${"e".repeat(64)}`;
  if (field === "pinnedCommit") return "e".repeat(40);
  if (field === "sourceEvidenceSha256") return "e".repeat(64);
  if (field === "productionRouteSnapshot") {
    return {
      domains: ["substituted.example.test"],
      proxyTarget: "http://substituted",
      tlsRequired: false,
    };
  }
  return `substituted-${field}`;
}

function substituteBaseField(document, field, replacement) {
  const base = document.steps["base-state-rows"].result;
  base.expected[field] = replacement;
  if (field === "buildRunId") {
    base.buildRuns[0].id = replacement;
    base.manifests[0].buildRunId = replacement;
  } else if (field === "manifestId") {
    base.manifests[0].id = replacement;
    base.stagingVersions[0].artifactManifestId = replacement;
    base.productionVersions[0].artifactManifestId = replacement;
  } else if (field === "manifestDigest") {
    base.manifests[0].digest = replacement;
  } else if (field === "stagingEnvId") {
    base.environments[0].id = replacement;
  } else if (field === "productionEnvId") {
    base.environments[1].id = replacement;
  } else if (field === "stagingDeploymentRunId") {
    base.stagingVersions[0].deploymentRunId = replacement;
  } else if (field === "stagingCurrentVersionId") {
    base.stagingVersions[0].id = replacement;
    base.environments[0].currentEnvironmentVersionId = replacement;
  } else if (field === "productionCurrentVersionId") {
    base.productionVersions[0].id = replacement;
    base.environments[1].currentEnvironmentVersionId = replacement;
  } else if (field === "pinnedCommit") {
    base.buildRuns[0].sourceCommitSha = replacement;
  }
}

function aliasEnvironments(document) {
  const stagingId = document.context.stagingEnvId;
  substituteBaseField(document, "productionEnvId", stagingId);
  document.context.productionEnvId = stagingId;
}

function aliasCurrentVersions(document) {
  const stagingId = document.context.stagingCurrentVersionId;
  substituteBaseField(document, "productionCurrentVersionId", stagingId);
  document.context.productionCurrentVersionId = stagingId;
}

function duplicateCrossArrayVersion(document) {
  const base = document.steps["base-state-rows"].result;
  base.stagingVersions.push({ id: "cross-version" });
  base.productionVersions.push({ id: "cross-version" });
}

function rejectHistory(label, mutate) {
  const document = historyDocumentFixture();
  mutate(document);
  assert.throws(() => parseHistory(document), undefined, label);
}
