# 2026-07-21 — Local Docker Resources Investigation (s031)

Branch: `codex/local-docker-resources-s031`
Worktree: `/Users/zhaoxingbo/Workspace/ai-driven/svton-agent-deep-s030`
Target: Decide which **local Docker resources** the Devpilot API needs to verify end-to-end project flow on a developer machine, then plan how to create, populate, and manage them.

This document is the investigation (read-only) deliverable. The companion implementation plan is
`docs/todos/2026-07-21-local-docker-resources-plan.md`. The task board entry is
`.agent-board/todos/LOCAL-DOCKER-RESOURCES-001.json`.

All file references are absolute or repo-relative with `file:line`.

---

## 0. Method & evidence conventions

- Read-only investigation only. No `docker build` / `docker compose up` was performed in this phase.
- Existing compose file was validated for syntax only:
  `docker compose -f docker-compose.devpilot-staging.yml config` → exit 0,
  output saved at `/tmp/codex-tool-runs/svton/local-docker-resources-s031/existing-compose-config.txt`.
- Decisions that would normally escalate to a human are resolved here using project conventions
  (existing compose file, `apps/devpilot-api/.env.example`, `.agent-board/goals/G004.json`,
  `docs/devpilot/demo-runbook.md`, `scripts/devpilot-docker-staging.mjs`). Rejected alternatives
  are documented per-section.

Scope reminder: the project's G004 verdict is
"`production_like_ready_external_signoff_required`" — i.e. every local/Docker-backed check that can
be done without real cloud credentials should be automated
(`apps/devpilot-api/.env.example:0`, `.agent-board/goals/G004.json:14-19`). The local docker
resource set must maximize that automated coverage; it must not claim real cloud validation.

---

## 1. Resource inventory (what the Devpilot API exposes that Docker can back)

The Devpilot API has four resource subsystems. Each `prisma model` row below is keyed to
`apps/devpilot-api/prisma/schema.prisma`.

### 1.1 Resource domain models

| Prisma model | schema line | Role | Docker-backable? |
|---|---|---|---|
| `Resource` | `schema.prisma:584` | Legacy encrypted team resource blob (`type` free-form string e.g. `mysql`, `redis`, `qiniu-kodo`). | Yes — same containers as below. |
| `ResourceType` | `schema.prisma:1158` | System-level catalog of requestable resource kinds (key, provisioningMode, schemas). Seeded by `DEFAULT_RESOURCE_TYPES` (`resource-type-defaults.constants.ts:25`). | N/A (metadata) |
| `ResourceRequest` | `schema.prisma:1189` | Unified request ticket (`pending → approved → completed`). | Indirectly — fulfillment target is a docker container. |
| `ResourceInstance` | `schema.prisma:1232` | Delivered instance (encrypted credentials + delivery JSON). | Yes — points at a docker container endpoint. |
| `ResourceProvisioningRun` | `schema.prisma:1297` | External delivery run (api / webhook mode). Reaches `fake-provider` in staging. | Yes — drives `fake-provider`. |
| `ResourcePool` | `schema.prisma:1113` | Pre-provisioned pool (`mysql|redis|nginx|cdn`, endpoint + adminConfig). | Yes — backs the pool endpoint. |
| `ResourceAllocation` | `schema.prisma:1130` | Lease of a slot in a pool to a project (resourceName + encrypted credentials). | Yes — name/db allocated inside the pool container. |
| `ManagedResource` | `schema.prisma:1375` | Inventory record (`sourceType: server|cloud|manual`, `provider: docker|aliyun-rds|aliyun-sls|tencent-cos`, `kind: docker_container|mysql|redis|database|log_service|object_storage`). | Yes — discovered by docker inventory. |
| `ResourceSyncRun` | `schema.prisma:1436` | Sync run summary. | N/A |
| `ResourceActionRun` | `schema.prisma:1469` | Per-resource action history. | N/A |
| `ResourceMetricSnapshot` | `schema.prisma:1514` | Sampled metrics (CPU/mem/etc.) | Yes — scraped from docker stats. |
| `ResourceConnectionRun` | `schema.prisma:1563` | Connection probe history. | Yes — tcp/mysql/redis probe target. |
| `ResourceQueryRun` | `schema.prisma:1617` | Read query history (SQL). | Yes — mysql target. |
| `BackupPlan` / `BackupRun` | `schema.prisma:1673 / 1720` | Logical/snapshot backup. Steps built in `backup.service.ts:504-563` hard-code `docker exec ${containerName} ... mysqldump` and `docker cp ${containerName}:/data/dump.rdb /var/backups/devpilot/redis/dump.rdb`. | Yes — **needs the resource container and the backup-target container both present**. |
| `Server` | `schema.prisma:193` | SSH server record (`authType: password|key`). Drives `SshLiveServerExecutorAdapter` and CLI docker inventory. | Yes — ssh server container. |
| `Site` | `schema.prisma:414` | Reverse-proxy / static / docker site (`runtimeType: reverse_proxy|static|docker|runtime`). Plan writes nginx config and reloads via `nginx -t` / `systemctl reload nginx` (`site-ops-plan.utils.ts:164-174`). | Yes — nginx target container. |

### 1.2 Default resource types — provisioning modes

From `apps/devpilot-api/src/resource-request/resource-type-defaults.constants.ts:25-362`:

| key | category | provisioningMode | Delivery fields | Local docker backing |
|---|---|---|---|---|
| `mysql` | database | `manual` (`:33`) | host/port/username/password/database | mysql container |
| `postgresql` | database | `manual` (`:62`) | host/port/username/password/database/schema | postgresql container |
| `redis` | cache | `manual` (`:92`) | host/port/password/db | redis container |
| `server` | compute | `manual` (`:119`) | host/port/username/password/privateKey | ssh server container |
| `port` | network | `manual` (`:157`) | port/protocol/host/notes | (virtual; no container) |
| `domain` | network | `manual` (`:202`) | domain/recordType/target/... | (virtual; no container) |
| `git-account` | account | `credential_only` (`:259`) | account/accessToken/... | OAuth provider mock (optional) |
| `cloud-account` | account | `credential_only` (`:305`) | account/accessKeyId/accessKeySecret/... | (credentials only) |
| `custom-credential` | custom | `credential_only` (`:344`) | account/secret/url | (credentials only) |

### 1.3 Expected providers & credentials shapes

Driven by `ManagedResource.provider` / `kind` enumeration (`schema.prisma:1385-1386`) and
inventory adapters under `apps/devpilot-api/src/resource-control/inventory/`:

| Provider | Kind | Adapter | Expected credential / endpoint |
|---|---|---|---|
| `docker` | `docker_container`, `mysql`, `redis` | `docker-inventory.ts` + `docker-api-inventory-executor.ts` (dockerode) | `dockerApiHost` (e.g. `tcp://host:2376`) or `dockerApiSocket` (e.g. `/var/run/docker.sock`) in Server tags/services (`docker-inventory-executor.factory.ts:8-10,55-66`). |
| `aliyun-rds` | `database` | `cloud-inventory.ts:44`, `cloud-provider-inventory.service.ts:112,212` | `rdsEndpoint` (default `https://rds.aliyuncs.com`), region, AccessKey. **No local equivalent** — keep cloud-only. |
| `aliyun-sls` | `log_service` | `cloud-inventory.ts:47`, `aliyun-sls-log-query.adapter.ts:105-130` | `${region}.log.aliyuncs.com`, project/logstore. **Local substitute:** any HTTP log endpoint or skip live SLS (env `LOG_CENTER_SLS_LIVE_QUERY_ENABLED=false`, already default per `env.schema.ts:78`). |
| `tencent-cos` | `object_storage` | `cloud-inventory.ts:148`, `cloud-provider-inventory.service.ts:109` | COS endpoint, SecretId/SecretKey. **Local substitute:** MinIO S3-compatible endpoint. |
| `qiniu` (object storage) | object storage (CDN feature) | `cdn.service.ts:57,73-74`, `cdn-refresh-provider.factory.ts:31`, `config/features.json:51`, `config/resources.json:55` | `QINIU_ACCESS_KEY`/`QINIU_SECRET_KEY`/`QINIU_BUCKET`/`QINIU_DOMAIN`. **Local substitute:** MinIO S3 endpoint. |

---

## 2. Flow coverage matrix

Each major flow is mapped to the docker fixtures that let it run end-to-end locally.

| Flow | Code path | Currently covered? | Docker fixtures needed |
|---|---|---|---|
| **resource-request lifecycle** (request → approve → provisioning run → instance) | `resource-request.controller.ts`, `resource-request-lifecycle.service.ts`, `resource-request-http-provisioning.service.ts` | Partially — `fake-provider` only (`docker-compose.devpilot-staging.yml:40-65`). | `mysql`, `postgresql`, `redis`, `ssh-server`, `fake-provider`, `minio` (for object_storage delivery). |
| **resource-control docker inventory + metrics** | `resource-control-sync.service.ts:4`, `docker-inventory.ts:92`, `docker-api-inventory-executor.ts`, scheduler in `env.schema.ts:115-124` | Partially — `devpilot-api` and `nginx-proxy` are stubbed in inventory utils (`resource-control-docker-inventory.utils.ts:34-65`) but no live daemon target exists. | Expose a real **docker daemon target** (`docker:dind` or socket proxy) so `dockerApiHost: tcp://...:2376` resolves via dockerode. Plus target containers (`mysql`, `redis`, `nginx`) for the inventory to list. |
| **resource-control cloud inventory** | `cloud-provider-inventory.service.ts:109-115` | No — would need real cloud creds. | Local **MinIO** standing in for `tencent-cos`/`qiniu` inventory items (manual seed). |
| **resource-pool allocation** | `resource-pool-provisioning.service.ts:29-72` (parses pool endpoint, returns host/port/database/username/password) | No — no `mysql`/`redis` pool container is wired in compose. | `mysql` pool container (allocate DBs by name), `redis` pool container (allocate DB index 1..15). |
| **backup / restore** | `backup.service.ts:504-563` (hard-codes `docker exec devpilot-...-mysql ... mysqldump` and `docker cp ... /var/backups/devpilot/{mysql|redis}`), `backup-restore.service.ts:132` | Partially — `backup-target` exists but no real source container name match. | **`mysql` and `redis` containers with stable names** that match the backup command + `backup-target` to receive `docker cp` artifacts. |
| **deployment** (`deployment-script-plan` adapter) | `deployment-command-builders.utils.ts:28-45`, `ssh-live.adapter.ts:30`, `script-plan.adapter.ts:13` | Partially — `virtual-nginx` is a passive HTTP target; commands run via `server_agent` task-pull, not real ssh. | `ssh-server` container to exercise the `ssh` transport end-to-end (currently transport must be `server_agent` to work locally, see `devpilot-docker-staging.mjs:88-93`). |
| **site sync (nginx-site-plan)** | `site-ops-plan.utils.ts:164-174` (`nginx -t`, `systemctl reload nginx`) | Partially — `virtual-nginx` is plain nginx with no write access. | `nginx-site-target` (or reuse `virtual-nginx`) with bind-mounted conf dir so plans can be validated. |
| **server-executor task-pull** (agent target) | `server-agent.adapter.ts:43`, `env.schema.ts:153-162` | Yes via task-pull runner script (`devpilot-docker-staging.mjs:177-187`). | (None additional — task-pull is the agent side; the docker resource it talks to is `virtual-nginx`.) |
| **monitoring** (alert rules, dashboards) | `monitoring-access.service.ts`, `monitoring-notification-delivery-config.service.ts:30-68` | Minimal — alerts evaluated against snapshots only. | Optional: `prometheus` + `node-exporter` for real metric ingestion; `mailhog`/`smtp-sink` for `SMTP_*`/`MAIL_*` notification delivery config (`monitoring-notification-delivery-config.service.ts:39-68`). |
| **log-center SLS live query** | `aliyun-sls-log-query.adapter.ts:44-130` | Off by default (`LOG_CENTER_SLS_LIVE_QUERY_ENABLED=false`). | Optional: leave off (no production-equivalent local SLS); or stand in with a fake HTTP log endpoint via `fake-provider`. |
| **OAuth login** (GitHub/GitLab/Gitee) | `nestjs-oauth`, `apps/devpilot-api/.env.example:26-36` | No — empty client id/secret. | Optional: GitLab container for local OAuth flow; otherwise leave env empty (login falls back to email/password — already used by all demo scripts). |

---

## 3. Gap analysis (current vs needed)

Current `docker-compose.devpilot-staging.yml` provides exactly **5 services**:

1. `mysql:8.0` on `127.0.0.1:3320`, db `devpilot_g003_staging`, root/password — used as the API's own DB.
2. `redis:7-alpine` on `127.0.0.1:6384` — used as the API's own cache/lock.
3. `virtual-nginx` on `127.0.0.1:18098` — passive smoke target.
4. `backup-target` (alpine) — placeholder dir + dummy backup files.
5. `fake-provider` (node:20-alpine) on `127.0.0.1:19091` — single provisioning mock for `resource-request`.

### Verdict

The current compose file covers G003's "disposable staging" demo (one user/team/project,
one fake provisioning round, one backup dry-run). It does **not** cover:

- **Pool provisioning** (no second mysql/redis containers; the API's own DB cannot double as a pool
  because pool allocation creates new DB names and new users — that mutates the API's own schema).
- **Real SSH transport** for `server-executor` (only `server_agent` task-pull is exercised).
- **Docker API inventory** via dockerode (`dockerApiHost`/`dockerApiSocket` has nothing to connect
  to inside the staging stack — `resource-control-docker-inventory.utils.ts:34-65` only stubs).
- **Object storage** (`tencent-cos`/`qiniu`/`cdn-refresh`) — no S3-compatible endpoint.
- **Backup source** for the names referenced in `backup.service.ts:504-563` (`devpilot-...-mysql`
  container name does not exist; the script hard-codes `devpilot-g003-mysql` only inside the
  staging seed, see `devpilot-docker-staging.mjs:131`).
- **Email / SMS** delivery (no SMTP sink; `SMS_*` and `SMTP_*` env vars unexercised).

### What is already sufficient

- API's own MySQL & Redis (with healthchecks).
- `fake-provider` HTTP provisioning roundtrip.
- Task-pull agent target via virtual-nginx.

---

## 4. Recommended docker resources (one per line, with rationale)

The set below is grouped into **Tier A (must add — closes real flow gaps)** and
**Tier B (optional — widen coverage but not required for the core local flow)**. Tier A is the
minimum that turns "production_like_ready" into "every locally-testable flow is testable".

### Tier A — must add

1. **`resource-mysql`** — second `mysql:8.0` container dedicated to *resource* / *pool* use
   (DB-per-project allocation, restore target). Distinct from the API's own mysql so seeding and
   allocation don't collide with the live schema. Justification: pool provisioning
   (`resource-pool-provisioning.service.ts:35-44`) creates DBs/users by name; backup steps
   (`backup.service.ts:538-562`) hard-code `docker exec ${containerName}`.
2. **`resource-redis`** — second `redis:7-alpine` for pool allocation (DB index 1..15) and redis
   backup (`backup.service.ts:510-535` hard-codes `docker cp ${container}:/data/dump.rdb`).
3. **`resource-postgres`** — `postgres:15-alpine` so the `postgresql` default resource type
   (`resource-type-defaults.constants.ts:55-84`) has a real endpoint. Cheap; removes a hole.
4. **`ssh-server`** — `linuxserver/openssh-server:latest` (or `lscr.io/linuxserver/openssh-server`)
   with password auth, so the `ssh` transport (`ssh-live.adapter.ts:30`, `script-plan.adapter.ts:13`)
   runs end-to-end instead of forcing `server_agent`. Justification: G004 wants every
   locally-testable flow automated; SSH is currently only testable via mocks.
5. **`minio`** — `minio/minio:latest` S3-compatible endpoint on fixed ports, plus a seeded bucket.
   Stands in for `tencent-cos` and `qiniu` object storage so `cdn.service.ts`, `cloud-inventory.ts`
   for `tencent-cos`, and the `object-storage-qiniu` feature flag can all be smoke-tested locally
   against one endpoint.
6. **`docker-socket-proxy`** (or `docker:dind`) — read-only docker daemon target so
   `dockerApiHost: tcp://docker-socket-proxy:2375` resolves in
   `docker-inventory-executor.factory.ts:55-66`, letting `resource-control` exercise live
   dockerode inventory rather than only the stub at `resource-control-docker-inventory.utils.ts:34-65`.
7. **`mailhog`** (or `maildev`) — SMTP sink on 1025 / HTTP UI on 8025. Wires into `SMTP_HOST` /
   `SMTP_PORT` / `MAIL_FROM` consumed by `monitoring-notification-delivery-config.service.ts:39-68`.
   Without it, alert notification delivery is unverifiable locally.

### Tier B — optional, wider coverage

8. **`gitlab`** — `gitlab/gitlab-ce:latest` (heavy). Would let OAuth (`GITHUB_CLIENT_ID`-style
   envs, `nestjs-oauth`) and `git-account` resource type run locally. **Recommendation: skip in
   default compose**, expose via a `docker-compose.devpilot-staging.gitlab.yml` override; document
   it as opt-in because of the image size. Login already falls back to email/password.
9. **`prometheus` + `node-exporter`** — would give real metric ingestion. **Recommendation: skip**
   for the local-flow tier; metric evaluation (`monitoring-alert-resource-metric-threshold-evaluation.service.ts`)
   already runs against `ResourceMetricSnapshot` rows, which can be seeded directly. Add only if
   the user later asks for live scraping.
10. **`rabbitmq`** — rejected: the queue port is DB-backed
    (`apps/devpilot-api/src/server-executor/queue/queue.module.ts:14-20` binds `DbJobQueue`), not
    external. `nestjs-queue` keys exist but the only consumer uses Redis/DB. No docker fixture needed.

### Alternatives rejected

- **Reusing the API's mysql as the resource/pool mysql**: rejected — pool allocation runs
  `CREATE DATABASE db_xxx` and creates users (`resource-pool-provisioning.service.ts:35-44`); doing
  that against the API's own DB risks polluting schema and breaking the running API. Keep separate.
- **Single nginx serving both smoke and site-sync**: rejected — site-sync writes config files and
  reloads nginx (`site-ops-plan.utils.ts:164-174`); reusing `virtual-nginx` would couple the
  disposable smoke target to mutable state. Keep `virtual-nginx` immutable; expose
  `nginx-site-target` as a separate service when site-sync is exercised (Tier B / future).
- **Real aliyun-sls / tencent-cos / qiniu**: rejected — requires real cloud creds and violates
  G004's "do not claim real cloud validation" rule. MinIO is the local substitute.
- **Standing up the API & web inside compose**: out of scope. The prompt's mention of
  `docker-compose.devpilot-app.yml` does not exist in this worktree
  (`ls docker-compose.devpilot-app.yml` → not found). Local flow runs the API via
  `pnpm --filter @svton/devpilot-api dev` (`devpilot-docker-staging.mjs:96`), which is the
  established convention.

---

## 5. How to create each resource (concrete spec)

Naming convention follows the existing pattern: container `devpilot-g003-<role>`, compose service
`<role>`. Existing env-driven ports use `DEVPILOT_STAGING_*_PORT` defaults; we extend that scheme.

| Service | Image | Container name | Host port env (default → container) | Volume | Network | Healthcheck |
|---|---|---|---|---|---|---|
| `resource-mysql` | `mysql:8.0` | `devpilot-g003-resource-mysql` | `DEVPILOT_STAGING_RESOURCE_MYSQL_PORT` (3321 → 3306) | `devpilot-g003-resource-mysql-data` | default | `mysqladmin ping -h 127.0.0.1 -uroot -p${MYSQL_ROOT_PASSWORD} --silent` (reuse pattern from `:13-16`) |
| `resource-redis` | `redis:7-alpine` | `devpilot-g003-resource-redis` | `DEVPILOT_STAGING_RESOURCE_REDIS_PORT` (6385 → 6379) | `devpilot-g003-resource-redis-data` | default | `redis-cli ping` (reuse pattern from `:23-26`) |
| `resource-postgres` | `postgres:15-alpine` | `devpilot-g003-resource-postgres` | `DEVPILOT_STAGING_RESOURCE_POSTGRES_PORT` (5433 → 5432) | `devpilot-g003-resource-postgres-data` | default | `pg_isready -U postgres` |
| `ssh-server` | `lscr.io/linuxserver/openssh-server:latest` | `devpilot-g003-ssh-server` | `DEVPILOT_STAGING_SSH_PORT` (2223 → 2222) | `devpilot-g003-ssh-server-config` | default | `nc -z 127.0.0.1 2222` (via `--health-cmd`) |
| `minio` | `minio/minio:latest` (`server /data --console-address ":9001"`) | `devpilot-g003-minio` | `DEVPILOT_STAGING_MINIO_PORT` (9100 → 9000), `DEVPILOT_STAGING_MINIO_CONSOLE_PORT` (9101 → 9001) | `devpilot-g003-minio-data` | default | `curl -fsS http://127.0.0.1:9000/minio/health/live` |
| `docker-socket-proxy` | `tecnativa/docker-socket-proxy:0.3.0` (read-only, `CONTAINERS=1`, `INFO=1`, `IMAGES=1`, `EXEC=1`) | `devpilot-g003-docker-socket-proxy` | `DEVPILOT_STAGING_DOCKER_PROXY_PORT` (2376 → 2375) | (mounts host `/var/run/docker.sock` read-only) | default | `curl -fsS http://127.0.0.1:2375/version` |
| `mailhog` | `mailhog/mailhog:latest` | `devpilot-g003-mailhog` | `DEVPILOT_STAGING_SMTP_PORT` (1025 → 1025), `DEVPILOT_STAGING_MAILHOG_HTTP_PORT` (8025 → 8025) | (none, ephemeral) | default | `nc -z 127.0.0.1 8025` |

Env vars for each (added to compose `environment:` block):

- `resource-mysql`: `MYSQL_ROOT_PASSWORD=password`, `MYSQL_DATABASE=devpilot_resource_pool`.
- `resource-redis`: `REDIS_PASSWORD=` (empty, matches the API's own pattern at
  `docker-compose.devpilot-staging.yml:18-27`).
- `resource-postgres`: `POSTGRES_PASSWORD=password`, `POSTGRES_DB=devpilot_resource_pool`.
- `ssh-server`: `PASSWORD_AUTH=true`, `USER_NAME=devpilot`, `USER_PASSWORD=devpilot`,
  `PUBLIC_KEY_DIR=/devpilot-keys` (optional pubkey), `SUDO_ACCESS=false`.
- `minio`: `MINIO_ROOT_USER=minio`, `MINIO_ROOT_PASSWORD=minio12345`,
  `MINIO_BROWSER=on`.
- `docker-socket-proxy`: `CONTAINERS=1 INFO=1 IMAGES=1 EXEC=1 VERSION=1 NETWORKS=1 VOLUMES=1`.
- `mailhog`: `MH_STORAGE=memory` (ephemeral; matches G003 disposable-staging policy).

---

## 6. How to populate / seed each

The existing seed mechanism is `scripts/devpilot-docker-staging.mjs::seedStagingRecords`
(`:126-142`) which uses Prisma directly. Extend the same pattern — no separate prisma seed file is
needed (the project currently has no `prisma/seed.ts` — see `find apps -name seed*` → none).

### 6.1 Per-resource seeding actions

| Resource | Seed action | Where it runs |
|---|---|---|
| `resource-mysql` | `CREATE DATABASE db_demo; CREATE USER 'user_db_demo'@'%' IDENTIFIED BY '<hex>'; GRANT ALL ON db_demo.* TO ...;` — mirrors `resource-pool-provisioning.service.ts:35-44`. | `docker compose exec resource-mysql mysql ...` step in the staging runner (after healthcheck). |
| `resource-redis` | `redis-cli -n 1 SET devpilot:seed 'ok'` (proves DB 1 is writable for pool allocation). | compose exec in runner. |
| `resource-postgres` | `CREATE DATABASE db_demo; CREATE ROLE user_db_demo LOGIN PASSWORD '<hex>'; GRANT ALL ... ;` — mirrors `:45-55`. | compose exec in runner. |
| `ssh-server` | After first boot, set `devpilot/devpilot` password via env (already done at creation). Seed a `Server` row in Prisma with `host=127.0.0.1`, `port=2223`, `username=devpilot`, `authType=password`, encrypted credentials. | Runner `seedStagingRecords`. |
| `minio` | `mc alias set local http://minio:9000 minio minio12345 && mc mb local/devpilot-test` — bucket for qiniu/cos stand-in. Seed a `TeamCredential` row carrying the S3-compatible shape so `cdn.service.ts` / `cloud-provider-inventory.service.ts` find it. | compose run a one-shot `minio/mc` container, then Prisma insert. |
| `docker-socket-proxy` | No data seed; seed a `Server` row whose `tags` include `{ dockerApiHost: 'tcp://docker-socket-proxy:2375' }` so `docker-inventory-executor.factory.ts:55-66` picks the dockerode path. | Runner `seedStagingRecords`. |
| `mailhog` | No data seed; set `SMTP_HOST=mailhog`, `SMTP_PORT=1025`, `MAIL_FROM=devpilot@staging.local` in the API env so `monitoring-notification-delivery-config.service.ts:39-68` validates. | API env in runner. |

### 6.2 Fixture JSON for `ResourceType` extensions

The default types in `resource-type-defaults.constants.ts:25-362` are already upserted by
`ResourceTypeService.ensureDefaults()` on boot. **Do not** mutate them; instead, the seed script
should add a small number of additional `ResourceType` rows for the new local backings:

- `local-mysql-pool` (provisioningMode `pool`) — points at `resource-mysql` endpoint.
- `local-redis-pool` (provisioningMode `pool`) — points at `resource-redis`.
- `local-postgres` (provisioningMode `manual`) — delivery points at `resource-postgres`.
- `local-object-storage` (provisioningMode `manual`, category `storage`) — delivery carries MinIO
  endpoint + bucket + access/secret keys.
- `local-ssh-server` (provisioningMode `manual`, alias of `server` default) — delivery points at
  the ssh-server container.

Each seeded via the existing `prisma.resourceType.create` pattern (see
`devpilot-docker-staging.mjs:139`).

### 6.3 References to existing runbooks

- `docs/devpilot/demo-runbook.md` — already documents the disposable demo flow and the
  `node scripts/devpilot-docker-staging.mjs run` entrypoint (`:357-376`). The new resources are
  additive; the runbook section "disposable staging rehearsal" must be extended with the new
  services in the matrix (currently `:60-72`).
- `docs/devpilot/resource-request-minimum-loop.md` — staging checklist (`:36,60-67`). Add notes
  for pool/ssh/object-storage flows.

---

## 7. How to manage each (lifecycle, naming, env-driven ports, backup/restore)

### 7.1 Lifecycle

- Start: `docker compose -f docker-compose.devpilot-staging.yml up -d --remove-orphans`
  (already wrapped by `node scripts/devpilot-docker-staging.mjs up`).
- Stop & wipe volumes: `node scripts/devpilot-docker-staging.mjs down` (already runs
  `compose down -v --remove-orphans`).
- Reset a single resource: `docker compose rm -sfsv resource-mysql && docker volume rm
  devpilot-g003-resource-mysql-data` — only when iterating; the default policy is full-stack
  disposable reset (matches G003 staging policy).

### 7.2 Backup / restore

- The `backup-target` container (alpine, `docker-compose.devpilot-staging.yml:36-38`) already
  owns the `/var/backups/devpilot/{mysql,redis}` directory. **Keep it**; the new resource
  containers must use container names that match the regex in the seeded command policy
  (`devpilot-docker-staging.mjs:152-154` — currently anchored to `devpilot-g003-mysql`). Two
  options:
  - **Recommended:** name the resource mysql `devpilot-g003-mysql` so the existing policy regex
    continues to match without changes; rename the API's own mysql to `devpilot-g003-api-mysql`.
    This keeps backup/restore demo flow (`devpilot-docker-staging.mjs:170-187`) unchanged.
  - Rejected: extend command policy regex to add `devpilot-g003-resource-mysql` — doubles the
    surface area; the API's own DB is not a valid backup target anyway.

  The implementation plan locks in the **rename** approach (see
  `docs/todos/2026-07-21-local-docker-resources-plan.md`).

### 7.3 Naming conventions

- Containers: `devpilot-g003-<role>` (matches existing).
- Compose services: `<role>` kebab-case (matches existing `mysql`, `redis`, `virtual-nginx`).
- Ports: env var `DEVPILOT_STAGING_<ROLE>_PORT` with default that avoids collisions (existing
  pattern at `docker-compose.devpilot-staging.yml:11,22,33,44`).
- Project name stays `devpilot-g003-staging` (`docker-compose.devpilot-staging.yml:1`) so all
  containers share the default network and the `devpilot-g003-staging_default` network name.

### 7.4 Env-driven ports summary

| Env var | Default | Service |
|---|---|---|
| `DEVPILOT_STAGING_MYSQL_PORT` | 3320 | api's own mysql (existing) |
| `DEVPILOT_STAGING_REDIS_PORT` | 6384 | api's own redis (existing) |
| `DEVPILOT_STAGING_NGINX_PORT` | 18098 | virtual-nginx (existing) |
| `DEVPILOT_STAGING_FAKE_PROVIDER_PORT` | 19091 | fake-provider (existing) |
| `DEVPILOT_STAGING_API_MYSQL_PORT` (new, rename) | 3320 | api's own mysql (renamed service) |
| `DEVPILOT_STAGING_RESOURCE_MYSQL_PORT` | 3321 | resource-mysql |
| `DEVPILOT_STAGING_RESOURCE_REDIS_PORT` | 6385 | resource-redis |
| `DEVPILOT_STAGING_RESOURCE_POSTGRES_PORT` | 5433 | resource-postgres |
| `DEVPILOT_STAGING_SSH_PORT` | 2223 | ssh-server |
| `DEVPILOT_STAGING_MINIO_PORT` | 9100 | minio S3 |
| `DEVPILOT_STAGING_MINIO_CONSOLE_PORT` | 9101 | minio console |
| `DEVPILOT_STAGING_DOCKER_PROXY_PORT` | 2376 | docker-socket-proxy |
| `DEVPILOT_STAGING_SMTP_PORT` | 1025 | mailhog SMTP |
| `DEVPILOT_STAGING_MAILHOG_HTTP_PORT` | 8025 | mailhog UI |

---

## 8. Integration points

### 8.1 Env vars consumed in `apps/devpilot-api/src` (will be set by the runner)

| Env | Source | Set by |
|---|---|---|
| `DATABASE_URL`, `REDIS_HOST/PORT/PASSWORD/DB` | API's own mysql/redis | runner already sets (`devpilot-docker-staging.mjs:78-83`). |
| `RESOURCE_PROVISIONING_HTTP_ENABLED=true` | enables HTTP provisioning | runner already sets (`:87`). |
| `SMTP_HOST/PORT/MAIL_FROM` | mailhog | new runner env (read by `monitoring-notification-delivery-config.service.ts:39-68`). |
| `QINIU_*`, `TENCENT_*`, `SMS_*` | MinIO stand-in / fake-provider | Optional; left unset in default local flow because `cdn.service.ts` only invokes on `cdn-refresh` and the SMS module isn't imported in `app.module.ts` (it's a generator feature flag at `config/features.json:64`). |
| `LOG_CENTER_SLS_LIVE_QUERY_ENABLED` | stays `false` | env default (`env.schema.ts:78`). |
| `SERVER_EXECUTOR_AGENT_TARGET_ENABLED`, `...TASK_PULL_*` | ssh-server / task-pull | runner already sets (`:91-94`). |

### 8.2 How `resource-control` inventory sees the new resources

- The `docker-socket-proxy` service exposes the host docker daemon (read-only). Seeding a `Server`
  row with `tags: { dockerApiHost: 'tcp://docker-socket-proxy:2375' }` makes
  `DockerInventoryExecutorFactory.resolve()` (`docker-inventory-executor.factory.ts:32-41`)
  return `DockerApiInventoryExecutor` instead of the CLI executor. The real containers (resource-mysql,
  resource-redis, virtual-nginx, etc.) become discoverable as `ManagedResource` rows of
  `kind=docker_container` / `mysql` / `redis`.

### 8.3 How `resource-request` provisioning reaches the new resources

- `manual` mode: the seeded `local-*` resource types accept manual delivery JSON; the operator
  fills host/port/credentials matching the new containers (matches `resource-request-lifecycle.service.ts`).
- `pool` mode: `resource-request-pool-provisioning.service.ts` reads the matching `ResourcePool`
  row and calls `ResourcePoolProvisioningService.provisionResource()`
  (`resource-pool-provisioning.service.ts:29-72`) which parses the pool endpoint and returns a
  host/port/database/username/password delivery object. Seeding `ResourcePool` rows pointing at
  `127.0.0.1:3321` (mysql) and `127.0.0.1:6385` (redis) with `adminConfig`
  encrypted under the API's CBC default key closes this loop. (The original
  plan §3.1 called for POSTing via `/resource-pools` so the server would
  encrypt; the impl deviated to raw Prisma for drop-and-recreate idempotency
  but now seals the plaintext client-side with the same KDF + default key the
  API uses. See `encryptCbcForSeed` / `encryptGcmForSeed` in
  `scripts/devpilot-docker-staging.mjs`.)
- `api` / `webhook` mode: continues to use `fake-provider` (`:40-65`).

### 8.4 Backup reachability

`backup.service.ts:504-563` builds shell steps that call `docker exec devpilot-g003-mysql ...` and
`docker cp devpilot-g003-redis:/data/dump.rdb /var/backups/devpilot/redis/dump.rdb`. These run via
the server-executor against a `Server` row whose host is the host running docker. With the
recommended rename (resource-mysql = `devpilot-g003-mysql`), these commands work unchanged.

---

## 9. Sequencing constraints (high-level — see plan doc for step ordering)

1. Rename existing mysql service to `api-mysql` / container `devpilot-g003-api-mysql`, then add
   `resource-mysql` as `devpilot-g003-mysql` (so backup regex still matches).
2. Add the remaining Tier A services (`resource-redis`, `resource-postgres`, `ssh-server`,
   `minio`, `docker-socket-proxy`, `mailhog`).
3. Validate `docker compose config`.
4. Extend the seed runner (`scripts/devpilot-docker-staging.mjs::seedStagingRecords`) to seed the
   new `ResourceType`, `ResourcePool`, `Server`, `TeamCredential`, `ManagedResource` rows.
5. Extend `matrix()` (`:61-72`) to describe the new services and the runner env block (`:78-95`)
   to set `SMTP_*`.
6. Update `docs/devpilot/demo-runbook.md` matrix table and `docs/devpilot/resource-request-minimum-loop.md`.
7. Add a smoke check per new service in `observability()` (`:189-197`).

---

## 10. Verification approach (no execution in this phase)

The implementation plan defines exact commands. Highlights:

- `docker compose -f docker-compose.devpilot-staging.yml config` — must exit 0.
- `docker compose -f docker-compose.devpilot-staging.yml up -d --wait` — all healthchecks must
  pass.
- `curl -fsS http://127.0.0.1:9100/minio/health/live` — MinIO ready.
- `curl -fsS http://127.0.0.1:2376/version` via the proxy — docker daemon reachable.
- `nc -z 127.0.0.1 2223` — ssh-server listening.
- `docker compose exec resource-mysql mysql -uroot -ppassword -e 'SELECT 1'` — resource mysql ready.
- `node scripts/devpilot-docker-staging.mjs run` — full flow passes with new IDs and the extended
  matrix in the summary JSON.

---

## 11. Glossary / file index

- `docker-compose.devpilot-staging.yml` — the only compose file in the worktree (the
  `docker-compose.devpilot-app.yml` referenced in the prompt does not exist here).
- `scripts/devpilot-docker-staging.mjs` — disposable staging orchestrator; the only seed entrypoint.
- `apps/devpilot-api/src/resource-request/resource-type-defaults.constants.ts` — system-level
  ResourceType seed list.
- `apps/devpilot-api/src/resource-pool/resource-pool-provisioning.service.ts` — pool allocation
  contract (host/port/database/username/password shape).
- `apps/devpilot-api/src/resource-control/inventory/executors/docker-inventory-executor.factory.ts`
  — pick dockerode vs CLI by Server tags.
- `apps/devpilot-api/src/backup/backup.service.ts` — hard-coded container names + paths used by
  backup/restore command plans.
- `apps/devpilot-api/src/common/config/env.schema.ts` — every config knob with defaults.
- `apps/devpilot-api/.env.example` — base env (no `SMTP_*` / `QINIU_*` / docker-resource entries
  yet).
