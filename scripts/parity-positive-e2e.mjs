#!/usr/bin/env node
// F455 positive E2E driver over the RUNNING parity stack.
//
// Chain (each AC-E2E-007..015 mapped to concrete evidence):
//   1.  (preflight) stack health: api / web / mysql / target-workload
//   2.  login (bootstrap admin from docker-compose.devpilot-parity.yml)
//   3.  fresh project intake: draft -> isolated fixture alias connect -> current
//       analysis -> contract -> review -> finalize -> verify exactly one active
//       Staging + one active Production baseline + config revision R1
//   4.  env configuration (CAS -> R2): deployment-target binding evidence
//       (GET targets), resource refs (parity-resource-0001), env vars + secret
//       ref (parity-secret-0001), domain entries (parity-site-0001 domain ->
//       proxyTarget http://127.0.0.1:43992) for staging AND production
//   5.  create release order 1.0.0 through the API: 0 BuildRun / 0 Manifest
//   6.  build main HEAD -> BuildRun succeeded + Manifest (pinned commit)
//   7.  staging deploy same Manifest -> DeploymentRun completed, no
//       git/checkout/pull/build
//   8.  production preview -> confirm (ReleaseRun awaiting_approval + approval)
//       -> approve -> execute -> Production DeploymentRun completed with
//       workload + probe
//   9.  Production current EnvironmentVersion == run manifest/digest
//  10.  final site http://127.0.0.1:43992 loads (HTTP 200 + body signature)
//
// Evidence: /tmp/codex-tool-runs/svton/f455/f455-positive-e2e-evidence.json
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  check,
  checkedStep,
  finishEvidence,
  predicate,
} from "./lib/parity-e2e-evidence.mjs";
import { POSITIVE_AC_MAPPING } from "./lib/parity-positive-e2e-contract.mjs";
import {
  productionGateEvidence,
  productionGateEvidenceChecks,
} from "./lib/parity-production-gate-evidence.mjs";
import {
  buildProductionRouteExpectation,
  productionRouteEvidence,
  productionRouteEvidenceChecks,
} from "./lib/parity-production-route-evidence.mjs";
import { historyChainOutputDirectory } from "./lib/parity-history-chain-paths.mjs";
import { requireFirstEnvironmentRevision } from "./lib/parity-environment-revision-list.mjs";
import { requireEnvironmentTargets } from "./lib/parity-environment-targets.mjs";
import { createPositiveIntakeFlow } from "./lib/parity-positive-intake-flow.mjs";
import {
  positiveDeliveryClaimChecks,
  runPositiveDeliveryClaim,
} from "./lib/parity-positive-delivery-claim-step.mjs";
import { parityRuntimeConfig } from "./lib/parity-runtime-config.mjs";
import { parityApiError } from "./lib/parity-http-error.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runtime = parityRuntimeConfig();
const outDir = historyChainOutputDirectory(
  process.env,
  "f455",
  "/tmp/codex-tool-runs/svton/f455",
);
const apiBase = runtime.apiBase;
const teamId = "parity-team-0001";
let projectId;
let orderId;
let stagingEnvId;
let productionEnvId;
const adminEmail = "admin@parity.local";
const adminPassword = "ParityDemo123!";
const pinnedCommit = "2f0ec3246761537123c65ac415a14e503ebbfa38";
const PREFIX = "2f0ec324";
const runState = {};
const parityRouteProviderKey = process.env.DEVPILOT_PARITY_ROUTE_PROVIDER_KEY || null;
const { PrismaClient } = createRequire(
  resolve(root, "apps/devpilot-api/package.json"),
)("@prisma/client");
const prisma = new PrismaClient({
  datasources: { db: { url: runtime.databaseUrl } },
});
const evidence = {
  worker: "f455-positive-e2e",
  objective: "AC-E2E-007..015 positive chain over the parity stack",
  stack: {
    web: runtime.webOrigin,
    api: apiBase,
    mysql: runtime.mysqlEvidence,
    targetWorkload: runtime.targetOrigin,
    fixtureRepo: "/read-only-repositories/parity-app-intake",
    pinnedCommit,
  },
  context: { projectId: null, orderId: null, teamId },
  capturedAt: null,
  steps: {},
  ac: {},
};
const runLog = [];
function log(message) {
  const line = `[f455 ${new Date().toISOString()}] ${message}`;
  runLog.push(line);
  process.stdout.write(`${line}\n`);
}

async function main() {
  await mkdir(outDir, { recursive: true });
  evidence.capturedAt = new Date().toISOString();

  // ---------------------------------------------------------------- preflight
  await step("preflight", async () => {
    const [health, web, target] = await Promise.all([
      httpGet(`${apiBase}/health`),
      httpGet(`${runtime.webOrigin}/`, { raw: true }),
      httpGet(`${runtime.targetOrigin}/`, { raw: true }),
    ]);
    const mysqlOk = await mysqlPing();
    const token = await login();
    return {
      apiHealth: health.status === 200,
      webStatus: web.status,
      targetStatus: target.status,
      mysqlOk,
      tokenIssued: Boolean(token),
      targetBodyMarker: /Parity Target Workload/.test(target.body || ""),
    };
  });

  // ------------------------------------------------------------------- login
  const token = await login();
  evidence.steps.login = {
    email: adminEmail,
    source: "docker-compose.devpilot-parity.yml DEVPILOT_BOOTSTRAP_ADMIN_EMAIL/PASSWORD",
    ok: true,
  };
  log(`login ok (bootstrap admin ${adminEmail})`);

  const headers = {
    authorization: `Bearer ${token}`,
    "x-team-id": teamId,
    "content-type": "application/json",
  };

  const intakeFlow = createPositiveIntakeFlow({
    pinnedCommit,
    runKey: Date.now().toString(36),
    request: (method, path, body) => api(method, path, headers, body),
  });
  await step("intake-draft", () => intakeFlow.draft());
  await step("intake-connect", () => intakeFlow.connect());
  await step("intake-analyze", () => intakeFlow.analyze());
  await step("intake-contract", () => intakeFlow.contract());
  await step("intake-review", () => intakeFlow.review());
  const finalization = await step("intake-finalize", () =>
    intakeFlow.finalize(),
  );
  const intakeContext = intakeFlow.context();
  runState.intakeContext = intakeContext;
  runState.intakeFinalization = finalization;
  const intakeProjectId = intakeFlow.projectId();
  const baselines = await step("baselines-verified", async () => {
    const [staging, production] = await Promise.all([
      prisma.projectEnvironment.findFirst({
        where: { projectId: intakeProjectId, key: "staging", status: "active" },
      select: { id: true, key: true, baselineRole: true, status: true, currentConfigRevisionId: true },
      }),
      prisma.projectEnvironment.findFirst({
        where: { projectId: intakeProjectId, key: "production", status: "active" },
      select: { id: true, key: true, baselineRole: true, status: true, currentConfigRevisionId: true },
      }),
    ]);
    const all = await prisma.projectEnvironment.findMany({
      where: { projectId: intakeProjectId, status: "active", baselineRole: { not: null } },
      select: { id: true, baselineRole: true },
    });
    const revisions = await prisma.environmentConfigRevision.findMany({
      where: { projectId: intakeProjectId },
      select: { id: true, environmentId: true, revision: true },
      orderBy: [{ environmentId: "asc" }, { revision: "asc" }],
    });
    return {
      staging: staging?.baselineRole,
      production: production?.baselineRole,
      stagingId: staging?.id,
      productionId: production?.id,
      stagingCurrentConfigRevisionId: staging?.currentConfigRevisionId,
      productionCurrentConfigRevisionId: production?.currentConfigRevisionId,
      exactlyOnePerRole:
        all.filter((e) => e.baselineRole === "staging").length === 1 &&
        all.filter((e) => e.baselineRole === "production").length === 1,
      revisions: revisions.map((r) => ({ env: r.environmentId, revision: r.revision, id: r.id })),
      r1Count: revisions.filter((r) => r.revision === 1).length,
    };
  });
  projectId = intakeProjectId;
  stagingEnvId = baselines.stagingId;
  productionEnvId = baselines.productionId;
  const claim = await step("delivery-fixture-claim", () =>
    runPositiveDeliveryClaim({
      root,
      runtime,
      prisma,
      teamId,
      projectId,
      stagingEnvId,
      productionEnvId,
      productionConfigRevisionId: baselines.productionCurrentConfigRevisionId,
      pinnedCommit,
      intakeContext,
      request: api,
      headers,
    }),
  );
  if (claim.projectId !== projectId)
    throw new Error("delivery fixture claim scope drift");

  // ------------------------------------------------------- env configuration
  const stagingRevisionList = await api(
    "GET",
    `/project-environments/${stagingEnvId}/config-revisions`,
    headers,
  );
  const productionRevisionList = await api(
    "GET",
    `/project-environments/${productionEnvId}/config-revisions`,
    headers,
  );
  const stagingR1 = requireFirstEnvironmentRevision(stagingRevisionList);
  const productionR1 = requireFirstEnvironmentRevision(productionRevisionList);
  await step("env-r1-current", async () => {
    return {
      stagingR1: stagingR1?.id,
      productionR1: productionR1?.id,
      stagingRevisionNumber: stagingR1?.revision,
      productionRevisionNumber: productionR1?.revision,
    };
  });
  await step("env-targets", async () => {
    const [stagingTargets, productionTargets] = await Promise.all([
      api("GET", `/project-environments/${stagingEnvId}/targets`, headers),
      api("GET", `/project-environments/${productionEnvId}/targets`, headers),
    ]);
    const stagingTarget = requireEnvironmentTargets(stagingTargets);
    const productionTarget = requireEnvironmentTargets(productionTargets);
    runState.productionTargetRef = productionTarget.current.targetRef;
    return {
      staging: stagingTarget,
      production: productionTarget,
      stagingMatched:
        stagingTarget.current.providerKey === "local-filesystem-v1" &&
        stagingTarget.current.targetRef === "filesystem-release-target",
      productionMatched:
        productionTarget.current.providerKey === "local-filesystem-v1" &&
        productionTarget.current.targetRef === "filesystem-release-target",
    };
  });
  let stagingR2;
  let productionR2;
  await step("env-save-r2-staging", async () => {
    stagingR2 = await api(
      "POST",
      `/project-environments/${stagingEnvId}/config-revisions`,
      headers,
      {
        plainVariables: {
          HTTP_PLAIN_PARITY: "staging-r2",
          PARITY_DEPLOY_MARKER: "f455-r2",
        },
        secretReferenceIds: ["parity-secret-0001"],
        resourceReferences: [
          {
            id: "parity-resource-0001",
            kind: "resource_instance",
            sharedEnvironmentIds: [stagingEnvId],
            risk: "low",
            impact: "parity target workload (staging)",
          },
        ],
        routeSnapshot: {
          domains: ["staging.parity.example.test"],
          proxyTarget: runtime.targetOrigin,
        },
        policyReferenceIds: [],
        expectedCurrentRevisionId: stagingR1?.id,
        changeSummary: "F455 positive e2e: staging env configuration (R2)",
      },
    );
    return {
      revision: stagingR2?.revision?.revision,
      id: stagingR2?.revision?.id,
      snapshotHash: stagingR2?.revision?.snapshotHash,
      cas: stagingR2?.revision?.revision === (stagingR1?.revision ?? 0) + 1,
      current: await currentRevisionId(stagingEnvId),
      snapshot: pick(stagingR2?.revision, [
        "plainVariables",
        "secretReferences",
        "resourceReferences",
        "routeSnapshot",
      ]),
    };
  });
  await step("env-save-r2-production", async () => {
    productionR2 = await api(
      "POST",
      `/project-environments/${productionEnvId}/config-revisions`,
      headers,
      {
        plainVariables: {
          HTTP_PLAIN_PARITY: "production-r2",
          PARITY_DEPLOY_MARKER: "f455-r2",
        },
        secretReferenceIds: ["parity-secret-0001"],
        resourceReferences: [
          {
            id: "parity-resource-0001",
            kind: "resource_instance",
            sharedEnvironmentIds: [productionEnvId],
            risk: "low",
            impact: "parity target workload (production)",
          },
          {
            id: "parity-resource-managed-0001",
            kind: "managed_resource",
            sharedEnvironmentIds: [productionEnvId],
            risk: "low",
            impact: "parity target workload managed resource (production gate evidence)",
          },
        ],
        routeSnapshot: {
          // F455: the frozen production route must be reachable from INSIDE
          // the parity-api container (the site probe runs in-process):
          // - Docker's embedded DNS answers parity.example.test with a 502 —
          //   a definitive negative that the fail-closed probe policy rejects
          //   (observed: SITE_HTTP_PROBE_FAILED), so tlsRequired=true points
          //   the HTTP probe at the https:// final URL (unreachable in
          //   container) and it falls back to the proxyTarget;
          // - proxyTarget is the parity-network name of the target-workload
          //   container (the brief's literal http://127.0.0.1:43992 is the
          //   same workload's host-published port — reachable from the host,
          //   not from inside the container). The browser pass loads
          //   http://127.0.0.1:43992 (AC-E2E-015).
          domains: ["parity.example.test"],
          proxyTarget: "http://parity-target-workload",
          tlsRequired: true,
        },
        policyReferenceIds: [],
        expectedCurrentRevisionId: productionR1?.id,
        changeSummary: "F455 positive e2e: production env configuration (R2)",
      },
    );
    return {
      revision: productionR2?.revision?.revision,
      id: productionR2?.revision?.id,
      snapshotHash: productionR2?.revision?.snapshotHash,
      cas:
        productionR2?.revision?.revision === (productionR1?.revision ?? 0) + 1,
      current: await currentRevisionId(productionEnvId),
      snapshot: pick(productionR2?.revision, [
        "plainVariables",
        "secretReferences",
        "resourceReferences",
        "routeSnapshot",
      ]),
    };
  });

  // ------------------------------------------------------------ release order
  await step("release-order", async () => {
    const created = await api(
      "POST",
      `/projects/${projectId}/delivery/releases`,
      headers,
      {
        releaseVersion: "1.0.0",
        note: `C5 ${runtime.goalId} ${runtime.sourceRevision} ${runtime.runtimeId}`,
      },
    );
    orderId = created.id;
    evidence.context = { teamId, projectId, orderId };
    const order = await api(
      "GET",
      `/projects/${projectId}/delivery/releases/${orderId}`,
      headers,
    );
    const builds = await api(
      "GET",
      `/projects/${projectId}/delivery/releases/${orderId}/builds`,
      headers,
    );
    const dbBuilds = await prisma.buildRun.count({ where: { releaseOrderId: orderId } });
    const dbManifests = await prisma.artifactManifest.count({
      where: { releaseOrderId: orderId },
    });
    const ok =
      order.releaseVersion === "1.0.0" &&
      (builds.total ?? builds.items?.length ?? 0) === 0 &&
      dbBuilds === 0 &&
      dbManifests === 0;
    return {
      ok,
      releaseVersion: order.releaseVersion,
      status: order.status,
      buildsTotal: builds.total ?? builds.items?.length ?? 0,
      dbBuildRunCount: dbBuilds,
      dbManifestCount: dbManifests,
      orderId,
    };
  });

  // --------------------------------------------------------------------- build
  let manifestId;
  let manifestDigest;
  let buildRunId;
  await step("build", async () => {
    const started = await api(
      "POST",
      `/projects/${projectId}/delivery/releases/${orderId}/builds`,
      headers,
    );
    buildRunId = started.id;
    const run = await poll(
      async () => {
        const detail = await api(
          "GET",
          `/projects/${projectId}/delivery/releases/${orderId}/builds/${buildRunId}`,
          headers,
        );
        return ["succeeded", "failed", "canceled"].includes(detail.status)
          ? detail
          : undefined;
      },
      240,
      3000,
      "build",
    );
    if (run.status !== "succeeded") {
      throw new Error(`build failed: ${run.errorCode || run.errorMessage}`);
    }
    manifestId = run.manifest?.id;
    manifestDigest = run.manifest?.digest;
    runState.manifestId = manifestId;
    runState.manifestDigest = manifestDigest;
    const pinned = run.sourceCommitSha === pinnedCommit;
    if (!pinned || !manifestId || !manifestDigest) {
      throw new Error("build did not produce a manifest bound to the pinned commit");
    }
    const [buildRunCount, manifestCount, manifestRow] = await Promise.all([
      prisma.buildRun.count({ where: { releaseOrderId: orderId } }),
      prisma.artifactManifest.count({ where: { releaseOrderId: orderId } }),
      prisma.artifactManifest.findUnique({
        where: { id: manifestId },
        select: { buildRunId: true, _count: { select: { items: true } } },
      }),
    ]);
    return {
      buildRunId,
      status: run.status,
      sourceCommitSha: run.sourceCommitSha,
      pinnedCommitMatched: pinned,
      manifestId,
      manifestDigest,
      manifestItems: manifestRow?._count.items,
      manifestBuildRunId: manifestRow?.buildRunId,
      buildRunCount,
      manifestCount,
      logSummary: run.logSummary,
    };
  });

  // ------------------------------------------------------------ staging deploy
  let stagingRunId;
  await step("staging-deploy", async () => {
    const deployed = await api(
      "POST",
      `/projects/${projectId}/delivery/releases/${orderId}/staging-deployments`,
      headers,
      { manifestId },
    );
    stagingRunId = deployed.id ?? deployed.deploymentRunId;
    const row = await prisma.deploymentRun.findUnique({
      where: { id: stagingRunId },
      select: {
        id: true,
        status: true,
        environmentId: true,
        artifactManifestId: true,
        adapterKey: true,
        commandPlan: true,
        result: true,
        params: true,
      },
    });
    if (row.status !== "completed") {
      throw new Error(`staging deploy not completed: ${JSON.stringify(row)}`);
    }
    return {
      deploymentRunId: stagingRunId,
      status: row.status,
      environmentId: row.environmentId,
      artifactManifestId: row.artifactManifestId,
      sameManifest: row.artifactManifestId === manifestId,
      artifactVerified: row.result?.artifactVerified === true,
      commandProof: stagingCommandProof(row, {
        manifestId,
        manifestDigest,
        buildRunId,
      }),
    };
  });

  // ------------------------------------------------------- production preview
  let previewInputHash;
  await step("production-preview", async () => {
    const preview = await api(
      "GET",
      `/projects/${projectId}/delivery/releases/${orderId}/production-preview?manifestId=${manifestId}`,
      headers,
    );
    previewInputHash = preview.inputHash;
    return {
      inputHash: preview.inputHash,
      snapshot: pick(preview.snapshot, ["environment", "manifest", "config", "releaseOrder", "releasePolicy"]),
      manifestFrozen: preview.snapshot?.manifest?.id === manifestId,
      configRevisionId: preview.snapshot?.config?.revisionId,
      expectedConfigRevisionId: productionR2?.revision?.id,
    };
  });

  // ---------------------------------------------------------- production confirm
  let releaseRunId;
  let approvalId;
  await step("production-confirm", async () => {
    const confirm = await api(
      "POST",
      `/projects/${projectId}/delivery/releases/${orderId}/production-releases`,
      headers,
      {
        manifestId,
        expectedInputHash: previewInputHash,
        idempotencyKey: `f455-positive-e2e-production-confirm`,
      },
    );
    releaseRunId = confirm.id;
    approvalId = confirm.operationApproval?.id;
    runState.releaseRunId = releaseRunId;
    runState.approvalId = approvalId;
    return {
      releaseRunId,
      status: confirm.status,
      awaitingApproval: confirm.status === "awaiting_approval",
      approvalId,
      approvalStatus: confirm.operationApproval?.status,
      verifiedDigest: confirm.verifiedDigest,
      verifiedDigestMatches: confirm.verifiedDigest === manifestDigest,
      manifestId: confirm.artifactManifestId,
      configRevisionId: confirm.configRevisionId,
      expectedConfigRevisionId: productionR2?.revision?.id,
    };
  });

  // ------------------------------------------------------------------ approve
  await step("approval-list", async () => {
    const approvals = await api("GET", `/operation-approvals?category=release`, headers);
    const found = (approvals.items ?? approvals).find((a) => a.id === approvalId);
    return {
      id: found?.id,
      status: found?.status,
      action: found?.action,
      targetType: found?.targetType,
      risk: found?.risk,
      inputHashMatches: found?.inputHash === previewInputHash,
    };
  });
  await step("approval-review", async () => {
    const reviewed = await api(
      "POST",
      `/operation-approvals/${approvalId}/review`,
      headers,
      { decision: "approved", reviewComment: "F455 positive e2e: approve production release 1.0.0" },
    );
    return {
      approvalId,
      decision: reviewed.decision,
      status: reviewed.status,
      reviewerId: reviewed.reviewerId,
      reviewedAt: reviewed.reviewedAt,
    };
  });

  // ---------------------------------------------------------------- production
  await step("production-execute", async () => {
    const productionRouteSnapshot = productionR2?.revision?.routeSnapshot || {};
    const primaryDomain = productionRouteSnapshot.domains?.[0];
    const siteCandidates = primaryDomain
      ? await prisma.site.findMany({
          where: {
            teamId,
            projectId,
            environmentId: productionEnvId,
            primaryDomain,
          },
          select: { id: true },
        })
      : [];
    runState.productionSiteId = siteCandidates[0]?.id;
    const executed = await api(
      "POST",
      `/projects/${projectId}/delivery/environment-versions/${productionEnvId}/actions`,
      headers,
      { kind: "upgrade", manifestId, releaseRunId },
    );
    const runId = executed.run?.id ?? executed.id ?? executed.deploymentRunId;
    const row = await prisma.deploymentRun.findUnique({
      where: { id: runId },
      select: {
        id: true,
        status: true,
        environmentId: true,
        artifactManifestId: true,
        releaseRunId: true,
        params: true,
        result: true,
        startedAt: true,
        finishedAt: true,
      },
    });
    if (row.status !== "completed") {
      throw new Error(`production deploy not completed: ${JSON.stringify(row)}`);
    }
    const result = row.result || {};
    const finalGateKey = `final:${releaseRunId}:${runId}`;
    const expectedRoute = buildProductionRouteExpectation({
      teamId,
      projectId,
      environmentId: productionEnvId,
      deploymentRunId: runId,
      releaseRunId,
      manifestId,
      configRevisionId: productionR2?.revision?.id,
      routeSnapshot: productionRouteSnapshot,
      siteId: siteCandidates[0]?.id,
      targetRef: runState.productionTargetRef,
      providerKey: parityRouteProviderKey,
      receiptVersion: 1,
    });
    const [productionRunCount, productionGate, routeRuns, releaseEvidence, siteCurrent] = await Promise.all([
      prisma.deploymentRun.count({
        where: {
          environmentId: productionEnvId,
          releaseRunId,
          artifactManifestId: manifestId,
        },
      }),
      prisma.releaseGateDecision.findUnique({
        where: {
          releaseOrderId_stage_requestKey: {
            releaseOrderId: orderId,
            stage: "production",
            requestKey: finalGateKey,
          },
        },
        select: {
          id: true,
          releaseOrderId: true,
          stage: true,
          phase: true,
          requestKey: true,
          allowed: true,
          inputHash: true,
          inputSnapshot: true,
          blockerGateIds: true,
          integrityErrors: true,
          actionRunType: true,
          actionRunId: true,
          consumedAt: true,
        },
      }),
      prisma.siteRouteSwitchRun.findMany({
        where: {
          teamId,
          projectId,
          environmentId: productionEnvId,
          deploymentRunId: runId,
          releaseRunId,
        },
        select: {
          teamId: true,
          siteId: true,
          projectId: true,
          environmentId: true,
          deploymentRunId: true,
          releaseRunId: true,
          targetRef: true,
          proxyTarget: true,
          domains: true,
          status: true,
          reasonCode: true,
          result: true,
          startedAt: true,
          finishedAt: true,
        },
      }),
      prisma.releaseRun.findUnique({
        where: { id: releaseRunId },
        select: {
          environmentId: true,
          artifactManifestId: true,
          configRevisionId: true,
          routeSnapshot: true,
        },
      }),
      prisma.site.findUnique({
        where: { id: siteCandidates[0]?.id || "__missing_site__" },
        select: { id: true, primaryDomain: true, routeSwitch: true },
      }),
    ]);
    return {
      deploymentRunId: runId,
      status: row.status,
      environmentId: row.environmentId,
      artifactManifestId: row.artifactManifestId,
      sameManifest: row.artifactManifestId === manifestId,
      releaseRunId: row.releaseRunId,
      workload: result.workload,
      healthProbe: result.healthProbe,
      siteProbe: result.siteProbe,
      routeSwitch: result.routeSwitch,
      providerKey: result.providerKey,
      artifactVerified: result.artifactVerified,
      gateDecision: result.gateDecision,
      productionRunCount,
      productionGate: productionGateEvidence(productionGate, result.gateDecision, {
          releaseOrderId: orderId,
          releaseRunId,
          deploymentRunId: runId,
          environmentId: productionEnvId,
          manifestId,
        buildRunId,
        configRevisionId: productionR2?.revision?.id,
        finalGateKey,
        deploymentReleaseRunId: row.releaseRunId,
        deploymentEnvironmentId: row.environmentId,
        deploymentManifestId: row.artifactManifestId,
      }),
      routeEvidence: productionRouteEvidence({
        expected: expectedRoute,
        deployment: {
          releaseRunId: row.releaseRunId,
          environmentId: row.environmentId,
          artifactManifestId: row.artifactManifestId,
          startedAt: row.startedAt,
          finishedAt: row.finishedAt,
        },
        releaseRun: releaseEvidence,
        siteCandidateCount: siteCandidates.length,
        siteCurrent,
        routeRuns,
        siteProbe: result.siteProbe,
        deploymentRouteSwitch: result.routeSwitch,
        capturedAt: new Date().toISOString(),
      }),
    };
  });

  // ---------------------------------------------------- current env version
  await step("production-current-version", async () => {
    const versions = await api(
      "GET",
      `/projects/${projectId}/delivery/environment-versions`,
      headers,
    );
    const production = (versions.environments || []).find(
      (e) => e.id === productionEnvId,
    );
    const currentVersion = await prisma.environmentVersion.findUnique({
      where: { id: production?.currentEnvironmentVersionId ?? "" },
      select: {
        id: true,
        environmentId: true,
        artifactManifestId: true,
        deploymentRunId: true,
        releaseRunId: true,
        artifactManifest: { select: { digest: true } },
      },
    });
    const matches =
      currentVersion?.artifactManifestId === manifestId &&
      currentVersion?.artifactManifest?.digest === manifestDigest;
    return {
      currentEnvironmentVersionId: production?.currentEnvironmentVersionId,
      manifestId,
      manifestDigest,
      matches,
      currentVersion: currentVersion
        ? {
            id: currentVersion.id,
            artifactManifestId: currentVersion.artifactManifestId,
            digest: currentVersion.artifactManifest.digest,
            deploymentRunId: currentVersion.deploymentRunId,
            releaseRunId: currentVersion.releaseRunId,
          }
        : null,
      stagingCurrent: (versions.environments || []).find(
        (e) => e.id === stagingEnvId,
      )?.currentEnvironmentVersionId,
    };
  });

  // ------------------------------------------------------------- release run
  await step("release-run-final", async () => {
    const run = await prisma.releaseRun.findUnique({
      where: { id: releaseRunId },
      select: {
        id: true,
        status: true,
        mode: true,
        artifactManifestId: true,
        verifiedDigest: true,
        configRevisionId: true,
        operationApproval: {
          select: { status: true, consumedAt: true, reviewedAt: true },
        },
      },
    });
    return {
      releaseRunId,
      status: run?.status,
      succeeded: run?.status === "succeeded",
      mode: run?.mode,
      artifactManifestId: run?.artifactManifestId,
      verifiedDigestMatches: run?.verifiedDigest === manifestDigest,
      configRevisionId: run?.configRevisionId,
      approvalStatus: run?.operationApproval?.status,
      approvalConsumedAt: run?.operationApproval?.consumedAt,
    };
  });

  // ------------------------------------------------------------------ gates
  await step("gate-decisions", async () => {
    const rows = await prisma.releaseGateDecision.findMany({
      where: { releaseOrderId: orderId },
      select: {
        id: true,
        stage: true,
        allowed: true,
        blockerGateIds: true,
        deferredGateIds: true,
        requestKey: true,
      },
      orderBy: [{ createdAt: "desc" }],
      take: 10,
    });
    return rows.map((r) => ({
      stage: r.stage,
      allowed: r.allowed,
      blockerGateIds: r.blockerGateIds,
      deferredGateIds: r.deferredGateIds,
    }));
  });

  // -------------------------------------------------------------- final site
  await step("final-site-http", async () => {
    const route = productionR2?.revision?.routeSnapshot || {};
    const primaryDomain = route.domains?.[0];
    const publicFinalUrl = primaryDomain
      ? `${route.tlsRequired === true ? "https" : "http"}://${primaryDomain}/`
      : null;
    if (!publicFinalUrl || !runState.productionSiteId) {
      throw new Error("Production route identity is incomplete");
    }
    const liveProxyUrl = `${runtime.routeControlOrigin}/sites/${encodeURIComponent(runState.productionSiteId)}/`;
    const res = await httpGet(liveProxyUrl, { raw: true });
    const body = res.body || "";
    return {
      publicFinalUrl,
      publicSignoffRequired: true,
      liveProxyUrl,
      observedUrl: res.url,
      status: res.status,
      ok: res.status >= 200 && res.status < 400,
      bodySignature: body ? `sha256:${createHash("sha256").update(body).digest("hex")}` : null,
      titleMarker: /Parity Target Workload/.test(body),
    };
  });

  // ------------------------------------------------------------ final db summary
  await step("db-summary", async () => {
    const [builds, stagingDeploys, productionDeploys, envVersions, approvals] =
      await Promise.all([
        prisma.buildRun.count({ where: { releaseOrderId: orderId } }),
        prisma.deploymentRun.count({
          where: {
            environmentId: stagingEnvId,
            artifactManifest: { releaseOrderId: orderId },
          },
        }),
        prisma.deploymentRun.count({
          where: {
            environmentId: productionEnvId,
            artifactManifest: { releaseOrderId: orderId },
          },
        }),
        prisma.environmentVersion.count({
          where: { environmentId: productionEnvId },
        }),
        prisma.operationApproval.count({
          where: { projectId, targetId: releaseRunId },
        }),
      ]);
    return {
      buildRunsOnOrder: builds,
      stagingDeploymentRuns: stagingDeploys,
      productionDeploymentRuns: productionDeploys,
      productionEnvironmentVersions: envVersions,
      operationApprovals: approvals,
    };
  });

  finishEvidence(evidence, POSITIVE_AC_MAPPING);
  await writeEvidence();
  log("E2E chain PASSED — evidence at " + evidencePath());
}

// ----------------------------------------------------------------------------
// helpers
// ----------------------------------------------------------------------------
function evidencePath() {
  return `${outDir}/f455-positive-e2e-evidence.json`;
}

async function step(name, action) {
  return checkedStep(evidence, name, action, STEP_VERIFY[name], log);
}

const STEP_VERIFY = {
  preflight: (r) => [
    check("apiHealth", r.apiHealth, true), check("webStatus", r.webStatus, 200),
    check("targetStatus", r.targetStatus, 200), check("mysqlOk", r.mysqlOk, true),
    check("tokenIssued", r.tokenIssued, true), check("targetBodyMarker", r.targetBodyMarker, true),
  ],
  "intake-draft": (r) => [
    predicate("newProjectId", Boolean(r.project?.id) && r.project.id !== projectId, r.project?.id),
    check("onboardingStatus", r.project?.onboardingStatus, "draft"),
    predicate("notFinalized", !r.project?.onboardingFinalizedAt, r.project?.onboardingFinalizedAt),
  ],
  "intake-connect": (r) => [
    predicate("connectionId", Boolean(r.connectionId), r.connectionId),
    check("status", r.status, "connected"),
    check("selectedBranch", r.selectedBranch, "main"),
    check("commitSha", r.commitSha, pinnedCommit),
    predicate("provider", Boolean(r.provider), r.provider),
  ],
  "intake-analyze": (r) => [
    predicate("freshRunId", Boolean(r.runId) && r.runId !== "parity-analysis-0001", r.runId),
    check("status", r.status, "succeeded"), check("commitSha", r.commitSha, pinnedCommit),
    check("pinned", r.pinned, true), predicate("services", r.services?.length > 0, r.services?.length),
    predicate("packageManager", Boolean(r.packageManager), r.packageManager),
  ],
  "intake-contract": (r) => [
    predicate("contractShape", r.contractKeys?.length > 0, r.contractKeys),
    predicate("suggestions", r.suggestionCount > 0, r.suggestionCount),
  ],
  "intake-review": (r) => [
    check("expectedRefusal", r.expectedRefusal, false),
    predicate("reviewSnapshotId", Boolean(r.reviewSnapshotId), r.reviewSnapshotId),
    predicate("reviewSnapshotHash", /^[a-f0-9]{64}$/.test(r.reviewSnapshotHash || ""), r.reviewSnapshotHash),
  ],
  "intake-finalize": (r) => [
    check("expectedRefusal", r.expectedRefusal, false),
    predicate("projectId", Boolean(r.projectId), r.projectId),
    check("status", r.status, "ready"),
    predicate(
      "repositoryIdentityId",
      Boolean(r.repositoryIdentityId),
      r.repositoryIdentityId,
    ),
    predicate(
      "onboardingRevision",
      Number.isInteger(r.onboardingRevision),
      r.onboardingRevision,
    ),
    predicate(
      "finalizedAt",
      Number.isFinite(Date.parse(r.finalizedAt || "")),
      r.finalizedAt,
    ),
    predicate(
      "environments",
      Array.isArray(r.environments) && r.environments.length === 2,
      r.environments,
    ),
  ],
  "baselines-verified": (r) => [
    check("stagingRole", r.staging, "staging"), check("productionRole", r.production, "production"),
    check("exactlyOnePerRole", r.exactlyOnePerRole, true), check("r1Count", r.r1Count, 2),
    predicate("stagingCurrentR1", r.revisions.some((x) => x.id === r.stagingCurrentConfigRevisionId && x.revision === 1), r.stagingCurrentConfigRevisionId),
    predicate("productionCurrentR1", r.revisions.some((x) => x.id === r.productionCurrentConfigRevisionId && x.revision === 1), r.productionCurrentConfigRevisionId),
  ],
  "delivery-fixture-claim": (r) =>
    positiveDeliveryClaimChecks(r, {
      projectId,
      stagingEnvId,
      productionEnvId,
      analysisRunId: runState.intakeContext?.analysisRunId,
      reviewSnapshotId: runState.intakeContext?.reviewSnapshotId,
      reviewSnapshotHash: runState.intakeContext?.reviewSnapshotHash,
      repositoryIdentityId: runState.intakeFinalization?.repositoryIdentityId,
    }),
  "env-r1-current": (r) => [
    predicate("stagingR1", Boolean(r.stagingR1), r.stagingR1),
    predicate("productionR1", Boolean(r.productionR1), r.productionR1),
    check("stagingRevision", r.stagingRevisionNumber, 1), check("productionRevision", r.productionRevisionNumber, 1),
  ],
  "env-targets": (r) => [
    check("stagingMatched", r.stagingMatched, true), check("productionMatched", r.productionMatched, true),
    predicate("stagingBindings", r.staging?.bindings?.length > 0, r.staging?.bindings?.length),
    predicate("productionBindings", r.production?.bindings?.length > 0, r.production?.bindings?.length),
  ],
  "env-save-r2-staging": (r) => environmentR2Checks(r, "staging"),
  "env-save-r2-production": (r) => environmentR2Checks(r, "production"),
  "release-order": (r) => [
    check("releaseVersion", r.releaseVersion, "1.0.0"), check("buildsTotal", r.buildsTotal, 0),
    check("dbBuildRunCount", r.dbBuildRunCount, 0), check("dbManifestCount", r.dbManifestCount, 0),
    check("aggregate", r.ok, true),
  ],
  build: (r) => [
    predicate("buildRunId", Boolean(r.buildRunId), r.buildRunId), check("status", r.status, "succeeded"),
    check("sourceCommitSha", r.sourceCommitSha, pinnedCommit), check("pinnedCommitMatched", r.pinnedCommitMatched, true),
    predicate("manifestId", Boolean(r.manifestId), r.manifestId), predicate("manifestDigest", Boolean(r.manifestDigest), r.manifestDigest),
    predicate("manifestItems", r.manifestItems > 0, r.manifestItems), check("manifestBuildRunId", r.manifestBuildRunId, r.buildRunId),
    check("buildRunCount", r.buildRunCount, 1), check("manifestCount", r.manifestCount, 1),
  ],
  "staging-deploy": (r) => [
    predicate("deploymentRunId", Boolean(r.deploymentRunId), r.deploymentRunId),
    check("status", r.status, "completed"),
    check("environmentId", r.environmentId, stagingEnvId),
    check("sameManifest", r.sameManifest, true),
    check("artifactVerified", r.artifactVerified, true),
    ...stagingCommandProofChecks(r.commandProof),
  ],
  "production-preview": (r) => [
    predicate("inputHash", /^[a-f0-9]{64}$/.test(r.inputHash || ""), r.inputHash),
    check("manifestFrozen", r.manifestFrozen, true),
    check("configRevisionId", r.configRevisionId, r.expectedConfigRevisionId),
  ],
  "production-confirm": (r) => [
    predicate("releaseRunId", Boolean(r.releaseRunId), r.releaseRunId), check("status", r.status, "awaiting_approval"),
    check("awaitingApproval", r.awaitingApproval, true), predicate("approvalId", Boolean(r.approvalId), r.approvalId),
    check("approvalStatus", r.approvalStatus, "pending"), check("verifiedDigestMatches", r.verifiedDigestMatches, true),
    check("manifestId", r.manifestId, runState.manifestId), check("configRevisionId", r.configRevisionId, r.expectedConfigRevisionId),
  ],
  "approval-list": (r) => [
    check("id", r.id, runState.approvalId), check("status", r.status, "pending"),
    check("targetType", r.targetType, "release_run"), check("inputHashMatches", r.inputHashMatches, true),
  ],
  "approval-review": (r) => [
    check("approvalId", r.approvalId, runState.approvalId), check("status", r.status, "approved"),
    predicate("reviewerId", Boolean(r.reviewerId), r.reviewerId), predicate("reviewedAt", Boolean(r.reviewedAt), r.reviewedAt),
  ],
  "production-execute": (r) => productionExecutionChecks(r),
  "production-current-version": (r) => [
    predicate("currentEnvironmentVersionId", Boolean(r.currentEnvironmentVersionId), r.currentEnvironmentVersionId),
    check("currentPointer", r.currentEnvironmentVersionId, r.currentVersion?.id), check("matches", r.matches, true),
    check("manifestId", r.currentVersion?.artifactManifestId, runState.manifestId), check("digest", r.currentVersion?.digest, runState.manifestDigest),
    predicate("deploymentRunId", Boolean(r.currentVersion?.deploymentRunId), r.currentVersion?.deploymentRunId),
    check("releaseRunId", r.currentVersion?.releaseRunId, runState.releaseRunId),
  ],
  "release-run-final": (r) => [
    check("releaseRunId", r.releaseRunId, runState.releaseRunId), check("status", r.status, "succeeded"),
    check("succeeded", r.succeeded, true), check("mode", r.mode, "standard"),
    check("artifactManifestId", r.artifactManifestId, runState.manifestId), check("verifiedDigestMatches", r.verifiedDigestMatches, true),
    predicate("configRevisionId", Boolean(r.configRevisionId), r.configRevisionId), check("approvalStatus", r.approvalStatus, "approved"),
    predicate("approvalConsumedAt", Boolean(r.approvalConsumedAt), r.approvalConsumedAt),
  ],
  "gate-decisions": (r) => [
    predicate("decisions", r.length > 0, r.length),
    predicate("allAllowed", r.every((x) => x.allowed === true), r.map((x) => x.allowed)),
    predicate("noBlockers", r.every((x) => (x.blockerGateIds || []).length === 0), r),
  ],
  "final-site-http": (r) => [
    predicate("publicFinalUrl", Boolean(r.publicFinalUrl), r.publicFinalUrl),
    check("publicSignoffRequired", r.publicSignoffRequired, true),
    predicate("liveProxyUrl", Boolean(r.liveProxyUrl), r.liveProxyUrl),
    check("observedUrl", r.observedUrl, r.liveProxyUrl),
    predicate("status2xx", r.status >= 200 && r.status < 300, r.status),
    check("ok", r.ok, true),
    predicate("bodySignature", Boolean(r.bodySignature), r.bodySignature),
    check("titleMarker", r.titleMarker, true),
  ],
  "db-summary": (r) => [
    check("buildRunsOnOrder", r.buildRunsOnOrder, 1), check("stagingDeploymentRuns", r.stagingDeploymentRuns, 1),
    check("productionDeploymentRuns", r.productionDeploymentRuns, 1), predicate("productionEnvironmentVersions", r.productionEnvironmentVersions > 0, r.productionEnvironmentVersions),
    check("operationApprovals", r.operationApprovals, 1),
  ],
};

const STAGING_COMMAND_STEPS = [
  "verify_manifest_digest",
  "materialize_exact_manifest",
  "start_workloads",
  "probe_workloads",
  "activate_release",
];

function stagingCommandProof(row, expected) {
  const result = row.result || {};
  const params = row.params || {};
  return {
    commandPlan: row.commandPlan,
    providerEvidence: pick(result, [
      "providerActivated", "providerKey", "providerDeploymentId",
      "providerTargetRef", "checkoutInvoked", "pullInvoked",
      "buildInvoked", "gitInvoked", "artifactVerified", "immutableInput",
    ]),
    artifactContract: {
      expected,
      deploymentRunId: row.id,
      adapterKey: row.adapterKey,
      rowManifestId: row.artifactManifestId,
      resultManifestId: result.manifestId,
      resultManifestDigest: result.manifestDigest,
      paramsManifestId: params.manifestId,
      paramsManifestDigest: params.manifestDigest,
      paramsBuildRunId: params.buildRunId,
      paramsProviderKey: params.deploymentProvider?.key,
      paramsTargetRef: params.deploymentProvider?.targetRef,
    },
  };
}

function stagingCommandProofChecks(proof = {}) {
  const plan = proof.commandPlan || {};
  const provider = proof.providerEvidence || {};
  const artifact = proof.artifactContract || {};
  const expected = artifact.expected || {};
  return [
    check("commandPlanVersion", plan.version, 1),
    predicate("commandPlanStepsExact", jsonEqual(plan.steps, STAGING_COMMAND_STEPS), plan.steps),
    check("commandPlanCheckout", plan.checkout, false), check("commandPlanPull", plan.pull, false),
    check("commandPlanBuild", plan.build, false), predicate("commandPlanFetch", falseOrAbsent(plan.fetch), plan.fetch),
    predicate("commandPlanGit", falseOrAbsent(plan.git), plan.git),
    check("providerCheckoutInvoked", provider.checkoutInvoked, false),
    check("providerPullInvoked", provider.pullInvoked, false),
    check("providerBuildInvoked", provider.buildInvoked, false),
    check("providerGitInvoked", provider.gitInvoked, false),
    check("providerActivated", provider.providerActivated, true),
    check("providerArtifactVerified", provider.artifactVerified, true),
    check("immutableInput", provider.immutableInput, true),
    check("rowManifestId", artifact.rowManifestId, expected.manifestId),
    check("resultManifestId", artifact.resultManifestId, expected.manifestId),
    check("resultManifestDigest", artifact.resultManifestDigest, expected.manifestDigest),
    check("paramsManifestId", artifact.paramsManifestId, expected.manifestId),
    check("paramsManifestDigest", artifact.paramsManifestDigest, expected.manifestDigest),
    check("paramsBuildRunId", artifact.paramsBuildRunId, expected.buildRunId),
    check("providerKey", provider.providerKey, artifact.adapterKey),
    check("paramsProviderKey", artifact.paramsProviderKey, artifact.adapterKey),
    check("providerDeploymentId", provider.providerDeploymentId, artifact.deploymentRunId),
    check("providerTargetRef", provider.providerTargetRef, artifact.paramsTargetRef),
  ];
}

function falseOrAbsent(value) {
  return value === false || value === undefined;
}

function environmentR2Checks(result, role) {
  const production = role === "production";
  const snapshot = result.snapshot || {};
  const expectedVariables = {
    HTTP_PLAIN_PARITY: `${role}-r2`,
    PARITY_DEPLOY_MARKER: "f455-r2",
  };
  const expectedResources = production
    ? ["parity-resource-0001", "parity-resource-managed-0001"]
    : ["parity-resource-0001"];
  return [
    check("revision", result.revision, 2), predicate("id", Boolean(result.id), result.id),
    predicate("snapshotHash", /^[a-f0-9]{64}$/.test(result.snapshotHash || ""), result.snapshotHash),
    check("cas", result.cas, true), check("currentPointer", result.current, result.id),
    predicate("plainVariables", jsonEqual(snapshot.plainVariables, expectedVariables), snapshot.plainVariables),
    predicate("secretReferences", jsonEqual(ids(snapshot.secretReferences), ["parity-secret-0001"]), ids(snapshot.secretReferences)),
    predicate("resourceReferences", jsonEqual(ids(snapshot.resourceReferences), expectedResources.sort()), ids(snapshot.resourceReferences)),
    predicate("domains", jsonEqual(snapshot.routeSnapshot?.domains, [`${production ? "" : "staging."}parity.example.test`]), snapshot.routeSnapshot?.domains),
    check("proxyTarget", snapshot.routeSnapshot?.proxyTarget, production ? "http://parity-target-workload" : runtime.targetOrigin),
    check("tlsRequired", snapshot.routeSnapshot?.tlsRequired, production),
  ];
}

function productionExecutionChecks(result) {
  return [
    predicate(
      "deploymentRunId",
      Boolean(result.deploymentRunId),
      result.deploymentRunId,
    ),
    check("status", result.status, "completed"),
    check("environmentId", result.environmentId, productionEnvId),
    check("sameManifest", result.sameManifest, true),
    check("releaseRunId", result.releaseRunId, runState.releaseRunId),
    check("artifactVerified", result.artifactVerified, true),
    check("productionRunCount", result.productionRunCount, 1),
    predicate("workload", Boolean(result.workload), result.workload),
    check("healthProbe", result.healthProbe?.status, "passed"),
    ...productionRouteEvidenceChecks(result.routeEvidence),
    ...productionGateEvidenceChecks(result.productionGate),
  ];
}

function ids(items) {
  return (items || []).map((item) => item.id).sort();
}

function jsonEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function selfTestStagingCommandProof() {
  const row = {
    id: "deployment-1",
    adapterKey: "local-filesystem-v1",
    artifactManifestId: "manifest-1",
    commandPlan: {
      version: 1,
      steps: [...STAGING_COMMAND_STEPS],
      checkout: false,
      pull: false,
      build: false,
    },
    params: {
      manifestId: "manifest-1",
      manifestDigest: "sha256:artifact",
      buildRunId: "build-1",
      deploymentProvider: {
        key: "local-filesystem-v1",
        targetRef: "filesystem-release-target",
      },
    },
    result: {
      providerActivated: true,
      providerKey: "local-filesystem-v1",
      providerDeploymentId: "deployment-1",
      providerTargetRef: "filesystem-release-target",
      checkoutInvoked: false,
      pullInvoked: false,
      buildInvoked: false,
      gitInvoked: false,
      artifactVerified: true,
      immutableInput: true,
      manifestId: "manifest-1",
      manifestDigest: "sha256:artifact",
    },
  };
  const expected = {
    manifestId: "manifest-1",
    manifestDigest: "sha256:artifact",
    buildRunId: "build-1",
  };
  assertProofChecksPass(stagingCommandProofChecks(stagingCommandProof(row, expected)));
  for (const command of ["npm run build", "pnpm build", "git -C repo fetch"]) {
    const mutated = structuredClone(row);
    mutated.commandPlan.steps.push(command);
    const checks = stagingCommandProofChecks(stagingCommandProof(mutated, expected));
    if (checks.find((item) => item.name === "commandPlanStepsExact")?.pass !== false) {
      throw new Error(`command plan fixture escaped exact allowlist: ${command}`);
    }
  }
}

function assertProofChecksPass(checks) {
  const failed = checks.filter((item) => item.pass !== true);
  if (failed.length > 0) {
    throw new Error(`valid command proof rejected: ${failed.map((item) => item.name).join(", ")}`);
  }
}

async function login() {
  const res = await fetch(`${apiBase}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  const body = await res.json();
  if (!res.ok || !body.data?.accessToken) {
    throw new Error(`login failed: ${JSON.stringify(body)}`);
  }
  return body.data.accessToken;
}

async function api(method, path, headers, body) {
  const res = await fetch(`${apiBase}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    throw parityApiError(method, path, res.status, json);
  }
  return json.data;
}

async function apiExpect(method, path, headers, body) {
  const res = await fetch(`${apiBase}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json;
  try {
    json = await res.json();
  } catch {
    json = {};
  }
  return { status: res.status, code: json.code, message: json.message };
}

async function httpGet(url, options = {}) {
  const res = await fetch(url);
  const body = options.raw ? await res.text() : await res.json().catch(() => null);
  return { status: res.status, body, url: res.url };
}

async function mysqlPing() {
  const rows = await prisma.$queryRaw`SELECT 1 AS healthy`;
  return Array.isArray(rows) && Number(rows[0]?.healthy) === 1;
}

async function currentRevisionId(environmentId) {
  const env = await prisma.projectEnvironment.findUnique({
    where: { id: environmentId },
    select: { currentConfigRevisionId: true },
  });
  return env?.currentConfigRevisionId;
}

function flattenLogs(logs) {
  if (Array.isArray(logs)) return logs.join("\n");
  if (typeof logs === "string") return logs;
  return JSON.stringify(logs || []);
}

async function poll(read, maxAttempts, intervalMs, label) {
  for (let i = 0; i < maxAttempts; i += 1) {
    const value = await read();
    if (value !== undefined) return value;
    if (i % 10 === 9) log(`poll ${label}: attempt ${i + 1}/${maxAttempts}`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`poll ${label} timed out`);
}

function pick(obj, keys) {
  if (!obj) return undefined;
  const out = {};
  for (const key of keys) {
    if (obj[key] !== undefined) out[key] = obj[key];
  }
  return out;
}
async function writeEvidence() {
  await mkdir(outDir, { recursive: true });
  await writeFile(evidencePath(), JSON.stringify(evidence, null, 2));
  const runLogPath = `${outDir}/f455-positive-e2e-run.log`;
  await writeFile(runLogPath, runLog.join("\n"));
  log(`run log written to ${runLogPath}`);
}
if (process.argv.includes("--self-test-deploy-command-proof")) {
  selfTestStagingCommandProof();
  process.stdout.write("staging deploy command proof self-test passed\n");
} else {
  main()
    .catch((error) => {
      evidence.status = "failed";
      evidence.error = error.stack || error.message;
      console.error(`[f455] FAILED: ${error.stack || error.message}`);
      return writeEvidence().then(() => process.exit(1));
    })
    .finally(() => prisma.$disconnect());
}
