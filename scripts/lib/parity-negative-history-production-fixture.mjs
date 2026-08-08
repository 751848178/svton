import { buildProductionRouteExpectation } from "./parity-production-route-evidence.mjs";

export function productionActionFixture(kind) {
  const suffix = kind === "upgrade" ? "upgrade" : "recovery";
  const identity = {
    teamId: "team",
    projectId: "project",
    releaseOrderId: "order",
    environmentId: "production",
    deploymentRunId: `deployment-${suffix}`,
    releaseRunId: `release-${suffix}`,
    manifestId: `manifest-${suffix}`,
    buildRunId: `build-${suffix}`,
    configRevisionId: "config-1",
  };
  return {
    deploymentRunId: identity.deploymentRunId,
    status: "completed",
    environmentId: identity.environmentId,
    expectedEnvironmentId: identity.environmentId,
    manifestId: identity.manifestId,
    expectedManifestId: identity.manifestId,
    releaseRunId: identity.releaseRunId,
    expectedReleaseRunId: identity.releaseRunId,
    newEnvironmentVersion: { kind, previousVersionId: "production-v1" },
    expectedPreviousVersionId: "production-v1",
    currentMoved: true,
    releaseRun: {
      status: "succeeded",
      mode: kind === "upgrade" ? "standard" : "recovery",
      approvalStatus: "approved",
      approvalConsumedAt: "2026-08-08T00:00:04.000Z",
    },
    artifactVerified: true,
    workload: { status: "running" },
    healthProbe: { status: "passed" },
    productionGate: gateFixture(identity),
    routeEvidence: routeFixture(identity),
  };
}

function gateFixture(identity) {
  const finalGateKey = `final:${identity.releaseRunId}:${identity.deploymentRunId}`;
  const expected = {
    ...identity,
    finalGateKey,
    deploymentReleaseRunId: identity.releaseRunId,
    deploymentEnvironmentId: identity.environmentId,
    deploymentManifestId: identity.manifestId,
  };
  const gate = {
    id: `gate-${identity.deploymentRunId}`,
    releaseOrderId: identity.releaseOrderId,
    stage: "production",
    phase: "deploy",
    requestKey: finalGateKey,
    allowed: true,
    inputHash: "a".repeat(64),
    inputSnapshot: {
      version: 1,
      stage: "production",
      phase: "deploy",
      actionInput: {
        checkpoint: "post_execution",
        deploymentRunId: identity.deploymentRunId,
        releaseRunId: identity.releaseRunId,
        environmentId: identity.environmentId,
        manifestId: identity.manifestId,
        buildRunId: identity.buildRunId,
        configRevisionId: identity.configRevisionId,
      },
    },
    blockerGateIds: [],
    integrityErrors: [],
    actionRunType: "deployment_run",
    actionRunId: identity.deploymentRunId,
    consumedAt: "2026-08-08T00:00:04.000Z",
  };
  return {
    gate,
    resultGate: { id: gate.id, stage: gate.stage, inputHash: gate.inputHash },
    expected,
  };
}

function routeFixture(identity) {
  const routeSnapshot = {
    domains: ["production.example.test"],
    proxyTarget: "http://target-workload",
    tlsRequired: true,
  };
  const expected = buildProductionRouteExpectation({
    ...identity,
    routeSnapshot,
    siteId: "site-1",
    targetRef: "target-1",
    providerKey: "route-provider-v1",
    receiptVersion: 1,
  });
  const observedAt = "2026-08-08T00:00:05.000Z";
  const receipt = {
    version: 1,
    providerKey: expected.providerKey,
    operationId: expected.operationId,
    status: "switched",
    reasonCode: "site_route_switched",
    observedAt,
    observed: {
      siteId: expected.siteId,
      deploymentRunId: expected.deploymentRunId,
      targetRef: expected.targetRef,
      routeHash: expected.routeHash,
    },
  };
  const routeSwitch = {
    version: 1,
    operationId: expected.operationId,
    teamId: expected.teamId,
    projectId: expected.projectId,
    environmentId: expected.environmentId,
    siteId: expected.siteId,
    deploymentRunId: expected.deploymentRunId,
    releaseRunId: expected.releaseRunId,
    primaryDomain: expected.primaryDomain,
    domains: expected.domains,
    proxyTarget: expected.proxyTarget,
    targetRef: expected.targetRef,
    routeHash: expected.routeHash,
    providerKey: expected.providerKey,
    status: "switched",
    reasonCode: "site_route_switched",
    switchedAt: observedAt,
    receipt,
  };
  const siteProbe = {
    primaryDomain: expected.primaryDomain,
    finalUrl: expected.configuredFinalUrl,
    http: {
      url: expected.configuredFinalUrl,
      finalUrl: expected.configuredFinalUrl,
      status: "passed",
      statusCode: 200,
      bodySignature: "sha256:body",
    },
    tls: {
      status: "valid",
      host: expected.primaryDomain,
      servername: expected.primaryDomain,
      authorized: true,
      authorizationErrorCode: null,
    },
  };
  return {
    expected,
    deployment: {
      releaseRunId: expected.releaseRunId,
      environmentId: expected.environmentId,
      artifactManifestId: expected.manifestId,
      startedAt: "2026-08-08T00:00:00.000Z",
    },
    releaseRun: {
      environmentId: expected.environmentId,
      artifactManifestId: expected.manifestId,
      configRevisionId: expected.configRevisionId,
      routeSnapshot,
    },
    siteCandidateCount: 1,
    siteCurrent: {
      id: expected.siteId,
      primaryDomain: expected.primaryDomain,
      routeSwitch: structuredClone(routeSwitch),
    },
    routeRuns: [
      {
        ...identity,
        siteId: expected.siteId,
        targetRef: expected.targetRef,
        proxyTarget: expected.proxyTarget,
        domains: expected.domains,
        status: "switched",
        reasonCode: "site_route_switched",
        result: { routeSwitch, siteProbe },
        finishedAt: "2026-08-08T00:00:06.000Z",
      },
    ],
    siteProbe: structuredClone(siteProbe),
    deploymentRouteSwitch: structuredClone(routeSwitch),
    capturedAt: "2026-08-08T00:00:07.000Z",
  };
}
