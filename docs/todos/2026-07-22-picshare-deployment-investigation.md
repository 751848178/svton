# Picshare Onboarding + Deployment on Devpilot — Investigation

Date: 2026-07-22
Scope: C = both (A) onboard picshare as a managed devpilot project, and (B) actually
deploy & run picshare via devpilot's deployment flow.
Investigator: /dev:invest subagent (read-only).

All claims cite `file:line`. No files were modified and no Docker commands were run;
running-container state was observed via `docker inspect` / `docker exec` (read-only
SELECTs).

---

## TL;DR

- Devpilot's deployment is **virtual in the currently running container**. The
  `script-plan` adapter is the only one whose `supports()` returns true because the
  two live-execution env flags are absent from the running `devpilot-app-api`
  container's environment. Every non-dryRun deployment returns `status: 'blocked'`
  with `error: "真实 Server executor transport 尚未启用"`.
- DryRun deployments DO complete (`status: 'completed'`) and produce a real
  `DeploymentRun` row + command plan + audit event. So we can fully exercise the
  deployment API and record real metadata; we just can't have devpilot actually
  `git clone`/`build`/`start` picshare.
- Recommended slice scope: **hybrid (interpretation i)** — start picshare's
  containers manually via its own docker-compose (real, reachable services) and
  register them in devpilot as a managed project + application + services + a
  real `DeploymentRun` (dryRun) that *reflects* the running state. Wire the
  `healthCheckUrl` so the recorded deployment plan would health-check the live
  container. Be explicit in the plan that devpilot did not start the containers.
- picshare needs: MySQL (a `picshare` database), Redis, backend (NestJS, container
  port 3000), admin (Next.js, container port 3001). Backend Dockerfile auto-runs
  `prisma migrate deploy` then `node dist/src/main`.
- Host port plan (existing conflicts observed via `docker ps`): twgg occupies
  `3100:3000` and `3101:3001`. picshare's own `docker-compose.local.yml` already
  reserves `4100` (backend) and `4101` (admin); reuse those.
- Recommended infra: **dedicated** picshare MySQL+Redis containers via picshare's
  own compose, on the shared `devpilot-g003-staging_default` external network so
  devpilot can reach them. (Shared DB on `devpilot-g003-mysql` is technically
  possible — root@% is open and a probe `CREATE DATABASE` succeeded — but dedicated
  is cleaner, matches the precedent set by twgg/deyi/net-portal, and avoids schema
  migration cross-talk.)

---

## A. devpilot's deployment capability assessment

### A.1 The deployment flow is real code that calls a real executor boundary

`DeploymentService.createRun()` (`apps/devpilot-api/src/deployment/deployment.service.ts:216`)
builds a real command-step plan and calls `this.serverExecutor.execute(executionInput)`
at `deployment.service.ts:481`, or `queueExecution()` at `:427` when `queue:true`.

The command steps are produced by `buildCommandSteps()`
(`apps/devpilot-api/src/deployment/deployment-command-builders.utils.ts:30-37`):

| step key     | command                                                         | required-if                          |
|--------------|----------------------------------------------------------------|--------------------------------------|
| checkout     | `git fetch --all --prune && git checkout <branch> && git pull` | `gitRepo` present                     |
| build        | `deployment.buildCommand`                                       | `buildCommand` present                |
| deploy       | `deployment.deployCommand`                                      | **always required**                   |
| health_check | `curl -fsS <healthCheckUrl>`                                    | `healthCheckUrl` present              |

So if the live executor were enabled, devpilot *would* literally SSH into the
target server, `git pull`, run the build/deploy commands, and `curl` the health
endpoint. The orchestration is genuine; only the transport is gated.

### A.2 The deployConfig shape (where buildCommand/healthCheckUrl come from)

`resolveDeploymentConfig()` (`deployment.service.ts:2027-2067`) merges four layers
in precedence order (highest first):

1. `dto.overrides` (per-request)
2. `applicationService.deployConfig` (per-service)
3. `project.config.deployment` (per-project)
4. `project.config.stackProfile` (legacy)

Recognised fields: `targetType`, `workingDirectory`, `buildCommand`,
`deployCommand`, `rollbackCommand`, `healthCheckUrl`
(`deployment-command-builders.utils.ts:9-16`).

The existing LT-Demo App's `ApplicationService.deployConfig` is just
`{"replicas": 1}` (verified via `SELECT ... FROM ApplicationService`), so its
deploy steps have empty `buildCommand`/`deployCommand`/`healthCheckUrl` and would
be blocked by `blockOnWarnings: true` (`deployment.service.ts:421`).

### A.3 server-executor transport IS DISABLED in the running container

Three adapters exist (`server-executor.service.ts:54-62, 80-101`):

| adapter       | file                                        | `supports()` true when                                                                          |
|---------------|---------------------------------------------|------------------------------------------------------------------------------------------------|
| `script-plan` | `adapters/script-plan.adapter.ts:15-17`     | `transport==='ssh' \|\| 'none'` — **always matches the default target**                         |
| `ssh-live`    | `adapters/ssh-live.adapter.ts:38-44`        | `transport==='ssh' && dryRun===false && SERVER_EXECUTOR_LIVE_ENABLED==='true'`                  |
| `server-agent`| `adapters/server-agent.adapter.ts:50-52`    | `transport==='server_agent'` (only resolved when `SERVER_EXECUTOR_AGENT_TARGET_ENABLED==='true'`)|

`resolveAdapter()` returns the **first** adapter whose `supports()` is true
(`server-executor-execution-runtime.service.ts:26-36`), so the order in
`server-executor.service.ts:54-62` matters: `sshLiveAdapter` is declared before
`scriptPlanAdapter`, but `ssh-live.supports()` is false unless the env flag is on.

Defaults (`apps/devpilot-api/src/common/config/env.schema.ts:141,142,154`):
```
SERVER_EXECUTOR_LIVE_ENABLED          default 'false'
SERVER_EXECUTOR_QUEUE_WORKER_ENABLED  default 'true'
SERVER_EXECUTOR_AGENT_TARGET_ENABLED  default 'false'
```

**Observed env on the running `devpilot-app-api` container** (`docker inspect`):
```
PORT=3121
DATABASE_URL=mysql://root:password@devpilot-g003-api-mysql:3306/devpilot_g003_staging
REDIS_HOST=devpilot-g003-api-redis
REDIS_PORT=6379
CORS_ORIGIN=http://localhost:3120
DEVPILOT_BOOTSTRAP_ADMIN_EMAIL=admin@devpilot.local
DEVPILOT_BOOTSTRAP_ADMIN_PASSWORD=DemoPass123!
NODE_ENV=production
```
No `SERVER_EXECUTOR_*` vars are set. So both live flags are at their `'false'`
default. Therefore `script-plan` is the active adapter for every deployment.

`script-plan.execute()` (`adapters/script-plan.adapter.ts:19-116`):
- if `dryRun === false` → returns `status: 'blocked'`,
  `error: "真实 Server executor transport 尚未启用"` and a controlled script plan
  (lines 51-81). **Never executes.**
- if `dryRun === true` and no warnings → returns `status: 'completed'`,
  `mode: 'dry_run'` (lines 85-115).
- if `dryRun === true` with warnings and `blockOnWarnings !== false` → `blocked`.

> Note: `scripts/devpilot-docker-staging.mjs:134-140` DOES set
> `SERVER_EXECUTOR_LIVE_ENABLED=true` etc., but only for a host-side
> `corepack pnpm dev` process it spawns — NOT for the dockerised
> `devpilot-app-api` container. The compose file
> (`docker-compose.devpilot-app.yml`) has no `SERVER_EXECUTOR_*` entries in its
> `environment:` block. The audit in `docs/devpilot/local-test-data.md:253-270`
> ("Still virtual by design") is correct for the running container.

### A.4 Confirmed against live DB state

The single existing `DeploymentRun` row (verified via
`SELECT ... FROM DeploymentRun`):
```
id: cmruu2jya0029945dc0blwnw9
status: running
mode: deploy
dryRun: 1
executorKey: server-executor
adapterKey: script-plan
error: NULL
```
This is a dry-run that landed in the script-plan adapter — exactly as predicted.

### A.5 Deployment endpoints

`apps/devpilot-api/src/deployment/deployment.controller.ts` exposes:

| Method & path                                  | Purpose                              | line |
|------------------------------------------------|--------------------------------------|------|
| `GET  /api/deployments/runs`                   | list runs                            | 43   |
| `POST /api/deployments/projects/:projectId/runs` | create a run (deploy)              | 52   |
| `POST /api/deployments/runs/:runId/rollback`   | rollback                             | 76   |
| `POST /api/deployments/runs/:runId/retry`      | retry                                | 148  |
| `POST /api/deployments/runs/:runId/smoke-check`| smoke check                          | 172  |

`POST .../runs` body (`apps/devpilot-api/src/deployment/dto/deployment.dto.ts`):
`environmentId`, `applicationId`, `applicationServiceId`, `serverId`, `branch`,
`commitSha`, `source`, `trigger`, `dryRun`, `queue`, `maxAttempts`, `overrides`,
`confirmationText`, `approvalId`, `approvalReason`.

`requiresDeploymentOperationApproval(dryRun)` returns `!dryRun`
(`deployment.service.ts:1922-1924`): non-dryRun deployments require an
`OperationApproval`. Since the live executor is off, a non-dryRun would get
blocked at the adapter even after approval.

There is **no** `/api/applications/:id/services/:serviceId/operations` deployment
trigger in the sense the brief asked about — that endpoint
(`application.controller.ts:186-210`) runs *service operations*
(restart/logs/rollback/status) via `application.service.ts`, a separate flow.
Deployments are triggered through `/api/deployments/projects/:projectId/runs`.

---

## B. picshare's deployment needs

### B.1 Containers & ports (from picshare's compose files)

`docker-compose.yml` (production-style):
- `backend`: image `picshare-backend:latest`, container port 3000, host `3100:3000`,
  healthcheck `wget --spider http://localhost:3000/api`
  (`picshare/docker-compose.yml:5-43`).
- `admin`: image `picshare-admin:latest`, container port 3001, host `3101:3001`,
  healthcheck `wget --spider http://localhost:3001`
  (`picshare/docker-compose.yml:46-69`).
- Network `picshare-network` (bridge).
- **No MySQL or Redis container is declared** — picshare expects these as
  external services via `DATABASE_URL` / `REDIS_HOST`.

`docker-compose.local.yml` (self-contained local validation):
- Same two services on host ports **4100/4101** (`picshare/docker-compose.local.yml:26,74`),
  explicitly chosen to "避开本机已占用:3000/3001/3002/3100/3101/3200/3201/3306"
  (header comment lines 8-9).
- Points `DATABASE_URL` at `host.docker.internal:3310/picshare_e2e`
  (`:31`) and `REDIS_HOST=host.docker.internal:6379` (`:47-48`).
- Comment notes the pre-existing `picshare-mysql-e2e` container at MySQL@3310
  (`:13`).

`docker-compose.backend.yml` / `docker-compose.admin.yml`: split files that each
declare one service against an **external** `picshare-network`
(`docker-compose.admin.yml:25-29`).

### B.2 Required env vars

From `picshare/docker-compose.yml:14-33` + `picshare/apps/backend/.env.example`:

| var                    | example / default                                          | required? |
|------------------------|------------------------------------------------------------|-----------|
| `DATABASE_URL`         | `mysql://user:password@localhost:3306/picshare?...`        | **yes**   |
| `JWT_SECRET`           | `prod-secret-key-2025-picshare-please-change-this`        | **yes**   |
| `JWT_ACCESS_EXPIRES_IN`| `2h`                                                       | yes       |
| `JWT_REFRESH_EXPIRES_IN`| `7d`                                                      | yes       |
| `CORS_ORIGIN`          | `*` (dev) / `https://admin.picshare.svton.cn` (prod)      | yes       |
| `REDIS_HOST`           | `localhost`                                                | **yes**   |
| `REDIS_PORT`           | `6379`                                                     | **yes**   |
| `REDIS_PASSWORD`       | (empty for local)                                          | no        |
| `REDIS_DB`             | `0`-`15`                                                   | yes       |
| `STORAGE_TYPE`         | `cos`                                                      | yes       |
| `COS_SECRET_ID/KEY`    | (Tencent COS creds)                                        | only if uploading |
| `COS_BUCKET/REGION/DOMAIN/PREFIX` | (COS config)                                    | only if uploading |
| `WECHAT_MINI_APP_ID/SECRET`       | (WeChat mini-program)                           | no (mock ok) |
| `SMS_PROVIDER`         | `mock` (logs code) / `tencent` / `aliun`                   | no (mock default) |

`.env.example` (`picshare/apps/backend/.env.example:1-63`) confirms the list.

### B.3 Build process

`apps/backend/Dockerfile` (multi-stage):
- `deps` → `pnpm install --frozen-lockfile` (`Dockerfile:25`).
- `builder` → `prisma generate` (`:41`), build `@picshare/types` (`:45`),
  `pnpm run build` (= `nest build`, per `apps/backend/package.json:9`) (`:49`).
- `runner` → copies `dist`, `prisma`, `node_modules`; installs standalone
  `prisma@5` CLI (`:81-84`).
- `CMD`: `prisma migrate deploy --schema=./prisma/schema.prisma; node dist/src/main`
  (`Dockerfile:98`). So **the container self-migrates on boot** — no separate
  migration step is needed.
- `EXPOSE 3000`.

`apps/admin/Dockerfile`:
- Standard Next.js standalone build. Build-arg `NEXT_PUBLIC_API_URL` is baked in
  at build time (`admin/Dockerfile:41-44`).
- `CMD node standalone/apps/admin/server.js`, `EXPOSE 3001`, `PORT=3001`.

### B.4 Prisma schema / migrations

`apps/backend/prisma/schema.prisma`:
- `datasource db { provider = "mysql"; url = env("DATABASE_URL") }` (lines 5-7).
- 15 migrations under `prisma/migrations/` (init through
  `20260719100000_drop_photos_filehash_unique`). `migration_lock.toml` present —
  standard Prisma MySQL setup. `prisma migrate deploy` will replay any unapplied
  migrations on first boot.

### B.5 Nginx config (not needed for the devpilot slice)

`nginx/picshare.conf` is a production HTTPS termination config (443/SSL) fronting
`3100` (api) and `3101` (admin). Not needed locally — picshare's own compose
already publishes the two ports directly. The devpilot `LT-Nginx Target`
(`devpilot-g003-virtual-nginx:80`) is a stub and not suitable for proxying
picshare.

### B.6 Can picshare run on `devpilot-g003-staging_default`?

Yes. picshare's compose lets us override the network. To let devpilot containers
reach picshare by DNS name, attach picshare's backend/admin to the external
`devpilot-g003-staging_default` network. The staging network currently contains
(`docker network inspect`): `devpilot-app-api`, `devpilot-app-web`,
`devpilot-g003-mysql`, `devpilot-g003-redis`, `devpilot-g003-api-mysql`,
`devpilot-g003-api-redis`, `devpilot-g003-virtual-nginx`, `devpilot-g003-ssh-server`,
`devpilot-g003-docker-socket-proxy`, `devpilot-g003-minio`,
`devpilot-g003-resource-postgres`, `devpilot-g003-mailhog`,
`devpilot-g003-fake-provider`, `devpilot-g003-backup-target`.

---

## C. Integration strategy

### C.1 Shared vs dedicated MySQL/Redis

| Option | Pros | Cons |
|---|---|---|
| **Dedicated** picshare MySQL + Redis containers (recommended) | Matches the twgg/deyi/net-portal precedent (`twgg/docker-compose.yml:27-70` declares its own `twgg-mysql` + `twgg-redis`); clean isolation; no migration cross-talk; picshare owns its own DB user/password; if it breaks, only picshare breaks. | One extra mysql + one extra redis container on the host (~150 MB RAM each). |
| Share `devpilot-g003-mysql` (create a `picshare` DB) | Zero new infra; `devpilot-g003-mysql` already accepts `root@%` and `CREATE DATABASE picshare_test_probe` succeeded in probe. | Couples picshare schema to the staging MySQL; `devpilot-g003-mysql` already hosts `devpilot_resource_pool` and any future devpilot data — a bad prisma migration could corrupt it; password is the shared `password`. |
| Share `devpilot-g003-redis` | Zero new infra. | DB index collision risk; redis has no namespace isolation by database in redis cluster mode. |

**Recommendation: dedicated.** The cost is two small containers; the isolation
and precedent alignment are worth it. The dedicated approach also keeps
picshare's compose self-contained (matches the design of
`docker-compose.local.yml`, which already assumes a dedicated
`picshare-mysql-e2e`).

> If the operator prefers shared, the only change to the plan is the
> `DATABASE_URL`/`REDIS_HOST` values and skipping the new mysql/redis services.
> The devpilot records are identical either way.

### C.2 Network attachment

Bring picshare's backend+admin up on `devpilot-g003-staging_default` (external).
This lets `devpilot-app-api` reach `picshare-backend:3000` and
`picshare-admin:3001` by DNS name — which is exactly what the recorded
`healthCheckUrl` will point at.

### C.3 Host port mapping

Observed host ports already in use (`docker ps`): `3001, 3002, 3003, 3005, 3100,
3101, 3120, 3121, 3200, 3201, 3306, 3310, 6379, 6380, 6381, 10086, 16379, 36379,
16380`.

picshare's defaults `3100` (backend) and `3101` (admin) COLLIDE with twgg. Reuse
the `docker-compose.local.yml` reservation:

| service           | container port | host port | rationale                       |
|-------------------|----------------|-----------|---------------------------------|
| picshare-backend  | 3000           | **4100**  | free; matches local.yml         |
| picshare-admin    | 3001           | **4101**  | free; matches local.yml         |
| picshare-mysql    | 3306           | **3311**  | 3310 taken by picshare-mysql-e2e|
| picshare-redis    | 6379           | **6386**  | 6385 (devpilot) and 6384 (api) taken; 6386 free |

### C.4 devpilot records needed to "onboard" picshare

Required records (all under team `Test Org` = `cmrusn8mw0009fp5bnu9kuiin`,
requires `X-Team-Id` header for most calls per `local-test-data.md:44`):

1. **Project** (`POST /api/projects`)
   - `name`: `Picshare`
   - `gitRepo`: the picshare repo URL (or `https://github.com/local/picshare`
     placeholder; devpilot only uses this to render the checkout step — never
     executed in dry-run).
   - `config`: `{ framework: "nestjs", origin: "imported", managementScope: "full", deployment: { targetType: "server", workingDirectory: "/app", buildCommand: "...", deployCommand: "...", healthCheckUrl: "http://picshare-backend:3000/api" } }`
   - Auto-creates environments `dev/test/staging/prod`
     (`local-test-data.md:36-41`).

2. **Application** (`POST /api/applications`) — `projectId`, `name`, `repositoryUrl`, `defaultBranch`.

3. **ApplicationService** (`POST /api/applications/:id/services`) — one per
   runnable service:
   - `backend`: `kind: 'container'`, `image: 'picshare-backend:local'`,
     `environmentId: <dev>`, `serverId: <picshare server>`,
     `ports: [3000]`, `env: { DATABASE_URL, REDIS_HOST, JWT_SECRET, ... }`,
     `deployConfig: { targetType: 'server', deployCommand: 'docker compose up -d backend', healthCheckUrl: 'http://picshare-backend:3000/api', workingDirectory: '/Users/zhaoxingbo/Workspace/ai-driven/picshare' }`.
   - `admin`: same shape with `image: 'picshare-admin:local'`,
     `ports: [3001]`, `healthCheckUrl: 'http://picshare-admin:3001'`.

4. **Server** (one new) — register the picshare docker host as a managed server
   so the `ApplicationService.serverId` has somewhere to point:
   - `name: 'Picshare Docker Host'`, `host: 'picshare-backend'`, `port: 3000`,
     `authType: 'password'`, `username: 'picshare'`, `password: 'picshare'`,
     `tags: ['picshare', 'local-test']`.
   - This mirrors the LT- server pattern (`local-test-data.md:48-52`). The host
     is the in-network DNS name (not `127.0.0.1`, per the gotcha at
     `local-test-data.md:234-238`).
   - The "password" is fictional — server-executor never runs against it (transport
     disabled). It exists only so the FK is satisfied and `/test` reports `online`
     via the TCP ping path.

5. **DeploymentRun** (`POST /api/deployments/projects/:projectId/runs`) — create
   a real (dry-run) deployment record that captures the plan:
   - `{ applicationId, applicationServiceId, environmentId: <dev>, dryRun: true }`.
   - With the deployConfig above and no warnings, this returns
     `status: 'completed'`, `mode: 'dry_run'`, `adapterKey: 'script-plan'`,
     carrying a full `commandPlan` JSON that documents the intended checkout /
     build / deploy / health-check steps.

Optional but nice: a `Site` (`POST /api/sites`) fronting the admin UI on
`picshare.lt-test.local` → `http://picshare-admin:3001`, mirroring the LT Example
Site pattern (`local-test-data.md:186-190`).

### C.5 Reachability summary

| who                         | reaches what                          | how                                              |
|-----------------------------|---------------------------------------|--------------------------------------------------|
| user's browser              | picshare admin UI                     | `http://127.0.0.1:4101` (host-published)        |
| user's browser              | picshare backend API                  | `http://127.0.0.1:4100/api` (host-published)    |
| devpilot-app-api container  | health-check picshare backend         | `http://picshare-backend:3000/api` (staging net)|
| devpilot-app-api container  | health-check picshare admin           | `http://picshare-admin:3001` (staging net)      |
| picshare-backend container  | its MySQL                             | `mysql://picshare:<pw>@picshare-mysql:3306/picshare` |
| picshare-backend container  | its Redis                             | `picshare-redis:6379`                            |

---

## D. Reality check on "deploy via devpilot"

### D.1 What devpilot cannot do today

Because `SERVER_EXECUTOR_LIVE_ENABLED=false` on the running container
(`A.3`), devpilot **cannot**:
- SSH anywhere to run `git fetch`/`build`/`deploy`,
- start or stop containers on the docker host,
- run `docker compose up`.

Any `POST /api/deployments/.../runs` with `dryRun: false` returns
`status: 'blocked'`, `error: "真实 Server executor transport 尚未启用"` and leaves
a `DeploymentRun` row stuck in `blocked`. We verified there is exactly one
existing `DeploymentRun` (a dry-run in `running` state).

### D.2 The two interpretations from the brief

**(i) Hybrid / reflective (RECOMMENDED for this slice):**
Start picshare's containers manually with picshare's own docker-compose against
the staging network, then register the running containers as devpilot managed
records and create a real `DeploymentRun` (dryRun) whose `commandPlan` reflects
the actual commands one would run. picshare ends up (a) running and reachable,
and (b) represented inside devpilot as a first-class project with a real
deployment record.

**(ii) Wire devpilot to actually start picshare:**
Would require enabling `SERVER_EXECUTOR_LIVE_ENABLED=true` on the API container,
provisioning SSH key auth on a target that can run `docker compose`, writing a
command-policy template that allows `git`/`docker`, obtaining an
`OperationApproval`, and submitting a live deploy. That is a multi-slice effort
touching the API container's env, the LT-SSH server's auth, and the command
policy subsystem (`server-command-policy-deployment-rules.constants.ts`). Out of
scope for a single onboarding slice.

### D.3 Recommended slice scope

| In scope (interpretation i) | Out of scope (interpretation ii) |
|-----------------------------|----------------------------------|
| Build picshare backend+admin images | Enabling live SSH execution |
| Start picshare backend+admin+mysql+redis on staging network | Modifying devpilot API container env / restarting it |
| Create `picshare` database (auto via prisma migrate on boot) | Wiring OperationApproval + command policy |
| Create devpilot Project / Application / 2 ApplicationServices / Server | Live deploy via devpilot actually running commands |
| Create a dry-run `DeploymentRun` recording the plan | Production HTTPS / nginx termination |
| Verify reachability (curl backend `/api`, admin `/`) | WeChat / SMS / COS provider wiring (mock ok) |
| Optionally create a devpilot `Site` for the admin | picshare mobile app |

We will be explicit in the plan: devpilot holds the deployment *intent and
metadata*; picshare is *actually running* via its own compose. The recorded
`healthCheckUrl` points at the live container, so the deployment record is a
truthful reflection of state.

---

## E. Concrete deployment plan (high level — see plan doc for exact commands)

1. Build: `docker compose -f docker-compose.local.yml build` (or use
   `docker-compose.yml` with overrides). The backend Dockerfile auto-migrates.
2. Write a small `docker-compose.devpilot.yml` override (or inline env) that:
   - sets `DATABASE_URL=mysql://picshare:<pw>@picshare-mysql:3306/picshare`,
   - sets `REDIS_HOST=picshare-redis`,
   - attaches all services to `devpilot-g003-staging_default` as `external: true`,
   - publishes backend `4100:3000`, admin `4101:3001`, mysql `3311:3306`,
     redis `6386:6379`,
   - builds admin with `NEXT_PUBLIC_API_URL=http://localhost:4100/api`.
3. `docker compose up -d --build`; wait for healthchecks.
4. Verify: `curl http://127.0.0.1:4100/api` (backend), `curl http://127.0.0.1:4101/` (admin).
5. Onboard into devpilot via API (login as admin, capture token, set `X-Team-Id`):
   `POST /api/projects` → capture `dev` env id → `POST /api/servers` →
   `POST /api/applications` → `POST /api/applications/:id/services` (x2) →
   `POST /api/deployments/projects/:projectId/runs` (dryRun).
6. Verify devpilot records via `GET /api/projects`, `GET /api/applications/:id`,
   `GET /api/deployments/runs`.

---

## F. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Port collision (3100/3101 taken by twgg) | certain | blocks startup | Use 4100/4101 (already free, picshare's own local.yml convention). |
| `prisma migrate deploy` fails (DB unreachable / charset) | medium | backend boot-loops | Healthcheck `start_period: 60s` already in local.yml; watch `docker logs picshare-backend`. |
| Backend can't reach MySQL/Redis (wrong DNS / network) | medium | backend boot-loops | Ensure all picshare services share the staging network; use DNS names `picshare-mysql`/`picshare-redis`. |
| `NEXT_PUBLIC_API_URL` baked at build time wrong | medium | admin UI can't call backend | Build with `http://localhost:4100/api`; rebuild if wrong. |
| devpilot API restart wipes in-memory state | low | none (data is in MySQL) | Records persist in `devpilot-g003-api-mysql`. |
| Operator expects devpilot to literally start picshare | medium | expectation mismatch | Plan doc states clearly: devpilot holds metadata + dry-run record; picshare runs via its own compose. |
| `blockOnWarnings` blocks the dry-run if deployCommand/healthCheckUrl missing | certain if misconfigured | dry-run returns `blocked` not `completed` | Populate both fields in `deployConfig`. |
| Existing `picshare-mysql-e2e` (3310) vs new `picshare-mysql` (3311) name confusion | low | wrong DB used | Use distinct container name `picshare-mysql` (not `-e2e`). |
| COS / WeChat / SMS env missing | low (mock defaults) | upload/login degraded | `SMS_PROVIDER=mock` works out of the box; COS only needed for actual uploads. |
| devpilot container can't resolve `picshare-backend` | medium | healthCheckUrl recorded but not verifiable from API | Attach picshare to `devpilot-g003-staging_default`; verify with `docker exec devpilot-app-api wget -qO- http://picshare-backend:3000/api`. |

---

## G. Adversarial alternatives (rejected)

### G.1 Rejected: enable live SSH execution and have devpilot actually run `docker compose up`

What it would take:
- Set `SERVER_EXECUTOR_LIVE_ENABLED=true` on `devpilot-app-api` (requires editing
  `docker-compose.devpilot-app.yml` `environment:` and recreating the container).
- Convert `LT-SSH Server` (`devpilot-g003-ssh-server:2222`) from password to **key
  auth** — `ssh-live.adapter.ts:92-99` rejects password auth:
  `"SSH live adapter 当前仅支持 key auth"`.
- Have that SSH user be able to run `docker` on the docker host — the
  `devpilot-g003-ssh-server` container is an isolated sandbox, not the docker
  host, so it has no `docker` daemon and no picshare checkout.
- Write a `ServerCommandPolicyTemplate` allowing `git`, `pnpm`, `docker compose`
  (`server-command-policy-deployment-rules.constants.ts`).
- Obtain an `OperationApproval` and submit with `confirmationText === project.name`
  (`deployment.service.ts:422`).

Rejected because: scope is multi-slice (API restart + SSH key infra + policy
authoring + approval flow), the sandbox SSH server can't reach a real docker
daemon anyway, and the user delegated scope decisions to investigator. Captured
as a follow-up in the plan doc's "Out of scope" section.

### G.2 Rejected: register picshare as an "external/managed-scope" project only (no deployment record)

Set `Project.config.managementScope = 'resources'`. But
`deployment.service.ts:239-241` explicitly rejects this: `if (managementScope ===
'resources') throw new BadRequestException('当前项目未启用构建部署能力');`. So the
project would be onboarded but could never have a DeploymentRun. This satisfies
interpretation (A) only and discards (B). Rejected because the brief asks for
both.

### G.3 Rejected: hand-insert devpilot records directly into MySQL

Skips the API's authz, audit-event, and `ensureDefaultsForProject` auto-env logic.
Loses the audit trail that makes devpilot valuable. Rejected — go through the API
(consistent with how the LT- data was created, per `local-test-data.md`).

### G.4 Rejected: front picshare with the devpilot `LT-Nginx Target`

`devpilot-g003-virtual-nginx` is a stub nginx that doesn't proxy arbitrary
upstreams; the devpilot `Site` subsystem CAN configure reverse_proxy but its live
nginx sync is also gated on `SERVER_EXECUTOR_LIVE_ENABLED`
(`docs-internal/devpilot/project-onboarding-control-plane-roadmap.md:258`).
Rejected for this slice — direct host-port access (4100/4101) is simpler.

---

## H. Open follow-ups (out of this slice)

- Implement real server-executor transport (or set the env flags + provision a
  docker-host SSH target) so devpilot can actually start/stop picshare.
- Implement real pool provisioning (`resource-pool-provisioning.service.ts`
  currently just parses endpoint + returns fake credentials —
  `local-test-data.md:253-260`).
- Add a `Site` for the picshare admin once live nginx sync is on.
- If picshare grows real users, swap `SMS_PROVIDER=mock` for tencent and supply
  COS creds.
