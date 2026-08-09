#!/usr/bin/env node
// F454 parity stack seed/reset tool.
//
// Commands:
//   node scripts/parity-seed.mjs fixture   materialize the fixture git repo at PARITY_FIXTURE_GIT_ROOT
//   node scripts/parity-seed.mjs up        compose up + migrate + idempotent seed
//   node scripts/parity-seed.mjs seed      idempotent seed (stack must be up; migrate is a no-op when applied)
//   node scripts/parity-seed.mjs reset     down + prune ONLY devpilot-parity-* volumes/network + up + migrate + seed
//   node scripts/parity-seed.mjs reset-bootstrap reset, then remove the legacy fixed project while retaining support primitives
//   node scripts/parity-seed.mjs down      compose down (parity project only)
//   node scripts/parity-seed.mjs destroy   verified isolated project down + volumes
//   node scripts/parity-seed.mjs inventory print row counts + fixed IDs (idempotency evidence)
//
// Reset allowlist: the reset path only ever touches
//   - the MySQL database named devpilot_parity (inside parity-mysql)
//   - docker volumes matching ^devpilot-parity- (the allowlist below)
//   - the docker network devpilot-parity_default
// and prints the allowlist before acting. It NEVER touches devpilot_g003_*,
// devpilot_resource_pool, the manual stack volumes, or any other project.
import { spawnSync } from "node:child_process";
import { createCipheriv, randomBytes, scryptSync } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parityComposeEnvironment,
  parityRuntimeConfig,
  requireVerifiedRuntimeIdentity,
} from "./lib/parity-runtime-config.mjs";
import {
  loadC5BuiltImageIds,
  recordC5BuiltImageIds,
} from "./lib/parity-isolated-c5-context.mjs";
import {
  assertRuntimeImageLabels,
  expectedRuntimeImageLabels,
} from "./lib/parity-runtime-provenance.mjs";
import {
  assertNoComposeResources,
  assertNoRuntimeResources,
  assertOwnedRuntimeResources,
  assertRunningRuntimeProvenance,
  removeOwnedRuntimeImages,
} from "./lib/parity-runtime-resource-ownership.mjs";
import { printParitySeedInventory } from "./lib/parity-seed-inventory.mjs";
import { seedParityConfigRevisions } from "./lib/parity-seed-config-revisions.mjs";
import { createParitySeedRuntimeOperations } from "./lib/parity-seed-runtime-operations.mjs";
import { downAfterVerifiedOwnership } from "./lib/parity-seed-reset-guard.mjs";
import { materializeParityHistoryArtifacts } from "./lib/parity-seed-version-history-artifacts.mjs";
import { seedParityVersionHistory } from "./lib/parity-seed-version-history.mjs";
import { detachParitySeedProject } from "./lib/parity-seed-bootstrap.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const composeFile = resolve(root, "docker-compose.devpilot-parity.yml");
const runtime = parityRuntimeConfig();
const fixtureSource = resolve(root, "fixtures/parity-app");
const fixtureGitRoot =
  process.env.PARITY_FIXTURE_GIT_ROOT ||
  "/tmp/codex-tool-runs/svton/f454/parity-app-git";
const dbName = runtime.databaseName;
const dbUrl = runtime.databaseUrl;
let verifiedRuntimeImageIds;

// Deterministic fixture IDs (AC-E2E-006): the same IDs are used across the
// seed, the DB, the API and the runtime evidence.
const IDS = {
  user: "parity-user-0001",
  team: "parity-team-0001",
  project: "parity-project-0001",
  envStaging: "parity-env-staging",
  envProduction: "parity-env-production",
  server: "parity-server-0001",
  secret: "parity-secret-0001",
  resourceType: "parity-resource-type-0001",
  resourceInstance: "parity-resource-0001",
  site: "parity-site-0001",
  order: "parity-order-0001",
  configStaging: "parity-config-rev-staging-0001",
  configProduction: "parity-config-rev-production-0001",
  appWeb: "parity-app-web",
  appApi: "parity-app-api",
  svcWeb: "parity-svc-web",
  svcApi: "parity-svc-api",
  svcWebProduction: "parity-svc-web-production",
  svcApiProduction: "parity-svc-api-production",

  connection: "parity-connection-0001",
  identity: "parity-identity-0001",
  identityRevision: "parity-identity-rev-0001",
  analysisRun: "parity-analysis-0001",
  // F455 production-gate fixture evidence (same approach as the F437 fixture:
  // MySQL-only evidence rows that the D-gates evaluate genuinely).
  managedResource: "parity-resource-managed-0001",
  connectionRun: "parity-connection-run-0001",
  metricSnapshot: "parity-metric-snapshot-0001",
  backupRun: "parity-backup-run-0001",
  logStream: "parity-log-stream-0001",
  logRun: "parity-log-run-0001",
  // Coherent previous Staging -> approved Production history used by D19.
  orderPrev: "parity-order-prev-0001",
  buildPrevA: "parity-build-prev-a-0001",
  buildPrevB: "parity-build-prev-b-0001",
  manifestPrevA: "parity-manifest-prev-a-0001",
  manifestPrevB: "parity-manifest-prev-b-0001",
  stagingDeployPrevA: "parity-deploy-staging-prev-a-0001",
  stagingDeployPrevB: "parity-deploy-staging-prev-b-0001",
  stagingEnvVersionPrevA: "parity-env-version-staging-prev-a-0001",
  stagingEnvVersionPrevB: "parity-env-version-staging-prev-b-0001",
  approvalPrevA: "parity-approval-prev-a-0001",
  approvalPrevB: "parity-approval-prev-b-0001",
  releasePrevA: "parity-release-prev-a-0001",
  releasePrevB: "parity-release-prev-b-0001",
  deployPrevA: "parity-deploy-prev-a-0001",
  deployPrevB: "parity-deploy-prev-b-0001",
  envVersionPrevA: "parity-env-version-prev-a-0001",
  envVersionPrevB: "parity-env-version-prev-b-0001",
};

const PrismaClient = createRequire(
  resolve(root, "apps/devpilot-api/package.json"),
)("@prisma/client").PrismaClient;
const printInventory = () =>
  printParitySeedInventory({ PrismaClient, dbUrl, dbName, ids: IDS });
const {
  dropCreateDb,
  migrateDeploy,
  repairApiFixtureMount,
  waitApiHealthy,
  waitMysqlHealthy,
} = createParitySeedRuntimeOperations({ compose, run, dbName, dbUrl });

const command = process.argv[2] || "up";

export async function main() {
  if (process.env.PARITY_REQUIRE_VERIFIED_RUNTIME === "1") {
    requireVerifiedRuntimeIdentity(runtime);
    if (["up", "reset", "reset-bootstrap"].includes(command)) {
      verifiedRuntimeImageIds = await prepareVerifiedRuntimeImages();
    }
  }
  if (command === "fixture") await ensureFixtureRepo();
  else if (command === "up" || command === "seed") {
    // Bring up infra first, migrate BEFORE the api container boots (its
    // onModuleInit queries tables), then bring up the rest and seed.
    await ensureFixtureRepo();
    await compose([
      "up",
      "-d",
      "mysql",
      "redis",
      "deploy-target",
      "target-workload",
    ]);
    await waitMysqlHealthy();
    await migrateDeploy();
    await compose(["up", "-d", "api", "web"]);
    await repairApiFixtureMount();
    await waitApiHealthy();
    if (verifiedRuntimeImageIds) {
      assertRunningRuntimeProvenance(runtime, verifiedRuntimeImageIds);
    }
    await seed();
    await printInventory();
  } else if (command === "reset") {
    await reset();
  } else if (command === "reset-bootstrap") {
    await reset();
    const receipt = await detachParitySeedProject(PrismaClient, dbUrl);
    console.log(`[parity-seed] bootstrap-only ${JSON.stringify(receipt)}`);
  } else if (command === "down") {
    await compose(["down", "--remove-orphans"]);
  } else if (command === "destroy") {
    requireVerifiedRuntimeIdentity(runtime);
    const expectedImageIds = process.env.PARITY_C5_MANIFEST_PATH
      ? await loadC5BuiltImageIds(process.env.PARITY_C5_MANIFEST_PATH, runtime)
      : undefined;
    assertOwnedRuntimeResources(runtime, undefined, expectedImageIds);
    await compose(["down", "--volumes", "--remove-orphans"]);
    removeOwnedRuntimeImages(runtime, undefined, expectedImageIds);
    assertNoRuntimeResources(runtime, undefined, expectedImageIds);
  } else if (command === "inventory") {
    await printInventory();
  } else {
    throw new Error(`unknown command: ${command}`);
  }
}

async function prepareVerifiedRuntimeImages() {
  await compose([
    "build",
    "api",
    "web",
    "route-control",
    "deploy-target",
    "target-workload",
  ]);
  const expected = expectedRuntimeImageLabels(runtime);
  const images = {
    api: runtime.apiImage,
    web: runtime.webImage,
    "route-control": runtime.routeControlImage,
    "deploy-target": runtime.deployTargetImage,
    "target-workload": runtime.targetWorkloadImage,
  };
  const imageIds = {};
  for (const [service, image] of Object.entries(images)) {
    const out = run("docker", [
      "image",
      "inspect",
      image,
      "--format={{json .Config.Labels}}",
    ]);
    assertRuntimeImageLabels(JSON.parse(out.stdout), expected);
    imageIds[service] = run("docker", [
      "image",
      "inspect",
      image,
      "--format={{.Id}}",
    ]).stdout.trim();
  }
  await recordC5BuiltImageIds(
    process.env.PARITY_C5_MANIFEST_PATH,
    runtime,
    imageIds,
  );
  return Object.freeze(imageIds);
}

main().catch((error) => {
  console.error(`[parity-seed] FAILED: ${error.stack || error.message}`);
  process.exit(1);
});

// ---------------------------------------------------------------------------
// Fixture git repo materialization (AC-E2E-002): committed files under
// fixtures/parity-app/ are copied to PARITY_FIXTURE_GIT_ROOT and committed
// with a FIXED author/committer + timestamp, so the pinned commit sha is
// deterministic across resets. The API container mounts this path read-only
// at /read-only-repositories/parity-app.
async function ensureFixtureRepo() {
  // The materialized repo must stay at a STABLE host path across resets:
  // Docker Desktop bind mounts track the directory handle, so rm -rf +
  // recreate leaves the container's mount stale/empty. Only materialize when
  // the repo is missing; the pinned commit is deterministic (fixed author +
  // timestamp + same committed tree), so re-runs never need regeneration.
  const markerPath = join(fixtureGitRoot, ".parity-pinned-commit.json");
  try {
    const existing = JSON.parse(await readFile(markerPath, "utf8"));
    console.log(
      `[parity-seed] fixture repo already materialized at ${fixtureGitRoot} (pinned ${existing.pinnedCommit})`,
    );
    return existing.pinnedCommit;
  } catch {
    // fall through to materialization
  }
  const stamp = "2026-08-08T00:00:00Z";
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: "Parity Fixture",
    GIT_AUTHOR_EMAIL: "parity@fixture.local",
    GIT_AUTHOR_DATE: stamp,
    GIT_COMMITTER_NAME: "Parity Fixture",
    GIT_COMMITTER_EMAIL: "parity@fixture.local",
    GIT_COMMITTER_DATE: stamp,
  };
  const stage = await mkdtemp(join(tmpdir(), "parity-fixture-stage-"));
  try {
    await cp(fixtureSource, stage, { recursive: true });
    await rm(join(stage, ".git"), { recursive: true, force: true });
    const git = (args) => run("git", args, { cwd: stage, env });
    await git(["init", "-q", "-b", "main"]);
    await git(["add", "-A"]);
    await git(["commit", "-q", "-m", "F454 parity fixture monorepo (pinned)"]);
    const sha = (await git(["rev-parse", "HEAD"])).stdout.trim();
    await mkdir(dirname(fixtureGitRoot), { recursive: true });
    await rm(fixtureGitRoot, { recursive: true, force: true });
    await cp(stage, fixtureGitRoot, { recursive: true });
    const manifest = {
      pinnedCommit: sha,
      source: fixtureSource,
      materializedAt: new Date().toISOString(),
    };
    await writeFile(markerPath, JSON.stringify(manifest, null, 2));
    console.log(
      `[parity-seed] fixture repo materialized at ${fixtureGitRoot} (pinned ${sha})`,
    );
    return sha;
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}

async function fixturePinnedCommit() {
  const marker = join(fixtureGitRoot, ".parity-pinned-commit.json");
  const manifest = JSON.parse(await readFile(marker, "utf8"));
  return manifest.pinnedCommit;
}

// ---------------------------------------------------------------------------
// Reset: down the exact validated Compose project with its own volumes, then
// recreate only its MySQL database. No global volume/network enumeration.
async function reset() {
  await ensureFixtureRepo();
  console.log(
    `[parity-seed] RESET namespace: project=${runtime.composeProject} DB=${dbName}`,
  );
  await downAfterVerifiedOwnership({
    runtime,
    expectedImageIds: verifiedRuntimeImageIds,
    down: () => compose(["down", "--volumes", "--remove-orphans"]),
  });
  assertNoComposeResources(runtime);
  await compose([
    "up",
    "-d",
    "mysql",
    "redis",
    "deploy-target",
    "target-workload",
  ]);
  await waitMysqlHealthy();
  await dropCreateDb();
  // Migrate BEFORE the api container boots (its onModuleInit queries tables).
  await migrateDeploy();
  await compose(["up", "-d", "api", "web"]);
  await repairApiFixtureMount();
  await waitApiHealthy();
  if (verifiedRuntimeImageIds) {
    assertRunningRuntimeProvenance(runtime, verifiedRuntimeImageIds);
  }
  await seed();
  await printInventory();
}

// ---------------------------------------------------------------------------
// Seed: deterministic fixed-ID rows via Prisma (host side), idempotent
// (upsert keyed on id).
async function seed() {
  const prisma = new (createRequire(
    resolve(root, "apps/devpilot-api/package.json"),
  )("@prisma/client").PrismaClient)({
    datasources: { db: { url: dbUrl } },
  });
  const pinnedCommit = await fixturePinnedCommit();
  const at = new Date();
  try {
    // 1. User + Team + membership (owner)
    await prisma.user.upsert({
      where: { id: IDS.user },
      create: {
        id: IDS.user,
        email: "parity-user-0001@parity.test",
        name: "Parity Seed User",
        role: "admin",
      },
      update: { name: "Parity Seed User" },
    });
    await prisma.team.upsert({
      where: { id: IDS.team },
      create: { id: IDS.team, name: "Parity Team" },
      update: {},
    });
    await prisma.teamMember.upsert({
      where: { teamId_userId: { teamId: IDS.team, userId: IDS.user } },
      create: {
        teamId: IDS.team,
        userId: IDS.user,
        role: "owner",
      },
      update: { role: "owner" },
    });
    // The API bootstraps admin@parity.local at startup; make that user a team
    // owner too so the runtime API flow (login as the bootstrap admin) can
    // act on the seeded parity project/order.
    const bootstrap = await prisma.user.findUnique({
      where: { email: "admin@parity.local" },
    });
    if (bootstrap) {
      await prisma.teamMember.upsert({
        where: { teamId_userId: { teamId: IDS.team, userId: bootstrap.id } },
        create: {
          teamId: IDS.team,
          userId: bootstrap.id,
          role: "owner",
        },
        update: { role: "owner" },
      });
      console.log(
        `[parity-seed] bootstrap admin ${bootstrap.id} added to ${IDS.team} as owner`,
      );
    }

    // 2. Project (governance finalized: ready + baselines)
    await prisma.project.upsert({
      where: { id: IDS.project },
      create: {
        id: IDS.project,
        teamId: IDS.team,
        createdById: IDS.user,
        name: "Parity App",
        config: { parity: true },
        onboardingStatus: "ready",
        onboardingRevision: 1,
        onboardingFinalizedAt: at,
      },
      update: { onboardingStatus: "ready" },
    });

    // 3. Staging/Production baselines
    const staging = await prisma.projectEnvironment.upsert({
      where: { id: IDS.envStaging },
      create: {
        id: IDS.envStaging,
        teamId: IDS.team,
        projectId: IDS.project,
        key: "staging",
        name: "Staging",
        baselineRole: "staging",
        sortOrder: 0,
      },
      update: { baselineRole: "staging" },
    });
    const production = await prisma.projectEnvironment.upsert({
      where: { id: IDS.envProduction },
      create: {
        id: IDS.envProduction,
        teamId: IDS.team,
        projectId: IDS.project,
        key: "production",
        name: "Production",
        baselineRole: "production",
        sortOrder: 1,
      },
      update: { baselineRole: "production" },
    });

    // 4. Server + bindings (deploy target on the parity network)
    const server = await prisma.server.upsert({
      where: { id: IDS.server },
      create: {
        id: IDS.server,
        teamId: IDS.team,
        createdById: IDS.user,
        name: "parity-deploy-target",
        host: "parity-deploy-target",
        port: 2222,
        username: "deploy",
        authType: "password",
        credentials: "redacted",
        status: "online",
        tags: ["parity", "ssh-target"],
        services: {
          ssh: true,
          nginx: true,
          docker: true,
          git: true,
          curl: true,
        },
      },
      update: { status: "online" },
    });
    for (const [envId, role] of [
      [IDS.envStaging, "staging-target"],
      [IDS.envProduction, "production-target"],
    ]) {
      await prisma.projectEnvironmentServer.upsert({
        where: {
          environmentId_serverId: { environmentId: envId, serverId: server.id },
        },
        create: {
          teamId: IDS.team,
          projectId: IDS.project,
          environmentId: envId,
          serverId: server.id,
          role,
          // F455: the deploy path resolves the provider-matched target via
          // matchReleaseDeploymentTargetBindings (F445); a binding without
          // metadata.releaseDeployment never matches the configured provider
          // and the deploy fails closed with "部署目标绑定缺失…".
          metadata: {
            releaseDeployment: {
              providerKey: "local-filesystem-v1",
              targetRef: "filesystem-release-target",
            },
          },
        },
        update: {
          role,
          metadata: {
            releaseDeployment: {
              providerKey: "local-filesystem-v1",
              targetRef: "filesystem-release-target",
            },
          },
        },
      });
    }

    // 5. SecretKey (CBC-encrypted with the API default key, see
    //    devpilot-docker-staging.mjs encryptCbcForSeed). Project-wide scope
    //    (environmentId null) so BOTH the staging and production
    //    config-revision CAS saves can reference it (F455; a per-environment
    //    secret cannot be referenced from the other environment).
    const secretValue = encryptCbcForSeed("parity-secret-plaintext-0001");
    await prisma.secretKey.upsert({
      where: { id: IDS.secret },
      create: {
        id: IDS.secret,
        teamId: IDS.team,
        createdById: IDS.user,
        projectId: IDS.project,
        environmentId: null,
        name: "parity-api-key",
        type: "api_key",
        value: secretValue,
        description: "F454 parity fixture secret (CBC-encrypted)",
      },
      update: { environmentId: null },
    });

    // 6. ResourceType + ResourceInstance (parity target workload)
    await prisma.resourceType.upsert({
      where: { id: IDS.resourceType },
      create: {
        id: IDS.resourceType,
        key: "parity-target-http",
        name: "Parity Target HTTP",
        category: "compute",
        approvalMode: "manual",
        provisioningMode: "manual",
        deliverySchema: { endpoint: runtime.targetOrigin },
        createdById: IDS.user,
      },
      update: {},
    });
    await prisma.resourceInstance.upsert({
      where: { id: IDS.resourceInstance },
      create: {
        id: IDS.resourceInstance,
        teamId: IDS.team,
        projectId: IDS.project,
        // Project-wide scope (F455): the parity target workload is shared by
        // BOTH routeSnapshots (staging.parity.example.test / parity.example.test
        // -> http://127.0.0.1:43992). The config-revision resolver forbids
        // production references to a non-production-scoped resource, and the
        // deploy input prepare requires the reference's shared scope to cover
        // the resource's own environment — so the fixture resource is
        // environment-agnostic and each env references it environment-exclusively.
        environmentId: null,
        resourceTypeId: IDS.resourceType,
        name: "parity-target-workload",
        status: "active",
        config: { endpoint: runtime.targetOrigin },
        delivery: { endpoint: runtime.targetOrigin },
      },
      update: { status: "active", environmentId: null },
    });

    // 7. Site (parity.example.test, TLS valid, routeSwitch -> parity target)
    await prisma.site.upsert({
      where: { id: IDS.site },
      create: {
        id: IDS.site,
        teamId: IDS.team,
        createdById: IDS.user,
        projectId: IDS.project,
        environmentId: IDS.envProduction,
        serverId: server.id,
        name: "Parity Site",
        primaryDomain: "parity.example.test",
        aliases: [],
        runtimeType: "reverse_proxy",
        runtimeConfig: { proxyTarget: runtime.routeProxyTarget },
        tls: {
          status: "valid",
          issuer: "parity-fixture",
          notBefore: at.toISOString(),
          notAfter: new Date(at.getTime() + 90 * 86400_000).toISOString(),
        },
        dns: {
          status: "ok",
          hostname: "parity.example.test",
          records: [{ type: "A", value: "127.0.0.1" }],
          checkedAt: at.toISOString(),
        },
        routeSwitch: {
          version: 1,
          targetRef: "filesystem-release-target",
          proxyTarget: runtime.routeProxyTarget,
          domains: ["parity.example.test"],
          status: "switched",
          reasonCode: "parity-seed",
          switchedAt: at.toISOString(),
        },
        status: "active",
      },
      update: { status: "active" },
    });

    // 8. Repository connection + canonical identity + current revision,
    //    pinned to the fixture commit (AC-E2E-002/AC-E2E-003).
    const canonicalKey = "local/read-only-repositories/parity-app";
    const canonicalUrl = "file:///read-only-repositories/parity-app";
    await prisma.repositoryConnection.upsert({
      where: { id: IDS.connection },
      create: {
        id: IDS.connection,
        teamId: IDS.team,
        projectId: IDS.project,
        connectedById: IDS.user,
        provider: "local",
        repositoryUrl: "/read-only-repositories/parity-app",
        visibility: "public",
        credentialSource: "none",
        defaultBranch: "main",
        selectedBranch: "main",
        commitSha: pinnedCommit,
        branches: ["main"],
        status: "connected",
        verifiedAt: at,
      },
      update: {
        commitSha: pinnedCommit,
        branches: ["main"],
        status: "connected",
        verifiedAt: at,
      },
    });
    await prisma.projectRepositoryIdentity.upsert({
      where: { id: IDS.identity },
      create: {
        id: IDS.identity,
        teamId: IDS.team,
        projectId: IDS.project,
        repositoryConnectionId: IDS.connection,
        provider: "local",
        canonicalKey,
        canonicalUrl,
        defaultBranch: "main",
        lockedAt: at,
      },
      update: { defaultBranch: "main" },
    });
    await prisma.projectRepositoryIdentityRevision.upsert({
      where: { id: IDS.identityRevision },
      create: {
        id: IDS.identityRevision,
        teamId: IDS.team,
        projectId: IDS.project,
        identityId: IDS.identity,
        createdById: IDS.user,
        revision: 1,
        expectedRevision: 0,
        defaultBranch: "main",
        verifiedCommitSha: pinnedCommit,
        reason: "parity fixture initial main",
        idempotencyKey: "parity-identity-initial",
      },
      update: { verifiedCommitSha: pinnedCommit },
    });
    await prisma.projectRepositoryIdentity.update({
      where: { id: IDS.identity },
      data: { currentRevisionId: IDS.identityRevision },
    });
    await prisma.repositoryConnection.update({
      where: { id: IDS.connection },
      data: { lastAppliedRunId: IDS.analysisRun, appliedAt: at },
    });

    // 9. Repository analysis run (succeeded, commit-bound) — real gate
    //    evidence for C05/C06/C08.
    await prisma.repositoryAnalysisRun.upsert({
      where: { id: IDS.analysisRun },
      create: {
        id: IDS.analysisRun,
        teamId: IDS.team,
        projectId: IDS.project,
        connectionId: IDS.connection,
        triggeredById: IDS.user,
        repositoryUrl: "/read-only-repositories/parity-app",
        branch: "main",
        commitSha: pinnedCommit,
        status: "succeeded",
        parserVersion: "f384.1",
        idempotencyKey: "parity-analysis-initial",
        result: {
          repository: {
            monorepo: true,
            packageManager: "pnpm",
            lockfiles: ["pnpm-lock.yaml"],
          },
          services: [
            { key: "web", path: "apps/web", language: "html" },
            { key: "api", path: "apps/api", language: "javascript" },
          ],
          changeImpact: { highRiskDirectories: [] },
          // F455: real migration-diff evidence for the D10/D11 production
          // gates (schemaDrift=false + orderValid=true + no destructive
          // changes — the fixture repo declares no schema or migration).
          migrationEvidence: {
            schemaDrift: false,
            orderValid: true,
            destructiveChanges: [],
            checkedAt: at.toISOString(),
          },
        },
        finishedAt: at,
        startedAt: at,
      },
      update: {
        commitSha: pinnedCommit,
        finishedAt: at,
        result: {
          repository: {
            monorepo: true,
            packageManager: "pnpm",
            lockfiles: ["pnpm-lock.yaml"],
          },
          services: [
            { key: "web", path: "apps/web", language: "html" },
            { key: "api", path: "apps/api", language: "javascript" },
          ],
          changeImpact: { highRiskDirectories: [] },
          migrationEvidence: {
            schemaDrift: false,
            orderValid: true,
            destructiveChanges: [],
            checkedAt: at.toISOString(),
          },
        },
      },
    });

    // 10. Applications + services with the F427 build contract
    //     (buildCommand + artifactPaths) for the controlled-local executor.
    await prisma.application.upsert({
      where: { id: IDS.appWeb },
      create: {
        id: IDS.appWeb,
        teamId: IDS.team,
        projectId: IDS.project,
        createdById: IDS.user,
        name: "web",
        repoPath: "apps/web",
        status: "active",
      },
      update: {},
    });
    await prisma.application.upsert({
      where: { id: IDS.appApi },
      create: {
        id: IDS.appApi,
        teamId: IDS.team,
        projectId: IDS.project,
        createdById: IDS.user,
        name: "api",
        repoPath: "apps/api",
        status: "active",
      },
      update: {},
    });
    await prisma.applicationService.upsert({
      where: { id: IDS.svcWeb },
      create: {
        id: IDS.svcWeb,
        teamId: IDS.team,
        projectId: IDS.project,
        applicationId: IDS.appWeb,
        // Staging owns its service instance; Production is seeded below with
        // a distinct service ID and exact Manifest component.
        environmentId: IDS.envStaging,
        name: "web",
        status: "active",
        deployConfig: {
          workingDirectory: "apps/web",
          buildCommand: "node scripts/build.mjs",
          artifactPaths: ["apps/web/dist"],
          // F455: managed-command-v1 (F433/F437 pattern) — the workload
          // runtime really verifies the materialized artifact with the safe
          // `test -f` predicate; no persistent process is started, so the
          // same-container Staging + Production deploys cannot collide on a
          // bound port.
          workloadExecutionMode: "managed-command-v1",
          deployCommand: "test -f dist/index.html",
          statusCommand: "test -f dist/index.html",
          failureCleanupCommand: "true",
        },
      },
      update: {
        status: "active",
        deployConfig: {
          workingDirectory: "apps/web",
          buildCommand: "node scripts/build.mjs",
          artifactPaths: ["apps/web/dist"],
          workloadExecutionMode: "managed-command-v1",
          deployCommand: "test -f dist/index.html",
          statusCommand: "test -f dist/index.html",
          failureCleanupCommand: "true",
        },
      },
    });
    await prisma.applicationService.upsert({
      where: { id: IDS.svcApi },
      create: {
        id: IDS.svcApi,
        teamId: IDS.team,
        projectId: IDS.project,
        applicationId: IDS.appApi,
        environmentId: IDS.envStaging,
        name: "api",
        status: "active",
        deployConfig: {
          workingDirectory: "apps/api",
          buildCommand: "node scripts/build.mjs",
          artifactPaths: ["apps/api/dist"],
          // F455: managed-command-v1 (F433/F437 pattern) — the workload
          // runtime really verifies the materialized api artifact
          // (dist/server.js) with the safe `test -f` predicate.
          workloadExecutionMode: "managed-command-v1",
          deployCommand: "test -f dist/server.js",
          statusCommand: "test -f dist/server.js",
          failureCleanupCommand: "true",
        },
      },
      update: {
        status: "active",
        deployConfig: {
          workingDirectory: "apps/api",
          buildCommand: "node scripts/build.mjs",
          artifactPaths: ["apps/api/dist"],
          workloadExecutionMode: "managed-process-v1",
          deployCommand: "node dist/server.js",
          healthCheckUrl: "http://127.0.0.1:4300/health",
          healthCheckAttempts: 10,
          healthCheckIntervalMs: 200,
        },
      },
    });
    const productionServiceSpecs = [
      {
        id: IDS.svcWebProduction,
        applicationId: IDS.appWeb,
        name: "web",
        deployConfig: {
          workingDirectory: "apps/web",
          buildCommand:
            "node scripts/build.mjs && mkdir -p dist-production && cp -f dist/index.html dist-production/index.html",
          artifactPaths: ["apps/web/dist-production"],
          workloadExecutionMode: "managed-command-v1",
          deployCommand: "test -f dist-production/index.html",
          statusCommand: "test -f dist-production/index.html",
          failureCleanupCommand: "true",
        },
      },
      {
        id: IDS.svcApiProduction,
        applicationId: IDS.appApi,
        name: "api",
        deployConfig: {
          workingDirectory: "apps/api",
          buildCommand:
            "node scripts/build.mjs && mkdir -p dist-production && cp -f dist/server.js dist-production/server.js",
          artifactPaths: ["apps/api/dist-production"],
          workloadExecutionMode: "managed-command-v1",
          deployCommand: "test -f dist-production/server.js",
          statusCommand: "test -f dist-production/server.js",
          failureCleanupCommand: "true",
        },
      },
    ];
    for (const serviceSpec of productionServiceSpecs) {
      await prisma.applicationService.upsert({
        where: { id: serviceSpec.id },
        create: {
          id: serviceSpec.id,
          teamId: IDS.team,
          projectId: IDS.project,
          applicationId: serviceSpec.applicationId,
          environmentId: IDS.envProduction,
          name: serviceSpec.name,
          status: "active",
          deployConfig: serviceSpec.deployConfig,
        },
        update: {
          status: "active",
          applicationId: serviceSpec.applicationId,
          environmentId: IDS.envProduction,
          deployConfig: serviceSpec.deployConfig,
        },
      });
    }

    // 11. Environment config revisions (envVars + secretReferences +
    //     resourceReferences + routeSnapshot entries -> parity target).
    await seedParityConfigRevisions({ prisma, ids: IDS, runtime });

    // 12. Release order (parity-order-0001)
    await prisma.releaseOrder.upsert({
      where: { id: IDS.order },
      create: {
        id: IDS.order,
        teamId: IDS.team,
        projectId: IDS.project,
        createdById: IDS.user,
        releaseVersion: "1.0.0",
        status: "draft",
      },
      update: {},
    });

    // 13. F455 production-gate fixture evidence. The production stage gates
    //     (D05 capacity, D08 resource connectivity, D10/D11 migration, D12
    //     backup, D18 observability, D19 previous stable version) evaluate
    //     REAL evidence rows — same approach as the F437 MySQL fixture — so
    //     the parity Production DeploymentRun shows genuinely checked gates.
    const [digestA, digestB] = await materializeParityHistoryArtifacts(
      root,
      compose,
      IDS,
    );
    const managed = await prisma.managedResource.upsert({
      where: {
        teamId_sourceType_provider_externalId: {
          teamId: IDS.team,
          sourceType: "manual",
          provider: "docker",
          externalId: "parity-target-workload",
        },
      },
      create: {
        id: IDS.managedResource,
        teamId: IDS.team,
        createdById: IDS.user,
        projectId: IDS.project,
        environmentId: IDS.envProduction,
        sourceType: "manual",
        provider: "docker",
        kind: "docker_container",
        name: "parity-target-workload-managed",
        externalId: "parity-target-workload",
        status: "active",
        endpoint: "http://parity-target-workload:80",
        metadata: { parity: true, fixture: true },
      },
      update: {
        status: "active",
        endpoint: "http://parity-target-workload:80",
      },
    });
    await prisma.resourceConnectionRun.upsert({
      where: { id: IDS.connectionRun },
      create: {
        id: IDS.connectionRun,
        teamId: IDS.team,
        actorId: IDS.user,
        resourceId: managed.id,
        projectId: IDS.project,
        environmentId: IDS.envProduction,
        sourceType: "manual",
        provider: "docker",
        kind: "docker_container",
        targetEndpoint: "http://parity-target-workload:80",
        authAdapterKey: "none",
        executorKey: "parity-fixture",
        adapterKey: "parity-http",
        dryRun: false,
        status: "completed",
        params: { target: "http://parity-target-workload:80" },
        result: { ok: true, statusCode: 200 },
        startedAt: at,
        finishedAt: at,
      },
      update: { status: "completed", dryRun: false, finishedAt: at },
    });
    await prisma.resourceMetricSnapshot.upsert({
      where: { id: IDS.metricSnapshot },
      create: {
        id: IDS.metricSnapshot,
        teamId: IDS.team,
        resourceId: managed.id,
        projectId: IDS.project,
        environmentId: IDS.envProduction,
        sourceType: "manual",
        provider: "docker",
        kind: "docker_container",
        metricSource: "parity-fixture",
        status: "collected",
        sampledAt: at,
        raw: {
          capacityFit: true,
          observability: { metrics: true, traces: true, alerts: true },
          promotionMetrics: { status: "stable" },
        },
      },
      update: {
        status: "collected",
        sampledAt: at,
        raw: {
          capacityFit: true,
          observability: { metrics: true, traces: true, alerts: true },
          promotionMetrics: { status: "stable" },
        },
      },
    });
    await prisma.backupRun.upsert({
      where: { id: IDS.backupRun },
      create: {
        id: IDS.backupRun,
        teamId: IDS.team,
        actorId: IDS.user,
        resourceId: managed.id,
        projectId: IDS.project,
        environmentId: IDS.envProduction,
        trigger: "manual",
        backupType: "logical",
        executorKey: "parity-fixture",
        adapterKey: "parity-script",
        dryRun: false,
        status: "completed",
        destinationType: "local",
        destination: { path: "/var/lib/devpilot/parity-backup" },
        result: { ok: true },
        startedAt: at,
        finishedAt: at,
      },
      update: { status: "completed", dryRun: false, finishedAt: at },
    });
    await prisma.logStream.upsert({
      where: { id: IDS.logStream },
      create: {
        id: IDS.logStream,
        teamId: IDS.team,
        createdById: IDS.user,
        projectId: IDS.project,
        environmentId: IDS.envProduction,
        managedResourceId: managed.id,
        name: "parity-target-workload",
        sourceType: "manual",
        sourceKey: "parity-target-workload",
        status: "active",
        retentionDays: 14,
      },
      update: { status: "active" },
    });
    await prisma.logCollectionRun.upsert({
      where: { id: IDS.logRun },
      create: {
        id: IDS.logRun,
        teamId: IDS.team,
        streamId: IDS.logStream,
        actorId: IDS.user,
        projectId: IDS.project,
        environmentId: IDS.envProduction,
        managedResourceId: managed.id,
        sourceType: "manual",
        sourceKey: "parity-target-workload",
        executorKey: "parity-fixture",
        adapterKey: "parity-log",
        dryRun: false,
        tail: 200,
        status: "completed",
        ingestionStatus: "completed",
        ingestedEntryCount: 12,
        result: { ok: true },
        startedAt: at,
        finishedAt: at,
      },
      update: {
        status: "completed",
        dryRun: false,
        ingestionStatus: "completed",
        finishedAt: at,
      },
    });

    // 13b. A complete prior identity graph on its own release order keeps
    //      parity-order-0001 empty while making browser history contract-valid.
    await seedParityVersionHistory({
      prisma,
      ids: IDS,
      pinnedCommit,
      digestA,
      digestB,
      capturedAt: at,
    });

    console.log(
      `[parity-seed] seeded ${dbName} (pinned fixture commit ${pinnedCommit})`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

// ---------------------------------------------------------------------------
// Helpers
function encryptCbcForSeed(plainText) {
  const key = scryptSync("default-32-char-encryption-key!", "cbc-salt", 32);
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-cbc", key, iv);
  let enc = cipher.update(plainText, "utf8", "hex");
  enc += cipher.final("hex");
  return `${iv.toString("hex")}:${enc}`;
}

function compose(args, options = {}) {
  return run(
    "docker",
    ["compose", "-p", runtime.composeProject, "-f", composeFile, ...args],
    {
      ...options,
      env: parityComposeEnvironment(runtime, options.env || process.env),
    },
  );
}

function run(cmd, args, options = {}) {
  const out = spawnSync(cmd, args, {
    cwd: options.cwd || root,
    env: { ...process.env, ...(options.env || {}) },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (options.check === false) return out;
  if (out.status !== 0) {
    throw new Error(
      `command failed (${cmd} ${args.join(" ")}): ${out.stderr || out.stdout}`,
    );
  }
  return out;
}
