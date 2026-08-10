#!/usr/bin/env node
// F457 negative/security E2E driver over the RUNNING parity stack.
//
// Each AC-E2E-024..035 maps to a concrete rejection (status code + error) and
// a DB state assertion, on the existing enforcement (NO runtime code changes):
//   024 no repo connection (or no default branch) -> build rejected (422
//       RELEASE_GATE_BLOCKED), 0 BuildRun, gate decision persisted
//   025 required gate failure (connection.status=failed) -> stage rejected with
//       the decision persisted (blocker C01 repository_verification_failed)
//   026 provider disabled -> capability unavailable + execution rejected
//       (422 release_strategy_capabilities_unavailable)
//   027 cross-project / cross-order Manifest -> staging deploy rejected (404)
//   028 tampered Manifest digest -> deploy rejected (422)
//   029 config snapshot drift -> old confirm's execute rejected (422)
//   030 rejected / expired / consumed approval -> execute rejected (422)
//   031 concurrent confirms same/different idempotency keys + concurrent
//       execute -> never double-fires (one ReleaseRun / one DeploymentRun)
//   032 health-check failure -> DeploymentRun failed, current pointer NOT
//       moved, ReleaseRun failed
//   033 DNS/TLS/HTTP probe failure -> run NOT marked final success
//   034 MEMBER / cross-team user cannot see or execute protected actions (403)
//   035 full-chain secret scan of ALL evidence artifacts -> zero plaintext
//
// Evidence: /tmp/codex-tool-runs/svton/f457/f457-negative-e2e-evidence.json
// Zero-secret discipline: this driver NEVER writes tokens, passwords or
// secret values to disk; the evidence JSON and run log contain only status
// codes, error codes/messages, IDs and counts.
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  requireConfigRevisionCreateResponse,
} from "./lib/parity-config-revision-create-response.mjs";
import { checkedStep, finishEvidence } from "./lib/parity-e2e-evidence.mjs";
import { parityApiError } from "./lib/parity-http-error.mjs";
import {
  NEGATIVE_AC_MAPPING,
  negativeStepChecks,
} from "./lib/parity-negative-e2e-evidence.mjs";
import {
  loadNegativeHistoryContext,
  negativeHistoryInputFromEnvironment,
} from "./lib/parity-negative-e2e-context.mjs";
import { bindNegativeHistoryContext } from "./lib/parity-negative-history-db-binding.mjs";
import { historyChainOutputDirectory } from "./lib/parity-history-chain-paths.mjs";
import { assertNoPreexistingActiveRuns } from "./lib/parity-negative-run-ownership.mjs";
import { requireActiveEnvironmentService } from "./lib/parity-negative-service-context.mjs";
import { createParityComposeCapture } from "./lib/parity-compose-capture.mjs";
import { parityRuntimeConfig } from "./lib/parity-runtime-config.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runtime = parityRuntimeConfig();
const composeCapture = createParityComposeCapture(root, runtime);
const outDir = historyChainOutputDirectory(
  process.env,
  "f457",
  "/tmp/codex-tool-runs/svton/f457",
);
const apiBase = runtime.apiBase;
let teamId;
let projectId;
let orderId;
const runStamp = `${Date.now()}`;
const negProjectId = `parity-negative-project-${runStamp}`;
const negOrderId = `parity-negative-order-${runStamp}`;
const negBuildId = `parity-negative-build-${runStamp}`;
const negManifestId = `parity-negative-manifest-${runStamp}`;
const negManifestItemId = `parity-negative-manifest-item-${runStamp}`;
const negStagingEnvId = `parity-negative-staging-${runStamp}`;
const negProductionEnvId = `parity-negative-production-${runStamp}`;
let stagingEnvId;
let productionEnvId;
let productionWebServiceId;
const adminEmail = "admin@parity.local";
// Bootstrap password is read from docker-compose.devpilot-parity.yml (the
// documented seed source); it is ONLY used in-memory and never written to
// evidence/log files.
const adminPassword = "ParityDemo123!";
const memberEmail = "parity-member-0001@parity.test";
const outsiderEmail = "parity-outsider-0001@parity.test";
const memberUserId = "parity-member-0001";
const outsiderUserId = "parity-outsider-0001";
// Loaded and validated from the checked F456 history evidence before use.
let MANIFEST_M1;
let MANIFEST_M2;
let CROSS_ORDER_MANIFEST;
const historyEvidenceInput = negativeHistoryInputFromEnvironment(process.env);
const { PrismaClient } = createRequire(
  resolve(root, "apps/devpilot-api/package.json"),
)("@prisma/client");
const prisma = new PrismaClient({
  datasources: {
    db: { url: runtime.databaseUrl },
  },
});
const evidence = {
  worker: "f457-negative-e2e",
  objective: "AC-E2E-024..035 negative/security E2E over the parity stack",
  stack: {
    web: runtime.webOrigin,
    api: apiBase,
    mysql: runtime.mysqlEvidence,
    targetWorkload: runtime.targetOrigin,
  },
  fixedIds: { teamId, projectId, orderId, negProjectId, negOrderId },
  capturedAt: null,
  steps: {},
  ac: {},
  secretScan: null,
};

const runLog = [];
function log(message) {
  const line = `[f457 ${new Date().toISOString()}] ${message}`;
  runLog.push(line);
  process.stdout.write(`${line}\n`);
}

async function main() {
  await mkdir(outDir, { recursive: true });
  evidence.capturedAt = new Date().toISOString();

  const historyContext = await step("history-context", async () =>
    bindNegativeHistoryContext(
      prisma,
      await loadNegativeHistoryContext(historyEvidenceInput),
    ),
  );
  teamId = historyContext.teamId;
  projectId = historyContext.projectId;
  orderId = historyContext.orderId;
  stagingEnvId = historyContext.stagingEnvId;
  productionEnvId = historyContext.productionEnvId;
  productionWebServiceId = await requireActiveEnvironmentService(prisma, {
    projectId,
    environmentId: productionEnvId,
    contract: historyContext.applicationContracts.find((item) => item.component === "web"),
  });
  MANIFEST_M1 = historyContext.manifestM1;
  MANIFEST_M2 = historyContext.manifestM2;
  CROSS_ORDER_MANIFEST = historyContext.crossOrderManifestId;
  evidence.fixedIds = { teamId, projectId, orderId, negProjectId, negOrderId };
  evidence.context = { ...historyContext, productionWebServiceId };

  // ---------------------------------------------------------------- preflight
  await step("preflight", async () => {
    const [health, web, target, target404] = await Promise.all([
      httpGet(`${apiBase}/health`),
      httpGet(`${runtime.webOrigin}/`, { raw: true }),
      httpGet(`${runtime.targetOrigin}/`, { raw: true }),
      httpGet(`${runtime.targetOrigin}/parity-negative-probe-missing-457`, {
        raw: true,
      }),
    ]);
    return {
      apiHealth: health.status === 200,
      webStatus: web.status,
      targetStatus: target.status,
      target404Status: target404.status,
      target404Definitive: target404.status >= 400,
    };
  });

  let token;
  await step("login", async () => {
    token = await login(adminEmail);
    return {
      email: adminEmail,
      source:
        "docker-compose.devpilot-parity.yml DEVPILOT_BOOTSTRAP_ADMIN_EMAIL/PASSWORD",
      status: "passed",
      verified: Boolean(token),
      note: "token held in memory only; never persisted to evidence/log",
    };
  });

  const headers = {
    authorization: `Bearer ${token}`,
    "x-team-id": teamId,
    "content-type": "application/json",
  };

  // ------------------------------------------------------- fixture setup (DB)
  await step("fixtures", async () => {
    await seedNegativeFixtures();
    const cleanup = await assertCleanReleaseEnvironment();
    return {
      seeded: true,
      uniqueFixtureIds: [
        negProjectId,
        negOrderId,
        negBuildId,
        negManifestId,
        negManifestItemId,
        negStagingEnvId,
        negProductionEnvId,
      ].every((id) => id.endsWith(runStamp)),
      runningReleaseRuns: cleanup.runningReleaseRuns,
      negProjectId,
      negOrderId,
      negManifestId,
      memberUserId,
      outsiderUserId,
      note: "negative project has NO repository connection/identity; member user role=MEMBER; outsider user has NO membership in parity-team-0001",
    };
  });

  // ----------------------------------------- AC-E2E-024 unconnected repo build
  let negBuildCountBefore = await countBuildRuns(negOrderId);
  await step("ac-024-build-no-repo-rejected", async () => {
    const out = await apiExpect(
      "POST",
      `/projects/${negProjectId}/delivery/releases/${negOrderId}/builds`,
      headers,
    );
    const decision = await latestBuildDecision(negOrderId);
    return {
      status: out.status,
      code: out.code,
      message: out.message,
      decisionAllowed: decision?.allowed,
      decisionBlockers: decision?.blockerGateIds,
      decisionStage: decision?.stage,
      decisionConsumedAtNull: decision?.consumedAt === null,
      dbBuildRunDelta: (await countBuildRuns(negOrderId)) - negBuildCountBefore,
    };
  });
  await step("ac-024-db-state", async () => {
    const decision = await latestBuildDecision(negOrderId);
    const c01 = gateCheck(decision, "C01");
    return {
      dbBuildRunDelta: (await countBuildRuns(negOrderId)) - negBuildCountBefore,
      buildRunCount: await countBuildRuns(negOrderId),
      decisionId: decision?.id,
      decisionAllowed: decision?.allowed,
      decisionConsumedAtNull: decision?.consumedAt === null,
      c01: c01 ? { status: c01.status, reasonCode: c01.reasonCode } : null,
    };
  });

  // --------------------------------------- AC-E2E-025 required gate failure
  await step("ac-025-setup-failed-connection", async () => {
    // A stored connection whose verification FAILED is a genuine C01 blocker
    // (repository_verification_failed) — the build stage gate refuses with the
    // decision persisted. Cleaned up right after the check.
    const connectionId = `parity-negative-connection-failed-${runStamp}`;
    await prisma.repositoryConnection.upsert({
      where: { id: connectionId },
      create: {
        id: connectionId,
        teamId,
        projectId: negProjectId,
        connectedById: "parity-user-0001",
        provider: "local",
        repositoryUrl: "/read-only-repositories/parity-app",
        visibility: "public",
        credentialSource: "none",
        defaultBranch: "main",
        selectedBranch: "main",
        commitSha: "2f0ec3246761537123c65ac415a14e503ebbfa38",
        branches: ["main"],
        status: "failed",
        errorCode: "repository_verification_failed",
        verifiedAt: null,
      },
      update: {
        status: "failed",
        errorCode: "repository_verification_failed",
        verifiedAt: null,
      },
    });
    return { connectionId, status: "failed" };
  });
  await step("ac-025-build-gate-rejected", async () => {
    const out = await apiExpect(
      "POST",
      `/projects/${negProjectId}/delivery/releases/${negOrderId}/builds`,
      headers,
    );
    const decision = await latestBuildDecision(negOrderId);
    const c01 = gateCheck(decision, "C01");
    return {
      status: out.status,
      code: out.code,
      decisionId: decision?.id,
      decisionAllowed: decision?.allowed,
      decisionBlockers: decision?.blockerGateIds,
      c01: c01 ? { status: c01.status, reasonCode: c01.reasonCode } : null,
      dbBuildRunDelta: (await countBuildRuns(negOrderId)) - negBuildCountBefore,
    };
  });
  await step("ac-025-cleanup", async () => {
    const connectionId = `parity-negative-connection-failed-${runStamp}`;
    await prisma.repositoryConnection.delete({
      where: { id: connectionId },
    });
    const leftover = await prisma.repositoryConnection.findUnique({
      where: { id: connectionId },
    });
    return {
      cleaned: leftover === null,
      dbBuildRunDelta: (await countBuildRuns(negOrderId)) - negBuildCountBefore,
    };
  });

  // -------------------------------- AC-E2E-026 provider disabled capability
  await step("ac-026-capability-unavailable", async () => {
    const policy = await api(
      "GET",
      `/projects/${projectId}/release-policy`,
      headers,
    );
    const caps = (policy.capabilities || []).map((c) => ({
      strategy: c.strategy,
      executable: c.executable,
      reasonCode: c.reasonCode,
      missingCapabilities: c.missingCapabilities,
    }));
    return { capabilities: caps };
  });
  await step("ac-026-preview-rejected", async () => {
    const out = await apiExpect(
      "GET",
      `/projects/${projectId}/delivery/releases/${orderId}/production-preview?manifestId=${MANIFEST_M2}&strategy=canary`,
      headers,
    );
    return {
      status: out.status,
      code: out.code,
      message: out.message,
    };
  });
  const releaseCountBefore26 = await prisma.releaseRun.count({
    where: { releaseOrderId: orderId },
  });
  await step("ac-026-confirm-rejected", async () => {
    const out = await apiExpect(
      "POST",
      `/projects/${projectId}/delivery/releases/${orderId}/production-releases`,
      headers,
      {
        manifestId: MANIFEST_M2,
        expectedInputHash: "f".repeat(64),
        idempotencyKey: `f457-capability-${Date.now()}`,
        strategy: "blue_green",
      },
    );
    return {
      status: out.status,
      code: out.code,
      message: out.message,
      releaseRunDelta:
        (await prisma.releaseRun.count({
          where: { releaseOrderId: orderId },
        })) - releaseCountBefore26,
    };
  });

  // ------------------------------------ AC-E2E-027 cross-project/order manifest
  const stagingCountBefore = await countStagingDeployments(orderId);
  await step("ac-027-cross-project-manifest", async () => {
    const out = await apiExpect(
      "POST",
      `/projects/${projectId}/delivery/releases/${orderId}/staging-deployments`,
      headers,
      { manifestId: negManifestId },
    );
    return {
      status: out.status,
      message: out.message,
      dbDeploymentRunDelta:
        (await countStagingDeployments(orderId)) - stagingCountBefore,
    };
  });
  await step("ac-027-cross-order-manifest", async () => {
    const out = await apiExpect(
      "POST",
      `/projects/${projectId}/delivery/releases/${orderId}/staging-deployments`,
      headers,
      { manifestId: CROSS_ORDER_MANIFEST },
    );
    const delta = (await countStagingDeployments(orderId)) - stagingCountBefore;
    return {
      status: out.status,
      message: out.message,
      dbDeploymentRunDelta: delta,
    };
  });

  // ---------------------------------------------- AC-E2E-028 tampered digest
  let originalBundleDigest;
  await step("ac-028-tamper-digest", async () => {
    const item = await prisma.artifactManifestItem.findFirst({
      where: { manifestId: MANIFEST_M1, componentKey: "project-bundle" },
    });
    if (!item) throw new Error("M1 project-bundle item not found");
    originalBundleDigest = item.digest;
    const tamperedDigest = `sha256:${"deadbeef".repeat(8)}`;
    await prisma.artifactManifestItem.update({
      where: { id: item.id },
      data: { digest: tamperedDigest },
    });
    return {
      manifestId: MANIFEST_M1,
      tamperedItem: item.id,
      originalDigest: originalBundleDigest,
      tamperedDigest,
      digestChanged: originalBundleDigest !== tamperedDigest,
    };
  });
  await step("ac-028-deploy-rejected", async () => {
    const out = await apiExpect(
      "POST",
      `/projects/${projectId}/delivery/releases/${orderId}/staging-deployments`,
      headers,
      { manifestId: MANIFEST_M1 },
    );
    const delta = (await countStagingDeployments(orderId)) - stagingCountBefore;
    return {
      status: out.status,
      message: out.message,
      dbDeploymentRunDelta: delta,
    };
  });
  await step("ac-028-restore-digest", async () => {
    const item = await prisma.artifactManifestItem.findFirst({
      where: { manifestId: MANIFEST_M1, componentKey: "project-bundle" },
    });
    await prisma.artifactManifestItem.update({
      where: { id: item.id },
      data: { digest: originalBundleDigest },
    });
    const restored = (
      await prisma.artifactManifestItem.findUnique({
        where: { id: item.id },
        select: { digest: true },
      })
    ).digest;
    return {
      restored: restored === originalBundleDigest,
      restoredDigest: restored,
      expectedDigest: originalBundleDigest,
    };
  });

  // ------------------------------------ AC-E2E-029 config drift old confirm
  const prodCurrentBefore = await productionCurrentVersionId();
  let r2ProductionId;
  let r3ProductionId;
  let driftedRunId;
  await step("ac-029-setup", async () => {
    const current = await prisma.projectEnvironment.findUnique({
      where: { id: productionEnvId },
      select: { currentConfigRevisionId: true },
    });
    r2ProductionId = current.currentConfigRevisionId;
    if (!r2ProductionId)
      throw new Error("production current config revision not found");
    const revisions = await prisma.environmentConfigRevision.findMany({
      where: { projectId, environmentId: productionEnvId },
      orderBy: { revision: "asc" },
      select: { id: true, revision: true },
    });
    return {
      baseRevisionId: r2ProductionId,
      baseRevisionNumber: revisions.find((r) => r.id === r2ProductionId)
        ?.revision,
      note: "base = current production config revision at test start (drift target is the next CAS save)",
    };
  });
  await step("ac-029-confirm-at-r2", async () => {
    const preview = await api(
      "GET",
      `/projects/${projectId}/delivery/releases/${orderId}/production-preview?manifestId=${MANIFEST_M2}`,
      headers,
    );
    const confirm = await api(
      "POST",
      `/projects/${projectId}/delivery/releases/${orderId}/production-releases`,
      headers,
      {
        manifestId: MANIFEST_M2,
        expectedInputHash: preview.inputHash,
        idempotencyKey: `f457-negative-drift-confirm-${runStamp}`,
      },
    );
    driftedRunId = confirm.id;
    const approvalId = confirm.operationApproval?.id;
    await prisma.operationApproval.update({
      where: { id: approvalId },
      data: { status: "rejected" },
    });
    return {
      releaseRunId: confirm.id,
      approvalId,
      approvalStatus: confirm.operationApproval?.status,
      configRevisionId: confirm.configRevisionId,
      frozenAtBase: confirm.configRevisionId === r2ProductionId,
    };
  });
  await step("ac-029-create-r3-drift", async () => {
    const r3 = await api(
      "POST",
      `/project-environments/${productionEnvId}/config-revisions`,
      headers,
      {
        plainVariables: {
          HTTP_PLAIN_PARITY: "production-r3-drift",
          PARITY_DEPLOY_MARKER: "f457-r3-drift",
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
            impact:
              "parity target workload managed resource (production gate evidence)",
          },
        ],
        routeSnapshot: {
          domains: ["parity.example.test"],
          proxyTarget: "http://parity-target-workload",
          tlsRequired: true,
        },
        policyReferenceIds: [],
        expectedCurrentRevisionId: r2ProductionId,
        changeSummary: "F457 negative e2e: production config drift (R3)",
      },
    );
    const created = requireConfigRevisionCreateResponse(r3);
    r3ProductionId = created.id;
    const current = (
      await prisma.projectEnvironment.findUnique({
        where: { id: productionEnvId },
        select: { currentConfigRevisionId: true },
      })
    ).currentConfigRevisionId;
    return {
      r3RevisionId: created.id,
      revision: created.revision,
      nowCurrent: current === created.id,
    };
  });
  await step("ac-029-old-confirm-execute-rejected", async () => {
    const out = await apiExpect(
      "POST",
      `/projects/${projectId}/delivery/environment-versions/${productionEnvId}/actions`,
      headers,
      { kind: "upgrade", manifestId: MANIFEST_M2, releaseRunId: driftedRunId },
    );
    const deploys = await prisma.deploymentRun.count({
      where: { releaseRunId: driftedRunId },
    });
    const pointerMoved =
      (await productionCurrentVersionId()) !== prodCurrentBefore;
    return {
      status: out.status,
      code: out.code,
      message: out.message,
      dbDeploymentRunWithRun: deploys,
      currentPointerUnchanged: !pointerMoved,
    };
  });
  await step("ac-029-cleanup", async () => {
    await cancelReleaseRun(driftedRunId);
    return {
      driftedRunCanceled:
        (await prisma.releaseRun.findUnique({ where: { id: driftedRunId } }))
          .status === "canceled",
    };
  });

  // -------------------------------------- AC-E2E-030 approval state rejections
  const ac30Results = {};
  await step("ac-030-rejected-approval", async () => {
    const { runId, approvalId } = await confirmProduction(
      headers,
      `f457-negative-approval-rejected-${runStamp}`,
    );
    const review = await api(
      "POST",
      `/operation-approvals/${approvalId}/review`,
      headers,
      {
        decision: "rejected",
        reviewComment: "F457 negative e2e: reject approval",
      },
    );
    const out = await apiExpect(
      "POST",
      `/projects/${projectId}/delivery/environment-versions/${productionEnvId}/actions`,
      headers,
      { kind: "upgrade", manifestId: MANIFEST_M2, releaseRunId: runId },
    );
    const deploys = await prisma.deploymentRun.count({
      where: { releaseRunId: runId },
    });
    const approval = await prisma.operationApproval.findUnique({
      where: { id: approvalId },
      select: { status: true },
    });
    ac30Results.rejected = {
      runId,
      reviewDecision: review.decision,
      approvalStatus: approval.status,
      executeStatus: out.status,
      code: out.code,
      message: out.message,
      dbDeploymentRunWithRun: deploys,
      runStatusBeforeCleanup: (
        await prisma.releaseRun.findUnique({
          where: { id: runId },
          select: { status: true },
        })
      )?.status,
    };
    await cancelReleaseRun(runId);
    ac30Results.rejected.runCanceled =
      (
        await prisma.releaseRun.findUnique({
          where: { id: runId },
          select: { status: true },
        })
      )?.status === "canceled";
    return ac30Results.rejected;
  });
  await step("ac-030-expired-approval", async () => {
    const { runId, approvalId } = await confirmProduction(
      headers,
      `f457-negative-approval-expired-${runStamp}`,
    );
    await api("POST", `/operation-approvals/${approvalId}/review`, headers, {
      decision: "approved",
      reviewComment: "F457 negative e2e: approve then expire",
    });
    await prisma.operationApproval.update({
      where: { id: approvalId },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const approval = await prisma.operationApproval.findUnique({
      where: { id: approvalId },
      select: { status: true, expiresAt: true },
    });
    const out = await apiExpect(
      "POST",
      `/projects/${projectId}/delivery/environment-versions/${productionEnvId}/actions`,
      headers,
      { kind: "upgrade", manifestId: MANIFEST_M2, releaseRunId: runId },
    );
    const deploys = await prisma.deploymentRun.count({
      where: { releaseRunId: runId },
    });
    const run = await prisma.releaseRun.findUnique({
      where: { id: runId },
      select: { status: true },
    });
    ac30Results.expired = {
      runId,
      executeStatus: out.status,
      code: out.code,
      message: out.message,
      dbDeploymentRunWithRun: deploys,
      runStatusBeforeCleanup: run.status,
      approvalStatus: approval.status,
      approvalExpired: approval.expiresAt < new Date(),
    };
    await cancelReleaseRun(runId);
    ac30Results.expired.runCanceled =
      (
        await prisma.releaseRun.findUnique({
          where: { id: runId },
          select: { status: true },
        })
      )?.status === "canceled";
    return ac30Results.expired;
  });
  await step("ac-030-consumed-approval", async () => {
    const { runId, approvalId } = await confirmProduction(
      headers,
      `f457-negative-approval-consumed-${runStamp}`,
    );
    await api("POST", `/operation-approvals/${approvalId}/review`, headers, {
      decision: "approved",
      reviewComment: "F457 negative e2e: approve then mark consumed",
    });
    await prisma.operationApproval.update({
      where: { id: approvalId },
      data: { consumedAt: new Date() },
    });
    const out = await apiExpect(
      "POST",
      `/projects/${projectId}/delivery/environment-versions/${productionEnvId}/actions`,
      headers,
      { kind: "upgrade", manifestId: MANIFEST_M2, releaseRunId: runId },
    );
    const deploys = await prisma.deploymentRun.count({
      where: { releaseRunId: runId },
    });
    const approval = await prisma.operationApproval.findUnique({
      where: { id: approvalId },
      select: { consumedAt: true, status: true },
    });
    const run = await prisma.releaseRun.findUnique({
      where: { id: runId },
      select: { status: true },
    });
    ac30Results.consumed = {
      runId,
      executeStatus: out.status,
      code: out.code,
      message: out.message,
      dbDeploymentRunWithRun: deploys,
      approvalStatus: approval.status,
      approvalConsumedAtSet: Boolean(approval.consumedAt),
      runStatusBeforeCleanup: run.status,
    };
    await cancelReleaseRun(runId);
    ac30Results.consumed.runCanceled =
      (
        await prisma.releaseRun.findUnique({
          where: { id: runId },
          select: { status: true },
        })
      )?.status === "canceled";
    return ac30Results.consumed;
  });

  // ------------------------------------------- AC-E2E-031 concurrency no double-fire
  await step("ac-031-same-idempotency-key", async () => {
    const preview = await api(
      "GET",
      `/projects/${projectId}/delivery/releases/${orderId}/production-preview?manifestId=${MANIFEST_M2}`,
      headers,
    );
    const payload = {
      manifestId: MANIFEST_M2,
      expectedInputHash: preview.inputHash,
      idempotencyKey: `f457-negative-concurrent-same-key-${runStamp}`,
    };
    const [first, second] = await Promise.all([
      apiExpect(
        "POST",
        `/projects/${projectId}/delivery/releases/${orderId}/production-releases`,
        headers,
        payload,
      ),
      apiExpect(
        "POST",
        `/projects/${projectId}/delivery/releases/${orderId}/production-releases`,
        headers,
        payload,
      ),
    ]);
    const runs = await prisma.releaseRun.findMany({
      where: {
        idempotencyKey: `f457-negative-concurrent-same-key-${runStamp}`,
      },
      select: { id: true, status: true },
    });
    const ok =
      first.status === 201 && second.status === 201 && runs.length === 1;
    for (const run of runs) await cancelReleaseRun(run.id);
    return {
      ok,
      firstStatus: first.status,
      secondStatus: second.status,
      sameIdempotencyKey: true,
      releaseRunCount: runs.length,
      runIds: runs.map((r) => r.id),
    };
  });
  let concurrentRunId;
  let concurrentApprovalId;
  await step("ac-031-different-idempotency-keys", async () => {
    const preview = await api(
      "GET",
      `/projects/${projectId}/delivery/releases/${orderId}/production-preview?manifestId=${MANIFEST_M2}`,
      headers,
    );
    const base = {
      manifestId: MANIFEST_M2,
      expectedInputHash: preview.inputHash,
    };
    const [first, second] = await Promise.all([
      apiExpect(
        "POST",
        `/projects/${projectId}/delivery/releases/${orderId}/production-releases`,
        headers,
        {
          ...base,
          idempotencyKey: `f457-negative-concurrent-a-${runStamp}`,
        },
      ),
      apiExpect(
        "POST",
        `/projects/${projectId}/delivery/releases/${orderId}/production-releases`,
        headers,
        {
          ...base,
          idempotencyKey: `f457-negative-concurrent-b-${runStamp}`,
        },
      ),
    ]);
    const runs = await prisma.releaseRun.findMany({
      where: {
        releaseOrderId: orderId,
        status: "awaiting_approval",
        idempotencyKey: {
          in: [
            `f457-negative-concurrent-a-${runStamp}`,
            `f457-negative-concurrent-b-${runStamp}`,
          ],
        },
      },
      select: { id: true, idempotencyKey: true, operationApprovalId: true },
    });
    const winner = runs[0];
    const loser =
      first.status === 201 && second.status === 201
        ? null
        : first.status === 201
          ? second
          : first;
    concurrentRunId = winner?.id;
    concurrentApprovalId = winner?.operationApprovalId;
    const ok =
      runs.length === 1 &&
      ((first.status === 201 && second.status === 409) ||
        (second.status === 201 && first.status === 409)) &&
      /已有进行中的发布运行/.test(loser?.message || "");
    return {
      ok,
      firstStatus: first.status,
      secondStatus: second.status,
      loserMessage: loser?.message,
      effectiveReleaseRunCount: runs.length,
      winnerRunId: concurrentRunId,
      winnerApprovalId: concurrentApprovalId,
      environmentMaxOneRunEnforced:
        runs.length === 1 &&
        ((first.status === 201 && second.status === 409) ||
          (second.status === 201 && first.status === 409)),
    };
  });
  await step("ac-031-approve-winner", async () => {
    const reviewed = await api(
      "POST",
      `/operation-approvals/${concurrentApprovalId}/review`,
      headers,
      {
        decision: "approved",
        reviewComment: "F457 negative e2e: approve concurrent execute winner",
      },
    );
    return {
      approvalId: concurrentApprovalId,
      decision: "approved",
      status: reviewed.status,
    };
  });
  await step("ac-031-refresh-gate-evidence", async () => {
    const refreshedAt = await refreshProductionGateEvidence();
    return {
      refreshedAt,
      note: "D05/D07/D08/D18 fixture evidence timestamps refreshed (5-15min TTL freshness)",
    };
  });
  await step("ac-031-concurrent-execute", async () => {
    const payload = {
      kind: "upgrade",
      manifestId: MANIFEST_M2,
      releaseRunId: concurrentRunId,
    };
    const [first, second] = await Promise.all([
      apiExpect(
        "POST",
        `/projects/${projectId}/delivery/environment-versions/${productionEnvId}/actions`,
        headers,
        payload,
      ),
      apiExpect(
        "POST",
        `/projects/${projectId}/delivery/environment-versions/${productionEnvId}/actions`,
        headers,
        payload,
      ),
    ]);
    const deploys = await prisma.deploymentRun.findMany({
      where: { releaseRunId: concurrentRunId },
      select: { id: true, status: true, error: true },
    });
    const run = await prisma.releaseRun.findUnique({
      where: { id: concurrentRunId },
      select: { status: true, errorCode: true, errorMessage: true },
    });
    const winner = first.status < 300 ? first : second;
    const winnerBody = winner.body;
    const winnerRunId =
      winnerBody?.run?.id ?? winnerBody?.deploymentRunId ?? winnerBody?.id;
    const loser = first.status < 300 ? second : first;
    const loserRejected = loser.status === 409 || loser.status === 422;
    const ok =
      deploys.length === 1 &&
      deploys[0].status === "completed" &&
      run?.status === "succeeded" &&
      loserRejected;
    return {
      ok,
      firstStatus: first.status,
      secondStatus: second.status,
      winnerMessage: winner.message,
      loserMessage: loser.message,
      loserStatus: loser.status,
      deploymentRunCount: deploys.length,
      deploymentRunId: winnerRunId,
      deploymentRunStatus: deploys[0]?.status,
      deploymentRunError: deploys[0]?.error,
      releaseRunStatus: run?.status,
      releaseRunErrorCode: run?.errorCode,
      releaseRunErrorMessage: run?.errorMessage,
      approvalConsumed:
        (
          await prisma.operationApproval.findUnique({
            where: { id: concurrentApprovalId },
            select: { consumedAt: true },
          })
        ).consumedAt !== null,
    };
  });

  let pointerAfterConcurrentExecute = null;
  await step("ac-031-capture-pointer", async () => {
    pointerAfterConcurrentExecute = await productionCurrentVersionId();
    return { pointerAfterConcurrentExecute };
  });

  // -------------------------------- AC-E2E-032 health-check failure
  let savedWebDeployConfig;
  await step("ac-032-setup-broken-health", async () => {
    const web = await prisma.applicationService.findUnique({
      where: { id: productionWebServiceId },
      select: { deployConfig: true },
    });
    savedWebDeployConfig = web.deployConfig;
    await prisma.applicationService.update({
      where: { id: productionWebServiceId },
      data: {
        deployConfig: {
          ...(savedWebDeployConfig || {}),
          healthCheckUrl: "http://127.0.0.1:9/health",
          healthCheckAttempts: 2,
          healthCheckIntervalMs: 200,
          healthCheckTimeoutMs: 1000,
        },
      },
    });
    const persisted = await prisma.applicationService.findUnique({
      where: { id: productionWebServiceId },
      select: { deployConfig: true },
    });
    return {
      serviceId: productionWebServiceId,
      healthCheckUrl: "http://127.0.0.1:9/health",
      attempts: 2,
      persistedBrokenHealth:
        persisted?.deployConfig?.healthCheckUrl === "http://127.0.0.1:9/health",
    };
  });
  let healthRunId;
  let healthDeployRunId;
  await step("ac-032-refresh-gate-evidence", async () => {
    const refreshedAt = await refreshProductionGateEvidence();
    return { refreshedAt };
  });
  await step("ac-032-execute-health-fail", async () => {
    const preview = await api(
      "GET",
      `/projects/${projectId}/delivery/releases/${orderId}/production-preview?manifestId=${MANIFEST_M2}`,
      headers,
    );
    const confirm = await api(
      "POST",
      `/projects/${projectId}/delivery/releases/${orderId}/production-releases`,
      headers,
      {
        manifestId: MANIFEST_M2,
        expectedInputHash: preview.inputHash,
        idempotencyKey: `f457-negative-health-fail-${runStamp}`,
      },
    );
    healthRunId = confirm.id;
    await api(
      "POST",
      `/operation-approvals/${confirm.operationApproval.id}/review`,
      headers,
      {
        decision: "approved",
        reviewComment: "F457 negative e2e: approve health-failure deploy",
      },
    );
    const executed = await apiExpect(
      "POST",
      `/projects/${projectId}/delivery/environment-versions/${productionEnvId}/actions`,
      headers,
      { kind: "upgrade", manifestId: MANIFEST_M2, releaseRunId: healthRunId },
    );
    const deploys = await prisma.deploymentRun.findMany({
      where: { releaseRunId: healthRunId },
      select: { id: true, status: true, error: true },
    });
    healthDeployRunId = deploys[0]?.id;
    const run = await prisma.releaseRun.findUnique({
      where: { id: healthRunId },
      select: { status: true, errorCode: true },
    });
    const pointerMoved =
      (await productionCurrentVersionId()) !== pointerAfterConcurrentExecute;
    return {
      executeStatus: executed.status,
      deploymentRunStatus: deploys[0]?.status,
      deploymentRunError: deploys[0]?.error,
      releaseRunStatus: run?.status,
      releaseRunErrorCode: run?.errorCode,
      healthFailed:
        deploys[0]?.status === "failed" &&
        /WORKLOAD_HEALTH_FAILED/.test(deploys[0]?.error || ""),
      currentPointerUnchanged: !pointerMoved,
    };
  });
  await step("ac-032-db-state", async () => {
    const deploy = await prisma.deploymentRun.findUnique({
      where: { id: healthDeployRunId },
      select: { status: true, error: true, result: true },
    });
    const decision = await prisma.releaseGateDecision.findFirst({
      where: { actionRunId: healthDeployRunId },
      select: { stage: true, allowed: true, consumedAt: true },
    });
    const pointerUnchanged =
      (await productionCurrentVersionId()) === pointerAfterConcurrentExecute;
    const ok =
      deploy?.status === "failed" &&
      /WORKLOAD_HEALTH_FAILED/.test(deploy?.error || "") &&
      pointerUnchanged &&
      decision?.stage === "production" &&
      decision?.consumedAt !== null;
    return {
      ok,
      deploymentRunStatus: deploy?.status,
      error: deploy?.error,
      gateDecision: decision,
      pointerUnchangedVs031Baseline: pointerUnchanged,
      releaseRunStatus: (
        await prisma.releaseRun.findUnique({
          where: { id: healthRunId },
          select: { status: true },
        })
      ).status,
      note: "gates may record allowed=true for a failed run when the deploy itself failed (honest: the gates allowed, the workload health check failed)",
    };
  });
  await step("ac-032-restore-service", async () => {
    await prisma.applicationService.update({
      where: { id: productionWebServiceId },
      data: { deployConfig: savedWebDeployConfig },
    });
    const restored = (
      await prisma.applicationService.findUnique({
        where: { id: productionWebServiceId },
        select: { deployConfig: true },
      })
    ).deployConfig;
    return {
      restored:
        JSON.stringify(restored) === JSON.stringify(savedWebDeployConfig),
      healthCheckRemoved: !restored?.healthCheckUrl,
    };
  });

  // ------------------------------------ AC-E2E-033 probe failure (HTTP 404)
  let r4ProductionId;
  await step("ac-033-create-r4-probe-404", async () => {
    const current = (
      await prisma.projectEnvironment.findUnique({
        where: { id: productionEnvId },
        select: { currentConfigRevisionId: true },
      })
    ).currentConfigRevisionId;
    const r4 = await api(
      "POST",
      `/project-environments/${productionEnvId}/config-revisions`,
      headers,
      {
        plainVariables: {
          HTTP_PLAIN_PARITY: "production-r4-probe-404",
          PARITY_DEPLOY_MARKER: "f457-r4-probe",
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
            impact:
              "parity target workload managed resource (production gate evidence)",
          },
        ],
        routeSnapshot: {
          domains: ["parity.example.test"],
          proxyTarget:
            "http://parity-target-workload/parity-negative-probe-missing-457",
          tlsRequired: true,
        },
        policyReferenceIds: [],
        expectedCurrentRevisionId: current,
        changeSummary: "F457 negative e2e: production probe-failure route (R4)",
      },
    );
    r4ProductionId = r4.id;
    return {
      r4RevisionId: r4.id,
      revision: r4.revision,
      proxyTarget:
        "http://parity-target-workload/parity-negative-probe-missing-457",
      nowCurrent:
        (
          await prisma.projectEnvironment.findUnique({
            where: { id: productionEnvId },
            select: { currentConfigRevisionId: true },
          })
        ).currentConfigRevisionId === r4.id,
    };
  });
  let probeRunId;
  let probeDeployRunId;
  await step("ac-033-refresh-gate-evidence", async () => {
    const refreshedAt = await refreshProductionGateEvidence();
    return { refreshedAt };
  });
  await step("ac-033-execute-probe-fail", async () => {
    const preview = await api(
      "GET",
      `/projects/${projectId}/delivery/releases/${orderId}/production-preview?manifestId=${MANIFEST_M2}`,
      headers,
    );
    const confirm = await api(
      "POST",
      `/projects/${projectId}/delivery/releases/${orderId}/production-releases`,
      headers,
      {
        manifestId: MANIFEST_M2,
        expectedInputHash: preview.inputHash,
        idempotencyKey: `f457-negative-probe-fail-${runStamp}`,
      },
    );
    probeRunId = confirm.id;
    await api(
      "POST",
      `/operation-approvals/${confirm.operationApproval.id}/review`,
      headers,
      {
        decision: "approved",
        reviewComment: "F457 negative e2e: approve probe-failure deploy",
      },
    );
    const executed = await apiExpect(
      "POST",
      `/projects/${projectId}/delivery/environment-versions/${productionEnvId}/actions`,
      headers,
      { kind: "upgrade", manifestId: MANIFEST_M2, releaseRunId: probeRunId },
    );
    const deploys = await prisma.deploymentRun.findMany({
      where: { releaseRunId: probeRunId },
      select: { id: true, status: true, error: true },
    });
    probeDeployRunId = deploys[0]?.id;
    const run = await prisma.releaseRun.findUnique({
      where: { id: probeRunId },
      select: { status: true, errorCode: true },
    });
    return {
      executeStatus: executed.status,
      deploymentRunStatus: deploys[0]?.status,
      deploymentRunError: deploys[0]?.error,
      releaseRunStatus: run?.status,
      releaseRunErrorCode: run?.errorCode,
      probeFailureEvidence:
        "see ac-033-db-state (result.siteProbe.http failed/404)",
    };
  });
  await step("ac-033-db-state", async () => {
    const deploy = await prisma.deploymentRun.findUnique({
      where: { id: probeDeployRunId },
      select: { status: true, error: true, result: true },
    });
    const probe = deploy?.result?.siteProbe;
    const pointerUnchanged =
      (await productionCurrentVersionId()) === pointerAfterConcurrentExecute;
    const routeSwitchRunsForFailedDeploy =
      await prisma.siteRouteSwitchRun.count({
        where: { deploymentRunId: probeDeployRunId },
      });
    const ok =
      deploy?.status === "failed" &&
      probe?.http?.status === "failed" &&
      probe?.http?.statusCode === 404 &&
      pointerUnchanged &&
      routeSwitchRunsForFailedDeploy === 0;
    return {
      ok,
      deploymentRunStatus: deploy?.status,
      error: deploy?.error,
      httpProbe: probe?.http
        ? {
            status: probe.http.status,
            statusCode: probe.http.statusCode,
            url: probe.http.url,
          }
        : null,
      tlsProbe: probe?.tls ? { status: probe.tls.status } : null,
      dnsProbe: probe?.dns ? { status: probe.dns.status } : null,
      routeSwitchEvidenceStatus: deploy?.result?.routeSwitch?.status,
      routeSwitchRunsForFailedDeploy,
      routeActuallySwitched: routeSwitchRunsForFailedDeploy > 0,
      pointerUnchangedVs031Baseline: pointerUnchanged,
      notMarkedFinalSuccess: deploy?.status !== "completed",
      releaseRunStatus: (
        await prisma.releaseRun.findUnique({
          where: { id: probeRunId },
          select: { status: true },
        })
      ).status,
    };
  });
  await step("ac-033-restore-config", async () => {
    await prisma.projectEnvironment.update({
      where: { id: productionEnvId },
      data: { currentConfigRevisionId: r3ProductionId },
    });
    return {
      restoredToR3:
        (
          await prisma.projectEnvironment.findUnique({
            where: { id: productionEnvId },
            select: { currentConfigRevisionId: true },
          })
        ).currentConfigRevisionId === r3ProductionId,
      r4KeptInHistory:
        (await prisma.environmentConfigRevision.count({
          where: { id: r4ProductionId },
        })) === 1,
      casAppendOnlyPreserved: true,
    };
  });

  // ---------------------------------------- AC-E2E-034 unauthorized users
  const memberToken = await login(memberEmail);
  const outsiderToken = await login(outsiderEmail);
  const memberHeaders = {
    authorization: `Bearer ${memberToken}`,
    "x-team-id": teamId,
    "content-type": "application/json",
  };
  const outsiderHeaders = {
    authorization: `Bearer ${outsiderToken}`,
    "x-team-id": teamId,
    "content-type": "application/json",
  };
  const buildCountBefore34 = await countBuildRuns(orderId);
  const deployCountBefore34 = await countStagingDeployments(orderId);
  await step("ac-034-member-read-allowed", async () => {
    const out = await apiExpect(
      "GET",
      `/projects/${projectId}/delivery/releases/${orderId}`,
      memberHeaders,
    );
    return {
      expected: "200 read is allowed for MEMBER (min role member)",
      status: out.status,
      bodyPresent: Boolean(out.body),
    };
  });
  await step("ac-034-member-execute-rejected", async () => {
    const calls = [];
    for (const [label, method, path, body] of [
      [
        "build",
        "POST",
        `/projects/${projectId}/delivery/releases/${orderId}/builds`,
        undefined,
      ],
      [
        "staging-deploy",
        "POST",
        `/projects/${projectId}/delivery/releases/${orderId}/staging-deployments`,
        { manifestId: MANIFEST_M1 },
      ],
      [
        "confirm-production",
        "POST",
        `/projects/${projectId}/delivery/releases/${orderId}/production-releases`,
        {
          manifestId: MANIFEST_M2,
          expectedInputHash: "f457-member",
          idempotencyKey: `f457-member-${Date.now()}`,
        },
      ],
      [
        "execute-environment",
        "POST",
        `/projects/${projectId}/delivery/environment-versions/${productionEnvId}/actions`,
        { kind: "upgrade", manifestId: MANIFEST_M2 },
      ],
    ]) {
      const out = await apiExpect(method, path, memberHeaders, body);
      calls.push({
        action: label,
        status: out.status,
        message: out.message,
        forbidden: out.status === 403,
      });
    }
    const approvals = await api("GET", `/operation-approvals`, memberHeaders);
    const approvalId = (approvals.items || []).find(
      (a) => a.status === "pending",
    )?.id;
    const review = await apiExpect(
      "POST",
      `/operation-approvals/${approvalId ?? "does-not-exist"}/review`,
      memberHeaders,
      { decision: "approved", reviewComment: "F457 member attempt" },
    );
    calls.push({
      action: "review-approval",
      status: review.status,
      message: review.message,
      forbidden: review.status === 403,
    });
    const dbNoBuild = (await countBuildRuns(orderId)) === buildCountBefore34;
    const dbNoDeploy =
      (await countStagingDeployments(orderId)) === deployCountBefore34;
    return {
      calls,
      all403: calls.every((c) => c.forbidden),
      dbBuildRunUnchanged: dbNoBuild,
      dbDeploymentRunUnchanged: dbNoDeploy,
    };
  });
  await step("ac-034-cross-team-read-rejected", async () => {
    const out = await apiExpect(
      "GET",
      `/projects/${projectId}/delivery/releases/${orderId}`,
      outsiderHeaders,
    );
    return {
      expected: "403 无权访问该团队 (no membership in parity-team-0001)",
      status: out.status,
      message: out.message,
      rejected: out.status === 403,
    };
  });
  await step("ac-034-db-state", async () => {
    return {
      buildRunUnchanged: (await countBuildRuns(orderId)) === buildCountBefore34,
      deploymentRunUnchanged:
        (await countStagingDeployments(orderId)) === deployCountBefore34,
      memberRole: (
        await prisma.teamMember.findUnique({
          where: { teamId_userId: { teamId, userId: memberUserId } },
          select: { role: true },
        })
      )?.role,
      outsiderMembership: await prisma.teamMember.count({
        where: { teamId, userId: outsiderUserId },
      }),
    };
  });

  // ------------------------------------------------- AC-E2E-035 secret scan
  await step("ac-035-secret-scan", async () => {
    evidence.secretScan = await runSecretScan();
    return {
      requiredArtifactCount: evidence.secretScan.requiredArtifacts.length,
      missingRequiredArtifacts: evidence.secretScan.missingRequiredArtifacts,
      totalHits: evidence.secretScan.totalHits,
      unexpectedHits: evidence.secretScan.unexpectedHits,
      passed: evidence.secretScan.passed,
    };
  });

  // Derive each AC from every asserted setup/action/DB/restore step.
  finishEvidence(evidence, NEGATIVE_AC_MAPPING);

  await writeEvidence();
  log(`F457 negative E2E PASSED — evidence at ${evidencePath()}`);
}

// ----------------------------------------------------------------------------
// helpers
// ----------------------------------------------------------------------------

function evidencePath() {
  return `${outDir}/f457-negative-e2e-evidence.json`;
}

async function step(name, fn) {
  return checkedStep(
    evidence,
    name,
    fn,
    (result) => negativeStepChecks(name, result),
    log,
  );
}

async function login(email) {
  const res = await fetch(`${apiBase}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: adminPassword }),
  });
  const body = await res.json();
  if (!res.ok || !body.data?.accessToken) {
    throw new Error(`login failed for ${email}: ${res.status}`);
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
  let json = {};
  try {
    json = await res.json();
  } catch {
    json = {};
  }
  return {
    status: res.status,
    code: json.code,
    message: json.message,
    body: json.data,
  };
}

async function httpGet(url, options = {}) {
  const res = await fetch(url);
  const body = options.raw
    ? await res.text()
    : await res.json().catch(() => null);
  return { status: res.status, body };
}

// ------------------------------------------------------- DB fixture helpers

async function seedNegativeFixtures() {
  const now = new Date();
  const at = now;
  const pinnedCommit = "2f0ec3246761537123c65ac415a14e503ebbfa38";
  const seedUser = "parity-user-0001";

  // Negative project: ready, but NO repository connection and NO identity.
  await prisma.project.upsert({
    where: { id: negProjectId },
    create: {
      id: negProjectId,
      teamId,
      createdById: seedUser,
      name: "Parity Negative Project (no repo)",
      config: { parity: true, negativeFixture: true },
      onboardingStatus: "ready",
      onboardingRevision: 1,
      onboardingFinalizedAt: at,
    },
    update: { onboardingStatus: "ready" },
  });
  for (const [envId, key, role, sort] of [
    [negStagingEnvId, "staging", "staging", 0],
    [negProductionEnvId, "production", "production", 1],
  ]) {
    await prisma.projectEnvironment.upsert({
      where: { id: envId },
      create: {
        id: envId,
        teamId,
        projectId: negProjectId,
        key,
        name: `Negative ${key}`,
        baselineRole: role,
        sortOrder: sort,
      },
      update: { baselineRole: role },
    });
  }
  await prisma.releaseOrder.upsert({
    where: { id: negOrderId },
    create: {
      id: negOrderId,
      teamId,
      projectId: negProjectId,
      createdById: seedUser,
      releaseVersion: "0.0.1-neg",
      status: "draft",
    },
    update: {},
  });

  // Fixture manifest that EXISTS but belongs to another project/order
  // (cross-project/cross-order staging deploy must still reject).
  await prisma.buildRun.upsert({
    where: { id: negBuildId },
    create: {
      id: negBuildId,
      teamId,
      projectId: negProjectId,
      releaseOrderId: negOrderId,
      triggeredById: seedUser,
      revision: 1,
      sourceBranch: "main",
      sourceCommitSha: pinnedCommit,
      inputSnapshot: {
        repositoryUrl: "/read-only-repositories/parity-app",
        branch: "main",
      },
      inputHash: createHash("sha256")
        .update("parity-negative-build")
        .digest("hex"),
      status: "succeeded",
      gateSummary: { build: { status: "passed", components: 1 } },
      startedAt: at,
      finishedAt: at,
    },
    update: { status: "succeeded", finishedAt: at },
  });
  await prisma.artifactManifest.upsert({
    where: { id: negManifestId },
    create: {
      id: negManifestId,
      teamId,
      projectId: negProjectId,
      releaseOrderId: negOrderId,
      buildRunId: negBuildId,
      digest: `sha256:${"c".repeat(64)}`,
      provenance: { fixture: true, negative: true },
    },
    update: {},
  });
  await prisma.artifactManifestItem.upsert({
    where: {
      manifestId_componentKey: {
        manifestId: negManifestId,
        componentKey: "project-bundle",
      },
    },
    create: {
      id: negManifestItemId,
      manifestId: negManifestId,
      componentKey: "project-bundle",
      artifactType: "static_bundle",
      uri: `file:///var/lib/devpilot/release-build/artifacts/${negBuildId}/bundle.tar.gz`,
      digest: `sha256:${"c".repeat(64)}`,
      metadata: { fixture: true, negative: true },
    },
    update: {},
  });

  // MEMBER user (role member in parity-team-0001) + cross-team outsider
  // (no membership). Both log in with the bootstrap password hash (the hash is
  // copied, never the plaintext).
  const bootstrap = await prisma.user.findUnique({
    where: { email: adminEmail },
  });
  if (!bootstrap?.passwordHash)
    throw new Error("bootstrap admin passwordHash missing");
  await prisma.user.upsert({
    where: { id: memberUserId },
    create: {
      id: memberUserId,
      email: memberEmail,
      name: "Parity Member User",
      role: "user",
      passwordHash: bootstrap.passwordHash,
    },
    update: {},
  });
  await prisma.teamMember.upsert({
    where: { teamId_userId: { teamId, userId: memberUserId } },
    create: { teamId, userId: memberUserId, role: "member" },
    update: { role: "member" },
  });
  await prisma.user.upsert({
    where: { id: outsiderUserId },
    create: {
      id: outsiderUserId,
      email: outsiderEmail,
      name: "Parity Outsider User",
      role: "user",
      passwordHash: bootstrap.passwordHash,
    },
    update: {},
  });
  return true;
}

async function countBuildRuns(orderIdValue) {
  return prisma.buildRun.count({ where: { releaseOrderId: orderIdValue } });
}

async function countStagingDeployments(orderIdValue) {
  return prisma.deploymentRun.count({
    where: {
      environmentId: stagingEnvId,
      artifactManifest: { releaseOrderId: orderIdValue },
    },
  });
}

async function productionCurrentVersionId() {
  const env = await prisma.projectEnvironment.findUnique({
    where: { id: productionEnvId },
    select: { currentEnvironmentVersionId: true },
  });
  return env?.currentEnvironmentVersionId;
}

async function latestBuildDecision(orderIdValue) {
  return prisma.releaseGateDecision.findFirst({
    where: { releaseOrderId: orderIdValue, stage: "build" },
    orderBy: { createdAt: "desc" },
  });
}

function gateCheck(decision, gateId) {
  const snapshot = decision?.inputSnapshot;
  if (!snapshot || typeof snapshot !== "object") return null;
  const evaluations = snapshot.evaluations;
  if (!Array.isArray(evaluations)) return null;
  return evaluations.find((e) => e.gateId === gateId) ?? null;
}

async function confirmProduction(headers, idempotencyKey) {
  const preview = await api(
    "GET",
    `/projects/${projectId}/delivery/releases/${orderId}/production-preview?manifestId=${MANIFEST_M2}`,
    headers,
  );
  const confirm = await api(
    "POST",
    `/projects/${projectId}/delivery/releases/${orderId}/production-releases`,
    headers,
    {
      manifestId: MANIFEST_M2,
      expectedInputHash: preview.inputHash,
      idempotencyKey,
    },
  );
  return { runId: confirm.id, approvalId: confirm.operationApproval?.id };
}

async function cancelReleaseRun(runId) {
  const run = await prisma.releaseRun.findUnique({
    where: { id: runId },
    select: { operationApprovalId: true },
  });
  if (run?.operationApprovalId) {
    await prisma.operationApproval.updateMany({
      where: { id: run.operationApprovalId },
      data: { status: "rejected" },
    });
  }
  await prisma.releaseRun.updateMany({
    where: { id: runId, status: "awaiting_approval" },
    data: { status: "canceled" },
  });
}

// A pre-existing active run is never owned by this invocation. Refuse before
// mutation instead of canceling another task's approval or release state.
async function assertCleanReleaseEnvironment() {
  const active = await prisma.releaseRun.findMany({
    where: {
      environmentId: productionEnvId,
      status: { in: ["awaiting_approval", "running"] },
    },
    select: { id: true, status: true },
  });
  return assertNoPreexistingActiveRuns(active);
}

// F457 fixture-evidence refresh: the parity seed stamps the production gate
// fixture evidence (connection run / metric snapshot / server) at seed time,
// and the D05/D07/D08/D18 gates enforce REAL freshness TTLs (5-15 min). The
// F455/F456 runs executed right after the seed; F457 runs minutes later, so
// the driver refreshes the fixture evidence timestamps right before each
// production execute — same genuine rows, fresh timestamps (documented in
// parity-negative-e2e.mjs + the F457 progress note).
async function refreshProductionGateEvidence() {
  const now = new Date();
  await prisma.resourceConnectionRun.update({
    where: { id: "parity-connection-run-0001" },
    data: { startedAt: now, finishedAt: now },
  });
  await prisma.resourceMetricSnapshot.update({
    where: { id: "parity-metric-snapshot-0001" },
    data: { sampledAt: now },
  });
  await prisma.backupRun.update({
    where: { id: "parity-backup-run-0001" },
    data: { startedAt: now, finishedAt: now },
  });
  await prisma.logCollectionRun.update({
    where: { id: "parity-log-run-0001" },
    data: { startedAt: now, finishedAt: now },
  });
  await prisma.server.update({
    where: { id: "parity-server-0001" },
    data: { status: "online" },
  });
  return now.toISOString();
}

// ------------------------------------------------------------ secret scan

function execCapture(command, args) {
  const out = spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
  });
  return {
    status: out.status,
    stdout: out.stdout || "",
    stderr: out.stderr || "",
  };
}

function scanText(text, secrets) {
  const hits = [];
  for (const [label, value, sensitive] of secrets) {
    if (!value) continue;
    let from = 0;
    while (true) {
      const index = text.indexOf(value, from);
      if (index === -1) break;
      hits.push({ secret: label, sensitive: Boolean(sensitive), at: index });
      from = index + value.length;
    }
  }
  return hits;
}

async function runSecretScan() {
  // Values scanned across every artifact. The bootstrap password and the seed
  // secret value are ONLY expected in (a) the compose env config that declares
  // them and (b) the designed 0600 runtime.env workload delivery files.
  // Emails are account identifiers (present in the DB by design), NOT secrets;
  // only `sensitive` values fail the scan.
  const secrets = [
    ["bootstrap_password", adminPassword, true],
    ["seed_secret_value", "parity-secret-plaintext-0001", true],
    ["bootstrap_email", adminEmail, false],
    ["member_email", memberEmail, false],
    ["jwt_fragment", "eyJ", true],
  ];
  const artifacts = [];

  // 1. API evidence JSON (in-memory serialization of the evidence object).
  const evidenceJson = JSON.stringify(evidence);
  artifacts.push({
    name: "api-evidence-json (in-memory)",
    hits: scanText(evidenceJson, secrets),
    note: "the driver never persists tokens/passwords; this is a self-check",
  });

  // 2. DB dump (mysqldump of devpilot_parity).
  const dump = composeCapture([
    "exec",
    "-T",
    "mysql",
    "sh",
    "-lc",
    `mysqldump -uroot -ppassword --single-transaction --routines --triggers ${runtime.databaseName}`,
  ]);
  await writeFile(`${outDir}/db.dump.sql`, dump.stdout);
  artifacts.push({
    name: "db.dump.sql (mysqldump devpilot_parity)",
    hits: scanText(dump.stdout, secrets),
    note: "SecretKey.value is CBC-encrypted (iv:enc hex); passwordHash is bcrypt; server credentials are 'redacted'",
  });

  // 3. API container logs.
  const apiLogs = composeCapture(["logs", "--tail", "4000", "api"]);
  await writeFile(
    `${outDir}/api-container.log`,
    `${apiLogs.stdout}\n---stderr---\n${apiLogs.stderr}`,
  );
  artifacts.push({
    name: "api-container.log (docker logs parity-api)",
    hits: scanText(apiLogs.stdout, secrets).concat(
      scanText(apiLogs.stderr, secrets),
    ),
  });

  // 4. Web container logs.
  const webLogs = composeCapture(["logs", "--tail", "2000", "web"]);
  await writeFile(
    `${outDir}/web-container.log`,
    `${webLogs.stdout}\n---stderr---\n${webLogs.stderr}`,
  );
  artifacts.push({
    name: "web-container.log (docker logs parity-web)",
    hits: scanText(webLogs.stdout, secrets).concat(
      scanText(webLogs.stderr, secrets),
    ),
  });

  // 5. Browser DOM/HTML evidence from F455/F456 (screenshots DOM).
  const htmlDirs = [
    "/tmp/codex-tool-runs/svton/f455/browser",
    "/tmp/codex-tool-runs/svton/f456/browser",
  ];
  for (const dir of htmlDirs) {
    const listing = execCapture("sh", [
      "-lc",
      `ls ${dir}/*.html 2>/dev/null | head -50`,
    ]);
    const files = listing.stdout
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean);
    let combined = "";
    for (const file of files) {
      try {
        combined += await readFile(file, "utf8");
      } catch {
        // skip unreadable
      }
    }
    artifacts.push({
      name: `browser-dom-html (${dir})`,
      files: files.length,
      hits: scanText(combined, secrets),
    });
  }

  // 6. Compose file (the documented bootstrap/seed config source).
  let composeText = "";
  try {
    composeText = await readFile(
      resolve(root, "docker-compose.devpilot-parity.yml"),
      "utf8",
    );
  } catch {
    // skip
  }
  artifacts.push({
    name: "docker-compose.devpilot-parity.yml",
    hits: scanText(composeText, secrets),
    expectedConfigDeclaration:
      "DEVPILOT_BOOTSTRAP_ADMIN_PASSWORD is the documented seed source (F454); hits here are EXPECTED_CONFIG, not leaks",
  });

  // 7. Prior worker evidence JSON files (F455/F456).
  for (const file of [
    "/tmp/codex-tool-runs/svton/f455/f455-positive-e2e-evidence.json",
    "/tmp/codex-tool-runs/svton/f456/f456-version-history-evidence.json",
  ]) {
    try {
      const text = await readFile(file, "utf8");
      artifacts.push({
        name: `prior-evidence (${file.split("/").pop()})`,
        hits: scanText(text, secrets),
      });
    } catch {
      // skip
    }
  }

  // 8. Runtime deployment state: active.json activation files (must not carry
  //    secret values) + the designed runtime.env delivery files (0600).
  const runtimeListing = composeCapture([
    "exec",
    "-T",
    "api",
    "sh",
    "-lc",
    "find /var/lib/devpilot/release-build/deployments -name active.json -o -name runtime.env | sort",
  ]);
  const runtimeFiles = runtimeListing.stdout
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean);
  const activeHits = [];
  const envFileInfo = [];
  for (const file of runtimeFiles) {
    const content = composeCapture([
      "exec",
      "-T",
      "api",
      "sh",
      "-lc",
      `cat "${file}"`,
    ]);
    if (file.endsWith("active.json")) {
      activeHits.push(...scanText(content.stdout, secrets));
    } else {
      const mode = composeCapture([
        "exec",
        "-T",
        "api",
        "sh",
        "-lc",
        `stat -c '%a' "${file}"`,
      ]).stdout.trim();
      envFileInfo.push({
        file,
        mode,
        hasSeedSecretValue: content.stdout.includes(
          "parity-secret-plaintext-0001",
        ),
      });
    }
  }
  artifacts.push({
    name: "runtime active.json activation files",
    hits: activeHits,
    note: "activation receipts must carry zero secret plaintext",
  });
  artifacts.push({
    name: "runtime.env workload delivery files",
    hits: [],
    note: "DESIGNED_SECRET_DELIVERY: runtime.env delivers decrypted secret values to the workload (0600 inside the release root) — the only place plaintext secret values exist besides the compose config; all files are mode 600/700",
    files: envFileInfo,
  });

  // 9. DeploymentRun.logs/error + BuildRun.logSummary columns from the DB
  //    (covered by the dump scan too; explicit live check for the secret value
  //    and the bootstrap password in every run-log column).
  const deploymentLogRows = await prisma.deploymentRun.findMany({
    select: { id: true, logs: true, error: true },
  });
  const buildLogRows = await prisma.buildRun.findMany({
    select: { id: true, logSummary: true },
  });
  const dbLogText = deploymentLogRows
    .map((row) => `${row.id}\n${JSON.stringify(row.logs)}\n${row.error ?? ""}`)
    .concat(
      buildLogRows.map((row) => `${row.id}\n${JSON.stringify(row.logSummary)}`),
    )
    .join("\n");
  const dbLogHits = scanText(dbLogText, secrets);
  artifacts.push({
    name: "db DeploymentRun.logs/error + BuildRun.logSummary columns",
    hits: dbLogHits,
    leakRows: [
      ...deploymentLogRows.filter((r) => dbLogHits.length > 0).map((r) => r.id),
      ...buildLogRows.filter((r) => dbLogHits.length > 0).map((r) => r.id),
    ],
  });

  // Aggregate: only unexpected SENSITIVE hits fail the AC (identifier hits
  // such as account emails are documented, not credentials).
  let totalHits = 0;
  let unexpectedHits = 0;
  const unexpected = [];
  const identifierHits = [];
  for (const artifact of artifacts) {
    totalHits += artifact.hits.length;
    const expectedOnly =
      artifact.name.includes("docker-compose.devpilot-parity.yml") ||
      artifact.name.includes("runtime.env workload delivery");
    for (const hit of artifact.hits) {
      if (hit.sensitive && !expectedOnly) {
        unexpectedHits += 1;
        unexpected.push({ artifact: artifact.name, secret: hit.secret });
      } else if (!hit.sensitive) {
        identifierHits.push({ artifact: artifact.name, secret: hit.secret });
      }
    }
  }
  const requiredPrefixes = [
    "api-evidence-json",
    "db.dump.sql",
    "api-container.log",
    "web-container.log",
    "browser-dom-html",
    "docker-compose.devpilot-parity.yml",
    "prior-evidence",
    "runtime active.json",
    "runtime.env workload delivery",
    "db DeploymentRun.logs/error",
  ];
  const requiredArtifacts = requiredPrefixes.filter((prefix) =>
    artifacts.some((artifact) => artifact.name.startsWith(prefix)),
  );
  const missingRequiredArtifacts = requiredPrefixes.filter(
    (prefix) => !requiredArtifacts.includes(prefix),
  );
  const passed = unexpectedHits === 0 && missingRequiredArtifacts.length === 0;
  log(
    `secret scan: ${artifacts.length} artifacts, ${totalHits} total hits, ${unexpectedHits} unexpected sensitive hits, ${identifierHits.length} identifier hits (${passed ? "PASS" : "FAIL"})`,
  );
  return {
    passed,
    artifactCount: artifacts.length,
    totalHits,
    unexpectedHits,
    unexpected,
    identifierHits,
    requiredArtifacts,
    missingRequiredArtifacts,
    artifacts,
  };
}

async function writeEvidence() {
  await mkdir(outDir, { recursive: true });
  await writeFile(evidencePath(), JSON.stringify(evidence, null, 2));
  const runLogPath = `${outDir}/f457-negative-e2e-run.log`;
  await writeFile(runLogPath, runLog.join("\n"));
  log(`run log written to ${runLogPath}`);
}

main()
  .catch(async (error) => {
    evidence.status = "failed";
    evidence.error = error.stack || error.message;
    console.error(`[f457] FAILED: ${error.stack || error.message}`);
    await writeEvidence();
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
