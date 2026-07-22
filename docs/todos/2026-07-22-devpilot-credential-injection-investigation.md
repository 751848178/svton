# Devpilot Credential Injection into Picshare Deployment — Investigation

Date: 2026-07-22
Scope: design how devpilot's deployment flow injects **platform-provisioned** resource
credentials (MySQL/Redis delivered via `ResourceRequest`) into picshare's deployment via a
`.env` file, so picshare consumes platform-managed databases instead of its own self-started
`mysql`/`redis` containers.
Investigator: invest subagent (read-only). No code modified. Every claim cites `file:line`.

> Correction to prior investigations: earlier docs (`2026-07-22-picshare-full-integration-investigation.md:235-239, 678-682`)
> claimed pool provisioning was "non-executing / fake credentials". That is **outdated**. The
> current code does real `CREATE DATABASE / CREATE USER / GRANT` against the pool endpoint and
> persists the generated password encrypted. See §3.

---

## 0. Executive summary (15 lines)

1. **The password IS recoverable.** It is persisted AES-256-GCM-encrypted in
   `ResourceInstance.credentials` at provisioning time
   (`resource-request-status-writer.service.ts:142-144`), split out of `delivery` by
   `splitDeliveryAndCredentials` (`resource-provisioning-sensitive.utils.ts:14-29`) because the
   field `password` is marked `sensitive: true` in the delivery schema
   (`resource-type-defaults.constants.ts:49,106`). It is NOT lost after the one-time return.
2. Decryption already has a public resolver: `ResourceRequestService.getInstanceCredentialForGeneration(teamId, instanceId)`
   (`resource-request-instance.service.ts:50-66`) returns `{ id, type, name, config: {...delivery, ...credentials} }`
   with the password decrypted. This is the exact entry point to reuse.
3. **Env-var generation also already exists**: `ResourceType.envTemplate` ships ready-made
   templates for MySQL (`DATABASE_URL="mysql://${username}:${password}@${host}:${port}/${database}"`,
   `resource-type-defaults.constants.ts:53`) and Redis (`REDIS_HOST/PORT/PASSWORD/DB`, `:110`),
   and `registry.service.ts:323-333` is the proven `${key}`-interpolation precedent.
4. **Recommended `.env` mechanism**: write the file over SSH to a path **inside the deploy
   `workingDirectory`** (so Compose auto-loads it) using a **fixed-shape heredoc command** whose
   literal body is `cat > .env <<'EOF' ... EOF` — but the secret values must be supplied via a
   step field that is **never persisted** (new `secretEnv` payload on the step), and the rendered
   command stored in `commandPlan` must be redacted. See §4, §6.
5. **Code changes are small and localized**: ~4 files in `apps/devpilot-api/src` (1 new util +
   edits to `deployment-command-builders.utils.ts`, `deployment.service.ts`,
   `deployment.module.ts`, and 1 new command-policy rule constant). Roughly 250-350 net lines.
6. **picshare changes**: 1 file — `picshare/docker-compose.devpilot.yml` — remove `mysql` +
   `redis` services, variabilize `DATABASE_URL`/`REDIS_HOST` to `${...}`, drop the
   `depends_on: mysql/redis`. No picshare application code changes.
7. **Key risk #1 — credential leakage in logs/`commandPlan`**: the SSH runner persists
   `input.steps` verbatim into `DeploymentRun.commandPlan` (`script-plan.adapter.ts:149`,
   `ssh-live-completed-result.utils.ts:26`) and the command-policy decision includes the full
   command text (`server-command-policy.service.ts:97,113,169-176`). A naive `echo "pw=..." > .env`
   step leaks the password into the DB. Mitigation: secret-aware step field + redaction.
8. **Key risk #2 — command policy blocks the step**: the policy is a strict regex allowlist
   (`server-command-policy.service.ts:136-176`). No existing rule matches a file-write heredoc, so
   the step is blocked unless we add a built-in rule or a team template pattern.
9. **Key risk #3 — first-deploy schema**: picshare's backend Dockerfile auto-runs
   `prisma migrate deploy` against `DATABASE_URL` on boot; the platform-provisioned `db_picshare`
   starts empty, so migration must succeed on first start (it will — Prisma replays pending
   migrations; the dedicated DB is isolated so no cross-talk).
10. **Genuine blocker**: none for the design. The only hard prerequisite that is environmental
    (not code) is that `SERVER_EXECUTOR_LIVE_ENABLED=true` for the live SSH write to actually
    happen; the dry-run path generates the redacted plan regardless.
11. Querying the right ResourceInstance: filter `ResourceInstance` by `teamId + projectId +
    environmentId + resourceType.key ∈ {mysql, redis} + status='active'`
    (`schema.prisma:1232-1263` indexes support this; `resource-request-instance.service.ts:25-36`
    already builds this `where` shape for `listInstances`).
12. The `ApplicationService` already has the three fields the brief mentions (`env Json?`,
    `secretKeyIds Json?`, `managedResourceId String?`, `schema.prisma:840,846,847`) — they are the
    natural binding points but are **not** required for the minimal slice; env can be derived
    purely from the project+environment's ResourceInstances.
13. Recommended phasing: Phase 1 = secret-safe `.env` injection for the pool-provisioned path
    (MySQL+Redis) with redaction; Phase 2 = also fold `SecretKey` rows (`secretKeyIds`) and
    `ApplicationService.env` into the same `.env`; Phase 3 = cleanup/rotation.
14. The deploy command stays `docker compose -f docker-compose.devpilot.yml up -d --build backend`
    — Compose automatically reads a `.env` file in the working directory for `${VAR}`
    interpolation, so no `--env-file` flag is needed.
15. Adversarial alternatives (SDK / Nacos / runtime secret fetch) are rejected in §10: they either
    don't exist in the stack, require picshare code changes, or break the "platform injects at
    deploy time" contract.

---

## 1. Current flow analysis — the confirmed gap (cited)

### 1.1 picshare ships its own DB containers + hardcoded `DATABASE_URL`

`picshare/docker-compose.devpilot.yml`:

- Declares its own `mysql` service (`picshare/docker-compose.devpilot.yml:5-28`) with
  `MYSQL_ROOT_PASSWORD: picshare_root`, `MYSQL_DATABASE: picshare`, `MYSQL_USER: picshare`,
  `MYSQL_PASSWORD: picshare_pw` (`:13-17`).
- Declares its own `redis` service (`:30-44`).
- `backend.environment.DATABASE_URL` is **hardcoded** to
  `mysql://picshare:picshare_pw@picshare-mysql:3306/picshare?...` (`:63`).
- `backend.environment.REDIS_HOST` is **hardcoded** to `picshare-redis` (`:76`).
- `backend.depends_on.mysql` + `backend.depends_on.redis` with `condition: service_healthy`
  (`:53-57`) — so picshare literally cannot start without its own containers.

### 1.2 ResourceRequest delivery carries the real platform credentials (but deployment ignores them)

The brief states a delivery example: `host: devpilot-g003-mysql, database: db_picshare,
username: user_db_picshare`. That shape is exactly what the platform produces
(`resource-pool-mysql-provisioning.utils.ts:56-81`): `database = resourceName` (e.g. `db_<hex>`),
`username = user_<resourceName>`, plus a generated `password`.

`DeploymentService.createRun` (`deployment.service.ts:216-532`) builds the command plan with
`buildCommandSteps(deployment, gitRepo, branch)` (`:269`) and **never consults** any
ResourceRequest / ResourceInstance / SecretKey. The plan is purely:

| step          | command                                                                  | file:line |
|---------------|--------------------------------------------------------------------------|-----------|
| checkout      | `git fetch --all --prune && git checkout <branch> && git pull`           | `deployment-command-builders.utils.ts:32` |
| build         | `deployment.buildCommand`                                                | `:33` |
| deploy        | `deployment.deployCommand`                                               | `:34` |
| health_check  | `curl -fsS <healthCheckUrl>`                                             | `:35` |

There is **no step** that writes a `.env` or otherwise injects credentials.

### 1.3 `ApplicationService` binding fields are present but unused

`schema.prisma:832-882`:
- `env Json?` (`:846`)
- `secretKeyIds Json?` (`:847`)
- `managedResourceId String?` (`:840`)

All three are the natural anchors for "this service depends on these platform resources /
secrets", and the prior investigation confirmed they are NULL for picshare today
(`2026-07-22-picshare-full-integration-investigation.md:66-67`). They are not strictly required
for the minimal slice (§7) but should be populated for traceability.

---

## 2. Deployment flow deep dive (A)

### 2.1 `createRun` → execution input → `serverExecutor.execute()`

`DeploymentService.createRun` (`deployment.service.ts:216`):

1. Loads project + config (`:222-231`), refuses `managementScope === 'resources'` (`:239-241`).
2. Resolves application / applicationService / environment / target server (`:243-266`).
3. Merges the deployment config from 4 precedence layers via `resolveDeploymentConfig`
   (`:250-254`, defined `:2027-2067`): `dto.overrides` > `applicationService.deployConfig` >
   `project.config.deployment` > `project.config.stackProfile`. Recognised fields: `targetType`,
   `workingDirectory`, `buildCommand`, `deployCommand`, `rollbackCommand`, `healthCheckUrl`
   (`deployment-command-builders.utils.ts:9-16`).
4. Builds the steps: `const steps = buildCommandSteps(deployment, gitRepo, branch)` (`:269`).
5. Creates the `DeploymentRun` row (`:302-330`).
6. Builds `executionInput` (`:396-424`) carrying `{ teamId, userId, operationKey, adapterKey,
   dryRun, target, steps, warnings, metadata, blockOnWarnings, requiredConfirmationText,
   confirmationText }`.
7. Either `serverExecutor.queueExecution(executionInput, …)` (`:427`) when `queue:true`, or
   `serverExecutor.execute(executionInput)` (`:481`). The result updates the run's `status`,
   `commandPlan`, `logs`, `result`, `error` (`:484-495`).

**Injection point:** between step 3 and step 4 — resolve platform credentials and pass them into
`buildCommandSteps` (new param) so it can emit an `.env`-writing step before `deploy`.

### 2.2 Can we add a pre-deploy step that writes `.env`? Yes.

`buildCommandSteps` is a **pure function** returning `ServerCommandStep[]`
(`deployment-command-builders.utils.ts:30-37`). Adding a step is trivial — insert one between
`build` and `deploy`. Two candidate command shapes:

- Heredoc (preferred, multiline-safe):
  ```
  cat > .env <<'DEVPILOT_EOF'
  DATABASE_URL=mysql://user_db_picshare:<pw>@devpilot-g003-mysql:3306/db_picshare
  REDIS_HOST=devpilot-g003-redis
  REDIS_PORT=6379
  REDIS_PASSWORD=<redis-pw>
  REDIS_DB=3
  DEVPILOT_EOF
  ```
- Single-line `printf` (matches an allowlist regex more easily, but values with special chars
  need quoting).

The step's `cwd` MUST equal `deployment.workingDirectory` (same as the `deploy` step) so the
`.env` lands where `docker compose -f docker-compose.devpilot.yml …` runs — Compose reads `.env`
from the current working directory by default.

### 2.3 `ServerCommandStep` shape — and the secret-leak problem

`server-executor.types.ts:58-67`:

```ts
type ServerCommandStep = {
  key: string;
  label: string;
  command: string;
  cwd?: string;
  required: boolean;
  risk?: "low" | "medium" | "high";
  timeoutSeconds?: number;
  preview?: string;
};
```

**There is no "credential-sensitive / do-not-log" flag.** `preview` exists but is cosmetic. This
matters because:

- The plan builder persists `input.steps` verbatim into `commandPlan`
  (`script-plan.adapter.ts:118-151`, specifically `steps: input.steps` at `:149`).
- `buildSshLivePlan` (referenced from `ssh-live.adapter.ts:57`) likewise embeds the steps.
- The command-policy decision record stores `command: step.command` in full
  (`server-command-policy.service.ts:97,113,169-176`).
- `DeploymentRun.commandPlan` is a persisted JSON column (`schema.prisma:968`).

So if we put `DATABASE_URL=mysql://...:<real-password>@...` directly into `step.command`, the
password lands in the database. **This is the single most important design constraint** — see §6.

**Required extension to `ServerCommandStep`**: add an optional `secretEnv?: Record<string,string>`
field (or `secretScript?: string` rendered server-side and never persisted). The step's persisted
`command` becomes a redacted placeholder; the executor expands `secretEnv` into the heredoc body
only at the moment it builds the real SSH script. Details in §4/§6.

### 2.4 How `serverExecutor.execute()` runs steps — sequential SSH, file persists across steps

Adapter selection (`server-executor-execution-runtime.service.ts` via
`server-executor.service.ts:120-122`): the first adapter whose `supports()` returns true wins.
Three adapters exist:

| adapter       | supports() true when | file |
|---------------|----------------------|------|
| `ssh-live`    | `transport==='ssh' && dryRun===false && SERVER_EXECUTOR_LIVE_ENABLED==='true'` | `ssh-live.adapter.ts:38-50` |
| `server-agent`| `transport==='server_agent'` (only with `SERVER_EXECUTOR_AGENT_TARGET_ENABLED==='true'`) | `server-agent.adapter.ts` |
| `script-plan` | `transport==='ssh' \|\| 'none'` (always; the planner/dry-run) | `script-plan.adapter.ts:15-17` |

For a **live** deploy, `ssh-live` runs. It calls `runSshLiveScript`
(`ssh-live.adapter.ts:107-112`), which calls `buildSshLiveRemoteWrappedScript(input)`
(`ssh-live-runner.utils.ts:37`). That builder (`ssh-live-script.utils.ts:4-17`) concatenates all
step commands into a single bash script:

```bash
set -euo pipefail
# <step.label>
cd '<cwd>'
<step.command>
# <next.label>
...
```

then wraps it in a `mktemp` heredoc + `setsid bash` (`ssh-live-script.utils.ts:19-57`). The whole
script runs as one SSH `execScript` call (`ssh-live-runner.utils.ts:92-101`).

**Consequence:** steps run sequentially in the same shell on the same host. A file written in step
N (`.env`) is present on disk for step N+1 (`docker compose …`). The cwd persists via the explicit
`cd` line emitted per step. So writing `.env` in a pre-deploy step **does** work with the existing
executor — no executor change needed for the file-write mechanism itself, only for the
secret-redaction concern.

Stdout/stderr are streamed (`ssh-live-runner.utils.ts:95-99`) and the truncated result is stored
in `DeploymentRun.logs` + `result.stdoutPreview/stderrPreview`
(`ssh-live-completed-result.utils.ts:27-58`). So any command that `echo`s a secret to stdout also
leaks via logs — another reason the heredoc body must not be logged (heredoc with quoted
delimiter `<<'EOF'` does not echo, so it is safe from stdout leakage; the leak vector is purely
the persisted `command`/`commandPlan`).

---

## 3. Credential resolution (B) — the password question, answered

### 3.1 The provisioning pipeline persists the password, encrypted

End-to-end (pool provisioning path, which is what produces the `db_picshare`-style delivery):

1. `ResourceRequestPoolProvisioningService.provisionFromPool`
   (`resource-request-pool-provisioning.service.ts:34-123`) calls
   `resourcePoolService.allocateResource(…)` (`:67-71`).
2. `ResourcePoolAllocationLifecycleService.allocateResource`
   (`resource-pool-allocation-lifecycle.service.ts:27-98`) calls
   `provisioningService.provisionResource(pool, resourceName)` (`:49-52`) which, for `mysql`,
   invokes `provisionMysqlDatabase` (`resource-pool-provisioning.service.ts:61-70`).
3. `provisionMysqlDatabase` (`resource-pool-mysql-provisioning.utils.ts:52-85`) connects to the
   pool admin endpoint, runs `CREATE DATABASE / CREATE USER … IDENTIFIED BY ? / GRANT / FLUSH`
   (`:70-80`) with a parameter-bound generated password (`password = opts.password ??
   generateMysqlPassword()` at `:59`, `generateMysqlPassword()` = `randomBytes(16).toString('hex')`
   at `:48-50`), and returns `{ host, port, database, username, password }` (`:81`).
4. Back in the lifecycle service, the full credentials JSON (incl. password) is AES-encrypted into
   `ResourceAllocation.credentials`:
   `encryptedCredentials: this.cryptoService.encryptCbc(JSON.stringify(credentials))`
   (`resource-pool-allocation-lifecycle.service.ts:64-66`). So **`ResourceAllocation.credentials`
   holds the password, encrypted** (`schema.prisma:1130-1153`, `credentials String @db.Text`).
5. The plaintext credentials object is also returned to the pool-provisioning adapter
   (`resource-pool-allocation-lifecycle.service.ts:92-97` returns `{ id, type, resourceName,
   credentials }`).
6. The adapter splits delivery vs credentials via `splitDeliveryAndCredentials`
   (`resource-request-pool-provisioning.service.ts:83`):
   - `splitDeliveryAndCredentials(allocation.credentials, resourceType.deliverySchema)`
     (`resource-provisioning-sensitive.utils.ts:14-29`) partitions each key: if the key is in the
     schema's `sensitive` set OR matches `isImplicitSensitiveKey` (key contains `password` /
     `secret` / `token` / `accesskey` / `privatekey`, `:44-53`), it goes to `credentials`;
     otherwise to `delivery`.
   - The MySQL delivery schema marks `password` as `sensitive: true`
     (`resource-type-defaults.constants.ts:49`), so `password` → `credentials`, and `host/port/
     username/database` → `delivery`.
7. `completeProvisionedRequest` (`resource-request-status-writer.service.ts:122-183`) persists:
   - `ResourceInstance.delivery` = the non-sensitive fields (`:161` writes `delivery:
     input.delivery` into `request.result`; `:141` writes the same into the instance row).
   - `ResourceInstance.credentials` = `this.encrypt(JSON.stringify(input.credentials))` when
     non-empty (`:142-144`). Encryption is AES-256-GCM via `encryptCredential`
     (`resource-credential-crypto.utils.ts:14-21`) keyed by
     `configService.get('ENCRYPTION_KEY')` run through `scryptSync`
     (`resource-request-status-writer.service.ts:42-49`).
   - `ResourceRequest.result.delivery` = the same non-sensitive delivery (`:157-162`).

**Conclusion: the password is persisted, encrypted, in `ResourceInstance.credentials`.** It is
NOT ephemeral. Redis is symmetric: `provisionRedisDatabase` returns
`{ host, port, db, password, keyPrefix }` (`resource-pool-redis-provisioning.utils.ts:64`); the
Redis delivery schema marks `password` sensitive (`resource-type-defaults.constants.ts:106`), so
the Redis password is also persisted encrypted.

> Note on Redis specifically: today the Redis pool reuses the pool's `adminPassword` as the
> per-allocation password (`resource-pool-redis-provisioning.utils.ts:46`: `password =
> opts.adminPassword ?? ""`). So all Redis allocations on a given pool currently share one
> password. That is a pre-existing isolation weakness but not a blocker for injection — the
> persisted value is whatever provisioning produced.

### 3.2 How to find the ResourceInstance(s) for a project + environment

`ResourceInstance` carries `teamId, projectId, environmentId, resourceTypeId, status, requestId`
(`schema.prisma:1232-1263`) with indexes on each (`:1258-1262`). The existing
`ResourceRequestInstanceService.listInstances(teamId, query)` builds exactly the needed `where`
(`resource-request-instance.service.ts:25-36`): `{ teamId, projectId?, environmentId?,
resourceTypeId?, status? }`. So the deploy-time resolver is:

```
find ResourceInstance where
  teamId    = run.teamId
  projectId = run.projectId
  environmentId = run.environmentId
  resourceType.key IN ('mysql','redis')   // joined via resourceTypeId → ResourceType.key
  status    = 'active'
```

Order by `createdAt desc` and take the most recent per type. (If multiple, prefer the one whose
`requestId` is referenced by the `ApplicationService.managedResourceId` chain — optional refinement.)

### 3.3 How to decrypt and read the password at deploy time

Reuse the existing public resolver — **do not** re-implement decryption:

`ResourceRequestService.getInstanceCredentialForGeneration(teamId, instanceId)`
(`resource-request.service.ts:98-99` → `resource-request-instance.service.ts:50-66`):

```ts
const delivery = (instance.delivery && typeof instance.delivery === 'object') ? instance.delivery : {};
const credentials = instance.credentials
  ? JSON.parse(this.statusWriter.decrypt(instance.credentials))
  : {};
return { id, type, name, config: { ...delivery, ...credentials } };
```

So one call returns a merged `config` map containing `host, port, database, username, password`
(for MySQL) or `host, port, db, password, keyPrefix` (for Redis) — exactly the keys the
`envTemplate` placeholders expect. `ResourceRequestModule` exports `ResourceRequestService`
(`resource-request.module.ts:67`), so the deployment module can import it.

`generator.service.ts:221-232` is the precedent consumer — it already calls
`getInstanceCredentialForGeneration` and pushes `{ type, config, mode: 'instance' }` into a
credential list. We mirror that pattern.

### 3.4 Do we additionally need a `SecretKey` row at provisioning time? No — but optionally yes.

The brief's question B7 asks whether we should write the DB password into a `SecretKey` at
provisioning time so it can be referenced at deploy time. **Not required**: `ResourceInstance`
already persists it encrypted (§3.1) and has a decrypting resolver (§3.3). Creating a duplicate
`SecretKey.database_password` would be redundant storage and a rotation hazard.

However, `KeyCenterService.exportAsEnv(teamId, projectId, keyIds?)` (`key-center.service.ts:277-294`)
already renders a `.env` from `SecretKey` rows, and `ApplicationService.secretKeyIds Json?`
(`schema.prisma:847`) is the link. **Phase 2** can optionally unify everything (DB creds + JWT
secrets + API keys) through `SecretKey` so the `.env` is assembled from one source of truth. For
the minimal slice, derive DB/Redis from `ResourceInstance` and leave `SecretKey` for non-resource
secrets (JWT, COS, etc.).

### 3.5 What about `ApplicationService.env` (the third field)?

`ApplicationService.env Json?` (`schema.prisma:846`) is a free-form per-service env override blob.
The minimal slice can ignore it (resource creds come from `ResourceInstance`). Phase 2 merges
`service.env` literal values into the same `.env` so operators can hardcode non-secret overrides
(`LOG_LEVEL`, `CORS_ORIGIN`, etc.) without editing picshare's compose.

---

## 4. `.env` injection design (C)

### 4.1 Docker Compose `.env` behavior — confirmed

Docker Compose automatically reads a `.env` file in the **project directory** (the cwd of the
`docker compose` invocation) and uses it for `${VAR}` interpolation in the compose file and for
variable expansion in `environment:` values. The picshare deploy command is
`docker compose -f docker-compose.devpilot.yml up -d --build backend` with
`cwd = deployment.workingDirectory` (the bind-mounted `/Users/zhaoxingbo/Workspace/ai-driven/picshare`,
per `docker-compose.deploy-target.yml:59`). Writing `.env` to that cwd before the `deploy` step is
sufficient — no `--env-file` flag needed.

### 4.2 Mechanism comparison

| Mechanism | Pros | Cons | Verdict |
|-----------|------|------|---------|
| `.env` in cwd (auto-loaded) | Zero compose changes; survives across the deploy step; Compose-native | Persists on the target disk after deploy | **Recommended** (with post-deploy cleanup step) |
| `--env-file /tmp/deploy.env` | Explicit; can live outside the repo; can be `rm`'d | Must be passed on every `docker compose` invocation; picshare compose would need the deploy command edited to include it | Rejected — fragile |
| `export VAR=… && docker compose …` | Transient | Visible in the command string → leaks into `commandPlan`/logs (`server-command-policy.service.ts:97`); also `export` in one SSH step does not survive into the next step's shell because each step re-emits `cd` but the heredoc runs in one process — actually variables DO persist within the single wrapped script, but the leakage risk is fatal | Rejected — leaks secrets |
| Docker secrets / `secrets:` block | Cleanest at runtime | Requires compose changes AND swarm/`docker run --secret` support; picshare app must read `/run/secrets/*`; out of scope | Rejected (Phase 3) |

**Decision: `.env` in cwd, written by a dedicated pre-deploy step, redacted in all persisted
artifacts, and removed by a post-deploy cleanup step (best-effort).**

### 4.3 Concrete step design (secret-safe)

Introduce a new step type extension. Minimal change to `ServerCommandStep`
(`server-executor.types.ts:58-67`) — add one optional field:

```ts
type ServerCommandStep = {
  key: string;
  label: string;
  command: string;
  cwd?: string;
  required: boolean;
  risk?: "low" | "medium" | "high";
  timeoutSeconds?: number;
  preview?: string;
  /** NEW: secret values rendered into `command` only at execution time.
   *  Persisted plans store `command` with placeholders, never these values. */
  secretEnv?: Record<string, string>;
};
```

The `.env`-write step is built as:

- `key: 'write_env_file'`
- `label: '生成 .env (平台凭据注入)'`
- `cwd: deployment.workingDirectory`
- `required: false` (so a service without platform resources still deploys)
- `risk: 'high'` (it writes secrets to disk)
- `command`: a **redacted template** stored/persisted, e.g.:
  ```
  cat > .env <<'DEVPILOT_EOF'
  DATABASE_URL=***REDACTED***
  REDIS_HOST=***REDACTED***
  REDIS_PORT=***REDACTED***
  REDIS_PASSWORD=***REDACTED***
  REDIS_DB=***REDACTED***
  DEVPILOT_EOF
  ```
- `secretEnv`: the real `{ DATABASE_URL, REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_DB }` map,
  held in memory only.

At execution time (`buildSshLiveScript` / `buildSshLiveRemoteWrappedScript`), the adapter
substitutes each `***REDACTED***`-style line (or, more robustly, regenerates the heredoc body from
`secretEnv` directly) so the real SSH script carries the true values. Because the SSH script is
built in-memory and sent over the SSH channel (`ssh-live-runner.utils.ts:37,92`), and the heredoc
body is never echoed, the secret never enters `stdout`/`stderr`. The persisted `commandPlan`
keeps the redacted template.

A symmetric **post-deploy cleanup step** (`key: 'cleanup_env_file'`,
`command: 'rm -f .env'`, `risk: 'low'`) removes the file after `docker compose up` has read it.
This is best-effort: if the deploy fails before cleanup, the `.env` remains on the target —
acceptable because the target is already a trusted host that holds the running containers, and the
`.env` is owned by the deploy user. (Hardening option: write to `.env` with `chmod 600` and a
`trap 'rm -f .env' EXIT` in the wrapped script — Phase 2.)

### 4.4 Why not put secrets in `step.command` directly? (rejected)

Because `commandPlan` = `input.steps` (`script-plan.adapter.ts:149`) and is persisted into
`DeploymentRun.commandPlan` (`deployment.service.ts:489`; `schema.prisma:968`). The password would
be at rest in plaintext JSON in the devpilot MySQL. Unacceptable. The `secretEnv` split is
mandatory.

---

## 5. Compose changes for picshare (D)

Single file: `picshare/docker-compose.devpilot.yml`.

### 5.1 Remove the self-managed DB services

Delete the entire `mysql:` block (`picshare/docker-compose.devpilot.yml:5-28`) and the entire
`redis:` block (`:30-44`). Also delete the `picshare_mysql_data` / `picshare_redis_data` volumes
(`:122-124`) — they are no longer referenced. (Keep them only if you want a rollback path; safer
to remove so there is no ambiguity about which DB picshare uses.)

### 5.2 Variabilize the backend env

`backend.environment`:

| field | current (hardcoded) | new (variabilized) | line |
|-------|---------------------|--------------------|------|
| `DATABASE_URL` | `mysql://picshare:picshare_pw@picshare-mysql:3306/picshare?...` | `${DATABASE_URL}` | `:63` |
| `REDIS_HOST` | `picshare-redis` | `${REDIS_HOST}` | `:76` |
| `REDIS_PORT` | `'6379'` | `${REDIS_PORT}` | `:77` |
| `REDIS_PASSWORD` | `''` | `${REDIS_PASSWORD}` | `:78` |
| `REDIS_DB` | `'2'` | `${REDIS_DB}` | `:79` |

The other backend env (`JWT_SECRET`, `CORS_ORIGIN`, `STORAGE_TYPE`, COS vars, SMS, WeChat) stays
as-is for Phase 1; Phase 2 can variabilize `JWT_SECRET` to `${JWT_SECRET}` and source it from a
`SecretKey`.

Provide safe defaults via `${VAR:-default}` so a manual `docker compose up` (without devpilot)
still works:
```
DATABASE_URL: ${DATABASE_URL:-mysql://picshare:picshare_pw@picshare-mysql:3306/picshare?connection_limit=10}
REDIS_HOST: ${REDIS_HOST:-picshare-redis}
REDIS_PORT: ${REDIS_PORT:-6379}
REDIS_PASSWORD: ${REDIS_PASSWORD:-}
REDIS_DB: ${REDIS_DB:-2}
```

### 5.3 Drop the `depends_on` for the removed services

`backend.depends_on.mysql` + `backend.depends_on.redis` (`picshare/docker-compose.devpilot.yml:53-57`)
must go (the services no longer exist). `admin.depends_on.backend` (`:104-106`) stays — admin still
waits for backend health.

> Note: removing `depends_on: mysql (service_healthy)` means picshare-backend may start before the
> platform MySQL is ready. Mitigation: the backend Dockerfile already runs `prisma migrate deploy`
> on boot with retry-friendly Prisma defaults; the existing `healthcheck.start_period: 90s`
> (`:93`) covers first-boot migration. If the platform DB is momentarily unreachable, the
> `restart: unless-stopped` policy (`:52`) will retry. Acceptable.

### 5.4 prisma migrate against the new `db_picshare`

`apps/backend/Dockerfile` CMD is `prisma migrate deploy --schema=./prisma/schema.prisma; node dist/src/main`
(cited in `2026-07-22-picshare-deployment-investigation.md:243-245`). The Prisma `datasource` reads
`env("DATABASE_URL")` (`apps/backend/prisma/schema.prisma:5-7`). With the variabilized
`DATABASE_URL` pointing at the platform `db_picshare`:

- First boot: `db_picshare` is empty (freshly `CREATE DATABASE`'d by the pool provisioning).
  `prisma migrate deploy` replays all 15 pending migrations from `prisma/migrations/` — succeeds,
  creates tables. No cross-talk because the DB is dedicated.
- Subsequent boots: `migrate deploy` is idempotent (applies only pending migrations).

No picshare code change required. The only requirement is that the provisioned DB user
(`user_db_picshare`) has `GRANT ALL` on `db_picshare.*` — which `provisionMysqlDatabase` guarantees
(`resource-pool-mysql-provisioning.utils.ts:77-79`).

---

## 6. Security (E) — credential leakage prevention

### 6.1 Leak surfaces and mitigations

| Surface | How secret could leak | Mitigation |
|---------|----------------------|------------|
| `DeploymentRun.commandPlan` | `steps[].command` persisted verbatim (`script-plan.adapter.ts:149`) | Store **redacted template** in `command`; real values only in transient `secretEnv` (§4.3) |
| Command-policy decision record | `decision.command = step.command` (`server-command-policy.service.ts:97,113`) | Same — policy evaluates the redacted template; the redacted shape must match the allowlist regex (§6.3) |
| `DeploymentRun.logs` / `result.stdoutPreview` | A step echoes the secret to stdout | Heredoc with quoted delimiter `<<'DEVPILOT_EOF'` does not echo; never `echo "$PW"`; never `set -x` |
| `DeploymentRun.result.stderrPreview` | `cat > .env` on a permission error could print the redirect target (not the body) | Ensure cwd is writable; the heredoc body itself is not on stderr |
| Target filesystem (`.env` at rest) | File persists after deploy | Post-deploy `rm -f .env` step; `chmod 600` at write time; `trap 'rm -f .env' EXIT` in the wrapper (Phase 2) |
| Devpilot API process memory | `secretEnv` held in memory between resolve and execute | Acceptable — short-lived; same trust level as the existing `getInstanceCredentialForGeneration` decryption |
| Audit events | `auditEventService.create` metadata (`deployment.service.ts:497-525`) | Do NOT put `secretEnv` into audit metadata; only put a redacted summary like `{ envVarsInjected: ['DATABASE_URL','REDIS_HOST',...] }` |

### 6.2 The redacted-template contract

The persisted `step.command` for the `.env` write step must:
1. Contain **no real secret** — only the variable names and a sentinel like `***REDACTED***` or an
   empty value.
2. Still be a valid, runnable shell command shape so the command-policy regex can match it
   deterministically (the regex matches the **redacted** form; the executor substitutes real values
   only after policy passes).
3. Be rebuildable from `secretEnv` at execution time without re-deriving the secrets.

Implementation: the builder constructs the real heredoc body in-memory, then produces the redacted
mirror by replacing each `secretEnv` value with `***REDACTED***`. The adapter's script builder
re-substitutes at the last moment. (Equivalently: the adapter ignores `step.command` for
`secretEnv`-bearing steps and rebuilds the heredoc purely from `secretEnv` keys + cwd.)

### 6.3 Command-policy rule for the new step

The policy is a strict allowlist (`server-command-policy.service.ts:136-176`): a step is blocked
unless its command matches a built-in rule (`server-command-policy-rules.constants.ts` /
`server-command-policy-deployment-rules.constants.ts`) OR a team template `allowedPattern`
(`server-command-policy-template-matcher.service.ts`). The existing deployment rules
(`server-command-policy-deployment-rules.constants.ts:3-51`) cover only `curl`, `git`, node build,
`docker build`, `docker compose …`. None matches a heredoc file write.

Two options:

- **Option A (recommended): new built-in rule.** Add to
  `server-command-policy-deployment-rules.constants.ts`:
  ```ts
  {
    key: "write-env-file",
    description: "Write redacted .env file (secrets injected at execution time)",
    adapters: ["deployment-script-plan"],
    operations: ["deployment.run", "deployment.rollback"],
    // Matches the REDACTED template only; real values never reach the policy.
    pattern: /^cat > \.env <<'DEVPILOT_EOF'(\n[A-Z_0-9]+=\*\*\*REDACTED\*\*\*)+\nDEVPILOT_EOF$/,
  },
  ```
  Plus a rule for the cleanup step:
  ```ts
  {
    key: "remove-env-file",
    description: "Remove .env file after deployment",
    adapters: ["deployment-script-plan"],
    operations: ["deployment.run", "deployment.rollback"],
    pattern: /^rm -f \.env$/,
  },
  ```
  The regex anchors the redacted form, so an attacker cannot smuggle arbitrary content — the
  policy only ever sees `***REDACTED***` placeholders.

- **Option B: team template.** Create a `ServerCommandPolicyTemplate` (there is already one for
  picshare: `cmrvcmd78001edq6bdhadofkq`, per
  `2026-07-22-picshare-full-integration-investigation.md:68`) with an `allowedPatterns` entry
  matching the same redacted shape. No core code change to the rule constants, but every team must
  author it themselves.

**Decision: Option A** — ship the built-in rule so the capability is safe-by-default; teams can
still tighten with templates.

---

## 7. Code change list (F)

### 7.1 `apps/devpilot-api/src/` (devpilot side)

| File | Change | Approx. size | New? |
|------|--------|--------------|------|
| `deployment/deployment-env-injection.utils.ts` | **NEW**. Pure helpers: (a) `resolvePlatformCredentials({ prisma, teamId, projectId, environmentId })` → queries active `ResourceInstance` rows for `mysql`+`redis` resource types, decrypts via `ResourceRequestService.getInstanceCredentialForGeneration`, returns a `{ DATABASE_URL?, REDIS_HOST?, REDIS_PORT?, REDIS_PASSWORD?, REDIS_DB?, ... }` map by interpolating each instance's `config` through its `ResourceType.envTemplate` (reuse the `registry.service.ts:323-333` algorithm). (b) `buildEnvWriteStep(cwd, envMap)` + `buildEnvCleanupStep(cwd)` → return the redacted-template `ServerCommandStep` with `secretEnv` populated. (c) `redactEnvCommand(envMap)` → produces the persisted redacted `command`. | ~150 lines | NEW |
| `deployment/deployment-command-builders.utils.ts` | Extend `buildCommandSteps`/`buildRollbackCommandSteps` signatures to accept an optional `envInjection?: { writeStep: ServerCommandStep; cleanupStep: ServerCommandStep }` param; insert `writeStep` between `build` and `deploy`, and `cleanupStep` after `deploy` (before `health_check`). Pure functions, fully testable. | ~30 lines edit | existing |
| `deployment/deployment.service.ts` | In `createRun` (around `:269`) and `rollbackRun` (around `:592`): after resolving `deployment`, call `resolvePlatformCredentials(...)`; if it returns a non-empty map, build the write/cleanup steps and pass them into `buildCommandSteps`. Thread `teamId`, `projectId`, `environmentId` (already available: `:307-309` for createRun; `:632` for rollback). Also add a redacted `envVarsInjected: [...]` entry to the audit metadata (`:513-524`) — never the values. | ~40 lines edit | existing |
| `deployment/deployment.module.ts` | Add `ResourceRequestModule` to `imports` (`:13`) so `ResourceRequestService` is injectable into `DeploymentService`. (KeyCenterModule only needed in Phase 2.) | 1 line edit | existing |
| `server-executor/server-executor.types.ts` | Add `secretEnv?: Record<string, string>` to `ServerCommandStep` (`:58-67`). | 2 lines edit | existing |
| `server-executor/adapters/ssh-live-script.utils.ts` | In `buildSshLiveScript` (`:4-17`), when a step has `secretEnv`, emit the real heredoc body from `secretEnv` (keys sorted) instead of `step.command`. The redacted `step.command` is what gets persisted upstream; the SSH script gets the real values. | ~20 lines edit | existing |
| `server-executor/server-command-policy-deployment-rules.constants.ts` | Add `write-env-file` + `remove-env-file` rules (§6.3). | ~20 lines edit | existing |
| `deployment/deployment.service.spec.ts` + new `deployment-env-injection.utils.spec.ts` | Unit tests: resolver picks the right instance by type; envTemplate interpolation; redaction; step ordering; policy passes on redacted form. | ~120 lines | mixed |

**Total devpilot-side: ~7 existing files edited + 1 new file + tests, roughly 300-400 net lines.**

### 7.2 `picshare/` (picshare side)

| File | Change | Approx. size |
|------|--------|--------------|
| `picshare/docker-compose.devpilot.yml` | Remove `mysql` + `redis` service blocks (`:5-44`); remove `picshare_mysql_data` + `picshare_redis_data` volumes (`:122-124`); variabilize `DATABASE_URL`/`REDIS_*` with `${VAR:-default}` (`:63,76-79`); remove `backend.depends_on.mysql/redis` (`:53-57`). | ~50 lines removed, ~6 lines edited |

**No picshare application code changes.** The backend reads `DATABASE_URL` from env (Prisma
datasource + `process.env`); the admin is unaffected.

### 7.3 Out of scope (Phase 2/3)

- Folding `ApplicationService.env` + `secretKeyIds` (SecretKey rows) into the same `.env`.
- `trap 'rm -f .env' EXIT` hardening in the SSH wrapper.
- Redis per-allocation password isolation (currently shared pool password,
  `resource-pool-redis-provisioning.utils.ts:46`).
- Rotating/re-deriving credentials on demand.

---

## 8. Implementation plan (phased, with acceptance criteria)

### Phase 1 — Platform-credential `.env` injection (the slice)

1. **Schema/types**: add `secretEnv?` to `ServerCommandStep`
   (`server-executor/server-executor.types.ts`).
2. **New util** `deployment-env-injection.utils.ts`: resolver + step builders + redactor (pure).
3. **Policy rules**: add `write-env-file` + `remove-env-file` to
   `server-command-policy-deployment-rules.constants.ts`.
4. **Builder wiring**: extend `buildCommandSteps`/`buildRollbackCommandSteps` with optional
   `envInjection`; update `deployment.service.ts` to resolve + inject; update
   `deployment.module.ts` to import `ResourceRequestModule`.
5. **SSH expansion**: update `buildSshLiveScript` to render `secretEnv` into the real heredoc.
6. **picshare compose**: edit `docker-compose.devpilot.yml` per §5.
7. **Tests**: resolver, interpolation, redaction, step order, policy-pass-on-redacted.

**Acceptance criteria:**
- A dry-run `DeploymentRun` for picshare's backend service produces a `commandPlan` whose
  `write_env_file` step shows `***REDACTED***` for every secret and never contains the real
  password in any persisted column (`commandPlan`, `logs`, `result`, audit `metadata`).
- The `write_env_file` step's redacted command matches the `write-env-file` policy rule
  (`decisions[].status === 'allowed'`).
- Given a completed `ResourceRequest` (mysql + redis) for picshare's project+environment, the
  resolver returns a `DATABASE_URL` whose host/database/username match the delivery and whose
  password equals the decrypted `ResourceInstance.credentials.password`.
- A live deploy (with `SERVER_EXECUTOR_LIVE_ENABLED=true`) writes `.env` to the working directory,
  `docker compose up` interpolates `${DATABASE_URL}` correctly, picshare-backend connects to the
  platform DB, prisma migrates `db_picshare`, and the health check passes; the `.env` is removed
  post-deploy.
- picshare's own `mysql`/`redis` containers are NOT started by `docker-compose.devpilot.yml`.

### Phase 2 — Unify all env sources

- Merge `ApplicationService.env` literals + `SecretKey` rows (via `secretKeyIds`) into the
  `.env` alongside the platform resource credentials.
- `trap 'rm -f .env' EXIT` in the SSH wrapper; `chmod 600 .env` at write.
- Optionally write a `SecretKey.database_password` at provisioning time so the DB password has a
  unified rotation surface (still redundant with `ResourceInstance.credentials`).

### Phase 3 — Hardening

- Per-allocation Redis password (extend `provisionRedisDatabase`).
- `.env` written to a `tmpfs`-backed path on the target instead of the repo dir, with
  `--env-file` (requires deploy-command change).
- Rotation API: re-provision → re-inject on next deploy.

---

## 9. Diagrams (mermaid) — enhanced deployment flow

### 9.1 Enhanced createRun flow with credential injection

```mermaid
flowchart TD
    Start([POST /api/deployments/projects/:projectId/runs]) --> Load[Load project + config<br/>deployment.service.ts:222]
    Load --> ResolveCfg[resolveDeploymentConfig<br/>overrides > service.deployConfig > project.config.deployment<br/>:250 :2027]
    ResolveCfg --> ResolveCreds[NEW resolvePlatformCredentials<br/>teamId+projectId+environmentId]
    ResolveCreds --> QueryInst{Active ResourceInstance<br/>for mysql + redis?}
    QueryInst -- yes --> Decrypt[getInstanceCredentialForGeneration<br/>decrypt ResourceInstance.credentials<br/>resource-request-instance.service.ts:50]
    Decrypt --> Interp[Interpolate ResourceType.envTemplate<br/>registry.service.ts:323 pattern]
    Interp --> BuildEnv[NEW buildEnvWriteStep + buildEnvCleanupStep<br/>redacted command + secretEnv]
    QueryInst -- no --> BuildEnvEmpty[no env injection<br/>step skipped]
    BuildEnv --> BuildSteps[buildCommandSteps with envInjection]
    BuildEnvEmpty --> BuildSteps
    BuildSteps --> SaveRun[Create DeploymentRun row<br/>:302]
    SaveSteps --> Exec[serverExecutor.execute executionInput<br/>:481]
    Exec --> ExecSteps[checkout → build → write_env_file → deploy → cleanup_env_file → health_check]
    SaveRun --> SaveSteps[Build commandPlan with REDACTED steps]
```

### 9.2 Secret flow (where the password lives at each stage)

```mermaid
sequenceDiagram
    participant Prov as Pool Provisioning<br/>(one-time)
    participant DB as devpilot MySQL
    participant DS as DeploymentService<br/>(per deploy)
    participant Mem as API process memory
    participant SSH as SSH channel
    participant Disk as Target .env on disk

    Prov->>DB: CREATE DATABASE db_picshare<br/>CREATE USER user_db_picshare IDENTIFIED BY '<pw>'<br/>resource-pool-mysql-provisioning.utils.ts:70
    Prov->>DB: INSERT ResourceInstance<br/>delivery={host,port,database,username}<br/>credentials=encrypt({password,...})<br/>resource-request-status-writer.service.ts:142
    Note over DB: password at rest: AES-256-GCM

    DS->>DB: SELECT ResourceInstance WHERE<br/>projectId+env+type=mysql+active
    DS->>DB: decrypt(credentials) via getInstanceCredentialForGeneration
    DS->>Mem: secretEnv = {DATABASE_URL: 'mysql://...:<pw>@...'}<br/>NOT persisted
    DS->>DB: INSERT DeploymentRun.commandPlan<br/>= REDACTED template (no <pw>)
    DS->>SSH: buildSshLiveScript substitutes secretEnv<br/>into heredoc body in-memory
    SSH->>Disk: cat > .env <<'EOF' ...real values... EOF<br/>(heredoc body never echoed)
    Note over Disk: chmod 600; removed by cleanup step
```

### 9.3 Component touch map

```mermaid
graph TD
    subgraph devpilot-api
      DS[DeploymentService] -->|new call| RES[NEW deployment-env-injection.utils]
      RES -->|resolve| RR[ResourceRequestService.getInstanceCredentialForGeneration]
      RR -->|decrypt| SW[ResourceRequestStatusWriterService.decrypt]
      RES -->|template| RT[ResourceType.envTemplate]
      DS -->|pass envInjection| BCB[buildCommandSteps]
      BCB -->|emits| WSTEP[write_env_file step<br/>redacted cmd + secretEnv]
      BCB -->|emits| CSTEP[cleanup_env_file step]
      DS --> SE[serverExecutor.execute]
      SE --> SSH[ssh-live adapter]
      SSH --> SCRIPT[buildSshLiveScript<br/>expands secretEnv]
      POL[ServerCommandPolicyService] -->|evaluates REDACTED form| RULE[NEW write-env-file rule]
    end
    subgraph picshare
      COMP[docker-compose.devpilot.yml] -->|no mysql/redis services| BE[backend: ${DATABASE_URL} ${REDIS_*}]
    end
    SSH -->|writes .env + runs compose| COMP
```

---

## 10. Adversarial alternatives (rejected)

### 10.1 Rejected: have picshare call a devpilot SDK at runtime to fetch credentials

Picshare-backend would, on boot, call `GET /api/resource-requests/instances/:id/credential` and
build its own DB connection. Rejected because:
- There is no such public "give me my decrypted DB password" endpoint today;
  `getInstanceCredentialForGeneration` (`resource-request-instance.service.ts:50`) is an internal
  service method consumed by the code generator, not an HTTP route.
- It requires picshare application code changes (new SDK client, boot-time fetch, retry logic) —
  violates the "no picshare code changes" goal.
- It introduces a runtime circular dependency: picshare needs devpilot-api up to boot, while
  devpilot may deploy picshare. Deploy-time injection breaks the cycle.
- Secrets would transit the network at app boot on every restart.

### 10.2 Rejected: use Nacos / a config center for runtime secret distribution

The stack has no Nacos. The closest analogue is the in-repo `registry.service.ts` (a static
feature/resource-type registry, `registry.service.ts:323-333`) and `KeyCenterService`
(`key-center.service.ts`). Neither is a runtime config center with a picshare client. Adding one
is a multi-slice infra project. The `.env` approach uses only primitives that already exist.

### 10.3 Rejected: docker `secrets:` (swarm-style) / `run --secret`

Requires Docker Swarm or per-container `--secret` bind mounts, compose file changes, and picshare
app code to read `/run/secrets/<name>`. Out of scope and heavier than `.env`.

### 10.4 Rejected: write the secret directly into `ApplicationService.env` (plaintext column)

`ApplicationService.env Json?` (`schema.prisma:846`) is a plaintext JSON column. Storing the DB
password there defeats the entire encrypted-credentials architecture
(`ResourceInstance.credentials` AES-GCM, `SecretKey.value` AES-CBC). Keep secrets in encrypted
columns; inject at deploy time.

### 10.5 Rejected: `export VAR=… && docker compose …` inline

The `export` values appear in `step.command`, which is persisted verbatim in
`DeploymentRun.commandPlan` (`script-plan.adapter.ts:149`) and shown in policy decisions
(`server-command-policy.service.ts:97`). Plaintext password at rest. Rejected — see §4.2/§6.

### 10.6 Rejected: `--env-file /tmp/deploy.env` passed to `docker compose`

Requires editing picshare's deploy command to append `--env-file`. Fragile (every compose
subcommand must include it), and the file path must be writable + cleaned up. The cwd `.env` is
Compose-native and zero-config. Rejected.

### 10.7 Rejected: skip the platform DB entirely and keep picshare's own mysql/redis

This is the status quo (`picshare/docker-compose.devpilot.yml:5-44`). It directly contradicts the
brief's target ("picshare uses platform-managed databases instead of its own self-started
containers") and leaves the provisioned `db_picshare` / Redis slot orphaned. Rejected by
objective.

### 10.8 Note on "real provisioning" vs prior investigations

`2026-07-22-picshare-full-integration-investigation.md:235-239, 678-682` claims pool provisioning
is "non-executing / fake credentials". That was true of an older revision. The current code
(`resource-pool-mysql-provisioning.utils.ts:52-85`,
`resource-pool-allocation-lifecycle.service.ts:49-66`) performs real `CREATE DATABASE / CREATE
USER / GRANT` and persists real encrypted credentials. This investigation treats provisioning as
real. If a particular deployment still points at a pool whose `adminConfig` is a placeholder, the
delivered credentials will fail at picshare's first connection — but that is a pool-configuration
problem, not a design blocker for the injection mechanism.

---

## 11. References (key file:line index)

- Deployment flow: `apps/devpilot-api/src/deployment/deployment.service.ts:216-532` (createRun),
  `:534-874` (rollbackRun); `deployment-command-builders.utils.ts:30-37` (buildCommandSteps).
- Step type: `apps/devpilot-api/src/server-executor/server-executor.types.ts:58-67`.
- Execution: `server-executor.service.ts:120-122`; `adapters/ssh-live.adapter.ts:52-124`;
  `adapters/ssh-live-runner.utils.ts:28-132`; `adapters/ssh-live-script.utils.ts:4-57`;
  `adapters/script-plan.adapter.ts:118-151`; `adapters/ssh-live-completed-result.utils.ts:9-65`.
- Command policy: `server-command-policy.service.ts:59-177`;
  `server-command-policy-deployment-rules.constants.ts:3-51`.
- Credential persistence: `resource-pool-mysql-provisioning.utils.ts:52-85`;
  `resource-pool-redis-provisioning.utils.ts:40-68`;
  `resource-pool-allocation-lifecycle.service.ts:27-98`;
  `resource-request/resource-request-pool-provisioning.service.ts:34-123`;
  `resource-request/resource-provisioning-sensitive.utils.ts:14-53`;
  `resource-request/resource-request-status-writer.service.ts:122-183`;
  `resource-request/resource-credential-crypto.utils.ts:14-34`.
- Credential resolution: `resource-request/resource-request-instance.service.ts:50-66`;
  `resource-request/resource-request.service.ts:98-99`;
  `generator/generator.service.ts:221-232` (precedent consumer).
- Env templates: `resource-request/resource-type-defaults.constants.ts:53,83,110`;
  `registry/registry.service.ts:323-333` (interpolation precedent).
- Schema: `apps/devpilot-api/prisma/schema.prisma:832-882` (ApplicationService),
  `:1086-1108` (SecretKey), `:1130-1153` (ResourceAllocation), `:1189-1229` (ResourceRequest),
  `:1232-1263` (ResourceInstance), `:939-1011` (DeploymentRun).
- picshare compose: `picshare/docker-compose.devpilot.yml:5-129`.
- Deploy target wiring: `docker-compose.deploy-target.yml:47-64` (docker.sock + repo bind-mount).
- Module wiring: `deployment/deployment.module.ts:13`;
  `resource-request/resource-request.module.ts:67`; `key-center/key-center.module.ts:12`.
