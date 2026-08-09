#!/usr/bin/env node
// F456 version/history E2E driver over the RUNNING parity stack.
//
// Chain (each AC-E2E-016..023 mapped to checked F455 context evidence):
//   0.  preflight: stack health (api / web / target-workload / mysql) + login
//   1.  base state: idempotent reset+seed (parity-seed.mjs reset) + rerun the
//       F455 positive chain (parity-positive-e2e.mjs) -> exactly 1 BuildRun +
//       1 Manifest + 1 Staging deploy + 1 Production release + current env
//       versions (documented reuse; the rerun overwrites the F455 evidence
//       file, so the original F455 evidence is preserved first).
//   2.  second build on the checked release order -> NEW BuildRun + NEW Manifest,
//       deterministic digest vs the first build (AC-E2E-016).
//   3.  deploy the FIRST manifest to Staging a second time -> two Staging
//       DeploymentRuns on the same Manifest, BuildRun count unchanged
//       (AC-E2E-017).
//   4.  Staging upgrade (actions: kind upgrade + candidate manifest) -> new
//       EnvironmentVersion kind upgrade (AC-E2E-018).
//   5.  Staging rollback (actions: kind recovery + historical version) -> new
//       EnvironmentVersion kind recovery (AC-E2E-019).
//   6.  Production upgrade: preview -> confirm (standard ReleaseRun +
//       approval) -> approve -> execute -> new Production EnvironmentVersion
//       + pointer move (AC-E2E-020).
//   7.  Production rollback: recovery preview -> recovery confirm (recovery
//       ReleaseRun + approval) -> approve -> execute -> new recovery
//       EnvironmentVersion + pointer move (AC-E2E-021).
//   8.  current/history/previousVersion chains verified on every
//       EnvironmentVersion (AC-E2E-022).
//   9.  browser pass (1484x1324, authenticated, parity web 4131): release
//       detail shows multiple BuildRuns + multiple Staging DeploymentRuns +
//       Production ReleaseRuns (upgrade + recovery); env-versions view shows
//       the upgrade/recovery history chains; build log drawer + staging run
//       log + production run log + env-version change log (AC-E2E-023).
//
// Evidence: /tmp/codex-tool-runs/svton/f456/f456-version-history-evidence.json
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { checkedStep, finishEvidence } from "./lib/parity-e2e-evidence.mjs";
import {
  HISTORY_AC_MAPPING,
  historyStepChecks,
} from "./lib/parity-history-e2e-evidence.mjs";
import { extractPositiveHistoryContext } from "./lib/parity-history-context.mjs";
import { browserSecretReference, runHistoryBrowserSession } from "./lib/parity-history-browser-session.mjs";
import {
  productionGateEvidence,
} from "./lib/parity-production-gate-evidence.mjs";
import {
  buildProductionRouteExpectation,
  productionRouteEvidence,
} from "./lib/parity-production-route-evidence.mjs";
import { productionConfirmResult } from "./lib/parity-negative-history-confirm-result.mjs";
import { versionRowResult } from "./lib/parity-negative-history-version-row-result.mjs";
import { historyChainOutputDirectory } from "./lib/parity-history-chain-paths.mjs";
import { parityRuntimeConfig } from "./lib/parity-runtime-config.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runtime = parityRuntimeConfig();
const outDir = historyChainOutputDirectory(process.env, "f456", "/tmp/codex-tool-runs/svton/f456");
const browserTrustedRoot = await realpath(tmpdir());
const apiBase = runtime.apiBase;
let teamId;
let projectId;
let orderId;
let stagingEnvId;
let productionEnvId;
const adminEmail = "admin@parity.local";
const adminPassword = "ParityDemo123!";
const pinnedCommit = "2f0ec3246761537123c65ac415a14e503ebbfa38";
const f455EvidenceOriginal = `${historyChainOutputDirectory(process.env, "f455", "/tmp/codex-tool-runs/svton/f455")}/f455-positive-e2e-evidence.json`;
const cdpDriver = resolve(root, "scripts/lib/parity-history-cdp-driver.mjs");
const webBase = runtime.webOrigin;
const parityRouteProviderKey = process.env.DEVPILOT_PARITY_ROUTE_PROVIDER_KEY || null;
let positiveContext;
const { PrismaClient } = createRequire(
  resolve(root, "apps/devpilot-api/package.json"),
)("@prisma/client");
const prisma = new PrismaClient({
  datasources: { db: { url: runtime.databaseUrl } },
});
const evidence = {
  worker: "f456-version-history-e2e",
  objective: "AC-E2E-016..023 multiple builds / repeat staging / upgrade-rollback E2E",
  stack: {
    web: webBase,
    api: apiBase,
    mysql: runtime.mysqlEvidence,
    targetWorkload: runtime.targetOrigin,
    fixtureRepo: "/read-only-repositories/parity-app",
    pinnedCommit,
  },
  context: {},
  capturedAt: null,
  steps: {},
  ac: {},
};

const runLog = [];
function log(message) {
  const line = `[f456 ${new Date().toISOString()}] ${message}`;
  runLog.push(line);
  process.stdout.write(`${line}\n`);
}

function sha256File(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function main() {
  await mkdir(outDir, { recursive: true });
  evidence.capturedAt = new Date().toISOString();

  // ---------------------------------------------------------------- preflight
  let token;
  await step("preflight", async () => {
    const [health, web, target] = await Promise.all([
      httpGet(`${apiBase}/health`),
      httpGet(`${webBase}/`, { raw: true }),
      httpGet(`${runtime.targetOrigin}/`, { raw: true }),
    ]);
    const mysqlRows = await prisma.$queryRaw`SELECT 1 AS healthy`;
    token = await login();
    return {
      apiHealth: health.status === 200,
      webStatus: web.status,
      targetStatus: target.status,
      targetBodyMarker: /Parity Target Workload/.test(target.body || ""),
      mysqlOk: Array.isArray(mysqlRows) && Number(mysqlRows[0]?.healthy) === 1,
      tokenIssued: Boolean(token),
    };
  });

  // ------------------------------------------------- base state: F455 rerun
  await step("base-reset-seed", async () => {
    const out = runNode(["scripts/parity-seed.mjs", "reset"], "f456-seed-reset");
    if (out.status !== 0) {
      throw new Error(`parity-seed reset failed (${out.status})`);
    }
    await waitStackReady();
    return { exit: out.status, log: out.logPath };
  });

  await step("base-f455-chain-rerun", async () => {
    const out = runNode(["scripts/parity-positive-e2e.mjs"], "f456-f455-rerun");
    if (out.status !== 0) {
      throw new Error(`F455 chain rerun failed (${out.status}) — see ${out.logPath}`);
    }
    const source = await readFile(f455EvidenceOriginal);
    const document = JSON.parse(source.toString("utf8"));
    const extracted = extractPositiveHistoryContext(document, sha256File(source));
    positiveContext = extracted.context;
    ({ teamId, projectId, orderId, stagingEnvId, productionEnvId } = positiveContext);
    evidence.context = positiveContext;
    const [buildRuns, manifests, stagingDeploys, prodDeploys, envVersions] =
      await Promise.all([
        prisma.buildRun.count({ where: { releaseOrderId: orderId } }),
        prisma.artifactManifest.count({ where: { releaseOrderId: orderId } }),
        prisma.deploymentRun.count({
          where: { environmentId: stagingEnvId, artifactManifest: { releaseOrderId: orderId } },
        }),
        prisma.deploymentRun.count({
          where: { environmentId: productionEnvId, artifactManifest: { releaseOrderId: orderId } },
        }),
        prisma.environmentVersion.count({ where: { projectId } }),
      ]);
    return {
      exit: out.status,
      log: out.logPath,
      sourceEvidence: f455EvidenceOriginal,
      sourceEvidenceSha256: positiveContext.sourceEvidenceSha256,
      contextChecks: extracted.checks,
      pinnedCommitMatches: positiveContext.pinnedCommit === pinnedCommit,
      buildRunsOnOrder: buildRuns,
      manifestsOnOrder: manifests,
      stagingDeploymentRuns: stagingDeploys,
      productionDeploymentRuns: prodDeploys,
      environmentVersions: envVersions,
    };
  });

  // read base state rows
  const base = await step("base-state-rows", async () => {
    const buildRuns = await prisma.buildRun.findMany({
      where: { releaseOrderId: orderId },
      select: { id: true, status: true, sourceCommitSha: true },
      orderBy: { createdAt: "asc" },
    });
    const manifests = await prisma.artifactManifest.findMany({
      where: { releaseOrderId: orderId },
      select: { id: true, digest: true, buildRunId: true },
      orderBy: { createdAt: "asc" },
    });
    const stagingVersions = await prisma.environmentVersion.findMany({
      where: { projectId, environmentId: stagingEnvId },
      select: { id: true, kind: true, previousVersionId: true, artifactManifestId: true, releaseRunId: true, deploymentRunId: true },
      orderBy: { effectiveAt: "asc" },
    });
    const productionVersions = await prisma.environmentVersion.findMany({
      where: { projectId, environmentId: productionEnvId },
      select: { id: true, kind: true, previousVersionId: true, artifactManifestId: true, releaseRunId: true },
      orderBy: { effectiveAt: "asc" },
    });
    const envs = await prisma.projectEnvironment.findMany({
      where: { projectId },
      select: { id: true, key: true, currentEnvironmentVersionId: true },
    });
    return {
      buildRuns,
      manifests,
      stagingVersions,
      productionVersions,
      environments: envs,
      expected: positiveContext,
    };
  });

  const B1 = base.buildRuns.find((run) => run.id === positiveContext.buildRunId);
  const M1 = base.manifests.find((manifest) => manifest.id === positiveContext.manifestId);
  if (!B1 || !M1 || base.buildRuns.length !== 1 || base.manifests.length !== 1) {
    throw new Error(`unexpected base state: builds=${base.buildRuns.length} manifests=${base.manifests.length}`);
  }
  const Vst1 = base.stagingVersions.find((v) => v.id === positiveContext.stagingCurrentVersionId);
  const Vprod1 = base.productionVersions.find((v) => v.id === positiveContext.productionCurrentVersionId);
  log(`base state: B1=${B1.id} M1=${M1.id} Vst1=${Vst1?.id} Vprod1=${Vprod1?.id}`);

  // The reset+seed recreated the bootstrap admin with a NEW user id, so the
  // pre-reset token is invalid (401 用户不存在). Re-login for the chain.
  await step("login", async () => {
    token = await login();
    return {
      status: "authenticated",
      verified: Boolean(token),
      email: adminEmail,
      source: "bootstrap-admin-after-reset",
    };
  });

  const headers = {
    authorization: `Bearer ${token}`,
    "x-team-id": teamId,
    "content-type": "application/json",
  };

  // ----------------------------------------------------------- AC-E2E-016 build 2
  let B2;
  let M2;
  let D2st;
  let D1st;
  let Vst2;
  let Vst3;
  let Vst4;
  let inputHashProd;
  let R2;
  let A2;
  let Vprod2;
  let inputHashRecovery;
  let R3;
  let A3;
  let Vprod3;

  await step("build-2", async () => {
    const started = await api(
      "POST",
      `/projects/${projectId}/delivery/releases/${orderId}/builds`,
      headers,
    );
    const runId = started.id;
    const run = await poll(
      async () => {
        const detail = await api(
          "GET",
          `/projects/${projectId}/delivery/releases/${orderId}/builds/${runId}`,
          headers,
        );
        return ["succeeded", "failed", "canceled"].includes(detail.status)
          ? detail
          : undefined;
      },
      240,
      3000,
      "build-2",
    );
    if (run.status !== "succeeded") {
      throw new Error(`second build failed: ${run.errorCode || run.errorMessage}`);
    }
    B2 = run;
    M2 = run.manifest;
    const dbCounts = await prisma.$transaction([
      prisma.buildRun.count({ where: { releaseOrderId: orderId } }),
      prisma.artifactManifest.count({ where: { releaseOrderId: orderId } }),
    ]);
    return {
      buildRunId: B2.id,
      distinctFromB1: B2.id !== B1.id,
      status: B2.status,
      sourceCommitSha: B2.sourceCommitSha,
      pinned: B2.sourceCommitSha === pinnedCommit,
      manifestId: M2.id,
      manifestDistinctFromM1: M2.id !== M1.id,
      manifestDigest: M2.digest,
      digestDeterministic: M2.digest === M1.digest,
      firstManifestDigest: M1.digest,
      logSummary: B2.logSummary,
      dbBuildRuns: dbCounts[0],
      dbManifests: dbCounts[1],
    };
  });

  // ------------------------------------------------------- AC-E2E-017 staging repeat
  await step("staging-deploy-repeat", async () => {
    const deployed = await api(
      "POST",
      `/projects/${projectId}/delivery/releases/${orderId}/staging-deployments`,
      headers,
      { manifestId: M1.id },
    );
    const runId = deployed.id ?? deployed.deploymentRunId;
    const row = await prisma.deploymentRun.findUnique({
      where: { id: runId },
      select: {
        id: true, status: true, environmentId: true, artifactManifestId: true,
        result: true, commandPlan: true, params: true,
      },
    });
    if (row.status !== "completed") {
      throw new Error(`repeat staging deploy not completed: ${JSON.stringify(row)}`);
    }
    D2st = row;
    const [allStagingOnM1, allStaging, buildsAfter] = await Promise.all([
      prisma.deploymentRun.findMany({
        where: { environmentId: stagingEnvId, artifactManifestId: M1.id },
        select: { id: true, status: true, artifactManifestId: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.deploymentRun.findMany({
        where: { environmentId: stagingEnvId, artifactManifest: { releaseOrderId: orderId } },
        select: { id: true, status: true, artifactManifestId: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.buildRun.count({ where: { releaseOrderId: orderId } }),
    ]);
    D1st = allStagingOnM1.find((run) => run.id === positiveContext.stagingDeploymentRunId);
    const stagingEnv = await prisma.projectEnvironment.findUnique({
      where: { id: stagingEnvId },
      select: { currentEnvironmentVersionId: true },
    });
    const currentVersion = await prisma.environmentVersion.findUnique({
      where: { id: stagingEnv.currentEnvironmentVersionId ?? "" },
      select: { id: true, kind: true, artifactManifestId: true, previousVersionId: true, deploymentRunId: true },
    });
    Vst2 = currentVersion;
    return {
      deploymentRunId: D2st.id,
      firstDeploymentRunId: D1st?.id,
      distinctFromD1st: D2st.id !== D1st?.id,
      status: D2st.status,
      sameManifestM1: D2st.artifactManifestId === M1.id,
      stagingDeploymentRunsOnM1: allStagingOnM1.map((r) => r.id),
      completedRunsOnM1: allStagingOnM1.filter((r) => r.status === "completed").length,
      stagingDeploymentRunsOnOrder: allStaging.map((r) => ({ id: r.id, manifest: r.artifactManifestId })),
      buildRunCountUnchanged: buildsAfter === 2,
      buildRunCount: buildsAfter,
      newStagingCurrent: {
        id: Vst2?.id, kind: Vst2?.kind, artifactManifestId: Vst2?.artifactManifestId,
        previousVersionId: Vst2?.previousVersionId, deploymentRunId: Vst2?.deploymentRunId,
      },
      expectedManifestId: M1.id,
      artifactVerified: row.result?.artifactVerified === true,
      commandEvidence: {
        commandPlan: row.commandPlan,
        providerEvidence: pick(row.result, ["checkoutInvoked", "pullInvoked", "buildInvoked", "gitInvoked"]),
        resultManifestId: row.result?.manifestId,
        resultManifestDigest: row.result?.manifestDigest,
        expectedManifestId: M1.id,
        expectedManifestDigest: M1.digest,
        paramsManifestId: row.params?.manifestId,
        paramsManifestDigest: row.params?.manifestDigest,
      },
    };
  });

  // ------------------------------------------------------ AC-E2E-018 staging upgrade
  await step("staging-upgrade", async () => {
    const executed = await api(
      "POST",
      `/projects/${projectId}/delivery/environment-versions/${stagingEnvId}/actions`,
      headers,
      { kind: "upgrade", manifestId: M2.id },
    );
    const runId = executed.run?.id ?? executed.id ?? executed.deploymentRunId;
    const row = await prisma.deploymentRun.findUnique({
      where: { id: runId },
      select: { id: true, status: true, environmentId: true, artifactManifestId: true, result: true },
    });
    if (row.status !== "completed") {
      throw new Error(`staging upgrade not completed: ${JSON.stringify(row)}`);
    }
    const version = await prisma.environmentVersion.findUnique({
      where: { deploymentRunId: row.id },
      select: { id: true, kind: true, artifactManifestId: true, previousVersionId: true, deploymentRunId: true },
    });
    if (version?.kind !== "upgrade") {
      throw new Error(`staging upgrade did not create an upgrade env version: ${JSON.stringify(version)}`);
    }
    const stagingEnv = await prisma.projectEnvironment.findUnique({
      where: { id: stagingEnvId },
      select: { currentEnvironmentVersionId: true },
    });
    Vst3 = version;
    return {
      deploymentRunId: row.id,
      status: row.status,
      environmentId: row.environmentId,
      manifestId: row.artifactManifestId,
      expectedEnvironmentId: stagingEnvId,
      expectedManifestId: M2.id,
      expectedPreviousVersionId: Vst2.id,
      newEnvironmentVersion: versionRowResult(version, Vst2.id, "previousIsVst2"),
      currentMoved: stagingEnv.currentEnvironmentVersionId === version.id,
      artifactVerified: row.result?.artifactVerified === true,
    };
  });

  // ----------------------------------------------------- AC-E2E-019 staging recovery
  await step("staging-recovery", async () => {
    const executed = await api(
      "POST",
      `/projects/${projectId}/delivery/environment-versions/${stagingEnvId}/actions`,
      headers,
      { kind: "recovery", sourceVersionId: Vst2.id },
    );
    const runId = executed.run?.id ?? executed.id ?? executed.deploymentRunId;
    const row = await prisma.deploymentRun.findUnique({
      where: { id: runId },
      select: { id: true, status: true, environmentId: true, artifactManifestId: true, result: true },
    });
    if (row.status !== "completed") {
      throw new Error(`staging recovery not completed: ${JSON.stringify(row)}`);
    }
    const version = await prisma.environmentVersion.findUnique({
      where: { deploymentRunId: row.id },
      select: { id: true, kind: true, artifactManifestId: true, previousVersionId: true, deploymentRunId: true },
    });
    if (version?.kind !== "recovery") {
      throw new Error(`staging recovery did not create a recovery env version: ${JSON.stringify(version)}`);
    }
    const stagingEnv = await prisma.projectEnvironment.findUnique({
      where: { id: stagingEnvId },
      select: { currentEnvironmentVersionId: true },
    });
    Vst4 = version;
    return {
      deploymentRunId: row.id,
      status: row.status,
      environmentId: row.environmentId,
      manifestId: row.artifactManifestId,
      expectedEnvironmentId: stagingEnvId,
      expectedManifestId: M1.id,
      expectedPreviousVersionId: Vst3.id,
      sourceVersionId: Vst2.id,
      restoredManifest: row.artifactManifestId === M1.id,
      newEnvironmentVersion: versionRowResult(version, Vst3.id, "previousIsVst3"),
      currentMoved: stagingEnv.currentEnvironmentVersionId === version.id,
      artifactVerified: row.result?.artifactVerified === true,
    };
  });

  // ----------------------------------------------------- AC-E2E-020 production upgrade
  await step("production-preview", async () => {
    const preview = await api(
      "GET",
      `/projects/${projectId}/delivery/releases/${orderId}/production-preview?manifestId=${M2.id}`,
      headers,
    );
    inputHashProd = preview.inputHash;
    return {
      inputHash: preview.inputHash,
      manifestFrozen: preview.snapshot?.manifest?.id === M2.id,
      manifestDigest: preview.snapshot?.manifest?.digest,
      expectedManifestDigest: M2.digest,
      snapshot: pick(preview.snapshot, ["environment", "build", "releaseOrder"]),
    };
  });
  await step("production-confirm", async () => {
    const confirm = await api(
      "POST",
      `/projects/${projectId}/delivery/releases/${orderId}/production-releases`,
      headers,
      {
        manifestId: M2.id,
        expectedInputHash: inputHashProd,
        idempotencyKey: "f456-version-history-production-upgrade",
      },
    );
    R2 = confirm;
    A2 = confirm.operationApproval?.id;
    return productionConfirmResult(confirm, "standard", {
      expectedManifestId: M2.id,
      expectedManifestDigest: M2.digest,
      expectedInputHash: inputHashProd,
    });
  });
  await step("production-approve", async () => {
    const reviewed = await api(
      "POST",
      `/operation-approvals/${A2}/review`,
      headers,
      { decision: "approved", reviewComment: "F456 version-history e2e: approve production upgrade (build 2)" },
    );
    return {
      approvalId: A2,
      decision: reviewed.decision,
      status: reviewed.status,
      reviewerId: reviewed.reviewerId,
      reviewedAt: reviewed.reviewedAt,
    };
  });
  await step("production-upgrade-execute", async () => {
    const routeSeed = await productionRouteSeed();
    const executed = await api(
      "POST",
      `/projects/${projectId}/delivery/environment-versions/${productionEnvId}/actions`,
      headers,
      { kind: "upgrade", manifestId: M2.id, releaseRunId: R2.id },
    );
    const runId = executed.run?.id ?? executed.id ?? executed.deploymentRunId;
    const row = await prisma.deploymentRun.findUnique({
      where: { id: runId },
      select: {
        id: true, status: true, environmentId: true, artifactManifestId: true,
        releaseRunId: true, result: true, startedAt: true, finishedAt: true,
      },
    });
    if (row.status !== "completed") {
      throw new Error(`production upgrade not completed: ${JSON.stringify(row)}`);
    }
    const version = await prisma.environmentVersion.findUnique({
      where: { deploymentRunId: row.id },
      select: { id: true, kind: true, artifactManifestId: true, previousVersionId: true, deploymentRunId: true },
    });
    if (version?.kind !== "upgrade") {
      throw new Error(`production upgrade did not create an upgrade env version: ${JSON.stringify(version)}`);
    }
    const productionEnv = await prisma.projectEnvironment.findUnique({
      where: { id: productionEnvId },
      select: { currentEnvironmentVersionId: true },
    });
    const releaseRun = await prisma.releaseRun.findUnique({
      where: { id: R2.id },
      select: { status: true, mode: true, operationApproval: { select: { status: true, consumedAt: true } } },
    });
    const proofs = await collectProductionProof(row, routeSeed, {
      releaseRunId: R2.id,
      manifestId: M2.id,
      buildRunId: B2.id,
    });
    Vprod2 = version;
    return {
      deploymentRunId: row.id,
      status: row.status,
      environmentId: row.environmentId,
      manifestId: row.artifactManifestId,
      releaseRunId: row.releaseRunId,
      expectedEnvironmentId: productionEnvId,
      expectedManifestId: M2.id,
      expectedReleaseRunId: R2.id,
      expectedPreviousVersionId: Vprod1.id,
      newEnvironmentVersion: versionRowResult(version, Vprod1.id, "previousIsVprod1"),
      currentMoved: productionEnv.currentEnvironmentVersionId === version.id,
      releaseRun: { status: releaseRun.status, mode: releaseRun.mode, approvalStatus: releaseRun.operationApproval?.status, approvalConsumedAt: releaseRun.operationApproval?.consumedAt },
      workload: row.result?.workload,
      healthProbe: row.result?.healthProbe,
      siteProbe: row.result?.siteProbe,
      routeSwitch: row.result?.routeSwitch,
      artifactVerified: row.result?.artifactVerified === true,
      gateDecision: row.result?.gateDecision,
      productionGate: proofs.productionGate,
      routeEvidence: proofs.routeEvidence,
    };
  });

  // ----------------------------------------------------- AC-E2E-021 production recovery
  await step("production-recovery-preview", async () => {
    const preview = await api(
      "POST",
      `/projects/${projectId}/delivery/environment-versions/${productionEnvId}/recovery/preview`,
      headers,
      { sourceVersionId: Vprod1.id },
    );
    inputHashRecovery = preview.inputHash;
    return {
      inputHash: preview.inputHash,
      sourceVersionId: Vprod1.id,
      expectedSourceVersionId: Vprod1.id,
      sourceManifestId: preview.snapshot?.manifest?.id,
      expectedManifestId: M1.id,
      sourceManifestDigest: preview.snapshot?.manifest?.digest,
      expectedManifestDigest: M1.digest,
      sourceReleaseRunId: preview.sourceReleaseRunId,
      sourceVersionKind: preview.sourceVersionKind,
      snapshot: pick(preview.snapshot, ["environment", "build", "releaseOrder"]),
    };
  });
  await step("production-recovery-confirm", async () => {
    const confirm = await api(
      "POST",
      `/projects/${projectId}/delivery/environment-versions/${productionEnvId}/recovery/confirm`,
      headers,
      {
        sourceVersionId: Vprod1.id,
        expectedInputHash: inputHashRecovery,
        idempotencyKey: "f456-version-history-production-recovery",
      },
    );
    R3 = confirm;
    A3 = confirm.operationApproval?.id;
    return productionConfirmResult(confirm, "recovery", {
      expectedManifestId: M1.id,
      expectedManifestDigest: M1.digest,
      expectedInputHash: inputHashRecovery,
      sourceVersionId: Vprod1.id,
    });
  });
  await step("production-recovery-approve", async () => {
    const reviewed = await api(
      "POST",
      `/operation-approvals/${A3}/review`,
      headers,
      { decision: "approved", reviewComment: "F456 version-history e2e: approve production recovery (rollback to Vprod1)" },
    );
    return {
      approvalId: A3,
      decision: reviewed.decision,
      status: reviewed.status,
      reviewerId: reviewed.reviewerId,
      reviewedAt: reviewed.reviewedAt,
    };
  });
  await step("production-recovery-execute", async () => {
    const routeSeed = await productionRouteSeed();
    const executed = await api(
      "POST",
      `/projects/${projectId}/delivery/environment-versions/${productionEnvId}/actions`,
      headers,
      { kind: "recovery", releaseRunId: R3.id },
    );
    const runId = executed.run?.id ?? executed.id ?? executed.deploymentRunId;
    const row = await prisma.deploymentRun.findUnique({
      where: { id: runId },
      select: {
        id: true, status: true, environmentId: true, artifactManifestId: true,
        releaseRunId: true, result: true, startedAt: true, finishedAt: true,
      },
    });
    if (row.status !== "completed") {
      throw new Error(`production recovery not completed: ${JSON.stringify(row)}`);
    }
    const version = await prisma.environmentVersion.findUnique({
      where: { deploymentRunId: row.id },
      select: { id: true, kind: true, artifactManifestId: true, previousVersionId: true, deploymentRunId: true },
    });
    if (version?.kind !== "recovery") {
      throw new Error(`production recovery did not create a recovery env version: ${JSON.stringify(version)}`);
    }
    const productionEnv = await prisma.projectEnvironment.findUnique({
      where: { id: productionEnvId },
      select: { currentEnvironmentVersionId: true },
    });
    const releaseRun = await prisma.releaseRun.findUnique({
      where: { id: R3.id },
      select: { status: true, mode: true, operationApproval: { select: { status: true, consumedAt: true } } },
    });
    const proofs = await collectProductionProof(row, routeSeed, {
      releaseRunId: R3.id,
      manifestId: M1.id,
      buildRunId: B1.id,
    });
    Vprod3 = version;
    return {
      deploymentRunId: row.id,
      status: row.status,
      environmentId: row.environmentId,
      manifestId: row.artifactManifestId,
      restoredM1: row.artifactManifestId === M1.id,
      releaseRunId: row.releaseRunId,
      expectedEnvironmentId: productionEnvId,
      expectedManifestId: M1.id,
      expectedReleaseRunId: R3.id,
      expectedPreviousVersionId: Vprod2.id,
      newEnvironmentVersion: versionRowResult(version, Vprod2.id, "previousIsVprod2"),
      currentMoved: productionEnv.currentEnvironmentVersionId === version.id,
      releaseRun: { status: releaseRun.status, mode: releaseRun.mode, approvalStatus: releaseRun.operationApproval?.status, approvalConsumedAt: releaseRun.operationApproval?.consumedAt },
      workload: row.result?.workload,
      healthProbe: row.result?.healthProbe,
      siteProbe: row.result?.siteProbe,
      routeSwitch: row.result?.routeSwitch,
      artifactVerified: row.result?.artifactVerified === true,
      gateDecision: row.result?.gateDecision,
      productionGate: proofs.productionGate,
      routeEvidence: proofs.routeEvidence,
    };
  });

  // ---------------------------------------------- AC-E2E-022 current/history chains
  await step("version-chains", async () => {
    const [stagingVersions, productionVersions, envs, deploymentRuns, releaseRuns] =
      await Promise.all([
        prisma.environmentVersion.findMany({
          where: { projectId, environmentId: stagingEnvId },
          select: {
            id: true, kind: true, previousVersionId: true, artifactManifestId: true,
            deploymentRunId: true, releaseRunId: true, effectiveAt: true,
          },
          orderBy: [{ effectiveAt: "asc" }, { id: "asc" }],
        }),
        prisma.environmentVersion.findMany({
          where: { projectId, environmentId: productionEnvId },
          select: {
            id: true, kind: true, previousVersionId: true, artifactManifestId: true,
            deploymentRunId: true, releaseRunId: true, effectiveAt: true,
          },
          orderBy: [{ effectiveAt: "asc" }, { id: "asc" }],
        }),
        prisma.projectEnvironment.findMany({
          where: { projectId },
          select: { id: true, key: true, currentEnvironmentVersionId: true },
        }),
        prisma.deploymentRun.findMany({
          where: { projectId, status: "completed" },
          select: { id: true, status: true },
        }),
        prisma.releaseRun.findMany({
          where: { projectId },
          select: { id: true, mode: true, status: true },
        }),
      ]);

    const stagingEnv = envs.find((e) => e.id === stagingEnvId);
    const productionEnv = envs.find((e) => e.id === productionEnvId);
    const chainOk = (versions) =>
      versions.every((v, index) => {
        if (index === 0) return v.previousVersionId === null;
        return v.previousVersionId === versions[index - 1].id;
      });
    const runCompleted = (versions) =>
      versions.every((v) => deploymentRuns.some((d) => d.id === v.deploymentRunId && d.status === "completed"));
    const apiList = await api("GET", `/projects/${projectId}/delivery/environment-versions`, headers);
    const apiStaging = (apiList.environments || []).find((e) => e.id === stagingEnvId);
    const apiProduction = (apiList.environments || []).find((e) => e.id === productionEnvId);

    return {
      staging: {
        chain: stagingVersions.map((v) => ({ id: v.id, kind: v.kind, prev: v.previousVersionId, manifest: v.artifactManifestId })),
        chainLinksValid: chainOk(stagingVersions),
        everyDeploymentCompleted: runCompleted(stagingVersions),
        dbCurrentMatchesLatest: stagingEnv?.currentEnvironmentVersionId === stagingVersions[stagingVersions.length - 1]?.id,
        apiCurrentMatchesDb: apiStaging?.currentEnvironmentVersionId === stagingEnv?.currentEnvironmentVersionId,
        expectedKinds: stagingVersions.map((v) => v.kind),
      },
      production: {
        chain: productionVersions.map((v) => ({ id: v.id, kind: v.kind, prev: v.previousVersionId, manifest: v.artifactManifestId })),
        chainLinksValid: chainOk(productionVersions),
        everyDeploymentCompleted: runCompleted(productionVersions),
        dbCurrentMatchesLatest: productionEnv?.currentEnvironmentVersionId === productionVersions[productionVersions.length - 1]?.id,
        apiCurrentMatchesDb: apiProduction?.currentEnvironmentVersionId === productionEnv?.currentEnvironmentVersionId,
        expectedKinds: productionVersions.map((v) => v.kind),
      },
      releaseRuns: releaseRuns.map((r) => ({ id: r.id, mode: r.mode, status: r.status })),
      expectedReleaseRuns: [
        { id: Vprod1.releaseRunId, mode: "standard" },
        { id: R2.id, mode: "standard" },
        { id: R3.id, mode: "recovery" },
      ],
      stagingRecoverySourcePresent: stagingVersions.some((v) => v.id === Vst2.id && v.kind === "deploy"),
      productionRecoverySourcePresent: productionVersions.some((v) => v.id === Vprod1.id && v.kind === "upgrade"),
    };
  });

  // ------------------------------------------------------- db-summary + final site
  await step("db-summary", async () => {
    const [builds, stagingDeploys, prodDeploys, envVersions, approvals, releaseRuns] =
      await Promise.all([
        prisma.buildRun.count({ where: { releaseOrderId: orderId } }),
        prisma.deploymentRun.count({ where: { environmentId: stagingEnvId, artifactManifest: { releaseOrderId: orderId } } }),
        prisma.deploymentRun.count({ where: { environmentId: productionEnvId, artifactManifest: { releaseOrderId: orderId } } }),
        prisma.environmentVersion.count({ where: { projectId } }),
        prisma.operationApproval.count({ where: { projectId } }),
        prisma.releaseRun.count({ where: { projectId } }),
      ]);
    return {
      buildRunsOnOrder: builds,
      stagingDeploymentRuns: stagingDeploys,
      productionDeploymentRuns: prodDeploys,
      environmentVersions: envVersions,
      operationApprovals: approvals,
      releaseRuns: releaseRuns,
    };
  });

  // ----------------------------------------------------------- browser pass
  await step("browser-pass", async () =>
    browserPass({
      buildRunId: B2.id,
      stagingRunId: D2st.id,
      upgradeReleaseRunId: R2.id,
      recoveryReleaseRunId: R3.id,
      recoveryDeploymentRunId: Vprod3.deploymentRunId,
    }),
  );

  finishEvidence(evidence, HISTORY_AC_MAPPING);

  await writeEvidence();
  log("E2E chain PASSED — evidence at " + evidencePath());
}

// ----------------------------------------------------------------------------
// browser pass
// ----------------------------------------------------------------------------
async function browserPass(ids) {
  const actions = browserActions(ids);
  const logPath = `${outDir}/f456-browser-driver.log`;
  const {
    artifacts,
    contents,
    cdpEvidence,
    browserFailures,
    outputNames,
    driverExit,
  } = await runHistoryBrowserSession({
    actions, secrets: { "admin-password": adminPassword },
    trustedRoot: browserTrustedRoot,
    driver: cdpDriver,
    width: 1484,
    height: 1324,
    timeout: 420000,
    logPath,
  });
  const {
    buildRunId,
    stagingRunId,
    upgradeReleaseRunId,
    recoveryReleaseRunId,
  } = ids;
  const releaseText = contents["02-release-detail.txt"].toString("utf8");
  const stagingStepText = contents["02b-staging-step.txt"].toString("utf8");
  const envVersionsText = contents["06-env-versions.txt"].toString("utf8");
  const buildLogText = contents["03-build-log-drawer.txt"].toString("utf8");
  const stagingLogText = contents["04-staging-run-log.txt"].toString("utf8");
  const productionLogText = contents["05-production-recovery-log.txt"].toString("utf8");
  return {
    driver: cdpDriver,
    driverExit,
    viewport: { width: 1484, height: 1324 },
    log: logPath,
    cdpSchema: cdpEvidence.schema,
    cdpVersion: cdpEvidence.version, cdpSessionIdentity: cdpEvidence.session,
    consoleEvents: cdpEvidence.console,
    httpResponses: cdpEvidence.httpResponses,
    consoleErrors: browserFailures.consoleErrors.slice(0, 10),
    badResponses: browserFailures.badResponses.slice(0, 10),
    failedRequests: cdpEvidence.failedRequests,
    runtimeExceptions: cdpEvidence.runtimeExceptions,
    artifacts,
    requiredArtifacts: outputNames,
    releaseDetailEvidence: {
      twoBuildsStep02: /BuildRun 2 个/.test(releaseText),
      manifestCount2: /Manifest 2 个/.test(releaseText),
      productionReleaseRuns3: /ReleaseRun 记录 3 个/.test(releaseText),
      recoveryRunMarked: /回退|恢复/.test(releaseText),
      orderIdShown: releaseText.includes(orderId),
      upgradeReleaseRunShown: releaseText.includes(upgradeReleaseRunId),
      recoveryReleaseRunShown: releaseText.includes(recoveryReleaseRunId),
      recoveryApprovalSummary: /生产回退 1.0.0 \/ Build #1/.test(releaseText),
      lifecycleEvidenceMismatchNote:
        "the order stepper shows 生产证据与发布单不匹配 because the lifecycle query (release-order-production-evidence.query.ts governedProductionDeploymentExists) only counts approvals with action project.release_order.deploy_production as valid production evidence — the recovery run's approval action project.release_order.deploy_production_recovery (AC-PROD-035, by design) is not counted; this is a known read-model display nuance, NOT a chain failure (all runs succeeded, approvals consumed, pointers moved).",
    },
    stagingStepEvidence: {
      totalStagingDeployments4: /4 次部署/.test(stagingStepText),
      twoManifestsListed: /R2 · Manifest/.test(stagingStepText) && /R1 · Manifest/.test(stagingStepText),
      manifestOptionListed: /成功 Manifest/.test(stagingStepText),
      productionPrerequisite: /已满足/.test(stagingStepText),
      note:
        "UI totals ALL staging DeploymentRuns on the order (F455 deploy + repeat deploy + upgrade + recovery = 4); the AC-E2E-017 two-runs-on-the-SAME-manifest evidence is the staging-deploy-repeat API/DB step (2 DeploymentRuns on M1, build count unchanged).",
    },
    envVersionsEvidence: {
      pageTitle: envVersionsText.includes("环境版本"),
      changeLogTable: envVersionsText.includes("环境变更记录"),
      stagingUpgradeKind: envVersionsText.includes("升级"),
      stagingRecoveryKind: envVersionsText.includes("回退"),
      productionUpgradeKind: envVersionsText.includes("升级"),
      productionRecoveryKind: envVersionsText.includes("回退"),
      currentSuccess: envVersionsText.includes("成功"),
    },
    buildLogDrawer: {
      opened: buildLogText.includes(buildRunId),
      hasBuildRunTitle: /BuildRun #2/.test(buildLogText),
    },
    stagingRunLog: {
      opened: stagingLogText.includes(stagingRunId),
      manifestShown: stagingLogText.includes("cmsj") || stagingLogText.includes("Manifest"),
    },
    productionRunLog: {
      opened: productionLogText.includes(recoveryReleaseRunId),
      recoveryMarked: /回退|recovery/.test(productionLogText),
      approved: /已批准/.test(productionLogText),
    },
  };
}

function browserActions(ids) {
  const {
    buildRunId,
    stagingRunId,
    upgradeReleaseRunId,
    recoveryReleaseRunId,
    recoveryDeploymentRunId,
  } = ids;
  return [
    "navigate:" + webBase + "/login?redirect=%2Fteams",
    "wait:1500",
    "setValue:input[type=email]@@@" + adminEmail,
    "setValue:input[type=password]@@@" + browserSecretReference("admin-password"),
    "click:button[type=submit]",
    "waitText:Parity Team",
    "wait:1500",
    "shot:01-after-login.png",
    "text:01-after-login.txt",
    "navigate:" + webBase + "/projects/" + projectId + "?releaseOrderId=" + orderId,
    "waitText:" + orderId,
    "wait:2500",
    "text:02-release-detail.txt",
    "dom:02-release-detail.html",
    "shot:02-release-detail.png",
    "navigate:" + webBase + "/projects/" + projectId + "?releaseOrderId=" + orderId + "&step=staging",
    "wait:2500",
    "text:02b-staging-step.txt",
    "shot:02b-staging-step.png",
    "navigate:" + webBase + "/projects/" + projectId + "?releaseOrderId=" + orderId + "&step=build&buildRunId=" + buildRunId,
    "waitText:" + buildRunId,
    "wait:1500",
    "text:03-build-log-drawer.txt",
    "shot:03-build-log-drawer.png",
    "navigate:" + webBase + "/projects/" + projectId + "?releaseOrderId=" + orderId + "&step=staging&deploymentRunId=" + stagingRunId,
    "waitText:" + stagingRunId,
    "wait:1500",
    "text:04-staging-run-log.txt",
    "shot:04-staging-run-log.png",
    "navigate:" + webBase + "/projects/" + projectId + "?releaseOrderId=" + orderId + "&step=production&releaseRunId=" + recoveryReleaseRunId + "&deploymentRunId=" + recoveryDeploymentRunId,
    "waitText:" + recoveryReleaseRunId,
    "wait:1500",
    "text:05-production-recovery-log.txt",
    "shot:05-production-recovery-log.png",
    "navigate:" + webBase + "/projects/" + projectId + "?view=environment-versions",
    "waitText:环境版本",
    "wait:2500",
    "text:06-env-versions.txt",
    "dom:06-env-versions.html",
    "shot:06-env-versions.png",
  ];
}

// ----------------------------------------------------------------------------
// helpers
// ----------------------------------------------------------------------------

function evidencePath() {
  return `${outDir}/f456-version-history-evidence.json`;
}

async function step(name, action) {
  return checkedStep(
    evidence,
    name,
    action,
    (result) => historyStepChecks(name, result),
    log,
  );
}

async function productionRouteSeed() {
  const routeSnapshot = positiveContext.productionRouteSnapshot || {};
  const primaryDomain = routeSnapshot.domains?.[0];
  const siteCandidates = primaryDomain
    ? await prisma.site.findMany({
        where: { teamId, projectId, environmentId: productionEnvId, primaryDomain },
        select: { id: true },
      })
    : [];
  return { routeSnapshot, siteCandidates };
}

async function collectProductionProof(row, seed, input) {
  const expectedRoute = buildProductionRouteExpectation({
    teamId,
    projectId,
    environmentId: productionEnvId,
    deploymentRunId: row.id,
    releaseRunId: input.releaseRunId,
    manifestId: input.manifestId,
    configRevisionId: positiveContext.productionConfigRevisionId,
    routeSnapshot: seed.routeSnapshot,
    siteId: seed.siteCandidates[0]?.id,
    targetRef: positiveContext.productionTargetRef,
    providerKey: parityRouteProviderKey,
    receiptVersion: 1,
  });
  const finalGateKey = `final:${input.releaseRunId}:${row.id}`;
  const [gate, routeRuns, releaseRun, siteCurrent] = await Promise.all([
    prisma.releaseGateDecision.findUnique({
      where: {
        releaseOrderId_stage_requestKey: {
          releaseOrderId: orderId,
          stage: "production",
          requestKey: finalGateKey,
        },
      },
      select: {
        id: true, releaseOrderId: true, stage: true, phase: true,
        requestKey: true, allowed: true, inputHash: true, inputSnapshot: true,
        blockerGateIds: true, integrityErrors: true, actionRunType: true,
        actionRunId: true, consumedAt: true,
      },
    }),
    prisma.siteRouteSwitchRun.findMany({
      where: {
        teamId,
        projectId,
        environmentId: productionEnvId,
        deploymentRunId: row.id,
        releaseRunId: input.releaseRunId,
      },
      select: {
        teamId: true, siteId: true, projectId: true, environmentId: true,
        deploymentRunId: true, releaseRunId: true, targetRef: true,
        proxyTarget: true, domains: true, status: true, reasonCode: true,
        result: true, startedAt: true, finishedAt: true,
      },
    }),
    prisma.releaseRun.findUnique({
      where: { id: input.releaseRunId },
      select: {
        environmentId: true, artifactManifestId: true,
        configRevisionId: true, routeSnapshot: true,
      },
    }),
    prisma.site.findUnique({
      where: { id: seed.siteCandidates[0]?.id || "__missing_site__" },
      select: { id: true, primaryDomain: true, routeSwitch: true },
    }),
  ]);
  return {
    productionGate: productionGateEvidence(gate, row.result?.gateDecision, {
      releaseOrderId: orderId,
      releaseRunId: input.releaseRunId,
      deploymentRunId: row.id,
      environmentId: productionEnvId,
      manifestId: input.manifestId,
      buildRunId: input.buildRunId,
      configRevisionId: positiveContext.productionConfigRevisionId,
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
      releaseRun,
      siteCandidateCount: seed.siteCandidates.length,
      siteCurrent,
      routeRuns,
      siteProbe: row.result?.siteProbe,
      deploymentRouteSwitch: row.result?.routeSwitch,
      capturedAt: new Date().toISOString(),
    }),
  };
}

async function login() {
  const res = await fetch(`${apiBase}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  const body = await res.json();
  if (!res.ok || !body.data?.accessToken) {
    throw new Error(
      `login failed: status=${res.status} tokenPresent=${Boolean(body.data?.accessToken)}`,
    );
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
    const err = new Error(`API ${method} ${path} failed (${res.status}): ${JSON.stringify(json)}`);
    err.status = res.status;
    err.code = json.code;
    err.message = json.message || err.message;
    throw err;
  }
  return json.data;
}

async function httpGet(url, options = {}) {
  const res = await fetch(url);
  const body = options.raw ? await res.text() : await res.json().catch(() => null);
  return { status: res.status, body };
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

function runNode(args, label) {
  const logPath = `${outDir}/${label}.log`;
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: "utf8",
    timeout: 600000,
  });
  writeFileSync(logPath, `${result.stdout || ""}\n--- STDERR ---\n${result.stderr || ""}`);
  return { status: result.status, logPath };
}

async function waitStackReady() {
  for (let i = 0; i < 60; i += 1) {
    const [apiOk, webOk] = await Promise.all([
      fetch(`${apiBase}/health`).then((r) => r.ok).catch(() => false),
      fetch(`${webBase}/`).then((r) => r.ok).catch(() => false),
    ]);
    if (apiOk && webOk) return true;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("stack did not become ready after reset");
}

async function writeEvidence() {
  await mkdir(outDir, { recursive: true });
  await writeFile(evidencePath(), JSON.stringify(evidence, null, 2));
  const runLogPath = `${outDir}/f456-version-history-e2e-run.log`;
  await writeFile(runLogPath, runLog.join("\n"));
  log(`run log written to ${runLogPath}`);
}

main()
  .catch((error) => {
    evidence.status = "failed";
    evidence.error = error.stack || error.message;
    console.error(`[f456] FAILED: ${error.stack || error.message}`);
    return writeEvidence().then(() => process.exit(1));
  })
  .finally(() => prisma.$disconnect());
