# Fix spec — Finding 2 (MAJOR): seeded endpoints use compose-internal hostnames

Source: `docs/todos/2026-07-21-local-docker-resources-cr.md` Finding 2 (lines 88-137) +
open question #2 (lines 343-347).
Branch reviewed: `codex/local-docker-resources-s031`.
Investigation log: `/tmp/codex-tool-runs/svton/local-docker-resources-s031/fix-major2/`.

---

## 1. Verdict

**Write host-reachable literal `127.0.0.1:NNNN` endpoints** in every seed row
where the API is the consumer. **Not** compose-internal `service:NNNN`. **Not** a
new `DEVPILOT_STAGING_HOST` env var. **Not** `localhost`.

Rationale:

1. **The API runs on the host, not in compose.**
   `scripts/devpilot-docker-staging.mjs:111` spawns the API via
   `corepack pnpm --filter @svton/devpilot-api dev`, and `apps/devpilot-api/package.json`
   defines `"dev": "nest start --watch"`. There is **no** `Dockerfile` under
   `apps/devpilot-api/`, **no** `docker-compose.devpilot-app.yml` in the repo
   (`rg "docker-compose.devpilot-app" -g '!node_modules' -g '!.git'` matches
   only this fix doc and the CR itself — the prompt's hypothesis was wrong), and
   no goal/slice in `.agent-board/goals/{G001..G004}.json` or
   `.agent-board/slices/S00*.json` plans to dockerize the API. So from the API
   process's perspective, compose-internal service names (`resource-mysql`,
   `docker-socket-proxy`, etc.) are unresolvable — `getaddrinfo` fails. The
   host-side published ports are the only reachable address form.

2. **The codebase already picked this convention.** The pre-slice
   `seedStagingRecords` row at git `58bc2748:scripts/devpilot-docker-staging.mjs:134`
   wrote `endpoint: "mysql://127.0.0.1:3320/devpilot_g003_staging"`; the slice
   updated it to `mysql://127.0.0.1:3321/devpilot_resource_pool`
   (`scripts/devpilot-docker-staging.mjs:151`). The runner's own `matrix()`
   self-description at `:64-72` advertises every service as
   `127.0.0.1:NNNN`. The seed's `startApi()` env (`:14-15,18,95,107`) and the
   `dbUrl` default (`:15`) all use literal `127.0.0.1`. The `seedLocalResources`
   block at `:185-205` is the **only** place in the file that deviates — it
   copied the strings verbatim from `docs/todos/2026-07-21-local-docker-resources-plan.md`
   §3.1, which pre-dated the rename decision (per CR Finding 2 lines 102-104).
   Aligning means deleting the deviation, not introducing a new pattern.

3. **The consumer code parses URLs and uses the hostname verbatim.**
   `resource-pool-provisioning.service.ts:81-98` does `new URL(endpoint)` and
   returns `url.hostname` / `url.port`. The docker inventory factory at
   `docker-inventory-executor.factory.ts:55-60` reads `services.dockerApiHost`
   and passes it to `new Docker({ host, port: 2376 })` (the port is hard-coded
   to `2376`, see §7-Q2). docker-modem at
   `node_modules/.pnpm/docker-modem@5.0.7/.../lib/modem.js:147-155` does
   `url.parse(this.host)` and uses `parsed.hostname` for the actual TCP dial.
   In all three cases the hostname is taken literally from the seeded string,
   so it must be something the API process can resolve. `127.0.0.1` always
   resolves to IPv4 loopback on every platform; `resource-mysql` resolves
   nowhere.

---

## 2. Per-row endpoint mapping

All values use the host-side published port from `docker-compose.devpilot-staging.yml`
(`3321`, `6385`, `5433`, `2223`, `9100`, `2376`). The database name on the
resource-pool mysql matches the compose env `MYSQL_DATABASE: devpilot_resource_pool`
(`docker-compose.devpilot-staging.yml:44`).

| # | Row (file:line) | Field | Old value | New value |
|---|---|---|---|---|
| 1 | `scripts/devpilot-docker-staging.mjs:185` | `ResourcePool.endpoint` (mysql) | `mysql://resource-mysql:3306` | `mysql://127.0.0.1:3321/devpilot_resource_pool` |
| 2 | `scripts/devpilot-docker-staging.mjs:186` | `ResourcePool.endpoint` (redis) | `redis://resource-redis:6379` | `redis://127.0.0.1:6385` |
| 3 | `scripts/devpilot-docker-staging.mjs:190` | `Server.services.dockerApiHost` | `tcp://docker-socket-proxy:2375` | `tcp://127.0.0.1:2376` |
| 4 | `scripts/devpilot-docker-staging.mjs:190` | `Server.host` (same row) | `docker-socket-proxy` | `127.0.0.1` |
| 4b| `scripts/devpilot-docker-staging.mjs:190` | `Server.port` (same row) | `2375` | `2376` |
| 5 | `scripts/devpilot-docker-staging.mjs:202` | `ManagedResource.endpoint` (redis) | `redis://resource-redis:6379` | `redis://127.0.0.1:6385` |
| 6 | `scripts/devpilot-docker-staging.mjs:203` | `ManagedResource.endpoint` (postgres) | `postgres://resource-postgres:5432` | `postgres://127.0.0.1:5433/devpilot_resource_pool` |
| 7 | `scripts/devpilot-docker-staging.mjs:204` | `ManagedResource.endpoint` (ssh) | `ssh://ssh-server:2222` | `ssh://127.0.0.1:2223` |
| 8 | `scripts/devpilot-docker-staging.mjs:205` | `ManagedResource.endpoint` (minio) | `http://minio:9000` | `http://127.0.0.1:9100` |

Notes on the mappings:

- **Row 1 (mysql pool):** The existing `seedStagingRecords` row at `:151` writes
  `mysql://127.0.0.1:3321/devpilot_resource_pool` — same DB, same container,
  same port. The pool row should match it exactly so the pool's
  `parseEndpoint()` returns the same host/port/database triplet the direct
  `ManagedResource` row advertises. The current
  `mysql://resource-mysql:3306` has no `/database` segment and would dial the
  wrong (internal) port even if DNS resolved.
- **Row 3 (dockerApiHost):** The factory at
  `docker-inventory-executor.factory.ts:60` hard-codes `port: 2376` regardless
  of the URL's port — so `tcp://127.0.0.1:2376` and `tcp://127.0.0.1:9999`
  produce the same dial target (`127.0.0.1:2376`). Writing `2376` in the URL
  anyway is correct because (a) it matches the actual host-side published port
  and (b) it stays self-consistent if the factory's hard-coding is ever removed.
  See §7-Q2 for the dockerode URL-parsing trace.
- **Row 4 (Server.host/port):** Strictly metadata today — `Server.host` and
  `Server.port` only surface in `displayName` and `metadata` via
  `server-executor-target-resolution.service.ts:84-91` and
  `credential-resolver.ts:89,95`; they are not used to dial in the docker-API
  path (the factory reads `services.dockerApiHost` instead). But leaving
  `host: "docker-socket-proxy"` produces a misleading
  `displayName: "@docker-socket-proxy:2375"`. Aligning it to `127.0.0.1:2376`
  is a one-line cleanup that costs nothing and removes the last compose-name
  reference from the row.
- **Row 8 (minio):** The host-side MinIO S3 port is `9100`
  (`docker-compose.devpilot-staging.yml:111`). The `9101` port is the console,
  not the S3 API — keep `9100` in the endpoint.
- **`ManagedResource.endpoint` for `sourceType: "server"` is informational.**
  Per `resource-control-connection-probe.service.ts:68` and
  `server-script.executor.ts:46`, the endpoint is stored as `targetEndpoint` /
  passed as metadata only; the actual SSH dial uses `serverExecutor.resolveTarget(teamId, serverId)`
  which reads `Server.host/port` from the row bound via `serverId`, not the
  `ManagedResource.endpoint`. So rows 5-8 are functionally cosmetic today, but
  aligning them removes the misleading data and makes the rows usable if a
  future slice adds a direct-DB or direct-redis adapter that does dial the
  endpoint.

---

## 3. Concrete diff spec

### 3.1 `scripts/devpilot-docker-staging.mjs`

**`:185` — mysql pool endpoint:**

```diff
-    const mysqlPool = await prisma.resourcePool.create({ data: { type: "mysql", name: "Local MySQL Pool", endpoint: "mysql://resource-mysql:3306", adminConfig: "redacted", capacity: 10, allocated: 0, status: "active" } });
+    // endpoint is host-reachable because the API runs on the host via `pnpm dev`,
+    // not inside the compose network (see startApi at :111). Matches the
+    // seedStagingRecords mysql row at :151.
+    const mysqlPool = await prisma.resourcePool.create({ data: { type: "mysql", name: "Local MySQL Pool", endpoint: "mysql://127.0.0.1:3321/devpilot_resource_pool", adminConfig: "redacted", capacity: 10, allocated: 0, status: "active" } });
```

**`:186` — redis pool endpoint:**

```diff
-    const redisPool = await prisma.resourcePool.create({ data: { type: "redis", name: "Local Redis Pool", endpoint: "redis://resource-redis:6379", adminConfig: "redacted", capacity: 15, allocated: 0, status: "active" } });
+    const redisPool = await prisma.resourcePool.create({ data: { type: "redis", name: "Local Redis Pool", endpoint: "redis://127.0.0.1:6385", adminConfig: "redacted", capacity: 15, allocated: 0, status: "active" } });
```

**`:190` — dockerHost Server row (host, port, and services.dockerApiHost):**

```diff
-    const dockerHost = await prisma.server.create({ data: { teamId: auth.teamId, createdById: auth.userId, name: "devpilot-g003-docker-host", host: "docker-socket-proxy", port: 2375, username: "", authType: "password", credentials: "redacted", status: "online", tags: ["local-docker"], services: { dockerApiHost: "tcp://docker-socket-proxy:2375" } } });
+    // host/port/dockerApiHost are all host-reachable: the API runs on the host
+    // (startApi at :111), so docker-socket-proxy is reachable only via the
+    // published port 127.0.0.1:2376 (compose :144). The factory at
+    // docker-inventory-executor.factory.ts:60 hard-codes port 2376 from the
+    // dockerApiHost URL's hostname, so the URL must carry a resolvable host.
+    const dockerHost = await prisma.server.create({ data: { teamId: auth.teamId, createdById: auth.userId, name: "devpilot-g003-docker-host", host: "127.0.0.1", port: 2376, username: "", authType: "password", credentials: "redacted", status: "online", tags: ["local-docker"], services: { dockerApiHost: "tcp://127.0.0.1:2376" } } });
```

**`:202-205` — mrSpecs endpoints:**

```diff
     const mrSpecs = [
-      { kind: "redis", name: "devpilot-g003-redis", endpoint: "redis://resource-redis:6379" },
-      { kind: "database", name: "devpilot-g003-resource-postgres", endpoint: "postgres://resource-postgres:5432" },
-      { kind: "docker_container", name: "devpilot-g003-ssh-server", endpoint: "ssh://ssh-server:2222" },
-      { kind: "object_storage", name: "devpilot-g003-minio", endpoint: "http://minio:9000" },
+      // All endpoints are host-reachable (API runs on the host via pnpm dev;
+      // see startApi at :111). Ports match the compose host-side bindings:
+      // resource redis 6385 (:59), postgres 5433 (:75), ssh 2223 (:95),
+      // minio 9100 (:111).
+      { kind: "redis", name: "devpilot-g003-redis", endpoint: "redis://127.0.0.1:6385" },
+      { kind: "database", name: "devpilot-g003-resource-postgres", endpoint: "postgres://127.0.0.1:5433/devpilot_resource_pool" },
+      { kind: "docker_container", name: "devpilot-g003-ssh-server", endpoint: "ssh://127.0.0.1:2223" },
+      { kind: "object_storage", name: "devpilot-g003-minio", endpoint: "http://127.0.0.1:9100" },
     ];
```

### 3.2 Doc updates

**`docs/devpilot/demo-runbook.md:402-408`** — replace the bullet block:

```diff
-- `ResourcePool` rows for `mysql` and `redis` pointing at `resource-mysql:3306`
-  and `resource-redis:6379` so pool provisioning (`resource-pool-provisioning.service.ts`)
-  returns a real host/port/database delivery object.
-- `Server` row with `tags: { dockerApiHost: 'tcp://docker-socket-proxy:2375' }`
-  so `docker-inventory-executor.factory.ts` selects the dockerode inventory
-  path; the live `mysql`/`redis`/`postgres`/`ssh-server`/`minio` containers
-  become discoverable as `ManagedResource` rows.
+- `ResourcePool` rows for `mysql` and `redis` pointing at
+  `mysql://127.0.0.1:3321/devpilot_resource_pool` and `redis://127.0.0.1:6385`
+  (host-reachable — the API runs on the host via `pnpm dev`, not inside compose)
+  so pool provisioning (`resource-pool-provisioning.service.ts`) returns a real
+  host/port/database delivery object.
+- `Server` row with `services: { dockerApiHost: 'tcp://127.0.0.1:2376' }`
+  (and `tags: ['local-docker']`, `host: '127.0.0.1'`, `port: 2376`) so
+  `docker-inventory-executor.factory.ts` selects the dockerode inventory path;
+  the live `mysql`/`redis`/`postgres`/`ssh-server`/`minio` containers become
+  discoverable as `ManagedResource` rows. The factory hard-codes `port: 2376`,
+  so the URL's port is informational; the hostname must be host-reachable.
```

Note: this bullet also fixes Finding 4 (the doc said `tags:` (record) but seed
writes `services:` and `tags:` (array)). Folded in here because both fixes
touch the same sentence.

**`docs/devpilot/demo-runbook.md:407-410`** (MinIO TeamCredential bullet):

```diff
-- `TeamCredential` row carrying the MinIO S3-compatible shape so the
-  `tencent-cos` / `qiniu` object-storage code paths have a local target.
+- `TeamCredential` row carrying the MinIO S3-compatible shape; the MinIO
+  endpoint `http://127.0.0.1:9100` is host-reachable. Note: the seeded
+  `ManagedResource` row has `sourceType: 'server'`, so the cloud-provider-
+  inventory path (the only consumer that decrypts `TeamCredential.config`)
+  is not exercised by this stack — the credential row is illustrative only.
+  See Finding 3 of the CR for the encrypt-vs-placeholder tradeoff.
```

**`docs/devpilot/resource-request-minimum-loop.md:77-78`:**

```diff
-- **Pool provisioning** — `resource-mysql` (`127.0.0.1:3321`) and
-  `resource-redis` (`127.0.0.1:6385`) back the seeded `ResourcePool` rows so
-  `resource-pool-provisioning.service.ts` returns a real host/port/database
-  delivery object for the `local-mysql-pool` and `local-redis-pool` resource
-  types. Allocation runs `CREATE DATABASE`/`CREATE USER` against this container,
-  never against the API's own mysql.
+- **Pool provisioning** — the resource-pool mysql container
+  (`devpilot-g003-mysql`, published at `127.0.0.1:3321`) and redis container
+  (`devpilot-g003-redis`, `127.0.0.1:6385`) back the seeded `ResourcePool`
+  rows, whose `endpoint` columns are `mysql://127.0.0.1:3321/devpilot_resource_pool`
+  and `redis://127.0.0.1:6385` (host-reachable because the API runs via
+  `pnpm dev`, not inside compose). `resource-pool-provisioning.service.ts`
+  returns a real host/port/database delivery object for the `local-mysql-pool`
+  and `local-redis-pool` resource types. Allocation runs
+  `CREATE DATABASE`/`CREATE USER` against this container, never against the
+  API's own mysql.
```

**`docs/devpilot/resource-request-minimum-loop.md:93-98`** (Docker inventory bullet):

```diff
-- **Docker inventory** — `docker-socket-proxy` on `127.0.0.1:2376` exposes the
-  host docker daemon read-only; the seeded `Server` row with
-  `tags: { dockerApiHost: 'tcp://docker-socket-proxy:2375' }` makes
-  `docker-inventory-executor.factory.ts` pick the dockerode path. If the host
-  has no `/var/run/docker.sock`, the proxy healthcheck fails fast and the
-  runner records `dockerProxyStatus != 200` as a warning.
+- **Docker inventory** — `docker-socket-proxy` on `127.0.0.1:2376` exposes
+  the host docker daemon via GET-only endpoints (POST/EXEC disabled — see
+  fix-major1). The seeded `Server` row's
+  `services.dockerApiHost = 'tcp://127.0.0.1:2376'` (host-reachable — the API
+  runs on the host) makes `docker-inventory-executor.factory.ts` pick the
+  dockerode path; the factory hard-codes `port: 2376`, so only the hostname
+  matters. If the host has no `/var/run/docker.sock`, the proxy healthcheck
+  fails fast and the runner records `dockerProxyStatus != 200` as a warning.
```

### 3.3 No compose changes

Finding 2 is purely a seed-row / doc problem. The compose file's
service names (`mysql`, `redis`, `postgres`, `ssh-server`, `minio`,
`docker-socket-proxy`) are correct and stay as-is — they only need to be
reachable from the host via the published ports, which they already are.
The `127.0.0.1:` port-prefix change belongs to fix-major1 (Finding 1 / Finding 7)
and is independent of this fix.

### 3.4 No code changes

No production code under `apps/devpilot-api/src` needs to change. The consumer
logic (`resource-pool-provisioning.service.ts:81-98`,
`docker-inventory-executor.factory.ts:48-66`) already handles arbitrary URL
strings; the bug is exclusively in what the seed writes into the URL field.

---

## 4. Adversarial alternatives considered

### Alternative A: "Use compose-internal service names and move the API into compose."

Rejected. Three independent reasons:

1. **No such plan exists.** Verified across `.agent-board/goals/{G001,G002,G003,G004}.json`,
   `.agent-board/slices/S0*.json` (28 slice files), and every file under
   `docs/todos/` and `docs-internal/`: zero references to dockerizing the
   API. The only Dockerfiles in the repo are under `apps/agent-desktop/`
   (the Tauri desktop shell) — none under `apps/devpilot-api/`. Designing
   the seed convention around a hypothetical future migration would lock
   the current slice into broken data indefinitely.
2. **The dev workflow is `pnpm dev` on the host.** `package.json:41`
   (`"init:api": "pnpm --filter @svton/devpilot-api dev"`),
   `apps/devpilot-api/README.md` (3 occurrences of
   `pnpm --filter @svton/devpilot-api dev`),
   `docs/devpilot/demo-runbook.md` (the runbook's main "start the API" step),
   and `scripts/devpilot-docker-staging.mjs:111` all run the API as a host
   process. The seed must serve the workflow that exists, not one that might.
3. **Even if the API later moves into compose, the seed values are
   per-deployment, not schema.** Changing `endpoint` strings in
   `seedLocalResources` is a 4-line edit at that future time. The cost of
   pre-emptively using compose names now (broken `provisionResource()` /
   `listContainers()` for every developer who tries to exercise the seeded
   flows today) outweighs the cost of a future 4-line edit.

### Alternative B: "Add a `DEVPILOT_STAGING_HOST` env var (default `127.0.0.1`) and interpolate it into every endpoint."

Rejected. Three reasons:

1. **YAGNI.** No developer has ever needed to point the staging seed at a
   non-loopback address. The matrix at `:64-72`, the runbook, and every
   other consumer of these ports hard-codes `127.0.0.1`. The runner itself
   is invoked from the same host that runs docker, so loopback is always
   correct.
2. **It would require touching `dbUrl`, `apiUrl`, `nginxUrl`, `providerUrl`,
   `REDIS_HOST`, `SMTP_HOST`, the `fetch("http://127.0.0.1:9100/...")` and
   `fetch("http://127.0.0.1:2376/...")` probes, and the `matrix()` block to
   be consistent — i.e. a rewrite of the script's address convention, not a
   localized seed fix. That scope mismatch is a strong signal the env var
   belongs to a different slice (if ever).
3. **The compose port overrides (`DEVPILOT_STAGING_RESOURCE_MYSQL_PORT` etc.)
   already exist** at `docker-compose.devpilot-staging.yml:46,59,75,95,111,144,159-160`
   for the rare case where a developer needs a non-default port. Adding a
   second override layer for the host would be redundant with those. If a
   future developer genuinely needs `192.168.x.x` instead of `127.0.0.1`,
   they can override the env *and* update the seed values in one place —
   the env-var indirection doesn't help them.

### Alternative C: "Use `localhost` instead of `127.0.0.1` to match `apps/devpilot-api/.env.example:13` (`REDIS_HOST=localhost`) and `env.schema.ts:36` (default `'localhost'`)."

Rejected. Two reasons:

1. **`localhost` is ambiguous on IPv6.** On this machine `/etc/hosts` resolves
   `localhost` to **both** `127.0.0.1` and `::1`. Once fix-major1 adds the
   `127.0.0.1:` port-prefix to the compose bindings (Finding 1 §4.2), those
   ports will bind to IPv4 loopback only. A client resolving `localhost` to
   `::1` and dialing `[::1]:3321` would get ECONNREFUSED. Using literal
   `127.0.0.1` in the seed forces IPv4 and avoids the issue entirely.
2. **The staging script already standardized on `127.0.0.1`.** `:14,15,18,32,
   64-72,95,107,144,151,275,276` — every prior choice is `127.0.0.1`. The API
   `.env.example`'s `localhost` default applies to a different deployment
   shape (real Redis, possibly remote); the staging script overrides it to
   `127.0.0.1` precisely because loopback is the right value for the local
   Docker stack. Aligning the new seed rows to `127.0.0.1` continues that
   override; switching the convention to `localhost` would force a
   script-wide rewrite.

### Alternative D: "Leave the seed rows with compose-internal names — they're latent (the runner never invokes pool provisioning or docker inventory), and the docs already explain the mapping."

Rejected. Three reasons:

1. **Latent incorrect data is worse than no data.** A developer following the
   runbook to "exercise the wider flow without real cloud credentials"
   (`docs/devpilot/resource-request-minimum-loop.md:74`) will trigger
   `provisionResource()` on `local-mysql-pool` and get either a DNS error
   (today) or a JSON.parse error on `"redacted"` (Finding 3) — neither of
   which the docs warn about. The seed advertises a capability it doesn't
   deliver.
2. **`resource-mysql` and `resource-redis` don't exist as compose service
   names at all** (CR Finding 2 lines 99-104; the actual service names are
   `mysql` and `redis` per `docker-compose.devpilot-staging.yml:39,55`). So
   the seeded endpoints would fail DNS resolution **even from inside the
   compose network**. The "internal hostname" form is wrong in both worlds.
3. **The cost of the fix is 8 string literals.** The cost of leaving it is
   a permanent footgun for every future slice that wants to exercise these
   flows against the local stack.

---

## 5. Risk of the recommended fix

1. **Future dockerization of the API would require reverting the seed values
   to compose-internal names.** Acknowledged but acceptable: (a) no such plan
   exists (§4-A), and (b) the revert is a localized 8-line edit. Risk: very
   low.

2. **The docker-socket-proxy `Server` row will still not produce a real
   docker inventory unless `RESOURCE_CONTROL_*_LIVE_ENABLED`-style flags are
   set and the scheduler/`syncServerDocker` is invoked.** This fix doesn't
   make the inventory flow work end-to-end; it only makes the row's hostname
   resolvable so the *failure mode* changes from `ENOTFOUND` to a real
   dockerode response. End-to-end invocation is a separate slice (and is
   gated on fix-major1's `POST=0` decision, since `listContainers` is
   GET-only and survives the prune). Risk: low; the fix doesn't overpromise.

3. **`Server.host = "127.0.0.1"` is the same value as the virtual-nginx
   Server row at `:144` (`host: "127.0.0.1", port: 22`).** Both rows now
   share `host=127.0.0.1` but have different `port` (22 vs 2376) and different
   `tags`/`services`. No uniqueness constraint exists on `(host, port)` in
   the `Server` table (verified: `apps/devpilot-api/prisma/schema.prisma`
   `model Server` has `@@unique([teamId, name])` only), so no collision.
   Risk: none.

4. **The `displayName` for the dockerHost Server row becomes
   `@127.0.0.1:2376`** (was `@docker-socket-proxy:2375`). This is more
   accurate but might surprise anyone grepping logs for the old name.
   Risk: cosmetic; mention in the runbook.

5. **The docs (runbook + minimum-loop) currently say
   `tags: { dockerApiHost: ... }` (record form); the seed writes
   `services: { dockerApiHost: ... }`.** Fixing the endpoints in the same
   edit is a natural place to also fix this wording (Finding 4). The fix
   above does so. If Finding 4 is tracked separately, drop the
   `tags`→`services` wording change from §3.2 and let Finding 4 own it.
   Risk: low; coordinated edit avoids a follow-up.

6. **No CI / test risk.** No unit test asserts on the seeded endpoint
   strings (`apps/devpilot-api/src/**/*.spec.ts` uses its own fixtures, not
   the staging seed). The staging runner only checks `observability.minioStatus`
   and `dockerProxyStatus` HTTP codes (`:275-276`), which use the host-side
   `127.0.0.1:9100`/`:2376` URLs directly and are unaffected by the seed
   values. Risk: none.

---

## 6. Investigation answers (file:line citations)

**Q1 — Where does the API run? Is there a `docker-compose.devpilot-app.yml`
that runs it in a container?**

- Host, not compose. `scripts/devpilot-docker-staging.mjs:89-115` `startApi()`
  spawns `corepack pnpm --filter @svton/devpilot-api dev` as a host-side child
  process with `cwd: root`. `apps/devpilot-api/package.json` defines
  `"dev": "nest start --watch"`.
- **No `docker-compose.devpilot-app.yml` exists.**
  `find . -name "docker-compose*.yml" -not -path "*/node_modules/*"`
  returns exactly one file: `docker-compose.devpilot-staging.yml`.
  `rg "docker-compose.devpilot-app" -g '!node_modules' -g '!.git'` matches
  only this fix doc and the CR. The prompt's reference to that file was a
  false premise.
- No `Dockerfile` under `apps/devpilot-api/`
  (`ls apps/devpilot-api/Dockerfile*` → no matches). The only Dockerfiles in
  the repo are for the Tauri desktop shell.
- The "default" dev workflow is unambiguously host-side:
  `package.json:41` (`"init:api": "pnpm --filter @svton/devpilot-api dev"`),
  `apps/devpilot-api/README.md` (3 references),
  `docs/devpilot/demo-runbook.md` (the runbook's primary API-start step).

**Q2 — What endpoints are actually consumed by the production code paths the
seed claims to back?**

- **`resource-pool-provisioning.service.ts:29-72` `provisionResource()`:**
  Calls `this.parseEndpoint(pool.endpoint, defaultPort)` (lines 36, 46, 57).
  `parseEndpoint` (lines 81-98) does `new URL(endpoint)` and returns
  `{ host: url.hostname, port: url.port ? Number(url.port) : defaultPort }`.
  So `mysql://127.0.0.1:3321` → `{ host: "127.0.0.1", port: 3321 }` ✓
  (host-reachable); `mysql://resource-mysql:3306` →
  `{ host: "resource-mysql", port: 3306 }` ✗ (`getaddrinfo ENOTFOUND`).
  **However**, this code path is gated on `JSON.parse(decryptCbc(pool.adminConfig))`
  at `:30-32`, and the seed writes `adminConfig: "redacted"` (Finding 3).
  So even after this endpoint fix, the pool flow still throws on decrypt until
  Finding 3 is resolved. This fix is necessary-but-not-sufficient for the
  pool path.
- **`docker-inventory-executor.factory.ts:48-66`:** Reads
  `services.dockerApiHost` (or `tags.dockerApiHost`), returns
  `{ host, port: 2376, ... }` — **port is hard-coded to 2376 regardless of
  the URL**. The `host` is the raw URL string. The executor at
  `docker-api-inventory-executor.ts:26-28` passes this to `new Docker(options)`.
- **docker-modem URL parsing** (`node_modules/.pnpm/docker-modem@5.0.7/.../lib/modem.js:95,147-155,240-243`):
  `this.host = opts.host` (line 95); in `dial()`:
  `var parsed = url.parse(this.host); address = url.format({ protocol: parsed.protocol || this.protocol, hostname: parsed.hostname || this.host, port: this.port, ... })`.
  So `host: "tcp://docker-socket-proxy:2375", port: 2376` produces address
  `tcp://docker-socket-proxy:2376` — the URL's `:2375` port is **overridden**
  by the hard-coded `:2376`. Then `url.parse(address).hostname` and `.port`
  feed `http.request({ hostname, port, ... })`. The actual TCP dial is to
  `(URL hostname):2376`. So for the dial to succeed, the URL's hostname must
  resolve on the host → `127.0.0.1`. The hard-coded port matches the
  published port `2376` → ✓.
- **`Server.services.dockerApiHost` is consumed by**
  `resource-control-sync.service.ts:131,154,156` via
  `dockerInventoryExecutorFactory.usesDockerApi({ services: server.services })`
  and `.resolve({ services: server.services })`. The flow is triggered by
  `syncServerDocker` (`resource-control-sync.service.ts:53`) via either the
  controller (`resource-control.controller.ts:156-159`) or the scheduler
  (`resource-control-scheduler.service.ts:94`). **The staging runner never
  invokes either** — confirmed by reading `scripts/devpilot-docker-staging.mjs`
  end-to-end (the only `resource-control`-touching code is the `observability()`
  GET probes at `:269-278`, which don't call `syncServerDocker`).
- **Object storage (qiniu/cos):** The only consumer of
  `TeamCredential.config` for object storage is
  `cloud-provider-inventory.service.ts:422-443` `getCredentialConfig()`, which
  does `JSON.parse(this.decrypt(credential.config))` (decryptGcm at :446).
  This path is invoked from `collect()` (line 168), which is only called from
  `collectCloudInventory()` (`resource-control-sync.service.ts:166-169`),
  which is only invoked for cloud resources (`sourceType: 'cloud'`). The
  seeded MinIO `ManagedResource` row has `sourceType: "server"`
  (`scripts/devpilot-docker-staging.mjs:209`), so this path is **never
  triggered** for the seeded credential. The `endpoint` field on the MinIO
  `ManagedResource` row is purely metadata (consumed only as
  `targetEndpoint` in `resource-control-connection-probe.service.ts:68` and
  as `metadata.resource.endpoint` in `server-script.executor.ts:46` — neither
  dials it). So `http://minio:9000` vs `http://127.0.0.1:9100` is
  functionally inert today, but the host-reachable form is correct for
  consistency and for any future direct-S3 adapter.

**Q3 — What does `seedStagingRecords` (the existing pattern) actually use?
Why?**

- `scripts/devpilot-docker-staging.mjs:151` writes
  `endpoint: "mysql://127.0.0.1:3321/devpilot_resource_pool"` — host-reachable
  literal IP, matching the host-side published port
  (`docker-compose.devpilot-staging.yml:46`) and the compose env's
  `MYSQL_DATABASE: devpilot_resource_pool` (`:44`).
- Pre-slice history: `git show 58bc2748:scripts/devpilot-docker-staging.mjs:134`
  wrote `mysql://127.0.0.1:3320/devpilot_g003_staging` (port `3320` because
  before the rename, the single mysql service was on `3320`). The slice
  updated to `3321` to track the rename. The convention is consistent across
  the slice boundary.
- **Why:** the API process spawned at `:111` runs on the host, so the
  `ManagedResource.endpoint` it advertises must be host-reachable for any
  future direct-DB adapter. The same logic applies to the new
  `seedLocalResources` rows; they just didn't get the treatment.

**Q4 — Is there a known plan to dockerize the API?**

- **No.** Verified:
  - `.agent-board/goals/G001.json`, `G002.json`, `G003.json`, `G004.json` —
    none mention dockerizing the API. G003's
    `cleared_blockers` includes "Local provider/resource/deploy/task-pull/
    backup/restore/rollback staging blocker cleared by S021 against disposable
    Docker containers" — i.e. the *resources* are dockerized, not the API.
  - `.agent-board/slices/S0*.json` (28 files) — none mention an API container.
  - `docs/todos/*.md` (11 files) — the only `docker` references are to
    `docker-compose.devpilot-staging.yml`, the staging runner, or backup
    `docker cp`/`docker exec` commands. No API-container plan.
  - `docs-internal/devpilot/traefik-architecture-and-roadmap.md` references
    `apps/devpilot-api/docker-compose.traefik.yml`, but that file does not
    exist in this worktree either (`ls apps/devpilot-api/docker-compose*` →
    no matches) and the doc is roadmap-level, not active.

**Q5 — What port mapping does the compose actually publish?**

From `docker-compose.devpilot-staging.yml` `ports:` blocks (verified at lines
16, 29, 46, 59, 75, 95, 111-112, 144, 159-160, 172, 183):

| Service | Host port | Container port | Env var |
|---|---|---|---|
| api-mysql | 3320 | 3306 | `DEVPILOT_STAGING_MYSQL_PORT` |
| api-redis | 6384 | 6379 | `DEVPILOT_STAGING_REDIS_PORT` |
| mysql (resource pool) | **3321** | 3306 | `DEVPILOT_STAGING_RESOURCE_MYSQL_PORT` |
| redis (resource pool) | **6385** | 6379 | `DEVPILOT_STAGING_RESOURCE_REDIS_PORT` |
| postgres | **5433** | 5432 | `DEVPILOT_STAGING_RESOURCE_POSTGRES_PORT` |
| ssh-server | **2223** | 2222 | `DEVPILOT_STAGING_SSH_PORT` |
| minio (S3) | **9100** | 9000 | `DEVPILOT_STAGING_MINIO_PORT` |
| minio (console) | 9101 | 9001 | `DEVPILOT_STAGING_MINIO_CONSOLE_PORT` |
| docker-socket-proxy | **2376** | 2375 | `DEVPILOT_STAGING_DOCKER_PROXY_PORT` |
| mailhog (SMTP) | 1025 | 1025 | `DEVPILOT_STAGING_SMTP_PORT` |
| mailhog (HTTP) | 8025 | 8025 | `DEVPILOT_STAGING_MAILHOG_HTTP_PORT` |
| virtual-nginx | 18098 | 80 | `DEVPILOT_STAGING_NGINX_PORT` |
| fake-provider | 19091 | 19091 | `DEVPILOT_STAGING_FAKE_PROVIDER_PORT` |

The six bolded ports are the ones that appear in this fix's endpoint mappings.

**Q6 — Adversarial: is `127.0.0.1` actually correct, or should it be
`localhost`? Or a `DEVPILOT_STAGING_HOST` env var? Does `0.0.0.0` vs
`127.0.0.1` matter for the seed URL?**

- **`127.0.0.1` is correct.** Reasons (full treatment in §4-C):
  - `/etc/hosts` on this machine (macOS 25.3.0 darwin arm64) resolves
    `localhost` to **both** `127.0.0.1` and `::1`. After fix-major1 adds the
    `127.0.0.1:` port-prefix to compose bindings, those ports bind IPv4
    loopback only; a client resolving `localhost`→`::1` and dialing
    `[::1]:NNNN` would get ECONNREFUSED. Literal `127.0.0.1` forces IPv4
    and is robust.
  - The staging script already uses `127.0.0.1` everywhere (lines 14, 15, 18,
    32, 64-72, 95, 107, 144, 151, 275, 276 — 20+ occurrences, zero
    `localhost`). Aligning the new seed rows continues the convention.
- **No `DEVPILOT_STAGING_HOST` env var.** §4-B rejects this as YAGNI; the
  compose port overrides already exist for the rare port-collision case, and
  the host itself is always loopback for the staging runner.
- **`0.0.0.0` vs `127.0.0.1` doesn't matter for the seed URL** (it matters
  for the compose `ports:` binding, which is fix-major1's scope). The seed
  URL is a *client-side* dial target — `mysql://0.0.0.0:3321` would actually
  work on most stacks (Linux treats `0.0.0.0` as a valid source address for
  loopback), but it's semantically wrong (`0.0.0.0` means "any interface"
  for *binding*, not for *dialing*). Stick with `127.0.0.1`.
- **Live verification on the running stack (macOS, 2026-07-21):**
  `netstat -an | grep -E "3321|6385|9100|2376"` shows
  `tcp46 *.3321 *.6385 *.9100 *.2376 LISTEN` — all currently bound to all
  interfaces (pre-fix-major1). After the `127.0.0.1:` prefix lands, they'll
  bind to IPv4 loopback only. Either way, `127.0.0.1:NNNN` from the host
  works.

---

## 7. Sources

- Code citations are relative to the repo root and live on branch
  `codex/local-docker-resources-s031` at HEAD `663ff7b7`.
- `node_modules/.pnpm/dockerode@5.0.1` and
  `node_modules/.pnpm/docker-modem@5.0.7` (URL parsing trace in §7-Q2).
- `git show 58bc2748:scripts/devpilot-docker-staging.mjs` for the pre-slice
  endpoint convention.
- Live `netstat` / `/etc/hosts` / `docker run --rm alpine ...` probes run on
  the staging stack at 2026-07-21 (logs saved to
  `/tmp/codex-tool-runs/svton/local-docker-resources-s031/fix-major2/`).
