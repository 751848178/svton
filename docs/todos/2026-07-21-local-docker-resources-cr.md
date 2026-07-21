# 2026-07-21 — Local Docker Resources Deep Code Review (s031)

Reviewer: CR subagent (`/dev:cr deep local`).
Branch: `codex/local-docker-resources-s031`.
Worktree: `/Users/zhaoxingbo/Workspace/ai-driven/svton-agent-deep-s030`.
HEAD: `663ff7b7` — "feat(devpilot): add local docker resources for full flow validation (s031)".
Diff: `git diff HEAD~1 HEAD` (8 files, +1311/-12).

This is **adversarial deep local review**. The implementation subagent reported all 7 ACs as
passing. I independently re-ran a subset of the ACs and probed the production code the seed data
is supposed to satisfy. Findings below.

Tool output is saved under `/tmp/codex-tool-runs/svton/local-docker-resources-s031/cr/`.

---

## 1. Verdict

**APPROVE-WITH-NITS.**

The slice is structurally sound: the compose file validates, all 12 services come up healthy,
the end-to-end staging runner passes (I re-ran it once on the already-up stack and it passed
again, confirming idempotency via the per-run DB reset), and there is no production code change.
The blockers that would have stopped a real flow (backup container-name regex, dbUrl port, compose
service rename) were all handled correctly.

However, there are two non-trivial correctness issues that the impl did not catch and that the
docs actively misstate: (a) the docker-socket-proxy is **not** read-only despite the comment
and doc claims — with `POST=1` + `CONTAINERS=1` I was able to `POST /containers/create` on the
host daemon through the proxy; (b) the seeded `ResourcePool` / `ManagedResource` endpoints and
the `dockerApiHost` Server tag use **compose-internal hostnames** (`resource-mysql`,
`resource-redis`, `resource-postgres`, `docker-socket-proxy`) that do not resolve from the API
(which runs on the host via `pnpm dev`), and two of those names don't even exist as compose
services (decision #1 renamed them back to `mysql` / `redis`). These are latent because the
staging runner never invokes pool provisioning or docker inventory, but the rows are dead data
that will mislead the next developer who tries to exercise those flows.

Approve with the nits + majors below tracked as follow-ups. None block the slice from being
merged as disposable staging rehearsal infrastructure.

---

## 2. Findings

### Finding 1 — MAJOR — docker-socket-proxy is NOT read-only (security / accuracy)

- **Location:** `docker-compose.devpilot-staging.yml:131-151`; comments at `:6-8`, `:142`;
  docs at `docs/devpilot/demo-runbook.md:357`, `docs/devpilot/resource-request-minimum-loop.md:93`.
- **Problem:** The proxy exposes `/var/run/docker.sock` with `POST: "1"` plus `CONTAINERS: "1"`,
  `EXEC: "1"`, `NETWORKS: "1"`, `VOLUMES: "1"`. The compose comment (`:142`) and the docs claim
  this is a "read-only host daemon". It is not. The `:ro` mount only protects the *socket file
  inode* on the host; the Docker Engine API exposed through the proxy still accepts mutating
  POST/DELETE on every endpoint that the per-endpoint env unlocks.
- **Evidence:** I ran this against the running stack on 2026-07-20:

  ```text
  $ curl -sS -X POST http://127.0.0.1:2376/containers/create \
          -H 'Content-Type: application/json' -d '{"Image":"alpine:3.20"}'
  {"Id":"61fe24d1742dcb74edd6ffdf3779bb3a47c981b0a49bf8d72cff00ae17a85adc","Warnings":[]}

  $ docker ps -a --filter "id=61fe24d1742d"
  61fe24d1742d  alpine:3.20  zealous_borg  Created

  $ curl -sS -o /dev/null -w "%{http_code}\n" -X DELETE \
          http://127.0.0.1:2376/containers/devpilot-g003-mailhog
  409    # 409 only because the container was running; DELETE is reachable
  ```

  I removed the test container with `docker rm -f 61fe24d1742d…` after the probe.
- **Risk:** Anything that can reach `127.0.0.1:2376` (any local process; any compromised seed
  runner; anything port-forwarded by a dev) can create / start / exec into / kill containers on
  the host daemon — including the API's own mysql, the resource mysql, etc. `EXEC: "1"` with
  `POST: "1"` additionally allows `docker exec` into any container the daemon runs, which is
  full host-equivalent compromise. This is staging-only, so the impact is bounded, but the
  claim "read-only" is false and should not be in the docs.
- **Suggested fix:**
  1. Either drop `POST: "1"` and `EXEC: "1"` from the proxy env and accept that the dockerode
     `exec`-based inventory probes won't work locally (the inventory flow isn't exercised by
     the staging runner anyway), or
  2. Keep `POST: "1"` but rewrite the comments and the runbook to say "POST-enabled docker
     daemon proxy; do not expose 2376 to untrusted networks" and add `127.0.0.1:` binding to
     the published port (`127.0.0.1:${DEVPILOT_STAGING_DOCKER_PROXY_PORT:-2376}:2375`) so the
     port isn't reachable from other machines on the LAN.
  3. Strongly consider the same `127.0.0.1:` binding for every published port in the file —
     currently all ports bind to `0.0.0.0` by default, which leaks minio/mailhog/ssh/mysql to
     the LAN during a `pnpm dev` session.

### Finding 2 — MAJOR — Seeded endpoints use compose-internal hostnames that don't resolve from the API

- **Location:** `scripts/devpilot-docker-staging.mjs:185-186, 190, 202-205`; also propagated to
  `docs/devpilot/demo-runbook.md:402` and `docs/devpilot/resource-request-minimum-loop.md:73-74, 95`.
- **Problem:** The API runs on the host via `pnpm --filter @svton/devpilot-api dev`
  (`scripts/devpilot-docker-staging.mjs:111`), not inside the compose network. The seed writes:
  - `ResourcePool.endpoint = "mysql://resource-mysql:3306"` and `"redis://resource-redis:6379"`
  - `Server.services.dockerApiHost = "tcp://docker-socket-proxy:2375"`
  - `ManagedResource.endpoint` for redis/postgres/ssh/minio = `"redis://resource-redis:6379"`,
    `"postgres://resource-postgres:5432"`, `"ssh://ssh-server:2222"`, `"http://minio:9000"`

  These hostnames (`resource-mysql`, `resource-redis`, `resource-postgres`, `docker-socket-proxy`,
  `ssh-server`, `minio`) only resolve inside the compose `devpilot-g003-staging_default`
  network. Worse, **`resource-mysql` and `resource-redis` don't exist as service names at all** —
  decision #1 in the plan renamed the *API's* services to `api-mysql`/`api-redis` and gave the
  resource-pool services the legacy names `mysql`/`redis`. The seed copied the endpoint strings
  verbatim from the plan's §3.1 spec (which pre-dated the rename decision) and never adjusted.
- **Evidence:**

  ```text
  $ rg -n "^  [a-z][a-z0-9-]+:" docker-compose.devpilot-staging.yml
  9:  api-mysql:
  25:  api-redis:
  39:  mysql:        # resource pool mysql
  55:  redis:        # resource pool redis
  68:  postgres:
  84:  ssh-server:
  102:  minio:
  131:  docker-socket-proxy:
  ...
  ```

  No service named `resource-mysql` or `resource-redis` exists. The seed rows referencing them
  would fail DNS resolution from anywhere.
- **Why the run still passes:** the staging runner only creates these rows; it never invokes
  pool provisioning (`resource-pool-provisioning.service.ts`), never runs the docker-inventory
  sync against the `dockerApiHost` Server row, and never connects to the seeded
  `ManagedResource.endpoint`s. So the bad data is latent. But it is dead/misleading data: any
  developer who later triggers `provisionResource()` on the `local-mysql-pool` ResourceType will
  hit `JSON.parse(cryptoService.decryptCbc("redacted"))` (Finding 3) and even after that is
  fixed would not reach the pool.
- **Suggested fix:**
  - Use host-reachable endpoints everywhere the API is the consumer: `mysql://127.0.0.1:3321/`,
    `redis://127.0.0.1:6385/`, `postgres://127.0.0.1:5433/`. (The existing `seedStagingRecords`
    row at `:151` already does this correctly — `mysql://127.0.0.1:3321/devpilot_resource_pool`.)
  - For the `dockerApiHost` Server tag: the proxy is published at `127.0.0.1:2376` on the host.
    Either set `dockerApiHost: "tcp://127.0.0.1:2376"` (and accept the factory's hard-coded
    `port: 2376`), or document that this Server row is only consumable from inside compose and
    therefore currently a no-op.
  - Update the runbook and minimum-loop docs to match.

### Finding 3 — MAJOR (latent) — `ResourcePool.adminConfig = "redacted"` and `TeamCredential.config = "redacted"` will throw if consumed

- **Location:** `scripts/devpilot-docker-staging.mjs:185-186, 195`.
- **Problem:** Production code at `apps/devpilot-api/src/resource-pool/resource-pool-provisioning.service.ts:30-32`
  does `JSON.parse(this.cryptoService.decryptCbc(pool.adminConfig))`. The seed writes the literal
  string `"redacted"` (not an encrypted JSON blob), so any call to `provisionResource()` on these
  pools throws on decrypt. Same for `TeamCredential.config = "redacted"` for any code path that
  decrypts it. The seedStagingRecords pattern already does this for `Server.credentials` (`:144`),
  so this matches an *existing* convention — but the existing convention only worked because the
  staging run also never exercises a code path that decrypts `Server.credentials` directly (SSH
  is replaced by `server_agent` task-pull). The new pools/credential are advertised (in docs and
  matrix) as backing pool provisioning and object-storage flows, which they cannot.
- **Evidence:** production decrypt is mandatory in the pool path:

  ```text
  apps/devpilot-api/src/resource-pool/resource-pool-provisioning.service.ts:30:
    const adminConfig = JSON.parse(
      this.cryptoService.decryptCbc(pool.adminConfig),
    ) as Record<string, unknown>;
  ```
- **Suggested fix:** Either (a) seed these via the API endpoints (`POST /resource-pools`,
  `POST /team-credentials`) so server-side encryption produces a valid ciphertext — the plan §3.1
  explicitly recommended this and the impl deviated without noting it; or (b) keep the raw-Prisma
  pattern but write an actually-encrypted blob using the API's `ENCRYPTION_KEY` (the runner
  already sets `JWT_SECRET` but not `ENCRYPTION_KEY`; could be added); or (c) document in the
  runbook that pool provisioning and tencent-cos/qiniu object storage flows are NOT exercised by
  the local stack despite the rows being seeded.

### Finding 4 — MINOR — Docs claim the `dockerApiHost` tag lives on `Server.tags`; the seed puts it on `Server.services`

- **Location:** seed at `scripts/devpilot-docker-staging.mjs:190`; docs at
  `docs/devpilot/demo-runbook.md:405`, `docs/devpilot/resource-request-minimum-loop.md:95`.
- **Problem:** Docs say `Server row with tags: { dockerApiHost: ... }`. Seed writes
  `tags: ["local-docker"]` (an array) and `services: { dockerApiHost: "tcp://..." }`.
- **Evidence:**

  ```text
  scripts/devpilot-docker-staging.mjs:190:
    ... tags: ["local-docker"], services: { dockerApiHost: "tcp://docker-socket-proxy:2375" } ...
  docs/devpilot/demo-runbook.md:405:
    - `Server` row with `tags: { dockerApiHost: 'tcp://docker-socket-proxy:2375' }`
  ```
- **Note:** The factory at `docker-inventory-executor.factory.ts:55-56` reads `dockerApiHost`
  from *either* `tags` (as a record) *or* `services`, so the seed placement actually works.
  But the seed's `tags` is an array (the schema allows `Json?`), which means the factory's
  `asRecord(meta.tags)` returns null and the value is only found via `services`. The docs should
  say `services: { dockerApiHost: ... }` to match.
- **Suggested fix:** Update the two doc lines, or move the tag into a record-shaped `tags` field.

### Finding 5 — MINOR — Compose comments and docs cite stale line ranges and a stale "hard-coded container name" rationale

- **Location:** `docker-compose.devpilot-staging.yml:5-8`; investigation
  `docs/todos/2026-07-21-local-docker-resources-investigation.md:380-383`;
  runbook `docs/devpilot/demo-runbook.md:352`.
- **Problem:** The compose comment says the rename "keeps the backup command regex
  (`scripts/devpilot-docker-staging.mjs:152-154`) and `backup.service.ts:504-563` container-name
  references unchanged". Two issues:
  1. The cited line range `152-154` in the staging script no longer exists; the regex is now at
     `scripts/devpilot-docker-staging.mjs:232` after the new helper was inserted.
  2. `backup.service.ts:504-563` does **not** hard-code `devpilot-g003-mysql`. It calls
     `this.resolveContainerName(resource)` (`backup.service.ts:508,626-632`), which reads
     `resource.config.containerName` — i.e., whatever the seed writes. The real reason the
     container name matters is the **staging script's own commandPolicyFlow regex** at the
     (now) `:232` line, plus the production `backup.service.ts` `safeDockerName` fallback
     (`:634-637`) that derives a name from `resource.name` if no config is set.
- **Evidence:**

  ```text
  apps/devpilot-api/src/backup/backup.service.ts:508:
    const containerName = this.resolveContainerName(resource);
  apps/devpilot-api/src/backup/backup.service.ts:626-632:
    private resolveContainerName(resource) {
      const config = this.asRecord(resource.config);
      const metadata = this.asRecord(resource.metadata);
      return this.readString(config.containerName)
        || this.readString(metadata.containerName)
        || this.safeDockerName(resource.name);
    }
  ```
- **Suggested fix:** Rewrite the compose comment to cite the actual reason (staging
  commandPolicyFlow regex + safeDockerName fallback) and the actual line (`:232`). Update the
  investigation doc's §8.4 claim accordingly.

### Finding 6 — MINOR — `category: "storage"` is not in the existing ResourceType defaults vocabulary

- **Location:** `scripts/devpilot-docker-staging.mjs:174`.
- **Problem:** The schema field is free-form `String?`, so this is not a schema violation, but
  every default in `resource-type-defaults.constants.ts` uses one of
  {database, cache, compute, network, account, custom}. `"storage"` is a new value. Anyone
  filtering resource types by category in the UI or in code may not find this row.
- **Suggested fix:** Use `category: "custom"` (closest existing match for an object-storage
  stand-in), or extend the convention explicitly if "storage" is intended.

### Finding 7 — MINOR — Published ports bind to `0.0.0.0` by default; no `127.0.0.1:` sit-prefix

- **Location:** `docker-compose.devpilot-staging.yml:16, 29, 46, 59, 75, 95, 111-112, 144, 159-160, 172, 183`.
- **Problem:** All `ports:` entries use the short form `"${ENV:-NNNN}:NNNN`, which binds to
  `0.0.0.0` — every published staging port is reachable from the LAN while the stack is up. This
  includes unauthenticated services (minio console with `minio`/`minio12345`, mailhog UI, ssh
  with `devpilot`/`devpilot`, mysql with `root`/`password`). The pre-existing services have the
  same shape, so this is a pre-existing issue the slice perpetuates rather than introduces — but
  the slice widens the attack surface notably (7 new published ports).
- **Suggested fix:** Use the long form `127.0.0.1:${ENV:-NNNN}:NNNN` for every published port in
  the staging compose. Disposable stacks should not be LAN-reachable.

### Finding 8 — NIT — `DEVPILOT_STAGING_API_MYSQL_PORT` documented in the investigation but not implemented

- **Location:** `docs/todos/2026-07-21-local-docker-resources-investigation.md:332`; actual
  env var in `docker-compose.devpilot-staging.yml:16` is still `DEVPILOT_STAGING_MYSQL_PORT`.
- **Problem:** The investigation listed `DEVPILOT_STAGING_API_MYSQL_PORT` as the "new, rename"
  env var for the API's own mysql. The impl kept the legacy `DEVPILOT_STAGING_MYSQL_PORT` for
  backward compatibility (sensible — overriding it doesn't break existing dev workflows), but
  the investigation doc was not updated to reflect the decision.
- **Suggested fix:** Either rename the env var to match the renamed service (breaking existing
  local env overrides), or add a one-line note to the investigation doc saying "rename deferred
  to preserve backward compat; `DEVPILOT_STAGING_MYSQL_PORT` continues to control `api-mysql`".

### Finding 9 — NIT — Runbook "Useful overrides" snippet would now collide with resource-mysql

- **Location:** `docs/devpilot/demo-runbook.md:384-388`.
- **Problem:** The example sets `DEVPILOT_STAGING_MYSQL_PORT=3321`, which (now that the env var
  controls `api-mysql`) would publish `api-mysql` on `3321`, colliding with the resource-mysql
  default `DEVPILOT_STAGING_RESOURCE_MYSQL_PORT=3321`. The example pre-dates the rename and was
  not updated.
- **Suggested fix:** Replace the snippet with non-colliding port numbers (e.g. `3322`, `6386`)
  or drop the example.

### Finding 10 — NIT — Healthcheck commentary mismatch on docker-socket-proxy

- **Location:** `docker-compose.devpilot-staging.yml:148`.
- **Problem:** The plan §2 spec had `test: ["CMD", "curl", "-fsS", ...]`. The impl switched to
  `wget -qO- ... >/dev/null 2>&1`. This is **correct** — `tecnativa/docker-socket-proxy:0.3.0`
  is alpine-based and ships busybox `wget` but **not** `curl`. I verified inside the running
  container:

  ```text
  $ docker exec devpilot-g003-docker-socket-proxy sh -c 'which wget; which curl'
  /usr/bin/wget
  
  ```

  (`curl` returns nothing.) Healthcheck is `healthy` with `FailingStreak: 0`. This is a good
  catch by the impl — but the deviation was not recorded in any of the report-outs (the agent-board
  entry has no deviations section). Document for future reviewers that the wget switch is
  intentional and required.
- **Suggested fix:** Add a one-line comment in the compose file noting the wget choice is forced
  by the image (no curl).

---

## 3. Re-verification log

All re-runs done on the already-running stack at 2026-07-20 ~18:00–18:10 UTC, against worktree
`/Users/zhaoxingbo/Workspace/ai-driven/svton-agent-deep-s030` on branch
`codex/local-docker-resources-s031` at HEAD `663ff7b7`.

| AC | Re-run command | Result | Notes |
|---|---|---|---|
| AC-1 | `docker compose -f docker-compose.devpilot-staging.yml config > /dev/null` | exit 0, no stderr | Saved to `cr/compose-config.txt`. |
| AC-2 | `docker compose ... ps` (via `docker ps` filter) | All 12 containers up; 9 with `(healthy)` status, 3 pre-existing without healthcheck (`virtual-nginx`, `backup-target`, `fake-provider`) | Matches spec. |
| AC-3 minio | `curl -fsS http://127.0.0.1:9100/minio/health/live` | 200 OK | Independent re-run. |
| AC-3 ssh | `nc -z 127.0.0.1 2223` | `succeeded!` | Independent re-run. |
| AC-3 others | mysql SELECT 1, redis PING, postgres pg_isready, mailhog :1025/:8025, docker-socket-proxy /version | All pass | Saved to `cr/ac3-smoke.log`. |
| AC-4 bucket | `docker compose ... --profile seed run --rm minio-mc` | `Bucket created successfully local/devpilot-test` | Idempotent (`--ignore-existing`). |
| AC-5 e2e | `node scripts/devpilot-docker-staging.mjs run` (re-run on already-up stack) | exit 0; summary `status=passed`; matrix has 13 entries; `observability.minioStatus=200`, `dockerProxyStatus=200`; `localResources` block has 5 resourceTypeIds, 2 poolIds, 4 managedResourceIds | Saved summary at `/tmp/codex-tool-runs/svton/g003-docker-staging-20260720180703/summary.json`. **Idempotency confirmed** — second run still passes because `run()` drops & recreates the `devpilot_g003_staging` DB at the start. |
| AC-6 env | `rg "SMTP_HOST\|MINIO_ENDPOINT\|Local Docker resources" apps/devpilot-api/.env.example` | 3 matches | All commented. |
| AC-7 docs | `rg "resource-mysql\|ssh-server\|minio\|docker-socket-proxy\|mailhog" docs/devpilot/{demo-runbook,resource-request-minimum-loop}.md` | matches in both files | OK (content accuracy is separate — see findings). |
| Backup regex compat | `docker inspect devpilot-g003-mysql --format '{{.Name}} service={{index .Config.Labels "com.docker.compose.service"}}'` | `/devpilot-g003-mysql service=mysql` | The resource-pool mysql correctly owns the legacy container name; api-mysql is `service=api-mysql`. Backup regex in `commandPolicyFlow` (`:232`) still matches. |
| docker-socket-proxy image contents | `docker exec ... sh -c 'which wget; which curl'` | wget yes, curl no | Confirms wget healthcheck is necessary (Finding 10). |
| POST=1 security probe | `curl -X POST .../containers/create -d '{"Image":"alpine:3.20"}'` | 200 + created container `zealous_borg` (removed afterwards) | Confirms Finding 1. |

I did NOT re-run AC-2 from a clean `compose down -v` because the stack was already up from the
impl run and the prompt asked for a subset; the impl's AC-2 log under
`/tmp/codex-tool-runs/svton/local-docker-resources-s031/` is consistent with the live state I
observed.

---

## 4. Idempotency deep-dive

- `ResourceType` has `@unique` on `key`. The seed suffixes every key with `${stamp}` (a
  14-digit timestamp). Across two runs in the same second this could collide, but the staging
  run takes >60s, so in practice the timestamp differs. **Caveat:** if anyone manually invokes
  `seedLocalResources` twice within the same second (unlikely), it would throw. Not a blocker.
- `ManagedResource` has `@@unique([teamId, sourceType, provider, externalId])`. The seed uses
  fixed `externalId` values (`devpilot-g003-mysql`, `devpilot-g003-redis`, etc.) but each run
  creates a new `teamId` via `createIdentity()`, so the unique tuple never collides across
  runs. Confirmed by my re-run: passed without conflict.
- `ResourcePool`, `Server`, `TeamCredential` have no unique constraint besides `id`. Safe.
- The staging runner achieves hard idempotency by dropping and recreating the
  `devpilot_g003_staging` database on `api-mysql` at the start of every `run()` (line 32). All
  seed rows are recreated from scratch each time. This is the intended disposable-staging
  policy and is documented in the runbook.

---

## 5. Open questions for the architect subagent

1. **Is the docker-socket-proxy actually needed for the slice's stated goal?** The staging
   runner never invokes the docker-inventory flow against the seeded `dockerApiHost` Server row.
   If it's only there for manual exploration, dropping `POST=1` and `EXEC=1` (per Finding 1)
   would make the proxy genuinely read-only without losing any automated coverage. If future
   slices plan to exercise dockerode exec probes, the proxy needs POST and the docs must stop
   calling it read-only. Which is intended?
2. **Should the seed write host-reachable endpoints (`127.0.0.1:NNNN`) or compose-internal
   ones (`service:NNNN`)?** This depends on whether future slices plan to (a) move the API into
   compose or (b) keep it on the host via `pnpm dev`. The current state is inconsistent (the
   `seedStagingRecords` row uses `127.0.0.1:3321`, the `seedLocalResources` rows use
   `resource-mysql:3306` etc.). Pick one convention and align.
3. **Should `ResourcePool.adminConfig` and `TeamCredential.config` be encrypted by the seed?**
   The plan §3.1 explicitly said to use the API endpoints so encryption is handled server-side;
   the impl used raw Prisma with `"redacted"` placeholders and did not record the deviation.
   This makes the rows unusable for their advertised flows. Is there a follow-up slice that
   completes the wiring, or should this slice's docs be downgraded to "rows are illustrative
   only, flows are not exercised"?
4. **Stale `MINIO_ROOT_PASSWORD` length claim.** Investigation §7 says `minio12345` is 10 chars
   (≥8 required). MinIO's current minimum is actually **8 characters minimum for both access
   key and secret key**, and `minio12345` (10 chars) passes. But the access key `minio` is only
   5 chars, which is below MinIO's documented 3-char minimum (passes) but worth confirming
   against the image version pulled. Not blocking; flagging for awareness.
