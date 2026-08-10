import { buildProductionRouteExpectation } from "./parity-production-route-evidence.mjs";

export function productionProofFixture(roots, action) {
  const route = routeFixture(roots, action);
  return {
    productionGate: gateFixture(roots, action),
    routeEvidence: route,
    gateDecision: structuredClone(gateFixture(roots, action).resultGate),
    siteProbe: structuredClone(route.siteProbe),
    routeSwitch: structuredClone(route.deploymentRouteSwitch),
  };
}

function gateFixture(roots, action) {
  const finalGateKey = `final:${action.releaseRunId}:${action.deploymentRunId}`;
  const expected = {
    releaseOrderId: roots.orderId,
    releaseRunId: action.releaseRunId,
    deploymentRunId: action.deploymentRunId,
    environmentId: roots.productionEnvId,
    manifestId: action.manifestId,
    buildRunId: action.buildRunId,
    configRevisionId: roots.productionConfigRevisionId,
    finalGateKey,
    deploymentReleaseRunId: action.releaseRunId,
    deploymentEnvironmentId: roots.productionEnvId,
    deploymentManifestId: action.manifestId,
  };
  const gate = {
    id: `gate-${action.deploymentRunId}`,
    releaseOrderId: roots.orderId,
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
        deploymentRunId: action.deploymentRunId,
        releaseRunId: action.releaseRunId,
        environmentId: roots.productionEnvId,
        manifestId: action.manifestId,
        buildRunId: action.buildRunId,
        configRevisionId: roots.productionConfigRevisionId,
      },
    },
    blockerGateIds: [],
    integrityErrors: [],
    actionRunType: "deployment_run",
    actionRunId: action.deploymentRunId,
    consumedAt: "2026-08-08T00:00:04.000Z",
  };
  return {
    gate,
    resultGate: { id: gate.id, stage: gate.stage, inputHash: gate.inputHash },
    expected,
  };
}

function routeFixture(roots, action) {
  const expected = buildProductionRouteExpectation({
    teamId: roots.teamId,
    projectId: roots.projectId,
    environmentId: roots.productionEnvId,
    deploymentRunId: action.deploymentRunId,
    releaseRunId: action.releaseRunId,
    manifestId: action.manifestId,
    configRevisionId: roots.productionConfigRevisionId,
    routeSnapshot: structuredClone(roots.productionRouteSnapshot),
    siteId: "site-1",
    targetRef: roots.productionTargetRef,
    providerKey: "route-provider-v1",
    receiptVersion: 1,
    finalSitePort: roots.finalSitePort,
  });
  const observedAt = "2026-08-08T00:00:05.000Z";
  const routeSwitch = routeSwitchFixture(expected, observedAt);
  const siteProbe = siteProbeFixture(expected);
  return {
    expected,
    deployment: {
      releaseRunId: action.releaseRunId,
      environmentId: roots.productionEnvId,
      artifactManifestId: action.manifestId,
      startedAt: "2026-08-08T00:00:00.000Z",
      finishedAt: "2026-08-08T00:00:06.000Z",
    },
    releaseRun: {
      environmentId: roots.productionEnvId,
      artifactManifestId: action.manifestId,
      configRevisionId: roots.productionConfigRevisionId,
      routeSnapshot: structuredClone(roots.productionRouteSnapshot),
    },
    siteCandidateCount: 1,
    siteCurrent: {
      id: expected.siteId,
      primaryDomain: expected.primaryDomain,
      routeSwitch: structuredClone(routeSwitch),
    },
    routeRuns: [
      {
        teamId: roots.teamId,
        siteId: expected.siteId,
        projectId: roots.projectId,
        environmentId: roots.productionEnvId,
        deploymentRunId: action.deploymentRunId,
        releaseRunId: action.releaseRunId,
        targetRef: roots.productionTargetRef,
        proxyTarget: expected.proxyTarget,
        domains: expected.domains,
        status: "switched",
        reasonCode: "site_route_switched",
        result: { routeSwitch, siteProbe },
        startedAt: "2026-08-08T00:00:00.000Z",
        finishedAt: "2026-08-08T00:00:06.000Z",
      },
    ],
    siteProbe: structuredClone(siteProbe),
    deploymentRouteSwitch: structuredClone(routeSwitch),
    capturedAt: "2026-08-08T00:00:07.000Z",
  };
}

function routeSwitchFixture(expected, observedAt) {
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
  return {
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
}

function siteProbeFixture(expected) {
  return {
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
}
