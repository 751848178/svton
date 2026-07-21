# 2026-07-21 — Fix Spec for CR Finding 3 (MAJOR)

Finding under review: `ResourcePool.adminConfig = "redacted"` and
`TeamCredential.config = "redacted"` throw if any consumer decrypts them.

Branch: `codex/local-docker-resources-s031`.
Worktree: `/Users/zhaoxingbo/Workspace/ai-driven/svton-agent-deep-s030`.
HEAD: `663ff7b7`.

This is the deep-dive / fix-spec produced by the research subagent. Read-only — no
edits made here; the diff spec below is for the implementing slice.

---

## 1. Verdict

**Option (b) — keep raw-Prisma seeding, but write an actually-encrypted blob using
the API's default `ENCRYPTION_KEY`.** This is the only option that (i) makes the
seeded rows actually consumable by their advertised production code paths, (ii)
preserves the runner's "drop & re-create DB, seed via Prisma" idempotency model,
and (iii) does not require widening the runner's authorization surface.

Option (a) (seed via API) is rejected because `POST /resource-pools` is guarded
by `@Roles("admin")` (`apps/devpilot-api/src/resource-pool/resource-pool.controller.ts:36`)
and the runner's user is created with `role: "user"`
(`apps/devpilot-api/src/auth/auth.service.ts:48`); the role guard
(`packages/nestjs-authz/src/guards/roles.guard.ts`) only honours team-scoped
roles `team_member`/`team_admin`/`team_owner` derived from `TeamMember.role`
(`apps/devpilot-api/src/authz.config.ts:64-75,136-143`). The literal string
`"admin"` is never granted by `authz.config.ts`, so the runner would have to
add a Prisma upsert flipping `user.role = "admin"` — at which point the runner
is already using Prisma to mutate auth state and loses the "go through the API"
benefit.

Option (c) (document and downgrade) is rejected as the *primary* fix because
(i) the slice's stated goal is "verify and populate local project flow
validation" (CR §1) and the docs explicitly advertise that pool provisioning
"returns a real host/port/database delivery object" (`docs/devpilot/demo-runbook.md:402-404`,
`docs/devpilot/resource-request-minimum-loop.md:77-82`) — downgrading silently
abandons that goal; and (ii) the encrypted-blob fix is ~10 lines and fully
restores the claimed behaviour, so there is no need to retreat to a disclaimer.

Option (c) is retained as a **secondary documentation hardening**: even after
(b), the runbook and minimum-loop should be edited to remove the misleading
"raw Prisma placeholder" excuse currently in the seed comments and to clarify
*which* code path actually consumes each encrypted column.

---

## 2. Investigation answers (with citations)

### Q1 — Encryption mechanism

- **CBC profile** (used by `ResourcePool.adminConfig`):
  - Algorithm: `aes-256-cbc` (`apps/devpilot-api/src/common/crypto/crypto.constants.ts:19`).
  - Wire format: `ivHex:ciphertextHex` (`crypto.service.ts:71-77`).
  - Key derivation: `scryptSync(encryptionKey, 'cbc-salt', 32)` for new data,
    with legacy `padEnd(32).slice(0,32)` fallback for old data
    (`crypto.constants.ts:27,43-55`, `crypto.service.ts:79-97`).
  - Key source: `ENCRYPTION_KEY` env var; falls back to
    `CBC_DEFAULT_KEY = 'default-key-32-chars-long!!!!!'`
    (`crypto.service.ts:37-38`, `crypto.constants.ts:30`).
  - Resource-pool-specific helper
    (`apps/devpilot-api/src/resource-pool/resource-pool-credential.utils.ts:17-42`)
    also reads `process.env.ENCRYPTION_KEY || CBC_DEFAULT_KEY` and uses
    `deriveCbcKey` — i.e. the *same* key the `CryptoService` uses, so a blob
    sealed with `encryptResourcePoolCredential` round-trips through
    `CryptoService.decryptCbc` and vice versa.
- **GCM profile** (used by `TeamCredential.config`):
  - Algorithm: `aes-256-gcm` (`crypto.constants.ts:20`).
  - Wire format: `ivHex:authTagHex:ciphertextHex` (`crypto.service.ts:108-115`).
  - Key derivation: `scryptSync(encryptionKey, 'salt', 32)` (`crypto.constants.ts:57-59`).
  - Key source: same `ENCRYPTION_KEY` env var; falls back to
    `GCM_DEFAULT_KEY = 'default-32-char-encryption-key!'`
    (`crypto.constants.ts:32`).
- **Env var**: `ENCRYPTION_KEY`, declared optional in
  `apps/devpilot-api/src/common/config/env.schema.ts:33`.

### Q2 — What `startApi()` sets

`scripts/devpilot-docker-staging.mjs:89-115` sets `DATABASE_URL`, `PORT`,
`REDIS_*`, `JWT_SECRET`, plus the feature-flag envs and SMTP envs. It does **not**
set `ENCRYPTION_KEY`. Therefore the API boots under
`CBC_DEFAULT_KEY = 'default-key-32-chars-long!!!!!'` and
`GCM_DEFAULT_KEY = 'default-32-char-encryption-key!'`. This is deterministic and
safe to mirror in the runner.

### Q3 — Shape of a valid `ResourcePool.adminConfig`

`apps/devpilot-api/src/resource-pool/resource-pool-provisioning.service.ts:29-72`:

```ts
async provisionResource(pool, resourceName) {
  const adminConfig = JSON.parse(
    this.cryptoService.decryptCbc(pool.adminConfig),
  ) as Record<string, unknown>;
  switch (pool.type) {
    case "mysql":     /* only reads pool.endpoint, ignores adminConfig */
    case "postgresql": /* same */
    case "redis": {
      ...
      password: typeof adminConfig.password === "string" ? adminConfig.password : "",
      ...
    }
  }
}
```

So `adminConfig` only needs to be a JSON object; the only key that's *read* is
`password` (redis). Minimal valid plaintext:

- mysql pool:      `{"username":"root","password":"password"}`
- redis pool:      `{"password":""}`

The plaintext must be `encryptCbc(JSON.stringify(...))` under the CBC key.

### Q4 — Shape of a valid `TeamCredential.config`

Consumers of `TeamCredential.config`:

1. `apps/devpilot-api/src/resource-control/inventory/cloud-provider-inventory.service.ts:422-447`
   — uses `decryptGcm`, then **falls back to raw `JSON.parse` if the value
   starts with `{`** (line 438). Tolerant.
2. `apps/devpilot-api/src/resource-control/executors/direct-db-query.executor.ts:298-307`
   — same pattern: `decryptGcm` then raw-JSON fallback if `{`-prefixed. Tolerant.
3. `apps/devpilot-api/src/cdn-config/cdn-config.service.ts:210-215` — uses
   `decryptGcm` with **NO JSON fallback**; throws `BadRequestException` on
   failure. Strict.

The MinIO credential row is type `"object-storage"`, which is consumed by the
cloud-inventory path (1) when `RESOURCE_CONTROL_CLOUD_INVENTORY_LIVE_ENABLED=true`
and the inventory dispatcher picks the S3 adapter. The CDN purge path (3) is
only reached via `POST /cdn-configs/:id/purge`, which the runner does not call
and which would only fire if a CDN config row attached this credential. So the
*only* consumer the slice claims to exercise is (1), which is tolerant.

Minimal valid plaintext (S3-compatible MinIO shape):

```json
{"provider":"s3","endpoint":"http://127.0.0.1:9100","region":"us-east-1","accessKeyId":"minio","secretAccessKey":"minio12345","bucket":"devpilot-test"}
```

The plaintext must be sealed with `encryptGcm` under the GCM key. (Raw JSON
would also work for consumers 1+2 but would throw for consumer 3 — so encrypting
it is strictly safer.)

### Q5 — Is option (a) feasible from the runner?

**No, not without an additional Prisma upsert to grant `user.role = "admin"`.**

- `POST /resource-pools` is `@Roles("admin")`
  (`resource-pool.controller.ts:34-38`). The role guard
  (`packages/nestjs-authz/src/guards/roles.guard.ts:96-108`) reads
  `user.role` plus team-scoped assignments from `authz.config.ts:92-144`.
  `mapTeamRole` (`authz.config.ts:64-75`) only emits `team_member` /
  `team_admin` / `team_owner` — the literal role `"admin"` is never produced by
  the team-membership path. The runner's `createIdentity()`
  (`scripts/devpilot-docker-staging.mjs:128-136`) creates a user via
  `/auth/register`, which hard-codes `role: 'user'`
  (`auth/auth.service.ts:48`). So a plain `POST /resource-pools` from the
  runner returns 403.
- `POST /team-credentials` is `@Roles('team_member')`
  (`cdn-config.controller.ts:166-167`) — this one the runner *can* hit
  directly.
- The runner currently has zero HTTP POSTs to `/resource-pools`; all seeding is
  raw Prisma (`seedStagingRecords` at `:138-159`, `seedLocalResources` at
  `:165-222`).

Cost of switching to (a): for `TeamCredential` it is a clean swap (~5 lines).
For `ResourcePool` it requires (i) a Prisma `user.update({ data: { role: 'admin' } })`
and (ii) wrapping the `POST /resource-pools` in the runner's `api()` helper.
That is more code than option (b) and widens the runner's auth-surface
manipulation — the runner would now be flipping the global `user.role` column,
which is exactly the kind of "use the API honestly" anti-pattern that option (a)
was supposed to avoid. **(b) is therefore strictly better than (a).**

### Q6 — Is option (c) the right call?

Adversarial take: **No, because the cost of (b) is trivial and the slice's
goal is explicitly to enable flow validation, not to seed illustrative rows.**

- The CR verdict (`docs/todos/2026-07-21-local-docker-resources-cr.md` §1) says
  the slice's purpose is "verify and populate local project flow validation".
- The docs make specific, falsifiable claims:
  - `docs/devpilot/demo-runbook.md:402-404`: "ResourcePool rows for mysql and
    redis ... so pool provisioning (`resource-pool-provisioning.service.ts`)
    returns a real host/port/database delivery object."
  - `docs/devpilot/resource-request-minimum-loop.md:77-82`: "Pool provisioning
    — ... `resource-pool-provisioning.service.ts` returns a real
    host/port/database delivery object for the `local-mysql-pool` and
    `local-redis-pool` resource types. Allocation runs `CREATE DATABASE`/
    `CREATE USER` against this container."
- Downgrading to "rows are illustrative only" would make those doc sentences
  false and would shrink the slice's coverage from "wider flow gaps closed"
  (investigation §3.1) to "we added some container rows and didn't wire them".
- The encrypted-blob fix is ~10 lines and uses only public, deterministic
  defaults. There is no good reason to retreat.

The investigation doc (`docs/todos/2026-07-21-local-docker-resources-investigation.md:100,371-376`)
explicitly names `resource-pool-provisioning.service.ts:29-72` as the target
production path. That path is not exercised by any unit test (see Q7), so the
local stack is the *only* place that can exercise it. If we downgrade, the path
has zero coverage anywhere.

### Q7 — Are there existing tests for pool provisioning or object storage?

- `apps/devpilot-api/src/resource-pool/resource-pool-allocation-lifecycle.service.spec.ts:43,82,113`
  **mocks** `provisionResource` and `deprovisionResource`. The real
  `ResourcePoolProvisioningService.provisionResource` (which contains the
  `decryptCbc` call) is never invoked.
- `apps/devpilot-api/src/resource-pool/resource-pool.service.spec.ts:46-74`
  tests the *write* direction (`createPool` → `encryptCbc`); it does not test
  decryption of a seeded value through provisioning.
- No e2e spec exists for the resource-pool or team-credential flows
  (`find apps -name '*.e2e-spec.ts'` returns nothing).
- `cloud-provider-inventory.service.spec.ts` mocks the credential config
  reader; it does not exercise a real `decryptGcm` round-trip on a seeded row.

So the local Docker stack is the **only** place where the decrypt path of
either column is exercised against the real CryptoService. This further
strengthens the case for option (b) over (c).

---

## 3. Concrete fix spec (option (b) + (c) doc hardening)

All line numbers are at HEAD `663ff7b7`.

### 3.1 — `scripts/devpilot-docker-staging.mjs`

**Change A — set `ENCRYPTION_KEY` in `startApi()` so the seed and the API agree
even if a future env override is added.**

File: `scripts/devpilot-docker-staging.mjs:89-110` (`startApi()` env block).

Old:
```js
    JWT_SECRET: "devpilot-g003-jwt",
    RESOURCE_PROVISIONING_HTTP_ENABLED: "true",
```

New:
```js
    JWT_SECRET: "devpilot-g003-jwt",
    // Pin ENCRYPTION_KEY to the API default (env.schema.ts:33 makes it
    // optional; CryptoService falls back to CBC_DEFAULT_KEY /
    // GCM_DEFAULT_KEY when unset). Pinning it here keeps the runner's
    // seed-side encryption and the API's runtime decryption on the same
    // key even if a future slice changes the default or sets the env.
    ENCRYPTION_KEY: "default-32-char-encryption-key!",
    RESOURCE_PROVISIONING_HTTP_ENABLED: "true",
```

(The value matches `GCM_DEFAULT_KEY` in `crypto.constants.ts:32`; the CBC and
GCM profiles both fall through to `deriveCbcKey(encryptionKey)` /
`deriveGcmKey(encryptionKey)` so the same string feeds both KDFs.)

**Change B — add a `seedCrypto` helper next to the file's other helpers
(after line 87, before `function startApi()`).**

New:
```js
// Local copy of the API's CryptoService KDF + seal logic, kept in sync with
// apps/devpilot-api/src/common/crypto/{crypto.constants,crypto.service}.ts.
// Used only so the raw-Prisma seed can write ciphertext the API can decrypt
// with its ENCRYPTION_KEY default — matches what POST /resource-pools and
// POST /team-credentials would produce server-side. If the API's KDF or
// default key changes, update this in lockstep.
const SEED_ENCRYPTION_KEY = "default-32-char-encryption-key!";
const seedCbcKey = crypto.scryptSync(SEED_ENCRYPTION_KEY, "cbc-salt", 32);
const seedGcmKey = crypto.scryptSync(SEED_ENCRYPTION_KEY, "salt", 32);
function encryptCbcForSeed(plainText) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", seedCbcKey, iv);
  let enc = cipher.update(plainText, "utf8", "hex");
  enc += cipher.final("hex");
  return `${iv.toString("hex")}:${enc}`;
}
function encryptGcmForSeed(plainText) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", seedGcmKey, iv);
  let enc = cipher.update(plainText, "utf8", "hex");
  enc += cipher.final("hex");
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc}`;
}
```

(The runner already imports node's `crypto`? No — it currently does not. Add
`import * as crypto from "node:crypto";` to the import block at the top of the
file, `scripts/devpilot-docker-staging.mjs:2-7`.)

**Change C — replace the two `adminConfig: "redacted"` writes with real
encrypted blobs.** Lines `scripts/devpilot-docker-staging.mjs:185-186`.

Old:
```js
    const mysqlPool = await prisma.resourcePool.create({ data: { type: "mysql", name: "Local MySQL Pool", endpoint: "mysql://resource-mysql:3306", adminConfig: "redacted", capacity: 10, allocated: 0, status: "active" } });
    const redisPool = await prisma.resourcePool.create({ data: { type: "redis", name: "Local Redis Pool", endpoint: "redis://resource-redis:6379", adminConfig: "redacted", capacity: 15, allocated: 0, status: "active" } });
```

New (and align the endpoint hostnames per Finding 2 — host-reachable from the API):
```js
    // adminConfig is encrypted with the API's CBC default key so
    // resource-pool-provisioning.service.ts:30-32 can decrypt+parse it
    // when POST /resource-pools/allocate is invoked. Plaintext shape is
    // the minimal object read by provisionResource(): { username, password }
    // for mysql, { password } for redis.
    const mysqlAdminConfig = encryptCbcForSeed(JSON.stringify({ username: "root", password: "password" }));
    const redisAdminConfig = encryptCbcForSeed(JSON.stringify({ password: "" }));
    const mysqlPool = await prisma.resourcePool.create({ data: { type: "mysql", name: "Local MySQL Pool", endpoint: "mysql://127.0.0.1:3321", adminConfig: mysqlAdminConfig, capacity: 10, allocated: 0, status: "active" } });
    const redisPool = await prisma.resourcePool.create({ data: { type: "redis", name: "Local Redis Pool", endpoint: "redis://127.0.0.1:6385", adminConfig: redisAdminConfig, capacity: 15, allocated: 0, status: "active" } });
```

(The endpoint hostname change is part of Finding 2; included here because
encrypted adminConfig alone does not make the pool consumable if the API
cannot resolve `resource-mysql`. If Finding 2 is being tracked separately,
drop the hostname change and keep only the `adminConfig` swap — but then
pool provisioning will still fail at `parseEndpoint`, just one line later.)

**Change D — replace `config: "redacted"` on the MinIO credential with a real
GCM-encrypted blob.** Line `scripts/devpilot-docker-staging.mjs:195`.

Old:
```js
    const minioCred = await prisma.teamCredential.create({ data: { teamId: auth.teamId, type: "object-storage", name: "Local MinIO (S3)", config: "redacted" } });
```

New:
```js
    // config is encrypted with the API's GCM default key so
    // cloud-provider-inventory.service.ts:436 (decryptGcm) and the strict
    // cdn-config.service.ts:212 path can both parse it. Plaintext is the
    // S3-compatible shape: provider/endpoint/region/accessKeyId/
    // secretAccessKey/bucket.
    const minioConfig = encryptGcmForSeed(JSON.stringify({
      provider: "s3",
      endpoint: "http://127.0.0.1:9100",
      region: "us-east-1",
      accessKeyId: "minio",
      secretAccessKey: "minio12345",
      bucket: "devpilot-test",
    }));
    const minioCred = await prisma.teamCredential.create({ data: { teamId: auth.teamId, type: "object-storage", name: "Local MinIO (S3)", config: minioConfig } });
```

**Change E — fix the misleading comment at lines 161-164.**

Old (`scripts/devpilot-docker-staging.mjs:161-164`):
```js
// Seeds the local Docker resource tier (Tier A) into the staging DB. Follows
// the existing raw-Prisma pattern of seedStagingRecords: credentials /
// adminConfig columns get a "redacted" placeholder instead of going through
// the API's CryptoService, matching the existing convention at :132,134.
```

New:
```js
// Seeds the local Docker resource tier (Tier A) into the staging DB. Uses
// raw Prisma to keep the drop-and-recreate idempotency model, but encrypts
// adminConfig (CBC) and TeamCredential.config (GCM) with the API's default
// ENCRYPTION_KEY so the seeded rows are consumable by
// resource-pool-provisioning.service.ts and cloud-provider-inventory.
// service.ts. See encryptCbcForSeed / encryptGcmForSeed below.
```

### 3.2 — `docs/devpilot/demo-runbook.md`

**Change F — clarify the matrix entry.** Line `docs/devpilot/demo-runbook.md:402-404`.

Old:
```
- `ResourcePool` rows for `mysql` and `redis` pointing at `resource-mysql:3306`
  and `resource-redis:6379` so pool provisioning (`resource-pool-provisioning.service.ts`)
  returns a real host/port/database delivery object.
```

New:
```
- `ResourcePool` rows for `mysql` and `redis` pointing at `127.0.0.1:3321` and
  `127.0.0.1:6385`, with `adminConfig` encrypted (CBC profile) under the API's
  default `ENCRYPTION_KEY`, so pool provisioning
  (`resource-pool-provisioning.service.ts`) returns a real host/port/database
  delivery object when `POST /resource-pools/allocate` is invoked.
```

**Change G — clarify the TeamCredential entry.** Line `docs/devpilot/demo-runbook.md:409-410`.

Old:
```
- `TeamCredential` row carrying the MinIO S3-compatible shape so the
  `tencent-cos` / `qiniu` object-storage code paths have a local target.
```

New:
```
- `TeamCredential` row carrying the MinIO S3-compatible shape, with `config`
  encrypted (GCM profile) under the API's default `ENCRYPTION_KEY`, so the
  `tencent-cos` / `qiniu` object-storage code paths
  (`cloud-provider-inventory.service.ts`) have a decryptable local target.
  The CDN purge path (`cdn-config.service.ts:212`) uses the same GCM
  decryption and would also work if a CDN config row is later attached.
```

### 3.3 — `docs/devpilot/resource-request-minimum-loop.md`

**Change H — replace the resource-mysql/resource-redis hostname claim.**
Lines `docs/devpilot/resource-request-minimum-loop.md:77-82`.

Old:
```
- **Pool provisioning** — `resource-mysql` (`127.0.0.1:3321`) and
  `resource-redis` (`127.0.0.1:6385`) back the seeded `ResourcePool` rows so
  `resource-pool-provisioning.service.ts` returns a real host/port/database
  delivery object for the `local-mysql-pool` and `local-redis-pool` resource
  types. Allocation runs `CREATE DATABASE`/`CREATE USER` against this container,
  never against the API's own mysql.
```

New (drop the `CREATE DATABASE` claim — `provisionResource` only *returns* a
credentials object; the actual DDL is the operator's responsibility):
```
- **Pool provisioning** — `127.0.0.1:3321` (mysql) and `127.0.0.1:6385` (redis)
  back the seeded `ResourcePool` rows; `adminConfig` is encrypted with the API's
  CBC default key so `resource-pool-provisioning.service.ts` decrypts and
  returns a real host/port/database delivery object for the `local-mysql-pool`
  and `local-redis-pool` resource types. The provisioning service returns
  allocation credentials (random password + generated db/user names); it does
  not itself run DDL — the operator (or a downstream cloud adapter) does.
```

**Change I — clarify the object-storage bullet.** Lines
`docs/devpilot/resource-request-minimum-loop.md:86-89`.

Old:
```
- **Object storage** — MinIO S3 endpoint on `127.0.0.1:9100` (bucket
  `devpilot-test`, seeded via the `--profile seed minio-mc` one-shot) stands in
  for `tencent-cos` / `qiniu` object storage; the seeded `TeamCredential` row
  carries the S3-compatible shape.
```

New:
```
- **Object storage** — MinIO S3 endpoint on `127.0.0.1:9100` (bucket
  `devpilot-test`, seeded via the `--profile seed minio-mc` one-shot) stands in
  for `tencent-cos` / `qiniu` object storage; the seeded `TeamCredential` row
  carries the S3-compatible shape, encrypted with the API's GCM default key so
  `cloud-provider-inventory.service.ts` can decrypt it. To exercise the live
  S3 inventory path, set `RESOURCE_CONTROL_CLOUD_INVENTORY_LIVE_ENABLED=true`
  in `startApi()`; by default the cloud inventory runs in stub mode.
```

### 3.4 — `docs/todos/2026-07-21-local-docker-resources-investigation.md`

**Change J — note the deviation in §8.3.** Lines
`docs/todos/2026-07-21-local-docker-resources-investigation.md:371-376`.

Old:
```
- `pool` mode: `resource-request-pool-provisioning.service.ts` reads the matching `ResourcePool`
  row and calls `ResourcePoolProvisioningService.provisionResource()`
  (`resource-pool-provisioning.service.ts:29-72`) which parses the pool endpoint and returns a
  host/port/database/username/password delivery object. Seeding `ResourcePool` rows pointing at
  `resource-mysql:3306` and `resource-redis:6379` closes this loop.
```

New:
```
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
```

---

## 4. Adversarial alternatives considered

### Rejected: Option (a) — seed via `POST /resource-pools` and `POST /team-credentials`

Pros:
- Uses the production write path, so encryption is guaranteed correct by
  construction.
- No risk of KDF drift between the seed and the API.

Cons (decisive):
- `POST /resource-pools` requires `@Roles("admin")`
  (`resource-pool.controller.ts:36`). The runner's user has `role: "user"`
  (`auth/auth.service.ts:48`). The authz config
  (`authz.config.ts:64-75,136-143`) never grants the literal role `"admin"`;
  team-scoped roles top out at `team_owner`. So the runner must add a Prisma
  `user.update({ data: { role: 'admin' } })` — which means the runner is still
  using Prisma to mutate auth state, defeating the "go through the API"
  benefit and widening what the disposable runner is allowed to do.
- `cdn-config.controller.ts:174-178` wraps `POST /team-credentials` in an
  access-policy check (`assertCanWriteCredential`) that calls
  `ControlAccessPolicyService.assertCanWrite`. Whether the default seed
  policy admits a freshly registered user is not guaranteed without testing.
- The runner becomes dependent on the HTTP path being up and the role
  escalation working, adding two more failure modes for the same coverage
  gain that option (b) delivers with no extra moving parts.

### Rejected: Option (c) — pure doc downgrade

Pros:
- Zero seed code change.
- Smallest diff.

Cons (decisive):
- The docs make specific falsifiable claims ("returns a real host/port/
  database delivery object", `demo-runbook.md:404`). Downgrading makes those
  sentences false. We would have to rewrite them to say "the rows exist but
  the flows are not exercised" — at which point the slice's coverage claim
  shrinks and the CR §1 verdict ("wider flow gaps closed") is no longer
  accurate.
- No unit test exercises the decrypt path of either column
  (Q7 above). Downgrading leaves *zero* coverage of
  `ResourcePoolProvisioningService.provisionResource` and the GCM
  TeamCredential decrypt path anywhere in the repo.
- The cost of (b) is ~10 lines and uses only deterministic public defaults.
  There is no engineering reason to prefer a doc disclaimer over a real fix.

### Rejected: write raw JSON (`{"password":"..."}`) instead of encrypting

Pros:
- Even smaller diff than (b).
- Tolerated by `cloud-provider-inventory.service.ts:438` and
  `direct-db-query.executor.ts:302` (both fall back to raw JSON on decrypt
  failure if the value `{`-starts).

Cons (decisive):
- `resource-pool-provisioning.service.ts:30-32` does `decryptCbc` *first* and
  has **no** JSON fallback — it would throw on `"redacted"` *and* on a raw
  JSON string. So this works only for the TeamCredential column, not for
  adminConfig.
- `cdn-config.service.ts:210-215` also has no fallback, so a raw-JSON
  TeamCredential would throw if a future CDN-config row attached it.
- Inconsistent (some columns encrypted, some not) is harder to reason about
  than "everything sealed with the API's default key".

### Rejected: set `ENCRYPTION_KEY` to a long random string in both places

Pros:
- Avoids "using the default key" which feels risky.

Cons (decisive):
- The default key is already in `crypto.constants.ts:30,32` and is the
  documented production fallback (`env.schema.ts:33` makes `ENCRYPTION_KEY`
  optional). The runner is disposable staging; the key never leaves the
  developer's machine and the DB is dropped every run. Adding a custom key
  gains nothing and creates a third place (runner + CBC default + GCM
  default) to keep in sync.

---

## 5. Risk of the recommended fix

1. **KDF drift.** The seed's `encryptCbcForSeed` / `encryptGcmForSeed` must
   track `crypto.constants.ts` (salts `cbc-salt` / `salt`, IV lengths 16 / 12,
   key length 32) and the default key strings. A future change to the API's
   KDF or defaults will silently break the seed. **Mitigation:** the comment
   block on the helper explicitly names the sync requirement and the source
   files; the helpers are 12 lines each, easy to grep. A stronger mitigation
   (out of scope for this fix) would be to import
   `@svton/devpilot-api`'s `CryptoService` directly from the runner — but
   that pulls NestJS into the script and is a larger refactor.

2. **Endpoint hostname change is load-bearing.** Changes C and H assume the
   Finding 2 fix (hostnames → `127.0.0.1`) lands together. If Finding 2 is
   deferred, the encrypted adminConfig alone makes `provisionResource`
   succeed at decrypt but still fail at `parseEndpoint` (DNS resolution of
   `resource-mysql`). The two findings should land in the same slice or the
   adminConfig fix should be paired with the hostname fix in the same commit.

3. **Live cloud inventory is off by default.** Even with a decryptable
   `TeamCredential.config`, `cloud-provider-inventory.service.ts:449-451`
   gates the live S3 call behind
   `RESOURCE_CONTROL_CLOUD_INVENTORY_LIVE_ENABLED=true`. The runner does not
   set this env (default `false`). So the encrypted MinIO credential is
   *consumable* but not *consumed* by the runner's matrix. The doc change (I)
   notes this. If the slice wants to actually exercise the live S3 inventory,
   it must additionally set the env in `startApi()` — but that pulls in the
   `cos-nodejs-sdk-v5` / S3 SDK and is a larger scope; out of scope for this
   finding.

4. **No automated test for the encrypted blob.** The fix does not add a unit
   test that round-trips the seed ciphertext through the real CryptoService.
   The runner itself is the integration test (it boots the API and the API
   loads `CryptoService` with the same default key), but only if a future
   slice extends the matrix to actually invoke `POST /resource-pools/allocate`.
   Until then the decrypt path is *possible* but not *exercised* by the
   runner. **Mitigation:** add a one-line `summary.json` check in
   `seedLocalResources` that decrypts the just-written `mysqlAdminConfig`
   with a local copy of the KDF and asserts it equals the plaintext — this
   catches KDF drift on every run. (Optional; mentioned for the implementing
   slice.)

5. **Role escalation risk: none.** The fix does not touch `user.role` or
   any auth path; it only changes column values in two tables.
