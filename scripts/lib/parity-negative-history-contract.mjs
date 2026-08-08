import { createHash } from "node:crypto";
import { HISTORY_AC_MAPPING } from "./parity-history-e2e-evidence.mjs";
import {
  TRUSTED_BASE_CONTEXT_FIELDS,
  validateTrustedHistoryBase,
} from "./parity-negative-history-base-identity.mjs";
import {
  canonicalHistoryStepValid,
  sameJsonValue,
} from "./parity-negative-history-check-contract.mjs";

export const HISTORY_WORKER = "f456-version-history-e2e";
export const HISTORY_OBJECTIVE =
  "AC-E2E-016..023 multiple builds / repeat staging / upgrade-rollback E2E";
const CLOCK_SKEW_MS = 5_000;
const REQUIRED_CONTEXT = (
  "teamId projectId orderId stagingEnvId productionEnvId buildRunId " +
  "manifestId manifestDigest stagingDeploymentRunId stagingCurrentVersionId " +
  "productionCurrentVersionId productionConfigRevisionId productionTargetRef pinnedCommit"
).split(" ");

export function parseNegativeHistoryEvidence(bytes, input) {
  requireInputs(input);
  const sourceSha256 = createHash("sha256").update(bytes).digest("hex");
  requireValue(sourceSha256 === input.expectedSha256, "history SHA mismatch");
  const document = JSON.parse(bytes.toString("utf8"));
  requireValue(document.worker === HISTORY_WORKER, "history worker mismatch");
  requireValue(
    document.objective === HISTORY_OBJECTIVE,
    "history objective mismatch",
  );
  requireValue(document.status === "passed", "history status mismatch");
  validateCapturedAt(document.capturedAt, input);
  const context = document.context;
  requireValue(isObject(context), "history context missing");
  requireValue(
    REQUIRED_CONTEXT.every((name) => nonEmpty(context[name])),
    "history context incomplete",
  );
  const baseStep = document.steps?.["base-state-rows"];
  const baseAnchors = validateTrustedHistoryBase(baseStep, context);
  requireValue(validateAcceptance(document), "history acceptance invalid");
  const trustedContext = Object.fromEntries(
    TRUSTED_BASE_CONTEXT_FIELDS.map((name) => [name, baseAnchors[name]]),
  );
  return Object.freeze({
    ...trustedContext,
    ...manifestContext(document, baseAnchors),
    sourcePath: input.evidencePath,
    sourceSha256,
    expectedSourceSha256: input.expectedSha256,
    capturedAt: document.capturedAt,
    worker: document.worker,
    objective: document.objective,
    status: document.status,
    historyAcceptanceIds: Object.keys(document.ac).sort(),
    historyAcceptancePassed: true,
    historyContractValid: true,
  });
}

function requireInputs(input) {
  requireValue(isObject(input), "history input missing");
  for (const name of "evidencePath expectedSha256 capturedNotBefore capturedNotAfter".split(
    " ",
  )) {
    requireValue(nonEmpty(input[name]), `history ${name} missing`);
  }
  requireValue(
    /^[a-f0-9]{64}$/.test(input.expectedSha256),
    "history SHA invalid",
  );
  const before = Date.parse(input.capturedNotBefore);
  const after = Date.parse(input.capturedNotAfter);
  requireValue(
    Number.isFinite(before) && Number.isFinite(after) && before <= after,
    "history window invalid",
  );
}

function validateCapturedAt(value, input) {
  const captured = Date.parse(value || "");
  const before = Date.parse(input.capturedNotBefore);
  const after = Date.parse(input.capturedNotAfter);
  const now = input.nowMs ?? Date.now();
  requireValue(Number.isFinite(captured), "history capturedAt invalid");
  requireValue(
    captured >= before && captured <= after,
    "history capturedAt outside window",
  );
  requireValue(captured <= now + CLOCK_SKEW_MS, "history capturedAt is future");
}

function validateAcceptance(document) {
  const ac = document.ac;
  const expectedIds = Object.keys(HISTORY_AC_MAPPING).sort();
  if (!isObject(ac) || !sameJsonValue(Object.keys(ac).sort(), expectedIds))
    return false;
  return expectedIds.every((acId) => {
    const entry = ac[acId];
    const sourceSteps = HISTORY_AC_MAPPING[acId];
    if (
      entry?.ok !== true ||
      !sameJsonValue(entry.sourceSteps, sourceSteps) ||
      entry.failures !== undefined
    )
      return false;
    const expanded = [];
    for (const stepName of sourceSteps) {
      const step = document.steps?.[stepName];
      if (!canonicalHistoryStepValid(stepName, step)) return false;
      expanded.push(...step.checks.map((item) => `${stepName}:${item.name}`));
    }
    return (
      Array.isArray(entry.checkNames) &&
      entry.checkNames.length > 0 &&
      sameJsonValue(entry.checkNames, expanded)
    );
  });
}

function manifestContext(document, baseAnchors) {
  const build2 = document.steps?.["build-2"]?.result;
  requireValue(
    build2?.status === "succeeded" && nonEmpty(build2.buildRunId),
    "history B2 invalid",
  );
  requireValue(
    nonEmpty(build2.manifestId) && build2.manifestId !== baseAnchors.manifestId,
    "history M2 invalid",
  );
  requireValue(
    digest(baseAnchors.manifestDigest) && digest(build2.manifestDigest),
    "history digest invalid",
  );
  return {
    manifestM1: baseAnchors.manifestId,
    manifestM1Digest: baseAnchors.manifestDigest,
    buildRunM1: baseAnchors.buildRunId,
    productionReleaseRunR1: baseAnchors.productionReleaseRunId,
    manifestM2: build2.manifestId,
    manifestM2Digest: build2.manifestDigest,
    buildRunM2: build2.buildRunId,
  };
}

function digest(value) {
  return /^sha256:[a-f0-9]{64}$/.test(value || "");
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireValue(value, message) {
  if (!value) throw new Error(message);
}
