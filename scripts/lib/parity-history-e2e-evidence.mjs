import { check, predicate } from "./parity-e2e-evidence.mjs";
import { productionGateEvidenceChecks } from "./parity-production-gate-evidence.mjs";
import { productionRouteEvidenceChecks } from "./parity-production-route-evidence.mjs";

export const HISTORY_AC_MAPPING = {
  "AC-E2E-016": ["build-2"],
  "AC-E2E-017": ["staging-deploy-repeat"],
  "AC-E2E-018": ["staging-upgrade"],
  "AC-E2E-019": ["staging-recovery"],
  "AC-E2E-020": ["production-preview", "production-confirm", "production-approve", "production-upgrade-execute"],
  "AC-E2E-021": ["production-recovery-preview", "production-recovery-confirm", "production-recovery-approve", "production-recovery-execute"],
  "AC-E2E-022": ["version-chains"],
  "AC-E2E-023": ["browser-pass"],
};

export function historyStepChecks(name, result) {
  const checks = STEP_CHECKS[name]?.(result);
  return checks || [predicate("registeredStep", false, name)];
}

const STEP_CHECKS = {
  preflight: (r) => [
    check("apiHealth", r.apiHealth, true), check("webStatus", r.webStatus, 200),
    check("targetStatus", r.targetStatus, 200), check("targetBodyMarker", r.targetBodyMarker, true),
    check("mysqlOk", r.mysqlOk, true), check("tokenIssued", r.tokenIssued, true),
  ],
  "base-reset-seed": (r) => [check("exit", r.exit, 0), predicate("log", Boolean(r.log), r.log)],
  "base-f455-chain-rerun": (r) => [
    check("exit", r.exit, 0), ...(r.contextChecks || []),
    check("pinnedCommitMatches", r.pinnedCommitMatches, true),
    check("buildRunsOnOrder", r.buildRunsOnOrder, 1), check("manifestsOnOrder", r.manifestsOnOrder, 1),
    check("stagingDeploymentRuns", r.stagingDeploymentRuns, 1), check("productionDeploymentRuns", r.productionDeploymentRuns, 1),
    predicate("environmentVersions", r.environmentVersions >= 2, r.environmentVersions),
  ],
  "base-state-rows": (r) => [
    check("buildCount", r.buildRuns?.length, 1), check("manifestCount", r.manifests?.length, 1),
    check("buildId", r.buildRuns?.[0]?.id, r.expected?.buildRunId), check("manifestId", r.manifests?.[0]?.id, r.expected?.manifestId),
    check("manifestDigest", r.manifests?.[0]?.digest, r.expected?.manifestDigest),
    predicate("stagingCurrent", (r.stagingVersions || []).some((v) => v.id === r.expected?.stagingCurrentVersionId), r.stagingVersions),
    predicate("productionCurrent", (r.productionVersions || []).some((v) => v.id === r.expected?.productionCurrentVersionId), r.productionVersions),
    predicate("stagingPointer", (r.environments || []).some((e) => e.id === r.expected?.stagingEnvId && e.currentEnvironmentVersionId === r.expected?.stagingCurrentVersionId), r.environments),
    predicate("productionPointer", (r.environments || []).some((e) => e.id === r.expected?.productionEnvId && e.currentEnvironmentVersionId === r.expected?.productionCurrentVersionId), r.environments),
  ],
  "re-login-after-reset": (r) => [check("tokenIssued", r.tokenIssued, true)],
  "build-2": (r) => [
    predicate("buildRunId", Boolean(r.buildRunId), r.buildRunId), check("distinctFromB1", r.distinctFromB1, true),
    check("status", r.status, "succeeded"), check("pinned", r.pinned, true),
    predicate("manifestId", Boolean(r.manifestId), r.manifestId), check("manifestDistinctFromM1", r.manifestDistinctFromM1, true),
    check("digestDeterministic", r.digestDeterministic, true), check("dbBuildRuns", r.dbBuildRuns, 2), check("dbManifests", r.dbManifests, 2),
  ],
  "staging-deploy-repeat": (r) => [
    predicate("deploymentRunId", Boolean(r.deploymentRunId), r.deploymentRunId), predicate("firstDeploymentRunId", Boolean(r.firstDeploymentRunId), r.firstDeploymentRunId),
    check("distinctFromFirst", r.distinctFromD1st, true), check("status", r.status, "completed"),
    check("sameManifestM1", r.sameManifestM1, true), check("completedRunsOnM1", r.completedRunsOnM1, 2),
    check("buildRunCount", r.buildRunCount, 2), check("newCurrentDeploymentRunId", r.newStagingCurrent?.deploymentRunId, r.deploymentRunId),
    check("newCurrentManifestId", r.newStagingCurrent?.artifactManifestId, r.expectedManifestId),
    check("artifactVerified", r.artifactVerified, true), ...stagingCommandChecks(r.commandEvidence),
  ],
  "staging-upgrade": (r) => versionActionChecks(r, "staging", "upgrade"),
  "staging-recovery": (r) => versionActionChecks(r, "staging", "recovery"),
  "production-preview": (r) => [
    predicate("inputHash", /^[a-f0-9]{64}$/.test(r.inputHash || ""), r.inputHash),
    check("manifestFrozen", r.manifestFrozen, true), check("manifestDigest", r.manifestDigest, r.expectedManifestDigest),
  ],
  "production-confirm": (r) => releaseConfirmChecks(r, "standard", "project.release_order.deploy_production"),
  "production-approve": (r) => approvalChecks(r),
  "production-upgrade-execute": (r) => productionActionChecks(r, "upgrade"),
  "production-recovery-preview": (r) => [
    predicate("inputHash", /^[a-f0-9]{64}$/.test(r.inputHash || ""), r.inputHash),
    check("sourceVersionId", r.sourceVersionId, r.expectedSourceVersionId),
    check("sourceManifestId", r.sourceManifestId, r.expectedManifestId), check("sourceManifestDigest", r.sourceManifestDigest, r.expectedManifestDigest),
  ],
  "production-recovery-confirm": (r) => releaseConfirmChecks(r, "recovery", "project.release_order.deploy_production_recovery"),
  "production-recovery-approve": (r) => approvalChecks(r),
  "production-recovery-execute": (r) => productionActionChecks(r, "recovery"),
  "version-chains": (r) => [
    check("stagingChain", r.staging?.chainLinksValid, true), check("stagingRuns", r.staging?.everyDeploymentCompleted, true),
    check("stagingDbCurrent", r.staging?.dbCurrentMatchesLatest, true), check("stagingApiCurrent", r.staging?.apiCurrentMatchesDb, true),
    check("productionChain", r.production?.chainLinksValid, true), check("productionRuns", r.production?.everyDeploymentCompleted, true),
    check("productionDbCurrent", r.production?.dbCurrentMatchesLatest, true), check("productionApiCurrent", r.production?.apiCurrentMatchesDb, true),
    check("stagingRecoverySource", r.stagingRecoverySourcePresent, true), check("productionRecoverySource", r.productionRecoverySourcePresent, true),
    predicate("releaseRuns", (r.expectedReleaseRuns || []).length > 0 && r.expectedReleaseRuns.every((expected) => (r.releaseRuns || []).some((run) => run.id === expected.id && run.mode === expected.mode && run.status === "succeeded")), r.releaseRuns),
  ],
  "db-summary": (r) => [
    check("buildRuns", r.buildRunsOnOrder, 2), check("stagingRuns", r.stagingDeploymentRuns, 4),
    check("productionRuns", r.productionDeploymentRuns, 3), check("environmentVersions", r.environmentVersions, 7),
    check("approvals", r.operationApprovals, 3), check("releaseRuns", r.releaseRuns, 3),
  ],
  "browser-pass": (r) => browserChecks(r),
};

function versionActionChecks(r, environment, kind) {
  return [
    predicate("deploymentRunId", Boolean(r.deploymentRunId), r.deploymentRunId), check("status", r.status, "completed"),
    check("environmentId", r.environmentId, r.expectedEnvironmentId), check("manifestId", r.manifestId, r.expectedManifestId),
    predicate("versionId", Boolean(r.newEnvironmentVersion?.id), r.newEnvironmentVersion?.id),
    check("versionKind", r.newEnvironmentVersion?.kind, kind), check("previousVersion", r.newEnvironmentVersion?.previousVersionId, r.expectedPreviousVersionId),
    check("currentMoved", r.currentMoved, true), check("artifactVerified", r.artifactVerified, true),
    predicate("environmentLabel", environment === "staging", environment),
  ];
}

function releaseConfirmChecks(r, mode, action) {
  return [
    predicate("releaseRunId", Boolean(r.releaseRunId), r.releaseRunId), check("status", r.status, "awaiting_approval"),
    check("mode", r.mode, mode), predicate("approvalId", Boolean(r.approvalId), r.approvalId),
    check("approvalStatus", r.approvalStatus, "pending"), check("approvalAction", r.approvalAction, action),
    check("manifestId", r.manifestId, r.expectedManifestId), check("verifiedDigest", r.verifiedDigest, r.expectedManifestDigest),
  ];
}

function approvalChecks(r) {
  return [
    predicate("approvalId", Boolean(r.approvalId), r.approvalId), check("status", r.status, "approved"),
    predicate("reviewerId", Boolean(r.reviewerId), r.reviewerId), predicate("reviewedAt", validTime(r.reviewedAt), r.reviewedAt),
  ];
}

function productionActionChecks(r, kind) {
  return [
    predicate("deploymentRunId", Boolean(r.deploymentRunId), r.deploymentRunId), check("status", r.status, "completed"),
    check("environmentId", r.environmentId, r.expectedEnvironmentId), check("manifestId", r.manifestId, r.expectedManifestId),
    check("releaseRunId", r.releaseRunId, r.expectedReleaseRunId), check("versionKind", r.newEnvironmentVersion?.kind, kind),
    check("previousVersionId", r.newEnvironmentVersion?.previousVersionId, r.expectedPreviousVersionId),
    check("currentMoved", r.currentMoved, true), check("releaseStatus", r.releaseRun?.status, "succeeded"),
    check("releaseMode", r.releaseRun?.mode, kind === "upgrade" ? "standard" : "recovery"),
    check("approvalStatus", r.releaseRun?.approvalStatus, "approved"), predicate("approvalConsumedAt", validTime(r.releaseRun?.approvalConsumedAt), r.releaseRun?.approvalConsumedAt),
    check("artifactVerified", r.artifactVerified, true), predicate("workload", Boolean(r.workload), r.workload),
    check("healthProbe", r.healthProbe?.status, "passed"), ...productionGateEvidenceChecks(r.productionGate),
    ...productionRouteEvidenceChecks(r.routeEvidence),
  ];
}

function stagingCommandChecks(value = {}) {
  const plan = value.commandPlan || {};
  const provider = value.providerEvidence || {};
  return [
    predicate("commandSteps", JSON.stringify(plan.steps) === JSON.stringify(["verify_manifest_digest", "materialize_exact_manifest", "start_workloads", "probe_workloads", "activate_release"]), plan.steps),
    check("commandCheckout", plan.checkout, false), check("commandPull", plan.pull, false), check("commandBuild", plan.build, false),
    check("providerCheckout", provider.checkoutInvoked, false), check("providerPull", provider.pullInvoked, false),
    check("providerBuild", provider.buildInvoked, false), check("providerGit", provider.gitInvoked, false),
    check("resultManifestId", value.resultManifestId, value.expectedManifestId), check("resultManifestDigest", value.resultManifestDigest, value.expectedManifestDigest),
    check("paramsManifestId", value.paramsManifestId, value.expectedManifestId), check("paramsManifestDigest", value.paramsManifestDigest, value.expectedManifestDigest),
  ];
}

function browserChecks(r) {
  const markers = booleanLeaves([r.releaseDetailEvidence, r.stagingStepEvidence, r.envVersionsEvidence, r.buildLogDrawer, r.stagingRunLog, r.productionRunLog]);
  return [
    check("driverExit", r.driverExit, 0), predicate("requiredArtifacts", (r.requiredArtifacts || []).length > 0 && r.requiredArtifacts.every((name) => /^[a-f0-9]{64}$/.test(r.artifacts?.[name] || "")), r.artifacts),
    check("consoleErrors", r.console?.length, 0), check("failedRequests", r.failedRequestsCount, 0),
    predicate("documentResponses", (r.documentResponses || []).length > 0 && r.documentResponses.every((item) => {
      const status = item.status ?? item.statusCode;
      return status >= 200 && status < 400;
    }), r.documentResponses),
    predicate("markers", markers.length > 0 && markers.every(Boolean), markers),
  ];
}

function booleanLeaves(values) {
  return values.flatMap((value) => Object.values(value || {}).filter((item) => typeof item === "boolean"));
}

function validTime(value) {
  return Boolean(value) && Number.isFinite(Date.parse(value instanceof Date ? value.toISOString() : value));
}
