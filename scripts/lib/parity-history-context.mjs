import { predicate, check } from "./parity-e2e-evidence.mjs";

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
    "teamId", "projectId", "orderId", "stagingEnvId", "productionEnvId",
    "buildRunId", "manifestId", "stagingDeploymentRunId",
    "stagingCurrentVersionId", "productionCurrentVersionId",
    "productionConfigRevisionId", "productionTargetRef", "pinnedCommit",
  ];
  return [
    check("positiveEvidenceStatus", document.status, "passed"),
    predicate("positiveEvidenceHash", /^[a-f0-9]{64}$/.test(context.sourceEvidenceSha256 || ""), context.sourceEvidenceSha256),
    predicate("positiveEvidenceCapturedAt", Number.isFinite(Date.parse(document.capturedAt || "")), document.capturedAt),
    predicate("positiveEvidenceAcceptance", Object.keys(document.ac || {}).length > 0 && Object.values(document.ac).every((value) => value.ok === true), document.ac),
    predicate("dynamicContextIds", requiredIds.every((key) => Boolean(context[key])), requiredIds.filter((key) => !context[key])),
    predicate("manifestDigest", /^sha256:[a-f0-9]{64}$/.test(context.manifestDigest || ""), context.manifestDigest),
    predicate("productionRouteSnapshot", Array.isArray(context.productionRouteSnapshot?.domains) && context.productionRouteSnapshot.domains.length > 0, context.productionRouteSnapshot),
  ];
}
