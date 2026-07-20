# 2026-07-21 — Local Docker Resources Implementation Plan (s031)

Companion to `docs/todos/2026-07-21-local-docker-resources-investigation.md`.
This is the plan the **impl subagent** executes. Every step has verifiable acceptance criteria.

Branch: `codex/local-docker-resources-s031`.
Worktree: `/Users/zhaoxingbo/Workspace/ai-driven/svton-agent-deep-s030`.

All commands assume `cwd = /Users/zhaoxingbo/Workspace/ai-driven/svton-agent-deep-s030`.

---

## 0. Decisions locked in (do not re-litigate during impl)

These are resolved from project conventions in the investigation doc; the impl subagent must
follow them without asking the user.

1. **Rename the API's own mysql/redis** to `api-mysql` / `api-redis` (containers
   `devpilot-g003-api-mysql`, `devpilot-g003-api-redis`). The new resource/pool mysql/redis take
   the legacy names `devpilot-g003-mysql` / `devpilot-g003-redis` so the existing backup command
   regex (`scripts/devpilot-docker-staging.mjs:152-154`) and `backup.service.ts:504-563` container
   names keep matching without editing production code.
2. **No new compose files.** Everything goes into the existing
   `docker-compose.devpilot-staging.yml`. Project name `devpilot-g003-staging` stays.
3. **No `docker build`.** All services use published images. Customization happens through env
   vars and the existing seed script (`scripts/devpilot-docker-staging.mjs`).
4. **Tier A only in default compose.** Tier B (gitlab, prometheus, nginx-site-target) is
   out-of-scope for this slice.
5. **No prisma migration.** All new seed rows go through Prisma client calls in the existing
   seed runner; no schema change is needed.
6. **Disposable staging policy preserved.** New volumes use the `devpilot-g003-*` prefix and are
   wiped by `node scripts/devpilot-docker-staging.mjs down` (which already runs `compose down -v`).

---

## 1. Files to modify (exact paths)

| Path | Change |
|---|---|
| `docker-compose.devpilot-staging.yml` | Rename `mysql`→`api-mysql` (container `devpilot-g003-api-mysql`), `redis`→`api-redis` (container `devpilot-g003-api-redis`). Add 7 new services: `mysql` (resource pool, container `devpilot-g003-mysql`), `redis` (resource pool, container `devpilot-g003-redis`), `postgres`, `ssh-server`, `minio`, `docker-socket-proxy`, `mailhog`. Add 5 new named volumes. Keep `virtual-nginx`, `backup-target`, `fake-provider` unchanged. |
| `scripts/devpilot-docker-staging.mjs` | (a) Update `dbUrl` default port reference if needed (it already uses `3320` which is now the resource-mysql port — keep `3320` mapped to **api-mysql**, and map resource-mysql to `3321`). (b) Extend `matrix()` (`:61-72`) with the 7 new entries. (c) Extend `startApi()` env block (`:78-95`) with `SMTP_HOST=mailhog`, `SMTP_PORT=1025`, `MAIL_FROM=devpilot@staging.local`. (d) Extend `seedStagingRecords` (`:126-142`) to seed `local-mysql-pool`, `local-redis-pool`, `local-postgres`, `local-object-storage`, `local-ssh-server` `ResourceType` rows; two `ResourcePool` rows; one `Server` row with `dockerApiHost` tag; one `TeamCredential` for MinIO. (e) Extend `observability()` (`:189-197`) to ping `http://127.0.0.1:9100/minio/health/live` and `http://127.0.0.1:2376/version`. |
| `apps/devpilot-api/.env.example` | Add commented sections for the new optional envs: `SMTP_HOST`, `SMTP_PORT`, `MAIL_FROM`, `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`. Add a comment block "# Local Docker resources (see docker-compose.devpilot-staging.yml)". |
| `docs/devpilot/demo-runbook.md` | Update the matrix table (`:56-72`) to list the 7 new services and ports. Add a sub-section under "disposable staging rehearsal" (`:357-376`) explaining how the new resources participate. |
| `docs/devpilot/resource-request-minimum-loop.md` | Add notes to the staging checklist (`:60-67`) for pool/ssh/object-storage flows. |

### Files NOT to modify

- `apps/devpilot-api/prisma/schema.prisma` — no schema change.
- `apps/devpilot-api/src/**` production code — no code change.
- `apps/devpilot-api/src/resource-request/resource-type-defaults.constants.ts` — leave the
  built-in defaults untouched; new types are seeded by the runner.

---

## 2. Concrete compose additions (spec the impl must follow)

The impl must produce this exact service shape (paths and env names from the investigation doc §5).

```yaml
# Project name and existing services stay. Only showing the NEW + RENAMED services.

services:
  # ---------- RENAMED (API's own infrastructure) ----------
  api-mysql:
    image: mysql:8.0
    container_name: devpilot-g003-api-mysql
    environment:
      MYSQL_ROOT_PASSWORD: password
      MYSQL_DATABASE: devpilot_g003_staging
    ports:
      - "${DEVPILOT_STAGING_MYSQL_PORT:-3320}:3306"
    volumes:
      - devpilot-g003-api-mysql-data:/var/lib/mysql
    healthcheck:
      test: ["CMD-SHELL", "mysqladmin ping -h 127.0.0.1 -uroot -ppassword --silent"]
      interval: 5s
      timeout: 3s
      retries: 30

  api-redis:
    image: redis:7-alpine
    container_name: devpilot-g003-api-redis
    ports:
      - "${DEVPILOT_STAGING_REDIS_PORT:-6384}:6379"
    volumes:
      - devpilot-g003-api-redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 30

  # ---------- NEW: resource/pool/backup targets (Tier A) ----------
  mysql:                                      # resource pool mysql; keeps legacy name so backup regex matches
    image: mysql:8.0
    container_name: devpilot-g003-mysql
    environment:
      MYSQL_ROOT_PASSWORD: password
      MYSQL_DATABASE: devpilot_resource_pool
    ports:
      - "${DEVPILOT_STAGING_RESOURCE_MYSQL_PORT:-3321}:3306"
    volumes:
      - devpilot-g003-mysql-data:/var/lib/mysql
    healthcheck:
      test: ["CMD-SHELL", "mysqladmin ping -h 127.0.0.1 -uroot -ppassword --silent"]
      interval: 5s
      timeout: 3s
      retries: 30

  redis:                                      # resource pool redis
    image: redis:7-alpine
    container_name: devpilot-g003-redis
    ports:
      - "${DEVPILOT_STAGING_RESOURCE_REDIS_PORT:-6385}:6379"
    volumes:
      - devpilot-g003-redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 30

  postgres:
    image: postgres:15-alpine
    container_name: devpilot-g003-resource-postgres
    environment:
      POSTGRES_PASSWORD: password
      POSTGRES_DB: devpilot_resource_pool
    ports:
      - "${DEVPILOT_STAGING_RESOURCE_POSTGRES_PORT:-5433}:5432"
    volumes:
      - devpilot-g003-resource-postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 3s
      retries: 30

  ssh-server:
    image: lscr.io/linuxserver/openssh-server:latest
    container_name: devpilot-g003-ssh-server
    environment:
      PASSWORD_AUTH: "true"
      USER_NAME: devpilot
      USER_PASSWORD: devpilot
      SUDO_ACCESS: "false"
      PUID: "1000"
      PGID: "1000"
    ports:
      - "${DEVPILOT_STAGING_SSH_PORT:-2223}:2222"
    healthcheck:
      test: ["CMD-SHELL", "nc -z 127.0.0.1 2222 || exit 1"]
      interval: 5s
      timeout: 3s
      retries: 30

  minio:
    image: minio/minio:latest
    container_name: devpilot-g003-minio
    command: ["server", "/data", "--console-address", ":9001"]
    environment:
      MINIO_ROOT_USER: minio
      MINIO_ROOT_PASSWORD: minio12345
      MINIO_BROWSER: "on"
    ports:
      - "${DEVPILOT_STAGING_MINIO_PORT:-9100}:9000"
      - "${DEVPILOT_STAGING_MINIO_CONSOLE_PORT:-9101}:9001"
    volumes:
      - devpilot-g003-minio-data:/data
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://127.0.0.1:9000/minio/health/live"]
      interval: 10s
      timeout: 5s
      retries: 30

  docker-socket-proxy:
    image: tecnativa/docker-socket-proxy:0.3.0
    container_name: devpilot-g003-docker-socket-proxy
    environment:
      CONTAINERS: "1"
      INFO: "1"
      IMAGES: "1"
      EXEC: "1"
      VERSION: "1"
      NETWORKS: "1"
      VOLUMES: "1"
      POST: "1"            # needed for `docker exec` inventory probes
    ports:
      - "${DEVPILOT_STAGING_DOCKER_PROXY_PORT:-2376}:2375"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://127.0.0.1:2375/version"]
      interval: 10s
      timeout: 5s
      retries: 30

  mailhog:
    image: mailhog/mailhog:latest
    container_name: devpilot-g003-mailhog
    environment:
      MH_STORAGE: memory
    ports:
      - "${DEVPILOT_STAGING_SMTP_PORT:-1025}:1025"
      - "${DEVPILOT_STAGING_MAILHOG_HTTP_PORT:-8025}:8025"
    healthcheck:
      test: ["CMD-SHELL", "nc -z 127.0.0.1 8025 || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 30

# Existing virtual-nginx, backup-target, fake-provider blocks unchanged.

volumes:
  devpilot-g003-api-mysql-data:
  devpilot-g003-api-redis-data:
  devpilot-g003-mysql-data:
  devpilot-g003-redis-data:
  devpilot-g003-resource-postgres-data:
  devpilot-g003-minio-data:
```

Notes for impl:
- The compose file currently has NO `volumes:` top-level block; adding one is required.
- ~~`POST: "1"` on docker-socket-proxy is required because dockerode's `listContainers` is GET
  but `exec`-based probes (used by `docker-api-inventory-executor.ts`) need POST. Keep it scoped
  via the proxy.~~ **CORRECTION (post-CR): this rationale was false — there is no `.exec()` call
  site in `apps/devpilot-api/src`, and the only dockerode call is `listContainers` (GET). The
  impl dropped `POST=1` / `EXEC=1` / `NETWORKS=1` / `VOLUMES=1` from the proxy env and rewrote
  this comment; see `docs/todos/2026-07-21-local-docker-resources-fix-major1.md`.**
- `docker-socket-proxy` mounts `/var/run/docker.sock` read-only — this works on Linux and macOS
  Docker Desktop. If the host has no docker socket, the service healthcheck fails fast, which is
  the desired signal.

---

## 3. Seed runner extension (spec)

In `scripts/devpilot-docker-staging.mjs`:

### 3.1 New helper: `seedLocalResources(auth, ids)` (called from `run()`)

Adds, via Prisma client (matching the existing pattern at `:126-142`):

- **ResourceType** rows (all `createdById: auth.userId`, `approvalMode: 'manual'`):
  - `{ key: \`local-mysql-pool-${stamp}\`, name: 'Local MySQL Pool', category: 'database', provisioningMode: 'pool', provisioningConfig: { poolKey: 'local-mysql' } }`
  - `{ key: \`local-redis-pool-${stamp}\`, name: 'Local Redis Pool', category: 'cache', provisioningMode: 'pool', provisioningConfig: { poolKey: 'local-redis' } }`
  - `{ key: \`local-postgres-${stamp}\`, name: 'Local PostgreSQL', category: 'database', provisioningMode: 'manual' }`
  - `{ key: \`local-object-storage-${stamp}\`, name: 'Local Object Storage (MinIO)', category: 'storage', provisioningMode: 'manual' }`
  - `{ key: \`local-ssh-server-${stamp}\`, name: 'Local SSH Server', category: 'compute', provisioningMode: 'manual' }`
- **ResourcePool** rows (`adminConfig` = encrypted JSON via the runner's CryptoService
  equivalent — the script already uses raw Prisma; use the API's `/resource-pools` endpoint
  instead so encryption is handled server-side):
  - `{ type: 'mysql', name: 'Local MySQL Pool', endpoint: 'mysql://resource-mysql:3306', capacity: 10, status: 'active' }`
  - `{ type: 'redis', name: 'Local Redis Pool', endpoint: 'redis://resource-redis:6379', capacity: 15, status: 'active' }`
- **Server** row (the dockerode inventory target):
  `{ name: 'devpilot-g003-docker-host', host: 'docker-socket-proxy', port: 2375, username: '', authType: 'password', credentials: encryptedEmpty, status: 'online', tags: ['local-docker'], services: { dockerApiHost: 'tcp://docker-socket-proxy:2375' } }`
  (Use the API's `/servers` endpoint so the credentials field is encrypted consistently — see
  `resource-pool-credential.utils.ts:40` for the encryption key source.)
- **TeamCredential** row (MinIO stand-in for qiniu/tencent-cos):
  `{ provider: 'minio', name: 'Local MinIO (S3)', type: 'object-storage', config: encrypted({ endpoint: 'http://minio:9000', publicEndpoint: 'http://127.0.0.1:9100', accessKey: 'minio', secretKey: 'minio12345', bucket: 'devpilot-test' }) }`
- **ManagedResource** rows mirroring the live containers (optional but valuable):
  - `{ sourceType: 'server', provider: 'docker', kind: 'mysql', name: 'devpilot-g003-mysql', externalId: 'devpilot-g003-mysql', status: 'running', endpoint: 'mysql://resource-mysql:3306', serverId: <docker-host server id>, metadata: { syncMode: 'seeded_local' } }`
  - same for `redis`, `postgres`, `ssh-server`, `minio`.

### 3.2 Bucket bootstrap for MinIO

Add a one-shot bootstrap step in `run()` after `compose up`:

```
docker compose -f docker-compose.devpilot-staging.yml run --rm minio-mc mb local/devpilot-test || true
```

where `minio-mc` is added as a profile-gated one-shot service:

```yaml
  minio-mc:                                   # one-shot bucket bootstrap; not started by default
    image: minio/mc:latest
    container_name: devpilot-g003-minio-mc
    depends_on: { minio: { condition: service_healthy } }
    entrypoint: ["/bin/sh","-lc"]
    command: ["mc alias set local http://minio:9000 minio minio12345 && mc mb --ignore-existing local/devpilot-test"]
    profiles: ["seed"]
```

The runner invokes it explicitly: `docker compose ... --profile seed run --rm minio-mc`.

### 3.3 Matrix & env block updates

In `matrix()` add 7 lines:
```
resourceMysql: "docker compose service mysql on 127.0.0.1:3321 (resource pool)",
resourceRedis: "docker compose service redis on 127.0.0.1:6385 (resource pool)",
resourcePostgres: "docker compose service postgres on 127.0.0.1:5433",
sshServer: "ssh-server on 127.0.0.1:2223 (devpilot/devpilot) for ssh transport",
minio: "MinIO S3 on 127.0.0.1:9100 (console :9101), bucket devpilot-test",
dockerSocketProxy: "docker-socket-proxy on 127.0.0.1:2376 (read-only host daemon)",
# CORRECTION (post-CR): matrix description was updated to "GET-only docker
# daemon proxy; no POST/EXEC" in the actual script — see fix-major1.md.
mailhog: "Mailhog SMTP on 127.0.0.1:1025, UI :8025",
```

In `startApi()` env add:
```
SMTP_HOST: "127.0.0.1",
SMTP_PORT: "1025",
MAIL_FROM: "devpilot@staging.local",
```

(Use `127.0.0.1` because the API runs on the host, not in compose.)

### 3.4 Observability smoke checks

In `observability()` add `fetch('http://127.0.0.1:9100/minio/health/live')` and
`fetch('http://127.0.0.1:2376/version')` calls; store `minioStatus` and `dockerProxyStatus` in
the returned evidence.

---

## 4. Sequencing constraints (impl order)

| Step | Depends on |
|---|---|
| 1. Edit `docker-compose.devpilot-staging.yml` (rename + add services + volumes) | nothing |
| 2. `docker compose config` validates | step 1 |
| 3. `docker compose up -d --wait` brings everything healthy | step 2 |
| 4. Edit `scripts/devpilot-docker-staging.mjs` (matrix, env, seed, observability) | step 3 (so the runner can be tested against a live stack) |
| 5. Run `minio-mc` profile to create bucket | step 3 |
| 6. Run `node scripts/devpilot-docker-staging.mjs run` end-to-end | steps 4 + 5 |
| 7. Update `apps/devpilot-api/.env.example` | independent (parallel with 1) |
| 8. Update `docs/devpilot/demo-runbook.md` and `resource-request-minimum-loop.md` | independent (parallel with 1) |

Steps 7 and 8 are documentation-only and can happen any time before the final commit.

---

## 5. Acceptance criteria (verifiable)

Each must pass before the slice can move to CR.

### AC-1: compose syntax

```bash
docker compose -f docker-compose.devpilot-staging.yml config > /dev/null
```
Expected: exit 0, no stderr.

### AC-2: compose up — all healthy

```bash
docker compose -f docker-compose.devpilot-staging.yml up -d --wait
docker compose -f docker-compose.devpilot-staging.yml ps --format '{{.Service}}\t{{.Health}}'
```
Expected: every service shows `healthy` (or no health status for `backup-target`/`fake-provider`).
The 7 new services + 2 renamed services + 3 unchanged services = 12 services total.

### AC-3: per-service smoke tests

```bash
# Resource mysql
docker compose -f docker-compose.devpilot-staging.yml exec -T mysql \
  sh -lc 'mysql -uroot -ppassword -e "SELECT 1"'
# Resource redis
docker compose -f docker-compose.devpilot-staging.yml exec -T redis redis-cli ping
# Postgres
docker compose -f docker-compose.devpilot-staging.yml exec -T postgres pg_isready -U postgres
# SSH server (from host)
nc -z 127.0.0.1 2223 && echo OK
# MinIO health
curl -fsS http://127.0.0.1:9100/minio/health/live && echo
# Docker socket proxy
curl -fsS http://127.0.0.1:2376/version | head -c 80 && echo
# Mailhog
nc -z 127.0.0.1 1025 && nc -z 127.0.0.1 8025 && echo OK
```
Expected: each prints `OK` / `PONG` / JSON / exit 0.

### AC-4: MinIO bucket seeded

```bash
docker compose -f docker-compose.devpilot-staging.yml --profile seed run --rm minio-mc
docker compose -f docker-compose.devpilot-staging.yml exec -T minio \
  sh -lc 'mc ls local/devpilot-test'  # may fail if mc not in minio image; use the UI at :9101 instead
```
Expected: bucket `devpilot-test` exists (verifiable via the MinIO console at
http://127.0.0.1:9101 → login `minio`/`minio12345`).

### AC-5: end-to-end staging run

```bash
node scripts/devpilot-docker-staging.mjs run 2>&1 | tee /tmp/codex-tool-runs/svton/local-docker-resources-s031/run.log
```
Expected:
- exit 0
- summary JSON contains `status: "passed"`
- summary JSON `matrix` contains all 13 entries (6 existing + 7 new)
- summary JSON contains new keys: `localResources: { resourceTypeIds: [...], poolIds: [...], serverId, credentialId }`
- summary JSON `observability` contains `minioStatus: 200` and `dockerProxyStatus: 200`

### AC-6: env example updated

```bash
rg -n "SMTP_HOST|MINIO_ENDPOINT|Local Docker resources" apps/devpilot-api/.env.example
```
Expected: at least 3 matches.

### AC-7: docs updated

```bash
rg -n "resource-mysql|ssh-server|minio|docker-socket-proxy|mailhog" docs/devpilot/demo-runbook.md docs/devpilot/resource-request-minimum-loop.md
```
Expected: matches in both files.

---

## 6. Roll-back / cleanup

If any AC fails during impl:

```bash
node scripts/devpilot-docker-staging.mjs down   # compose down -v --remove-orphans
git restore docker-compose.devpilot-staging.yml scripts/devpilot-docker-staging.mjs
```

The slice is purely additive to compose + seed runner + docs; no production code is touched, so
rollback is trivial.

---

## 7. Risks & mitigations

| Risk | Mitigation |
|---|---|
| `lscr.io/linuxserver/openssh-server` image pull is slow / rate-limited | Document alternative `ghcr.io/linuxserver/openssh-server`; both tags point to the same image. If pull fails, mark `ssh-server` as optional via a compose profile and continue with `server_agent` transport (current behavior). |
| `docker-socket-proxy` requires `/var/run/docker.sock` on the host | Healthcheck fails fast if absent; the seed runner treats `dockerProxyStatus != 200` as a warning, not a hard failure. |
| Renaming `mysql`→`api-mysql` may break references in other scripts | `rg "devpilot-g003-mysql\|service mysql\|mysql:" scripts/ apps/ docs/` first; the only hard reference is `backup.service.ts` (kept matching by giving the resource pool mysql the legacy name) and `devpilot-docker-staging.mjs:131,152-154` (unchanged because container name is preserved on the resource side). |
| `MINIO_ROOT_PASSWORD` length validation | `minio12345` is 10 chars; MinIO requires ≥8. OK. |
| Port conflicts on developer machine | All new ports use `DEVPILOT_STAGING_*_PORT` env overrides with non-default numbers (3321, 6385, 5433, 2223, 9100/9101, 2376, 1025/8025). |

---

## 8. Out-of-scope (explicitly not in this slice)

- GitLab / GitHub OAuth mock (Tier B).
- Prometheus + node-exporter live metric ingestion (Tier B).
- RabbitMQ (queue is DB-backed — `queue.module.ts:14-20`).
- A separate `nginx-site-target` for site-sync plan execution (Tier B).
- Building/publishing the API & web images into compose (the project runs them via `pnpm dev`).
- Any change to `schema.prisma` or production TS code.

---

## 9. Files for the CR reviewer to focus on

1. `docker-compose.devpilot-staging.yml` — rename correctness, volume additions, healthchecks,
   `docker-socket-proxy` socket mount.
2. `scripts/devpilot-docker-staging.mjs` — seed rows match the model fields in `schema.prisma`
   (no typo in `provisioningMode` enum, `sourceType`/`provider`/`kind` values from
   `ManagedResource` comments at `schema.prisma:1384-1386`).
3. `apps/devpilot-api/.env.example` — only additive, commented sections.
