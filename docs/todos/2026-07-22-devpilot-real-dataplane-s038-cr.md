# CR — devpilot-real-dataplane-s038

- **Branch:** `codex/devpilot-real-dataplane-s038`
- **Date:** 2026-07-22
- **Reviewer:** CR subagent (deep local review, review-only)
- **Scope:** working-tree changes (not committed)
  - Modified (4): `resource-pool-provisioning.service.ts` (rewrite), `resource-request-http-provisioning.service.ts`, `resource-request-provisioning.service.ts`, `resource-request.service.spec.ts` (env-name fix ×3)
  - Created (7): `resource-pool-mysql-provisioning.utils.ts`, `resource-pool-redis-provisioning.utils.ts`, `resource-pool-endpoint.utils.ts`, + 4 spec files (mysql, redis, endpoint, provisioning-service)

## Verdict

**CHANGES REQUESTED (block on 1 high-severity functional bug; ship after fix).**

The work is well-structured: pure driver-backed utils (no NestJS deps), strict identifier validation, parameterized password, `finally`-guaranteed connection cleanup, good unit-test coverage of the SQL sequence and the always-close invariant. SQL-injection surface is closed. The blocking issue is a **real deprovision bug in the Redis path** (wrong DB index → orphaned keys + potential cross-tenant deletion), which the new tests do not catch because they pass `db` explicitly. Two medium items (orphaned MySQL resources on partial failure; race on the capacity check) are pre-existing in the caller but are now riskier because provisioning has real side effects.

## Findings

### HIGH

#### H1 — Redis deprovision targets the wrong DB; leaks keys and risks cross-tenant deletion
- **Location:** `apps/devpilot-api/src/resource-pool/resource-pool-redis-provisioning.utils.ts:66-97` (deprovision) + `apps/devpilot-api/src/resource-pool/resource-pool-provisioning.service.ts:86-92` (caller)
- **Problem:** Provisioning allocates a random DB index `1..15` (`allocateRedisDbIndex`, line 33-35) and writes the marker to that DB. The chosen index lives only in the per-allocation encrypted credentials. On deprovision, the service calls `deprovisionRedisDatabase({ endpoint, adminPassword, resourceName })` **without `db`** (service lines 87-91), so `deprovisionRedisDatabase` falls back to `db = opts.db ?? 0` (utils line 70). It then `SELECT 0`, runs `KEYS '${resourceName}:*'` and `DEL`s matches there.
- **Consequence (two failure modes):**
  1. The actually-allocated DB (`1..15`) is never touched → marker key + any tenant data written there are **orphaned permanently** (resource leak across releases).
  2. Any keys in **DB 0** that happen to share the prefix (e.g. another allocation whose `resourceName` collides, or unrelated app keys in db 0) are deleted → cross-tenant data loss.
- **Evidence:**
  - `provisionRedisDatabase` writes to `db` (random 1..15): `redis.select(db)` (utils:58), `redis.set('${keyPrefix}__provisioned__', ...)` (utils:59).
  - `deprovisionRedisDatabase` defaults to db 0: `const db = opts.db ?? 0;` (utils:70), `redis.select(db)` (utils:87).
  - Service deprovision omits `db`: provisioning.service.ts:87-91 passes only `endpoint`, `adminPassword`, `resourceName`.
  - Lifecycle `releaseResource` (resource-pool-allocation-lifecycle.service.ts:91-94) passes `allocation.pool` + `allocation.resourceName` only; the allocated `db` (inside `allocation.credentials`, encrypted) is never decrypted and threaded through.
- **Why the tests miss it:** the redis spec calls `deprovisionRedisDatabase({ ..., db: 4 })` (redis spec lines 82-86), explicitly pinning db, so it never exercises the production code path that omits `db`. The provisioning-service spec mocks the util entirely, so it cannot catch the contract gap either.
- **Fix:** thread the allocated `db` from the allocation's decrypted credentials into `deprovisionResource`. Concretely: `releaseResource` must decrypt `allocation.credentials`, read `db`, and pass it through `deprovisionResource` → `deprovisionRedisDatabase({ ..., db })`. Also add a regression test that deprovisions **without** passing `db` at the service layer (i.e. end-to-end through `deprovisionResource`) and asserts the `SELECT` targets the originally-allocated index. Until fixed, Redis pools will leak and can corrupt db 0.

### MEDIUM

#### M1 — Orphaned MySQL/Redis resource if `createAllocationAndIncrementPool` fails
- **Location:** `apps/devpilot-api/src/resource-pool/resource-pool-allocation-lifecycle.service.ts:46-63`
- **Problem:** Provisioning (`provisionResource`, line 46) runs BEFORE the DB write (`createAllocationAndIncrementPool`, line 53). If the DB transaction fails (e.g. Prisma error, unique-constraint on `resourceName`), the just-created MySQL database/user (or Redis marker) has **no allocation record** → it is orphaned forever (no release path can find it). Previously this was low-impact (provisioning was a no-op stub); now it has real, externally-visible side effects.
- **Evidence:** no `try/catch` around lines 46-63; on throw the error propagates and the created DB/user remain on the MySQL server.
- **Fix:** wrap provision + persist in a compensating-action pattern: if `createAllocationAndIncrementPool` throws, call `deprovisionResource(pool, resourceName)` to roll back the MySQL/Redis side effects, then rethrow. (Not strictly a regression of this PR — the ordering predates it — but the blast radius is now real, so it should be addressed alongside the real driver work.)

#### M2 — Race condition on the capacity check
- **Location:** `apps/devpilot-api/src/resource-pool/resource-pool-allocation-lifecycle.service.ts:39-53` + `resource-pool.repository.ts:createAllocationAndIncrementPool`
- **Problem:** The guard `if (pool.allocated >= pool.capacity)` (line 39) reads `allocated` OUTSIDE the transaction; two concurrent `allocateResource` calls for the same pool can both pass the check and both increment. The `increment: 1` inside the transaction is atomic, but the capacity gate is not, so a pool can be over-allocated past `capacity`. Each over-allocation also creates a real MySQL DB/user.
- **Evidence:** `findPoolForAllocation` (repository) is a plain `findUnique` with no row lock; the increment transaction does not re-check capacity.
- **Fix:** move the capacity check into the transaction with an atomic conditional update (e.g. `updateMany({ where: { id, allocated: { lt: capacity } ... } })` and verify `count === 1`), or use `SELECT ... FOR UPDATE`. Note: this is partly pre-existing, but is now load-bearing for real resource creation, so it should be tightened.

#### M3 — Redis `resourceName` never validated; glob-meta chars can widen `KEYS`/`DEL`
- **Location:** `apps/devpilot-api/src/resource-pool/resource-pool-redis-provisioning.utils.ts:43,72,90` (no `assertSafeResourceName` call)
- **Problem:** The MySQL utils validate `resourceName` via `assertSafeResourceName` (regex `^(db|redis|res)_[a-z0-9]+$`). The Redis utils do **not**. `resourceName` is interpolated into a Redis `KEYS`/`DEL` glob pattern (`keys('${resourceName}:*')`). If `resourceName` ever contained glob metacharacters (`*`, `?`, `[`, `]`), `KEYS` would treat them as pattern syntax and could match keys belonging to other tenants, then `DEL` them. Today `resourceName` comes from `generateResourceName` (safe) or from `dto.resourceName` (user-controlled, only `@IsString()`). The mysql path is protected by the regex; the redis path is not.
- **Evidence:** `grep assertSafeResourceName resource-pool-redis-provisioning.utils.ts` → no matches. The DTO (`resource-pool.dto.ts:65-67`) allows any string for `resourceName`.
- **Fix:** call `assertSafeResourceName(opts.resourceName)` at the top of both `provisionRedisDatabase` and `deprovisionRedisDatabase` (and/or validate `resourceName` format in `AllocateResourceDto` with a `@Matches` decorator so bad input returns 400, not 500). Also prefer `SCAN` over `KEYS` for large datasets (see M4).

### LOW

#### L1 — Stale doc comment claims Redis deprovision does FLUSHDB
- **Location:** `apps/devpilot-api/src/resource-pool/resource-pool-redis-provisioning.utils.ts:8-10`
- **Problem:** The file-level docstring says "`deprovisionRedisDatabase` runs `FLUSHDB` against the slot." The implementation actually does prefix-scoped `KEYS`/`DEL` (which is the safer choice). The comment is wrong and misleads future readers/reviewers.
- **Fix:** update the comment to describe prefix-scoped deletion (and note the db-threading caveat from H1).

#### L2 — `KEYS` is O(N) and blocks the Redis server
- **Location:** `apps/devpilot-api/src/resource-pool/resource-pool-redis-provisioning.utils.ts:90`
- **Problem:** `redis.keys('${keyPrefix}*')` enumerates the whole keyspace of the selected DB. On a large/shared Redis this blocks the server. Combined with H1 (wrong db), the blast radius is bigger.
- **Fix:** use a `SCAN` loop + batched `DEL`, or — given the prefix design — maintain an explicit set of owned keys per resource.

#### L3 — No SSL/TLS option on the MySQL admin connection; passwords transit cleartext
- **Location:** `apps/devpilot-api/src/resource-pool/resource-pool-mysql-provisioning.utils.ts:61-67, 95-101`
- **Problem:** `createConnection({ host, port, user, password, connectTimeout })` passes no `ssl`. The new user's password is sent in `CREATE USER ... IDENTIFIED BY ?`, and the admin password authenticates the connection, both over a plaintext socket. Staging is `mysql:8.0` on localhost ports (acceptable), but production reuse would expose credentials on the wire.
- **Evidence:** `docker-compose.devpilot-staging.yml:44-48` — resource pool mysql is `mysql:8.0`, no TLS config.
- **Fix:** add an `ssl` option (env-gated) to `MysqlProvisioningOptions` and forward it to `createConnection`. (Note: MySQL 8.0 default auth is `caching_sha2_password`; mysql2 handles it via RSA exchange over plain TCP, which works but should be TLS in prod.)

#### L4 — Test coverage gaps in the orchestration spec
- **Location:** `apps/devpilot-api/src/resource-pool/resource-pool-provisioning.service.spec.ts`
- **Problem:** Missing cases: (a) redis `deprovisionResource` delegation (only mysql deprovision is tested, lines 101-113); (b) `readAdminUser` `config.user` fallback and missing-credentials path; (c) the contract gap that produced H1 (asserting the service passes `db` to redis deprovision) — there is currently no assertion that would fail when `db` is omitted.
- **Fix:** add the redis-deprovision delegation test, an adminConfig-shape test (`{ user }` instead of `{ username }`), and once H1 is fixed, an assertion that the decrypted `db` is forwarded.

#### L5 — Docs still reference the old (wrong) env name
- **Location:** `docs/devpilot/platform-capabilities.md:226,253,702,705,803`
- **Problem:** The code env-name fix is complete (all 3 code + 1 spec occurrence now use `RESOURCE_REQUEST_PROVISIONING_HTTP_ENABLED`), but the operator-facing doc `platform-capabilities.md` still tells operators to set the old `RESOURCE_PROVISIONING_HTTP_ENABLED`. Anyone following the doc will enable nothing. (Historical `docs/todos/*.md` references are intentionally left as-is.)
- **Fix:** update `docs/devpilot/platform-capabilities.md` to the corrected name. Out of strict scope for this PR but should be tracked.

## Positive observations

- **SQL injection is closed.** `assertSafeResourceName` (`^(db|redis|res)_[a-z0-9]+$`) runs before any interpolation in both provision and deprovision (mysql utils:55,90). Adversarial inputs verified safe: `"foo; DROP DATABASE mysql; --"`, `"foo' OR 1=1"`, `""` all fail the regex. The validated `resourceName` is backtick-interpolated (only safe shape), and the password uses a bound `?` parameter (`CREATE USER ... IDENTIFIED BY ?`, mysql utils:73-76, asserted in spec:54-58).
- **Connection cleanup is correct.** Both utils use `try { ... } finally { connection.end() / redis.disconnect() }` (mysql:69-84, 103-109; redis:56-63, 85-96). Specs explicitly assert the always-close invariant on both success and failure (mysql spec:82-100, redis spec:105-111).
- **Error propagation is intact.** `provisionResource` does not swallow driver errors; the provisioning-service spec asserts `ECONNREFUSED` propagates (spec:115-123), so a caller can detect failure. (What the caller does with it — see M1 — is the open gap.)
- **Credential handling is clean.** No password is logged anywhere (only `resourceName`/`pool.type`/`pool.name` appear in logs). Credentials are encrypted at rest (`encryptCbc`, lifecycle:59-61) and returned in plaintext only to the authenticated caller.
- **Code-structure standard met.** All new files ≤ 124 lines (max: provisioning-service.spec.ts at 124; utils ≤ 110). The driver utils are pure (no NestJS imports); only the orchestration service depends on `@nestjs/common` + `CryptoService`, as intended.
- **mysql2/ioredis correctly declared and installed.** Both are in `apps/devpilot-api/package.json` and symlinked into `apps/devpilot-api/node_modules` (pnpm). Imports use `mysql2/promise` and `ioredis` default correctly.
- **MySQL identifier construction is transitive-safe.** `username = user_${resourceName}` is built from the already-validated name, so it cannot introduce a breakout even though it isn't independently re-validated.

## Re-verification log

Run from `apps/devpilot-api` unless noted.

| Step | Command | Result |
|------|---------|--------|
| New specs (4 files) | `npx jest src/resource-pool/resource-pool-{mysql,redis}-provisioning.utils.spec.ts src/resource-pool/resource-pool-endpoint.utils.spec.ts src/resource-pool/resource-pool-provisioning.service.spec.ts` | **PASS** — 4 suites, 21 tests |
| Full test suite | `npx jest` | **PASS** — 115 suites, 670 tests (one "worker process force-exited" warning, pre-existing teardown noise, not a failure) |
| Type-check | `npx tsc --noEmit` | **PASS** — exit 0, no errors |
| Build | `npx nest build` | **PASS** — exit 0; dist emits all new `.js`/`.d.ts` for the 3 utils + 4 specs |
| Lint | `npx eslint <new files>` | **N/A** — no ESLint config exists for `devpilot-api` (`.eslintrc` only under `apps/devpilot-web` and `packages/*`). Pre-existing project gap, not introduced by this PR. The `lint` script in `apps/devpilot-api/package.json` references a config that is absent. |
| Dependency presence | `readlink apps/devpilot-api/node_modules/{mysql2,ioredis}` | **OK** — both symlink into `node_modules/.pnpm` (mysql2@3.16.0, ioredis@5.8.2) |
| env-name fix completeness | `grep -rn RESOURCE_PROVISIONING_HTTP_ENABLED apps ...` (excluding `docs/todos`, `dist`) | **Clean in code** — only the corrected `RESOURCE_REQUEST_PROVISIONING_HTTP_ENABLED` remains in `src/**`. Residual references are in `docs/devpilot/platform-capabilities.md` (L5) and historical `docs/todos/*` (intentional). |

## Single most important finding

**H1 — Redis deprovision deletes from DB 0 while provisioning wrote to a random DB 1..15.** Deprovision never receives the allocated `db` index, so it `SELECT 0` and `DEL`s prefix-matched keys there: the real allocated DB is leaked forever, and any db-0 keys sharing the prefix are destroyed. This is a live data-loss + resource-leak bug masked by tests that pass `db` explicitly. Block on threading the decrypted `db` through `releaseResource → deprovisionResource → deprovisionRedisDatabase` and adding a regression test that deprovisions through the service layer without an explicit `db`.
