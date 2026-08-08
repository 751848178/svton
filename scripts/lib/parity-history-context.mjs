import { predicate, check } from "./parity-e2e-evidence.mjs";
import {
  POSITIVE_ACCEPTANCE_IDS,
  POSITIVE_AC_MAPPING,
} from "./parity-positive-e2e-contract.mjs";

export function extractPositiveHistoryContext(document, sourceSha256) {
  const ids = document.context || document.fixedIds || {};
  const steps = document.steps || {};
  const build = steps.build?.result || {};
  const staging = steps["staging-deploy"]?.result || {};
  const baselines = steps["baselines-verified"]?.result || {};
  const versions = steps["production-current-version"]?.result || {};
  const productionConfig = steps["env-save-r2-production"]?.result || {};
  const targets = steps["env-targets"]?.result || {};
  const context = {
    teamId: ids.teamId,
    projectId: ids.projectId,
    orderId: ids.orderId,
    stagingEnvId: ids.stagingEnvId || baselines.stagingId,
    productionEnvId: ids.productionEnvId || baselines.productionId,
    buildRunId: build.buildRunId,
    manifestId: build.manifestId,
    manifestDigest: build.manifestDigest,
    stagingDeploymentRunId: staging.deploymentRunId,
    stagingCurrentVersionId: versions.stagingCurrent,
    productionCurrentVersionId: versions.currentEnvironmentVersionId,
    productionConfigRevisionId: productionConfig.id,
    productionRouteSnapshot: productionConfig.snapshot?.routeSnapshot,
    productionTargetRef: targets.production?.current?.targetRef,
    pinnedCommit: document.stack?.pinnedCommit,
    sourceEvidenceSha256: sourceSha256,
  };
  return { context, checks: positiveContextChecks(document, context) };
}

export function positiveContextChecks(document, context) {
  const requiredIds = [
    "teamId",
    "projectId",
    "orderId",
    "stagingEnvId",
    "productionEnvId",
    "buildRunId",
    "manifestId",
    "stagingDeploymentRunId",
    "stagingCurrentVersionId",
    "productionCurrentVersionId",
    "productionConfigRevisionId",
    "productionTargetRef",
    "pinnedCommit",
  ];
  return [
    check("positiveEvidenceStatus", document.status, "passed"),
    predicate(
      "positiveEvidenceHash",
      /^[a-f0-9]{64}$/.test(context.sourceEvidenceSha256 || ""),
      context.sourceEvidenceSha256,
    ),
    predicate(
      "positiveEvidenceCapturedAt",
      Number.isFinite(Date.parse(document.capturedAt || "")),
      document.capturedAt,
    ),
    predicate(
      "positiveEvidenceAcceptance",
      positiveAcceptanceValid(document),
      document.ac,
    ),
    predicate(
      "dynamicContextIds",
      requiredIds.every((key) => Boolean(context[key])),
      requiredIds.filter((key) => !context[key]),
    ),
    predicate(
      "manifestDigest",
      /^sha256:[a-f0-9]{64}$/.test(context.manifestDigest || ""),
      context.manifestDigest,
    ),
    predicate(
      "productionRouteSnapshot",
      Array.isArray(context.productionRouteSnapshot?.domains) &&
        context.productionRouteSnapshot.domains.length > 0,
      context.productionRouteSnapshot,
    ),
  ];
}

function positiveAcceptanceValid(document) {
  const acceptance = document.ac || {};
  const actualIds = Object.keys(acceptance).sort();
  if (!sameArray(actualIds, POSITIVE_ACCEPTANCE_IDS)) return false;
  return POSITIVE_ACCEPTANCE_IDS.every((acId) =>
    acceptanceEntryValid(acId, acceptance[acId], document.steps || {}),
  );
}

function acceptanceEntryValid(acId, entry, steps) {
  const canonicalSteps = POSITIVE_AC_MAPPING[acId];
  if (
    entry?.ok !== true ||
    !Array.isArray(entry.sourceSteps) ||
    entry.sourceSteps.length === 0 ||
    !entry.sourceSteps.every(nonEmptyString) ||
    new Set(entry.sourceSteps).size !== entry.sourceSteps.length ||
    !sameArray(entry.sourceSteps, canonicalSteps) ||
    !uniqueNonEmptyStrings(entry.checkNames)
  ) {
    return false;
  }
  const expectedCheckNames = [];
  for (const stepName of canonicalSteps) {
    const step = steps[stepName];
    if (!verifiedStep(step)) return false;
    expectedCheckNames.push(
      ...step.checks.map((item) => `${stepName}:${item.name}`),
    );
  }
  return (
    uniqueNonEmptyStrings(expectedCheckNames) &&
    sameArray(entry.checkNames, expectedCheckNames)
  );
}

function verifiedStep(step) {
  return (
    step?.ok === true &&
    step.status === "passed" &&
    step.verified === true &&
    Array.isArray(step.checks) &&
    step.checks.length > 0 &&
    step.checks.every((item) => item?.pass === true) &&
    uniqueNonEmptyStrings(step.checks.map((item) => item?.name))
  );
}

function uniqueNonEmptyStrings(values) {
  return (
    Array.isArray(values) &&
    values.length > 0 &&
    values.every(nonEmptyString) &&
    new Set(values).size === values.length
  );
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function sameArray(actual, expected) {
  return (
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  );
}
