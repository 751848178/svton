import { canonicalHistoryStepValid } from "./parity-negative-history-check-contract.mjs";

export const TRUSTED_BASE_CONTEXT_FIELDS = Object.freeze([
  "teamId",
  "projectId",
  "orderId",
  "stagingEnvId",
  "productionEnvId",
  "buildRunId",
  "manifestId",
  "manifestDigest",
  "stagingDeploymentRunId",
  "stagingCurrentVersionId",
  "productionCurrentVersionId",
  "productionConfigRevisionId",
  "productionTargetRef",
  "pinnedCommit",
  "productionRouteSnapshot",
  "sourceEvidenceSha256",
]);

export function validateTrustedHistoryBase(step, context) {
  requireValue(
    canonicalHistoryStepValid("base-state-rows", step),
    "canonical-replay",
  );
  validateContext(context);
  const result = step.result;
  const expected = result.expected;
  requireValue(isObject(expected), "expected-missing");
  requireValue(
    sameJson(
      Object.keys(expected).sort(),
      [...TRUSTED_BASE_CONTEXT_FIELDS].sort(),
    ),
    "expected-fields",
  );
  for (const field of TRUSTED_BASE_CONTEXT_FIELDS) {
    requireValue(
      sameJson(expected[field], context[field]),
      `expected-${field}`,
    );
  }

  requireValue(result.buildRuns?.length === 1, "build-count");
  requireValue(result.manifests?.length === 1, "manifest-count");
  const build = uniqueRow(result.buildRuns, context.buildRunId, "build");
  const manifest = uniqueRow(result.manifests, context.manifestId, "manifest");
  requireValue(build.status === "succeeded", "build-status");
  requireValue(build.sourceCommitSha === context.pinnedCommit, "build-commit");
  requireValue(manifest.digest === context.manifestDigest, "manifest-digest");
  requireValue(manifest.buildRunId === context.buildRunId, "manifest-build");

  const stagingVersion = uniqueRow(
    result.stagingVersions,
    context.stagingCurrentVersionId,
    "staging-version",
  );
  requireValue(stagingVersion.kind === "deploy", "staging-kind");
  requireValue(
    stagingVersion.artifactManifestId === context.manifestId,
    "staging-manifest",
  );
  requireValue(
    stagingVersion.deploymentRunId === context.stagingDeploymentRunId,
    "staging-deployment",
  );

  const productionVersion = uniqueRow(
    result.productionVersions,
    context.productionCurrentVersionId,
    "production-version",
  );
  requireValue(productionVersion.kind === "upgrade", "production-kind");
  requireValue(
    productionVersion.artifactManifestId === context.manifestId,
    "production-manifest",
  );
  requireValue(nonEmpty(productionVersion.releaseRunId), "production-release");

  const stagingEnvironment = uniqueRow(
    result.environments,
    context.stagingEnvId,
    "staging-environment",
  );
  const productionEnvironment = uniqueRow(
    result.environments,
    context.productionEnvId,
    "production-environment",
  );
  requireValue(stagingEnvironment.key === "staging", "staging-key");
  requireValue(productionEnvironment.key === "production", "production-key");
  requireValue(
    stagingEnvironment.currentEnvironmentVersionId ===
      context.stagingCurrentVersionId,
    "staging-pointer",
  );
  requireValue(
    productionEnvironment.currentEnvironmentVersionId ===
      context.productionCurrentVersionId,
    "production-pointer",
  );

  return deepFreeze({
    ...Object.fromEntries(
      TRUSTED_BASE_CONTEXT_FIELDS.map((field) => [field, context[field]]),
    ),
    productionReleaseRunId: productionVersion.releaseRunId,
  });
}

function validateContext(context) {
  requireValue(isObject(context), "context-missing");
  requireValue(
    sameJson(
      Object.keys(context).sort(),
      [...TRUSTED_BASE_CONTEXT_FIELDS].sort(),
    ),
    "context-fields",
  );
  for (const field of TRUSTED_BASE_CONTEXT_FIELDS) {
    if (field !== "productionRouteSnapshot") {
      requireValue(nonEmpty(context[field]), `context-${field}`);
    }
  }
  requireValue(/^sha256:[a-f0-9]{64}$/.test(context.manifestDigest), "digest");
  requireValue(/^[a-f0-9]{40}$/.test(context.pinnedCommit), "commit");
  requireValue(
    /^[a-f0-9]{64}$/.test(context.sourceEvidenceSha256),
    "source-sha",
  );
  requireValue(
    isObject(context.productionRouteSnapshot) &&
      Array.isArray(context.productionRouteSnapshot.domains) &&
      context.productionRouteSnapshot.domains.length > 0,
    "route-snapshot",
  );
}

function uniqueRow(rows, id, label) {
  requireValue(Array.isArray(rows), `${label}-rows`);
  const ids = rows.map((row) => row?.id);
  requireValue(ids.every(nonEmpty), `${label}-id`);
  requireValue(new Set(ids).size === ids.length, `${label}-duplicate`);
  const matches = rows.filter((row) => row.id === id);
  requireValue(matches.length === 1, `${label}-match`);
  return matches[0];
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value))
    return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}
function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function requireValue(value, reason) {
  if (!value) throw new Error(`history base identity invalid: ${reason}`);
}
