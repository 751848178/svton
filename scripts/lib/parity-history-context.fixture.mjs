import { POSITIVE_AC_MAPPING } from "./parity-positive-e2e-contract.mjs";

export function positiveDocument() {
  const steps = {};
  for (const name of new Set(Object.values(POSITIVE_AC_MAPPING).flat())) {
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
  steps["intake-connect"].result = { connectionId: "connection" };
  steps["intake-analyze"].result = { runId: "analysis" };
  steps["intake-review"].result = {
    reviewSnapshotId: "review",
    reviewSnapshotHash: "b".repeat(64),
  };
  steps["intake-finalize"].result = { repositoryIdentityId: "identity" };
  steps["delivery-fixture-claim"].result = {
    frozenIdentity: { finalization: { id: "finalization" } },
    applicationContracts: [
      {
        applicationId: "web",
        staging: { id: "web-staging" },
        production: { id: "web-production" },
      },
      {
        applicationId: "api",
        staging: { id: "api-staging" },
        production: { id: "api-production" },
      },
    ],
  };
  const ac = Object.fromEntries(
    Object.entries(POSITIVE_AC_MAPPING).map(([id, sourceSteps]) => [
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
    stack: {
      pinnedCommit: "a".repeat(40),
      localFinalSite: "http://parity.example.test:54321",
    },
    context: { teamId: "team", projectId: "project", orderId: "order" },
    ac,
    steps,
  };
}

export function passedStep() {
  return {
    ok: true,
    status: "passed",
    verified: true,
    checks: [{ name: "verified", pass: true }],
    result: {},
  };
}

export function expectedPositiveContext(sourceEvidenceSha256) {
  return {
    teamId: "team",
    projectId: "project",
    orderId: "order",
    stagingEnvId: "staging",
    productionEnvId: "production",
    buildRunId: "build",
    manifestId: "manifest",
    manifestDigest: `sha256:${"a".repeat(64)}`,
    stagingDeploymentRunId: "staging-run",
    stagingCurrentVersionId: "staging-version",
    productionCurrentVersionId: "production-version",
    productionConfigRevisionId: "config-2",
    productionRouteSnapshot: { domains: ["example.test"] },
    productionTargetRef: "target",
    repositoryConnectionId: "connection",
    analysisRunId: "analysis",
    reviewSnapshotId: "review",
    reviewSnapshotHash: "b".repeat(64),
    intakeFinalizationId: "finalization",
    repositoryIdentityId: "identity",
    applicationContracts: [
      {
        applicationId: "web",
        staging: { id: "web-staging" },
        production: { id: "web-production" },
      },
      {
        applicationId: "api",
        staging: { id: "api-staging" },
        production: { id: "api-production" },
      },
    ],
    pinnedCommit: "a".repeat(40),
    finalSitePort: 54321,
    sourceEvidenceSha256,
  };
}
