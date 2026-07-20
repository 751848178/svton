#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, createWriteStream } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createApi, sleep, unwrap } from "./devpilot-staging-http.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { PrismaClient } = createRequire(resolve(root, "apps/devpilot-api/package.json"))("@prisma/client");
const composeFile = resolve(root, "docker-compose.devpilot-staging.yml");
const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const runDir = process.env.DEVPILOT_STAGING_LOG_DIR || `/tmp/codex-tool-runs/svton/g003-docker-staging-${stamp}`;
const apiPort = process.env.DEVPILOT_API_PORT || "3211";
const apiUrl = `http://127.0.0.1:${apiPort}/api`;
const dbUrl = process.env.DEVPILOT_STAGING_DATABASE_URL || "mysql://root:password@127.0.0.1:3320/devpilot_g003_staging";
const taskToken = process.env.DEVPILOT_AGENT_TASK_PULL_TOKEN || "devpilot-g003-task-token";
const heartbeatToken = process.env.DEVPILOT_AGENT_HEARTBEAT_TOKEN || "devpilot-g003-heartbeat-token";
const nginxUrl = `http://127.0.0.1:${process.env.DEVPILOT_STAGING_NGINX_PORT || "18098"}`, providerUrl = `http://127.0.0.1:${process.env.DEVPILOT_STAGING_FAKE_PROVIDER_PORT || "19091"}`;
const api = createApi(apiUrl);
mkdirSync(runDir, { recursive: true });

const command = process.argv[2] || "run";
if (command === "up") await compose(["up", "-d", "--remove-orphans"]);
else if (command === "down") await compose(["down", "-v", "--remove-orphans"]);
else if (command === "run") await run(); else throw new Error(`unknown command: ${command}`);

async function run() {
  let api;
  const evidence = { status: "running", runDir, apiUrl, matrix: matrix() };
  try {
    await compose(["up", "-d", "--remove-orphans"]);
    await runLog("reset-db", "docker", ["compose", "-f", composeFile, "exec", "-T", "api-mysql", "sh", "-lc", "until mysqladmin ping -h 127.0.0.1 -uroot -ppassword --silent; do sleep 1; done; mysql -uroot -ppassword -e 'DROP DATABASE IF EXISTS devpilot_g003_staging; CREATE DATABASE devpilot_g003_staging;'"]);
    await runLog("prisma-generate", "corepack", ["pnpm", "--filter", "@svton/devpilot-api", "exec", "prisma", "generate"], { DATABASE_URL: dbUrl });
    await runLog("prisma-migrate", "corepack", ["pnpm", "--filter", "@svton/devpilot-api", "exec", "prisma", "migrate", "deploy"], { DATABASE_URL: dbUrl });
    api = startApi();
    await waitForApi();
    const auth = await createIdentity();
    const seeded = await seedStagingRecords(auth);
    evidence.ids = { ...auth, ...seeded };
    await runLog("minio-mb", "docker", ["compose", "-f", composeFile, "--profile", "seed", "run", "--rm", "minio-mc"]);
    evidence.localResources = await seedLocalResources(auth, seeded);
    evidence.resourceRequest = await resourceRequestFlow(auth, seeded);
    evidence.commandPolicy = await commandPolicyFlow(auth, seeded);
    evidence.deployment = await deploymentFlow(auth, seeded);
    mkdirSync("/tmp/devpilot-g003-agent-work", { recursive: true });
    evidence.taskPull = await taskPull(auth, seeded, "deployment-task-pull");
    evidence.backup = await backupRestoreFlow(auth, seeded);
    evidence.rollback = await rollbackFlow(auth, seeded, evidence.deployment.runId);
    evidence.observability = await observability(auth);
    evidence.status = "passed";
  } catch (error) {
    evidence.status = "failed";
    evidence.error = error.stack || error.message;
    throw error;
  } finally {
    if (api) api.kill("SIGTERM");
    writeFileSync(`${runDir}/summary.json`, JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify({ status: evidence.status, runDir, summary: `${runDir}/summary.json` }, null, 2));
    process.exit(evidence.status === "passed" ? 0 : 1);
  }
}

function matrix() { return {
    apiMysql: "docker compose service api-mysql on 127.0.0.1:3320, disposable DB devpilot_g003_staging",
    apiRedis: "docker compose service api-redis on 127.0.0.1:6384",
    resourceMysql: "docker compose service mysql on 127.0.0.1:3321 (resource pool)",
    resourceRedis: "docker compose service redis on 127.0.0.1:6385 (resource pool)",
    resourcePostgres: "docker compose service postgres on 127.0.0.1:5433",
    sshServer: "ssh-server on 127.0.0.1:2223 (devpilot/devpilot) for ssh transport",
    minio: "MinIO S3 on 127.0.0.1:9100 (console :9101), bucket devpilot-test",
    dockerSocketProxy: "docker-socket-proxy on 127.0.0.1:2376 (read-only host daemon)",
    mailhog: "Mailhog SMTP on 127.0.0.1:1025, UI :8025",
    virtualTarget: `nginx target on ${nginxUrl}, never production traffic`,
    fakeProvider: `HTTP fake-provider on ${providerUrl} for resource provisioning`,
    backupRestore: "backup-target container plus Devpilot backup/restore dry-run jobs",
    taskPullAgent: "local svton CLI task-pull runner with disposable /tmp cwd",
  }; }

async function compose(args) { await runLog(`compose-${args[0]}`, "docker", ["compose", "-f", composeFile, ...args]); }

async function runLog(name, cmd, args, extraEnv = {}) {
  const out = spawnSync(cmd, args, { cwd: root, env: { ...process.env, ...extraEnv }, encoding: "utf8" });
  const log = `${runDir}/${name}.log`;
  writeFileSync(log, `$ ${cmd} ${args.join(" ")}\n\n${out.stdout || ""}${out.stderr || ""}`);
  if (out.status !== 0) throw new Error(`${name} failed, see ${log}`);
  return log;
}

function startApi() {
  const apiLog = createWriteStream(`${runDir}/api.log`, { flags: "a" });
  const env = {
    ...process.env,
    DATABASE_URL: dbUrl,
    PORT: apiPort,
    REDIS_HOST: "127.0.0.1",
    REDIS_PORT: "6384",
    REDIS_PASSWORD: "",
    JWT_SECRET: "devpilot-g003-jwt",
    RESOURCE_PROVISIONING_HTTP_ENABLED: "true",
    SERVER_EXECUTOR_LIVE_ENABLED: "true",
    SERVER_EXECUTOR_AGENT_TARGET_ENABLED: "true",
    SERVER_EXECUTOR_AGENT_TASK_PULL_ENABLED: "true",
    SERVER_EXECUTOR_AGENT_TASK_PULL_CONTRACT_ENABLED: "true",
    SERVER_EXECUTOR_AGENT_TASK_PULL_TOKEN: taskToken,
    SERVER_EXECUTOR_AGENT_HEARTBEAT_ENABLED: "true",
    SERVER_EXECUTOR_AGENT_HEARTBEAT_TOKEN: heartbeatToken,
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: "1025",
    MAIL_FROM: "devpilot@staging.local",
  };
  const child = spawn("corepack", ["pnpm", "--filter", "@svton/devpilot-api", "dev"], { cwd: root, env });
  child.stdout.pipe(apiLog);
  child.stderr.pipe(apiLog);
  return child;
}

async function waitForApi() {
  for (let i = 0; i < 90; i += 1) {
    try {
      const res = await fetch(`${apiUrl}/auth/profile`);
      if ([401, 403].includes(res.status)) return;
    } catch {}
    await sleep(1000);
  }
  throw new Error("api did not become ready");
}

async function createIdentity() {
  const email = `g003-staging-${stamp}@example.test`;
  await api("POST", "/auth/register", { body: { email, password: "DemoPass123", name: "G003 Staging" }, ok: [200, 201, 400, 409] });
  const login = await api("POST", "/auth/login", { body: { email, password: "DemoPass123" }, ok: [200, 201] });
  const token = unwrap(login).accessToken;
  const profile = unwrap(await api("GET", "/auth/profile", { token }));
  const team = unwrap(await api("POST", "/teams", { token, body: { name: `G003 Docker ${stamp}` }, ok: [200, 201] }));
  return { token, userId: profile.id, teamId: team.id };
}

async function seedStagingRecords(auth) {
  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
  const agentServices = { devpilotAgent: { status: "online", capabilities: ["deploy", "rollback", "backup"], lastSeenAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 3600_000).toISOString() } };
  try {
    const project = await prisma.project.create({ data: { teamId: auth.teamId, createdById: auth.userId, name: "G003 Docker Staging", config: { framework: "docker-staging" }, gitRepo: null } });
    const env = await prisma.projectEnvironment.create({ data: { teamId: auth.teamId, projectId: project.id, key: "staging", name: "Docker staging", config: { disposable: true } } });
    const server = await prisma.server.create({ data: { teamId: auth.teamId, createdById: auth.userId, name: "devpilot-g003-virtual-nginx", host: "127.0.0.1", port: 22, username: "staging", authType: "password", credentials: "redacted", status: "online", tags: ["server-agent"], services: agentServices } });
    await prisma.projectEnvironmentServer.create({ data: { teamId: auth.teamId, projectId: project.id, environmentId: env.id, serverId: server.id, role: "staging-target" } });
    // The legacy `devpilot-g003-mysql` container name now belongs to the
    // resource pool mysql (post-rename in docker-compose.devpilot-staging.yml).
    // Pointing this row at it keeps the backup command-policy regex
    // (commandPolicyFlow below) and `backup.service.ts` hard-coded container
    // name working unchanged.
    const resource = await prisma.managedResource.create({ data: { teamId: auth.teamId, createdById: auth.userId, serverId: server.id, projectId: project.id, environmentId: env.id, sourceType: "server", provider: "docker", kind: "mysql", name: "devpilot-g003-mysql", externalId: "devpilot-g003-mysql", status: "running", endpoint: "mysql://127.0.0.1:3321/devpilot_resource_pool", config: { containerName: "devpilot-g003-mysql" }, metadata: { disposable: true } } });
    const app = await prisma.application.create({ data: { teamId: auth.teamId, projectId: project.id, createdById: auth.userId, name: "docker-staging-app", status: "active", config: {} } });
    const service = await prisma.applicationService.create({ data: { teamId: auth.teamId, projectId: project.id, applicationId: app.id, environmentId: env.id, serverId: server.id, managedResourceId: resource.id, name: "virtual-nginx", deployConfig: { targetType: "server", workingDirectory: "/tmp/devpilot-g003-agent-work", deployCommand: `curl -fsS ${nginxUrl}`, rollbackCommand: `curl -fsS ${nginxUrl}`, healthCheckUrl: nginxUrl } } });
    const type = await prisma.resourceType.create({ data: { key: `g003-docker-mysql-${stamp}`, name: "G003 Docker MySQL", approvalMode: "manual", provisioningMode: "api", provisioningConfig: { url: `${providerUrl}/provision`, method: "POST" }, deliverySchema: { credentialFields: ["password"] }, createdById: auth.userId } });
    return { projectId: project.id, environmentId: env.id, serverId: server.id, resourceId: resource.id, applicationId: app.id, serviceId: service.id, resourceTypeId: type.id };
  } finally {
    await prisma.$disconnect();
  }
}

// Seeds the local Docker resource tier (Tier A) into the staging DB. Follows
// the existing raw-Prisma pattern of seedStagingRecords: credentials /
// adminConfig columns get a "redacted" placeholder instead of going through
// the API's CryptoService, matching the existing convention at :132,134.
async function seedLocalResources(auth, ids) {
  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
  try {
    // ResourceType rows for the new local backings. Defaults in
    // resource-type-defaults.constants.ts are intentionally left untouched.
    const typeSpecs = [
      { key: `local-mysql-pool-${stamp}`, name: "Local MySQL Pool", category: "database", provisioningMode: "pool", provisioningConfig: { poolKey: "local-mysql" } },
      { key: `local-redis-pool-${stamp}`, name: "Local Redis Pool", category: "cache", provisioningMode: "pool", provisioningConfig: { poolKey: "local-redis" } },
      { key: `local-postgres-${stamp}`, name: "Local PostgreSQL", category: "database", provisioningMode: "manual" },
      { key: `local-object-storage-${stamp}`, name: "Local Object Storage (MinIO)", category: "storage", provisioningMode: "manual" },
      { key: `local-ssh-server-${stamp}`, name: "Local SSH Server", category: "compute", provisioningMode: "manual" },
    ];
    const resourceTypes = [];
    for (const spec of typeSpecs) {
      resourceTypes.push(await prisma.resourceType.create({ data: { key: spec.key, name: spec.name, category: spec.category, approvalMode: "manual", provisioningMode: spec.provisioningMode, provisioningConfig: spec.provisioningConfig ?? {}, deliverySchema: {}, createdById: auth.userId } }));
    }

    // ResourcePool rows pointing at the resource containers. adminConfig is a
    // placeholder string matching the existing seed pattern (real runs encrypt
    // this server-side via POST /resource-pools).
    const mysqlPool = await prisma.resourcePool.create({ data: { type: "mysql", name: "Local MySQL Pool", endpoint: "mysql://resource-mysql:3306", adminConfig: "redacted", capacity: 10, allocated: 0, status: "active" } });
    const redisPool = await prisma.resourcePool.create({ data: { type: "redis", name: "Local Redis Pool", endpoint: "redis://resource-redis:6379", adminConfig: "redacted", capacity: 15, allocated: 0, status: "active" } });

    // Server row carrying the dockerApiHost tag so
    // docker-inventory-executor.factory.ts picks the dockerode inventory path.
    const dockerHost = await prisma.server.create({ data: { teamId: auth.teamId, createdById: auth.userId, name: "devpilot-g003-docker-host", host: "docker-socket-proxy", port: 2375, username: "", authType: "password", credentials: "redacted", status: "online", tags: ["local-docker"], services: { dockerApiHost: "tcp://docker-socket-proxy:2375" } } });

    // TeamCredential row carrying the MinIO S3-compatible shape. The `config`
    // column is encrypted in production via POST /team-credentials; here we use
    // a placeholder to match the existing raw-Prisma pattern.
    const minioCred = await prisma.teamCredential.create({ data: { teamId: auth.teamId, type: "object-storage", name: "Local MinIO (S3)", config: "redacted" } });

    // ManagedResource rows mirroring the live containers so the resource-control
    // inventory has known targets to list/metric/probe. Skip the resource-mysql
    // container here because seedStagingRecords already creates a row for
    // `devpilot-g003-mysql` (the backup flow depends on that exact externalId).
    const mrSpecs = [
      { kind: "redis", name: "devpilot-g003-redis", endpoint: "redis://resource-redis:6379" },
      { kind: "database", name: "devpilot-g003-resource-postgres", endpoint: "postgres://resource-postgres:5432" },
      { kind: "docker_container", name: "devpilot-g003-ssh-server", endpoint: "ssh://ssh-server:2222" },
      { kind: "object_storage", name: "devpilot-g003-minio", endpoint: "http://minio:9000" },
    ];
    const managed = [];
    for (const spec of mrSpecs) {
      managed.push(await prisma.managedResource.create({ data: { teamId: auth.teamId, createdById: auth.userId, serverId: dockerHost.id, projectId: ids.projectId, environmentId: ids.environmentId, sourceType: "server", provider: "docker", kind: spec.kind, name: spec.name, externalId: spec.name, status: "running", endpoint: spec.endpoint, credentialId: spec.kind === "object_storage" ? minioCred.id : null, config: { containerName: spec.name }, metadata: { syncMode: "seeded_local" } } }));
    }

    return {
      resourceTypeIds: resourceTypes.map((t) => t.id),
      poolIds: [mysqlPool.id, redisPool.id],
      serverId: dockerHost.id,
      credentialId: minioCred.id,
      managedResourceIds: managed.map((m) => m.id),
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function resourceRequestFlow(auth, ids) {
  const request = unwrap(await api("POST", "/resource-requests", { auth, body: { resourceTypeId: ids.resourceTypeId, projectId: ids.projectId, environmentId: ids.environmentId, title: "Docker-backed MySQL", spec: { name: "docker-backed-mysql" } }, ok: [200, 201] }));
  const reviewed = unwrap(await api("POST", `/resource-requests/${request.id}/review`, { auth, body: { status: "approved", comment: "Docker staging approved" }, ok: [200, 201] }));
  const runs = unwrap(await api("GET", `/resource-requests/${request.id}/provisioning-runs`, { auth }));
  return { requestId: request.id, status: reviewed.status, provisioningRunId: runs[0]?.id, provisioningStatus: runs[0]?.status };
}

async function commandPolicyFlow(auth, ids) {
  return unwrap(await api("POST", "/server-command-policy-templates", { auth, body: { name: `g003-docker-staging-${stamp}`, enabled: true, priority: 500, adapterKeys: ["deployment-script-plan", "backup-script-plan", "restore-script-plan"], operationKeys: ["deployment.run", "deployment.rollback", "deployment.smoke_check", "restore.docker.mysql"], allowedPatterns: [`regex:^curl -fsS ${nginxUrl.replaceAll(".", "\\.")}(/health)?$`, "regex:^mkdir -p /var/backups/devpilot/mysql$", "regex:^test -f /var/backups/devpilot/mysql/devpilot-backup\\.sql$", "regex:^docker cp (devpilot-g003-mysql:/tmp/devpilot-backup\\.sql /var/backups/devpilot/mysql/devpilot-backup\\.sql|/var/backups/devpilot/mysql/devpilot-backup\\.sql devpilot-g003-mysql:/tmp/devpilot-restore-candidate)$", "regex:^docker exec devpilot-g003-mysql sh -lc .+$"], blockedPatterns: ["regex:.*\\brm\\s+-rf\\b.*", "regex:.*\\bsudo\\b.*", "regex:.*(;|\\|\\||&&|`|\\$\\(|>|<).*"] }, ok: [200, 201] }));
}

async function deploymentFlow(auth, ids) {
  const body = { environmentId: ids.environmentId, applicationId: ids.applicationId, applicationServiceId: ids.serviceId, serverId: ids.serverId, dryRun: false, queue: true, maxAttempts: 1, confirmationText: "G003 Docker Staging" };
  let run = unwrap(await api("POST", `/deployments/projects/${ids.projectId}/runs`, { auth, body, ok: [200, 201] }));
  if (run.status === "blocked" && run.operationApproval?.id) {
    await api("POST", `/operation-approvals/${run.operationApproval.id}/review`, { auth, body: { decision: "approved", reviewComment: "Docker staging approval" }, ok: [200, 201] });
    run = unwrap(await api("POST", `/deployments/projects/${ids.projectId}/runs`, { auth, body: { ...body, approvalId: run.operationApproval.id }, ok: [200, 201] }));
  }
  return { runId: run.id, status: run.status, serverExecutionJobId: run.serverExecutionJobId };
}

async function taskPull(auth, ids, name) {
  const log = await runLog(name, "corepack", ["pnpm", "--filter", "@svton/cli", "exec", "svton", "agent", "task-pull", "run", "--api-url", apiUrl, "--team", auth.teamId, "--server", ids.serverId, "--agent", "g003-agent", "--runner", name, "--token", taskToken, "--heartbeat-token", heartbeatToken, "--cwd", "/tmp/devpilot-g003-agent-work", "--max-iterations", "3", "--idle-limit", "1", "--ack-renewal-interval-ms", "30000", "--force-kill-grace-ms", "5000"]);
  return { log };
}

async function backupRestoreFlow(auth, ids) {
  const plan = unwrap(await api("POST", "/backups/plans", { auth, body: { resourceId: ids.resourceId, name: "G003 Docker MySQL backup", backupType: "logical", destinationType: "local" }, ok: [200, 201] }));
  const run = unwrap(await api("POST", `/backups/plans/${plan.id}/runs`, { auth, body: { dryRun: true, trigger: "api" }, ok: [200, 201] }));
  const restore = unwrap(await api("POST", `/backups/runs/${run.id}/restore`, { auth, body: { dryRun: true, confirmationText: "G003 Docker MySQL backup", validationQuery: "mysql --execute=\"SELECT 1\"", rollbackPlan: { command: `curl -fsS ${nginxUrl}` } }, ok: [200, 201] }));
  if (run.status !== "completed" || restore.status !== "completed") throw new Error(`backup/restore not completed: ${run.status}/${restore.status}`);
  return { planId: plan.id, runId: run.id, runStatus: run.status, restoreRunId: restore.id, restoreStatus: restore.status };
}

async function rollbackFlow(auth, ids, runId) {
  const body = { dryRun: false, queue: true, maxAttempts: 1, confirmationText: "G003 Docker Staging", postRollbackSmokeCheck: true, postRollbackSmokeDryRun: true, postRollbackSmokeHealthCheckUrl: nginxUrl };
  let rollback = unwrap(await api("POST", `/deployments/runs/${runId}/rollback`, { auth, body, ok: [200, 201] }));
  if (rollback.status === "blocked" && rollback.operationApproval?.id) {
    await api("POST", `/operation-approvals/${rollback.operationApproval.id}/review`, { auth, body: { decision: "approved", reviewComment: "Docker staging rollback approval" }, ok: [200, 201] });
    rollback = unwrap(await api("POST", `/deployments/runs/${runId}/rollback`, { auth, body: { ...body, approvalId: rollback.operationApproval.id }, ok: [200, 201] }));
  }
  const pulled = await taskPull(auth, ids, "rollback-task-pull");
  return { rollbackRunId: rollback.id, status: rollback.status, taskPullLog: pulled.log };
}

async function observability(auth) {
  const [jobs, logs, monitoring, audits, minioRes, dockerProxyRes] = await Promise.all([
    api("GET", "/server-execution-jobs", { auth }),
    api("GET", "/logs/streams", { auth }),
    api("GET", "/monitoring/service-slo/dashboard", { auth }),
    api("GET", "/audit-events", { auth }),
    fetch("http://127.0.0.1:9100/minio/health/live").then((r) => r.status).catch(() => "error"),
    fetch("http://127.0.0.1:2376/version").then((r) => r.status).catch(() => "error"),
  ]);
  return { jobs: unwrap(jobs).length ?? 0, logsStatus: logs.status, monitoringStatus: monitoring.status, auditEvents: unwrap(audits).length ?? 0, minioStatus: minioRes, dockerProxyStatus: dockerProxyRes };
}
