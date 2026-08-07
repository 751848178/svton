#!/usr/bin/env node
// F454 parity stack seed/reset tool.
//
// Commands:
//   node scripts/parity-seed.mjs fixture   materialize the fixture git repo at PARITY_FIXTURE_GIT_ROOT
//   node scripts/parity-seed.mjs up        compose up + migrate + idempotent seed
//   node scripts/parity-seed.mjs seed      idempotent seed (stack must be up; migrate is a no-op when applied)
//   node scripts/parity-seed.mjs reset     down + prune ONLY devpilot-parity-* volumes/network + up + migrate + seed
//   node scripts/parity-seed.mjs down      compose down (parity project only)
//   node scripts/parity-seed.mjs inventory print row counts + fixed IDs (idempotency evidence)
//
// Reset allowlist: the reset path only ever touches
//   - the MySQL database named devpilot_parity (inside parity-mysql)
//   - docker volumes matching ^devpilot-parity- (the allowlist below)
//   - the docker network devpilot-parity_default
// and prints the allowlist before acting. It NEVER touches devpilot_g003_*,
// devpilot_resource_pool, the manual stack volumes, or any other project.
import { spawnSync } from "node:child_process";
import { createCipheriv, createHash, randomBytes, scryptSync } from "node:crypto";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const composeFile = resolve(root, "docker-compose.devpilot-parity.yml");
const fixtureSource = resolve(root, "fixtures/parity-app");
const fixtureGitRoot =
  process.env.PARITY_FIXTURE_GIT_ROOT ||
  "/tmp/codex-tool-runs/svton/f454/parity-app-git";
const dbName = "devpilot_parity";
const dbUrl = `mysql://root:password@127.0.0.1:4334/${dbName}`;

// The only volume names the reset path may prune. Everything else is refused.
const VOLUME_ALLOWLIST = [
  "devpilot-parity-mysql",
  "devpilot-parity-redis",
  "devpilot-parity-release-build",
  "devpilot-parity-deployments",
  "devpilot-parity-deploy-target-data",
];
const NETWORK_ALLOWLIST = ["devpilot-parity_default"];

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
  connection: "parity-connection-0001",
  identity: "parity-identity-0001",
  identityRevision: "parity-identity-rev-0001",
  analysisRun: "parity-analysis-0001",
};

const command = process.argv[2] || "up";

export async function main() {
  if (command === "fixture") await ensureFixtureRepo();
  else if (command === "up" || command === "seed") {
    // Bring up infra first, migrate BEFORE the api container boots (its
    // onModuleInit queries tables), then bring up the rest and seed.
    await ensureFixtureRepo();
    await compose(["up", "-d", "mysql", "redis", "deploy-target", "target-workload"]);
    await waitMysqlHealthy();
    await migrateDeploy();
    await compose(["up", "-d", "api", "web"]);
    await repairApiFixtureMount();
    await waitApiHealthy();
    await seed();
    await printInventory();
  } else if (command === "reset") {
    await reset();
  } else if (command === "down") {
    await compose(["down", "--remove-orphans"]);
  } else if (command === "inventory") {
    await printInventory();
  } else {
    throw new Error(`unknown command: ${command}`);
  }
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
// Reset: down parity project, prune ONLY allowlisted parity volumes/network,
// up infra, drop/create ONLY devpilot_parity, migrate, seed.
async function reset() {
  await ensureFixtureRepo();
  console.log(
    `[parity-seed] RESET allowlist: DB=${dbName} volumes=${VOLUME_ALLOWLIST.join(",")} network=${NETWORK_ALLOWLIST.join(",")}`,
  );
  await compose(["down", "--remove-orphans"]);
  const volumes = listVolumes().filter((name) =>
    VOLUME_ALLOWLIST.includes(name),
  );
  for (const volume of volumes) {
    await run("docker", ["volume", "rm", "-f", volume]);
    console.log(`[parity-seed] pruned volume ${volume} (allowlisted)`);
  }
  const networks = listNetworks().filter((name) =>
    NETWORK_ALLOWLIST.includes(name),
  );
  for (const network of networks) {
    await run("docker", ["network", "rm", network]);
    console.log(`[parity-seed] pruned network ${network} (allowlisted)`);
  }
  await compose(["up", "-d", "mysql", "redis", "deploy-target", "target-workload"]);
  await waitMysqlHealthy();
  await dropCreateDb();
  // Migrate BEFORE the api container boots (its onModuleInit queries tables).
  await migrateDeploy();
  await compose(["up", "-d", "api", "web"]);
  await repairApiFixtureMount();
  await waitApiHealthy();
  await seed();
  await printInventory();
}

// Docker Desktop bind mounts can go stale when the host dir handle changes;
// if the api container sees an empty fixture mount, force-recreate it.
async function repairApiFixtureMount() {
  const out = run("docker", [
    "exec",
    "parity-api",
    "sh",
    "-lc",
    "test -f /read-only-repositories/parity-app/package.json && echo OK || echo MISSING",
  ], { check: false });
  if (out.stdout.trim() === "OK") return;
  console.log("[parity-seed] api fixture mount empty; force-recreating api");
  await compose(["up", "-d", "--force-recreate", "api"]);
}

function listVolumes() {
  const out = run("docker", ["volume", "ls", "-q"], { check: false });
  return out.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function listNetworks() {
  const out = run("docker", ["network", "ls", "--format", "{{.Name}}"], {
    check: false,
  });
  return out.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

async function dropCreateDb() {
  await run("docker", [
    "compose",
    "-f",
    composeFile,
    "exec",
    "-T",
    "mysql",
    "sh",
    "-lc",
    `mysql -uroot -ppassword -e 'DROP DATABASE IF EXISTS ${dbName}; CREATE DATABASE ${dbName};'`,
  ]);
  console.log(`[parity-seed] recreated database ${dbName}`);
}

// Host-side migrate deploy (same approach as scripts/devpilot-docker-staging.mjs)
async function migrateDeploy() {
  await run("corepack", [
    "pnpm",
    "--filter",
    "@svton/devpilot-api",
    "exec",
    "prisma",
    "migrate",
    "deploy",
  ], { env: { ...process.env, DATABASE_URL: dbUrl } });
  console.log(`[parity-seed] prisma migrate deploy applied on ${dbName}`);
}

async function waitMysqlHealthy() {
  for (let i = 0; i < 60; i += 1) {
    const state = containerHealth("parity-mysql");
    if (state === "healthy") return;
    await sleep(2000);
  }
  throw new Error("parity mysql did not become healthy");
}

async function waitApiHealthy() {
  for (let i = 0; i < 90; i += 1) {
    const state = containerHealth("parity-api");
    if (state === "healthy") return;
    await sleep(2000);
  }
  throw new Error("parity api did not become healthy");
}

function containerHealth(containerName) {
  const out = run("docker", [
    "inspect",
    containerName,
    "--format={{.State.Health.Status}}",
  ], { check: false });
  return out.stdout.trim();
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
        where: { environmentId_serverId: { environmentId: envId, serverId: server.id } },
        create: {
          teamId: IDS.team,
          projectId: IDS.project,
          environmentId: envId,
          serverId: server.id,
          role,
        },
        update: { role },
      });
    }

    // 5. SecretKey (CBC-encrypted with the API default key, see
    //    devpilot-docker-staging.mjs encryptCbcForSeed)
    const secretValue = encryptCbcForSeed("parity-secret-plaintext-0001");
    await prisma.secretKey.upsert({
      where: { id: IDS.secret },
      create: {
        id: IDS.secret,
        teamId: IDS.team,
        createdById: IDS.user,
        projectId: IDS.project,
        environmentId: IDS.envProduction,
        name: "parity-api-key",
        type: "api_key",
        value: secretValue,
        description: "F454 parity fixture secret (CBC-encrypted)",
      },
      update: {},
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
        deliverySchema: { endpoint: "http://127.0.0.1:43992" },
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
        environmentId: IDS.envStaging,
        resourceTypeId: IDS.resourceType,
        name: "parity-target-workload",
        status: "active",
        config: { endpoint: "http://127.0.0.1:43992" },
        delivery: { endpoint: "http://127.0.0.1:43992" },
      },
      update: { status: "active" },
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
        runtimeConfig: { proxyTarget: "http://127.0.0.1:43992" },
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
          proxyTarget: "http://127.0.0.1:43992",
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
        },
        finishedAt: at,
        startedAt: at,
      },
      update: { commitSha: pinnedCommit, finishedAt: at },
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
        environmentId: IDS.envStaging,
        name: "web",
        deployConfig: {
          workingDirectory: "apps/web",
          buildCommand: "node scripts/build.mjs",
          artifactPaths: ["apps/web/dist"],
        },
      },
      update: { deployConfig: { workingDirectory: "apps/web", buildCommand: "node scripts/build.mjs", artifactPaths: ["apps/web/dist"] } },
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
        deployConfig: {
          workingDirectory: "apps/api",
          buildCommand: "node scripts/build.mjs",
          artifactPaths: ["apps/api/dist"],
        },
      },
      update: { deployConfig: { workingDirectory: "apps/api", buildCommand: "node scripts/build.mjs", artifactPaths: ["apps/api/dist"] } },
    });

    // 11. Environment config revisions (envVars + secretReferences +
    //     resourceReferences + routeSnapshot entries -> parity target).
    const stagingRevision = await prisma.environmentConfigRevision.upsert({
      where: { id: IDS.configStaging },
      create: {
        id: IDS.configStaging,
        teamId: IDS.team,
        projectId: IDS.project,
        environmentId: IDS.envStaging,
        createdById: IDS.user,
        revision: 1,
        snapshotHash: createHash("sha256").update("parity-staging-v1").digest("hex"),
        plainVariables: { HTTP_PLAIN_PARITY: "staging" },
        secretReferences: [
          { id: IDS.secret, key: "PARITY_API_KEY" },
        ],
        resourceReferences: [
          { id: IDS.resourceInstance, kind: "resource_instance", name: "parity-target-workload" },
        ],
        routeSnapshot: {
          domains: ["staging.parity.example.test"],
          proxyTarget: "http://127.0.0.1:43992",
        },
        source: "parity_seed",
      },
      update: {},
    });
    const productionRevision = await prisma.environmentConfigRevision.upsert({
      where: { id: IDS.configProduction },
      create: {
        id: IDS.configProduction,
        teamId: IDS.team,
        projectId: IDS.project,
        environmentId: IDS.envProduction,
        createdById: IDS.user,
        revision: 1,
        snapshotHash: createHash("sha256").update("parity-production-v1").digest("hex"),
        plainVariables: { HTTP_PLAIN_PARITY: "production" },
        secretReferences: [
          { id: IDS.secret, key: "PARITY_API_KEY" },
        ],
        resourceReferences: [
          { id: IDS.resourceInstance, kind: "resource_instance", name: "parity-target-workload" },
        ],
        routeSnapshot: {
          domains: ["parity.example.test"],
          proxyTarget: "http://127.0.0.1:43992",
        },
        source: "parity_seed",
      },
      update: {},
    });
    await prisma.projectEnvironment.update({
      where: { id: staging.id },
      data: { currentConfigRevisionId: stagingRevision.id },
    });
    await prisma.projectEnvironment.update({
      where: { id: production.id },
      data: { currentConfigRevisionId: productionRevision.id },
    });

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

    console.log(`[parity-seed] seeded ${dbName} (pinned fixture commit ${pinnedCommit})`);
  } finally {
    await prisma.$disconnect();
  }
}

// ---------------------------------------------------------------------------
// Inventory: row counts + fixed IDs, used as idempotency evidence
// (reset+seed twice -> same counts and IDs).
async function printInventory() {
  const prisma = new (createRequire(
    resolve(root, "apps/devpilot-api/package.json"),
  )("@prisma/client").PrismaClient)({
    datasources: { db: { url: dbUrl } },
  });
  try {
    const counts = {
      project: await prisma.project.count({ where: { id: IDS.project } }),
      environment: await prisma.projectEnvironment.count({ where: { projectId: IDS.project } }),
      releaseOrder: await prisma.releaseOrder.count({ where: { id: IDS.order } }),
      buildRun: await prisma.buildRun.count({ where: { projectId: IDS.project } }),
      deploymentRun: await prisma.deploymentRun.count({ where: { projectId: IDS.project } }),
      repositoryConnection: await prisma.repositoryConnection.count({ where: { projectId: IDS.project } }),
      repositoryAnalysisRun: await prisma.repositoryAnalysisRun.count({ where: { projectId: IDS.project } }),
      site: await prisma.site.count({ where: { id: IDS.site } }),
      secretKey: await prisma.secretKey.count({ where: { id: IDS.secret } }),
      resourceInstance: await prisma.resourceInstance.count({ where: { id: IDS.resourceInstance } }),
      server: await prisma.server.count({ where: { id: IDS.server } }),
      configRevision: await prisma.environmentConfigRevision.count({ where: { projectId: IDS.project } }),
      application: await prisma.application.count({ where: { projectId: IDS.project } }),
      applicationService: await prisma.applicationService.count({ where: { projectId: IDS.project } }),
      fixedIds: Object.values(IDS),
    };
    const inventory = {
      database: dbName,
      capturedAt: new Date().toISOString(),
      counts,
      fixedIds: Object.values(IDS),
    };
    console.log(`[parity-seed] inventory ${JSON.stringify(inventory)}`);
    return inventory;
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

function compose(args) {
  return run("docker", ["compose", "-f", composeFile, ...args]);
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

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}
