import { check, predicate } from "./parity-e2e-evidence.mjs";

export const BASE_HISTORY_STEP_CHECKS = {
  preflight: (r) => [
    check("apiHealth", r.apiHealth, true),
    check("webStatus", r.webStatus, 200),
    check("targetStatus", r.targetStatus, 200),
    check("targetBodyMarker", r.targetBodyMarker, true),
    check("mysqlOk", r.mysqlOk, true),
    check("tokenIssued", r.tokenIssued, true),
  ],
  "base-reset-seed": (r) => [
    check("exit", r.exit, 0),
    predicate("log", Boolean(r.log), r.log),
  ],
  "base-f455-chain-rerun": (r) => [
    check("exit", r.exit, 0),
    ...(r.contextChecks || []),
    check("pinnedCommitMatches", r.pinnedCommitMatches, true),
    check("buildRunsOnOrder", r.buildRunsOnOrder, 1),
    check("manifestsOnOrder", r.manifestsOnOrder, 1),
    check("stagingDeploymentRuns", r.stagingDeploymentRuns, 1),
    check("productionDeploymentRuns", r.productionDeploymentRuns, 1),
    predicate(
      "environmentVersions",
      r.environmentVersions >= 2,
      r.environmentVersions,
    ),
  ],
  "base-state-rows": (r) => [
    check("buildCount", r.buildRuns?.length, 1),
    check("manifestCount", r.manifests?.length, 1),
    check("buildId", r.buildRuns?.[0]?.id, r.expected?.buildRunId),
    check("manifestId", r.manifests?.[0]?.id, r.expected?.manifestId),
    check(
      "manifestDigest",
      r.manifests?.[0]?.digest,
      r.expected?.manifestDigest,
    ),
    predicate(
      "stagingCurrent",
      includesId(r.stagingVersions, r.expected?.stagingCurrentVersionId),
      r.stagingVersions,
    ),
    predicate(
      "productionCurrent",
      includesId(r.productionVersions, r.expected?.productionCurrentVersionId),
      r.productionVersions,
    ),
    predicate(
      "stagingPointer",
      includesPointer(
        r.environments,
        r.expected?.stagingEnvId,
        r.expected?.stagingCurrentVersionId,
      ),
      r.environments,
    ),
    predicate(
      "productionPointer",
      includesPointer(
        r.environments,
        r.expected?.productionEnvId,
        r.expected?.productionCurrentVersionId,
      ),
      r.environments,
    ),
  ],
  "re-login-after-reset": (r) => [check("tokenIssued", r.tokenIssued, true)],
  "build-2": (r) => [
    predicate("buildRunId", Boolean(r.buildRunId), r.buildRunId),
    check("distinctFromB1", r.distinctFromB1, true),
    check("status", r.status, "succeeded"),
    check("pinned", r.pinned, true),
    predicate("manifestId", Boolean(r.manifestId), r.manifestId),
    check("manifestDistinctFromM1", r.manifestDistinctFromM1, true),
    check("digestDeterministic", r.digestDeterministic, true),
    check("dbBuildRuns", r.dbBuildRuns, 2),
    check("dbManifests", r.dbManifests, 2),
  ],
  "staging-deploy-repeat": (r) => [
    predicate("deploymentRunId", Boolean(r.deploymentRunId), r.deploymentRunId),
    predicate(
      "firstDeploymentRunId",
      Boolean(r.firstDeploymentRunId),
      r.firstDeploymentRunId,
    ),
    check("distinctFromFirst", r.distinctFromD1st, true),
    check("status", r.status, "completed"),
    check("sameManifestM1", r.sameManifestM1, true),
    check("completedRunsOnM1", r.completedRunsOnM1, 2),
    check("buildRunCount", r.buildRunCount, 2),
    check(
      "newCurrentDeploymentRunId",
      r.newStagingCurrent?.deploymentRunId,
      r.deploymentRunId,
    ),
    check(
      "newCurrentManifestId",
      r.newStagingCurrent?.artifactManifestId,
      r.expectedManifestId,
    ),
    check("artifactVerified", r.artifactVerified, true),
    ...stagingCommandChecks(r.commandEvidence),
  ],
};

function stagingCommandChecks(value = {}) {
  const plan = value.commandPlan || {};
  const provider = value.providerEvidence || {};
  const exactSteps = [
    "verify_manifest_digest",
    "materialize_exact_manifest",
    "start_workloads",
    "probe_workloads",
    "activate_release",
  ];
  return [
    predicate(
      "commandSteps",
      JSON.stringify(plan.steps) === JSON.stringify(exactSteps),
      plan.steps,
    ),
    check("commandCheckout", plan.checkout, false),
    check("commandPull", plan.pull, false),
    check("commandBuild", plan.build, false),
    check("providerCheckout", provider.checkoutInvoked, false),
    check("providerPull", provider.pullInvoked, false),
    check("providerBuild", provider.buildInvoked, false),
    check("providerGit", provider.gitInvoked, false),
    check("resultManifestId", value.resultManifestId, value.expectedManifestId),
    check(
      "resultManifestDigest",
      value.resultManifestDigest,
      value.expectedManifestDigest,
    ),
    check("paramsManifestId", value.paramsManifestId, value.expectedManifestId),
    check(
      "paramsManifestDigest",
      value.paramsManifestDigest,
      value.expectedManifestDigest,
    ),
  ];
}

function includesId(rows = [], id) {
  return rows.some((row) => row.id === id);
}

function includesPointer(rows = [], environmentId, versionId) {
  return rows.some(
    (row) =>
      row.id === environmentId && row.currentEnvironmentVersionId === versionId,
  );
}
