# CR — devpilot p0 bugfix s037

- **Reviewer**: CR subagent (`/dev:cr deep local`)
- **Worktree**: `/Users/zhaoxingbo/Workspace/ai-driven/svton-bugfix-s037`
- **Branch**: `codex/devpilot-p0-bugfix-s037`
- **Commit under review**: uncommitted working-tree changes (4 files)
- **Files under review**:
  1. `apps/devpilot-api/src/deployment/deployment-run-status.ts` — added `BLOCKED` to `RUNNING` transition list
  2. `apps/devpilot-api/src/deployment/deployment-run-status.spec.ts` — new spec (17 tests)
  3. `apps/devpilot-api/src/resource-control/inventory/executors/docker-inventory-executor.factory.ts` — port from URL
  4. `apps/devpilot-api/src/resource-control/inventory/executors/docker-inventory-executor.factory.spec.ts` — extended tests
- **Date**: 2026-07-22

## 1. Verdict

**APPROVE**

Both P0 fixes are functionally correct, verified by trace and by re-running
type-check, build, and the full deployment + inventory test suites (all green).
Bug 1 fix is the right semantic fix at the right layer. Bug 2 fix correctly
preserves the original `2376` default while honoring an explicit port in the
URL. Tests pin the regression cases.

Four nits (3 Low, 1 Info), none of which block merge. The most important is
Finding 1 (the comment understates the blast radius — the fix also unblocks the
approval path at `deployment.service.ts:341`, not just the execute path at
`:482`).

## 2. Findings

### Finding 1 — Fix comment understates blast radius (Info, doc-only)

- **Severity**: Info (no code change needed; comment accuracy)
- **Location**: `apps/devpilot-api/src/deployment/deployment-run-status.ts:40` (JSDoc)
- **Problem**: The new comment says `running → blocked` is needed for the case
  "`queue:false` 创建后审批才返回 blocked" (create with `queue:false`, then
  approval returns blocked). That describes only the **execute** path
  (`deployment.service.ts:482`). But the same missing transition also broke the
  **approval path** at `deployment.service.ts:341` (and the rollback equivalent
  at `:674`): when `queue:false` and `requiresApproval && !approvedApproval`,
  `run.status` is `'running'` and line 341 asserts `running → blocked`.
- **Evidence**: `run` is created at `deployment.service.ts:327` with
  `status: queue ? 'queued' : 'running'`. The approval branch at `:341` is
  reached regardless of `queue`. For `queue=false` it asserts
  `assertDeploymentRunTransition(run.status, BLOCKED)` with `run.status='running'`.
  Same shape at rollback `:674`.
- **Impact**: The fix is correct and broad enough to cover both paths — this is
  good, not a defect. The nit is only that the comment describes one of the two
  call sites it repairs.
- **Fix (optional)**: Broaden the comment, e.g.:
  `running → blocked: queue:false 下审批未通过 (createRun/rollbackRun 审批分支) 或
   script-plan adapter 返回 blocked (execute 分支) 时均会触发。`

### Finding 2 — `unix://` host yields empty-string hostname (Low, robustness)

- **Severity**: Low (edge case; misconfiguration, not a regression)
- **Location**: `docker-inventory-executor.factory.ts:62-65` + `:89-96`
- **Problem**: If a `unix:///var/run/docker.sock` value is mistakenly placed in
  the `dockerApiHost` field (it belongs in `dockerApiSocket`), `new URL()` parses
  it and `.hostname` returns `""` (empty string). The fallback
  `hostname ?? host` does NOT recover the original because `""` is not nullish
  (`??` only catches `null`/`undefined`). So `dockerOptions.host` becomes `""`,
  which dockerode will reject at connect time.
- **Evidence** (node REPL trace):
  ```
  parseHostUrl('unix:///var/run/docker.sock') → URL { hostname: '', port: '' }
  extractHostname(...) → ''
  '' ?? 'unix:///var/run/docker.sock' → ''   // empty string wins
  ```
- **Caveat / why Low**:
  - Correct usage routes unix sockets through `dockerApiSocket` → `socketPath`
    branch (`:67-69`), which is unaffected.
  - `new URL('unix:///var/run/docker.sock')` parses successfully (no throw), so
    this is a silent misroute, not a crash — but it only triggers on
    misconfiguration.
- **Fix (optional)**: Guard the empty hostname:
  ```ts
  const hostname = this.extractHostname(host);
  return { host: hostname || host, port, ... };
  ```
  (`||` instead of `??` so empty string falls back too.) Low priority — only
  matters for defensive handling of bad input.

### Finding 3 — IPv6 hostnames keep bracket form `[::1]` (Low, latent)

- **Severity**: Low (IPv6 over Docker API is rare; pre-existing behavior)
- **Location**: `docker-inventory-executor.factory.ts:85-87` (`extractHostname`)
- **Problem**: For `[::1]:2375` or `tcp://[::1]:2375`, `new URL().hostname`
  returns the string `[::1]` **with** the literal brackets. dockerode / the
  underlying socket may or may not accept the bracketed form.
- **Evidence**:
  ```
  extractHostname('[::1]:2375')    → '[::1]'
  extractHostname('tcp://[::1]:2375') → '[::1]'
  ```
- **Caveat / why Low**:
  - Pre-existing: the old code passed the raw `[::1]:2375` string as `host`,
    which was also wrong for dockerode. The new code is no worse and is arguably
    better (port is now correct).
  - No IPv6 docker hosts are referenced anywhere in the codebase
    (`rg "::1|\\[::" apps/devpilot-api/src` → 0 hits in config).
- **Fix (optional, if IPv6 ever matters)**: strip brackets,
  `hostname.replace(/^\[|\]$/g, '')`.

### Finding 4 — No end-to-end regression test for createRun (Low, test gap)

- **Severity**: Low (unit coverage is solid; only the integration gap is noted)
- **Location**: `deployment-run-status.spec.ts` (new) vs `deployment.service.spec.ts`
- **Problem**: The regression (`running → blocked`) is pinned at the **state-machine
  unit** level (`deployment-run-status.spec.ts:24`), which is the right place.
  But `deployment.service.spec.ts` stubs `serverExecutor.execute` to return
  `completed` / `failed` / `queued` — it never returns `blocked`, so no service-
  level test actually exercises the formerly-broken `createRun(queue:false) →
  execute → blocked` path end-to-end. If someone later removes `BLOCKED` from the
  `RUNNING` list, the unit test catches it, but the service test would not.
- **Caveat / why Low**: The unit test is sufficient to prevent regression of the
  transition table, which is the actual defect. An integration test would be
  belt-and-suspenders.
- **Fix (optional)**: Add one `deployment.service.spec.ts` case where
  `serverExecutor.execute` resolves to `{ status: 'blocked', ... }` and assert
  the run is persisted as `blocked` without throwing.

### Finding 5 — Pre-existing dead-code in `tls` branch (Info, NOT introduced here)

- **Severity**: Info (pre-existing; correctly left untouched by this PR)
- **Location**: `docker-inventory-executor.factory.ts:65`
- **Problem**: The expression
  `...(tls !== undefined ? { ...(tls ? {} : {}) } : {})` always evaluates to
  `{}` regardless of `tls` (both branches of the inner ternary are `{}`). So
  `tls` is read but never influences the returned options.
- **Evidence**: Confirmed identical in `git show HEAD:...factory.ts:58` — this
  is pre-existing dead code, preserved verbatim by the diff. The PR correctly
  did not expand scope to fix it.
- **Fix (separate PR, if desired)**:
  ```ts
  return { host: hostname, port, ...(tls !== undefined ? { tls } : {}) };
  ```
  But `DockerOptions` has no `tls` field (it uses `ca`/`cert`/`key`), so the
  whole `tls` read may be vestigial. Out of scope for this review.

## 3. Re-verification log

Logs under `/tmp/codex-tool-runs/svton/s037-cr/`.

### Type-check (green)

```
cd apps/devpilot-api && pnpm run type-check   → EXIT 0  (tsc --noEmit clean)
```
Log: `type-check.txt`

### Build (green)

```
cd apps/devpilot-api && pnpm run build        → EXIT 0
dist/main.js produced (1272 bytes)
```
Log: `build.txt`

### Targeted tests (green — 36 passed)

```
pnpm exec jest deployment-run-status docker-inventory-executor.factory
  → Test Suites: 2 passed, 2 total
  → Tests:       36 passed, 36 total
```
Log: `targeted-tests.txt`

### Full deployment suite (green — 45 passed)

```
pnpm exec jest deployment
  → Test Suites: 5 passed, 5 total
  → Tests:       45 passed, 45 total
```
Includes `deployment.service.spec.ts`, `deployment-run-status.spec.ts`,
auto-rollback + post-rollback-smoke schedulers, controller. No regressions.
Log: `deployment-suite.txt`

### Resource-control inventory suite (green — 36 passed)

```
pnpm exec jest resource-control/inventory
  → Test Suites: 4 passed, 4 total
  → Tests:       36 passed, 36 total
```
Log: `inventory-suite.txt`

### Lint (not runnable — pre-existing env gap)

```
pnpm run lint  → ESLint couldn't find a configuration file
```
`apps/devpilot-api` has **no eslint config** (only `devpilot-web` and
`packages/*` do). This is a pre-existing repo gap, unrelated to this change —
lint was never a gate for this package. Confirmed by
`find . -maxdepth 3 -name ".eslintrc*"` (no match under `apps/devpilot-api`).
Log: `eslint-config-search.txt`

## 4. Dimension-by-dimension review

### 4.1 Bug 1 fix correctness — VERIFIED

Trace of the formerly-broken path:

1. `deployment.service.ts:327` — `run` created with
   `status: queue ? 'queued' : 'running'`.
2. `deployment.service.ts:478` — for `queue=false`, calls
   `this.serverExecutor.execute(executionInput)`.
3. `script-plan.adapter.ts:51-81` — when `input.dryRun === false`, `execute()`
   returns `{ status: 'blocked', mode: 'blocked_live_execution', ... }`
   unconditionally (live SSH transport not yet enabled).
4. `deployment.service.ts:482` — `assertDeploymentRunTransition(run.status, execution.status)`
   = `assertDeploymentRunTransition('running', 'blocked')`.
5. **Before fix**: `RUNNING`'s list was `[COMPLETED, FAILED, CANCELLED]` →
   threw `illegal deployment run transition: running -> blocked`.
   **After fix**: `RUNNING`'s list is `[BLOCKED, COMPLETED, FAILED, CANCELLED]`
   → passes. ✓

The same fix also unblocks the approval path at `:341` (and rollback `:674`),
which asserts `run.status → BLOCKED` with `run.status='running'` when
`queue=false` and approval is required but not pre-approved (Finding 1).

**Other call sites — no accidental allow:**
- `:341` / `:674` (approval): `to=BLOCKED`. Now legal from `running`. Correct.
- `:430` / `:765` / `:1383` (queue path): `run.status='queued'`,
  `queuedExecution.status` can be `blocked`. `QUEUED`'s list already included
  `BLOCKED` — unchanged, no new allowance.
- The only transition the fix adds is `running → blocked`. There is no scenario
  where this is semantically invalid (blocked = "pause for approval / missing
  config", always recoverable). No existing test asserted the old throw, so no
  spec conflicts (`rg "illegal deployment run transition"` → only the new spec).

### 4.2 Bug 1 — is `running → blocked` semantically correct? — YES

The reviewer prompt asks whether the run should have been blocked BEFORE going
to `running` (i.e., created as `blocked`). It should not, for two reasons:

1. **The run genuinely starts in `running`** when `queue=false`. The run record
   is created (`status: 'running'`) and *then* the adapter is invoked. The
   adapter (`script-plan.adapter.ts:51`) decides to block live execution
   because the real SSH transport is not yet wired. The block decision happens
   *after* persistence, not before. This is by design: the run record must
   exist before the executor can attach `commandPlan`/`logs` to it.
2. **The script-plan adapter returns `blocked` only for non-dry-run live
   executions** (`if (!input.dryRun)` at `adapter.ts:51`). For dry-run, it
   returns `completed` or `blocked` based on warnings (`adapter.ts:83-86`),
   independent of approval. So `running → blocked` is the legitimate
   "execution paused pending transport/approval" transition.

The alternative (create the run as `blocked`) would require knowing the
adapter's verdict *before* creating the run, which inverts the current
dataflow and would still need a `running → blocked` transition for the
post-approval re-execute case. The chosen fix is correct and minimal.

The model is internally consistent: `queued ↔ blocked ↔ running` form a
reversible "not-yet-done" cluster, with `completed/failed/cancelled` as
terminals.

### 4.3 Bug 2 fix correctness — VERIFIED

`parseHostUrl` (`factory.ts:89-96`) normalizes then delegates to `new URL()`.
Tested all review-required inputs (node REPL, results in `url-test-results.txt`):

| Input | port | hostname | OK? |
|---|---|---|---|
| `tcp://host:2375` | 2375 | `host` | ✓ |
| `http://host:2375` | 2375 | `host` | ✓ |
| `host:2375` (bare) | 2375 | `host` | ✓ (prepended `tcp://`) |
| `host` (no port) | undefined → 2376 | `host` | ✓ |
| `https://host:2376` | 2376 | `host` | ✓ |
| `unix:///var/run/docker.sock` | undefined → 2376 | `""` | ⚠ Finding 2 |
| `[::1]:2375` (IPv6) | 2375 | `[::1]` | ⚠ Finding 3 |
| `tcp://[::1]:2375` | 2375 | `[::1]` | ⚠ Finding 3 |
| `host:2375/` (trailing /) | 2375 | `host` | ✓ |
| `host:2375/?foo=bar` (query) | 2375 | `host` | ✓ |
| `host:abc` (non-numeric) | undefined → 2376 | `host` | ✓ (URL drops bad port) |
| `host:99999` (out of range) | undefined → 2376 | `host` | ✓ |
| `tcp://user:pass@host:2375` | 2375 | `host` | ✓ (credentials stripped) |
| `192.168.1.1:2376` (IPv4) | 2376 | `192.168.1.1` | ✓ |

The two edge cases (`unix://` empty host, IPv6 brackets) are Low-severity and
documented as Findings 2 & 3. The core regression — honoring the URL's port
instead of hardcoding 2376 — is fully fixed.

### 4.4 Bug 2 backward compat — VERIFIED

When `host` has no port, `extractPort` returns `undefined`, and
`factory.ts:63` applies `?? DEFAULT_DOCKER_API_PORT` (= 2376, the exact
original hardcoded value, now a named constant). Covered by two spec cases:
- `factory.spec.ts:111-117` — `tcp://docker-proxy` → port 2376 ✓
- `factory.spec.ts:119-125` — `docker-proxy` (bare) → port 2376 ✓

The original `port: 2376` literal is fully replaced; no call site still
hardcodes it (`rg "2376" apps/devpilot-api/src/resource-control` → only the
new constant + comments).

### 4.5 Test quality — GOOD

`deployment-run-status.spec.ts` (17 tests):
- Covers every legal transition (11 positive cases) including the exact P0-1
  regression `running → blocked` (`:24`, labeled).
- 4 negative cases (`running → queued`, all three terminals `→ running`).
- Idempotent same-status and empty-`from` initial-create edge cases.
- Uses `canTransitionDeploymentRun` + `assertDeploymentRunTransition` together
  (asserts both the boolean and the throw). Solid.

`docker-inventory-executor.factory.spec.ts` (7 new tests):
- TCP URL, bare `host:port`, no-port default, hostname extraction,
  end-to-end `extractDockerOptions` with/without port.
- Covers the exact regression (`tcp://...:2375` → port 2375, not 2376).
- Casts via a typed `FactoryInternals` interface (not `any`) to reach private
  methods — acceptable, matches the codebase's existing test pattern.

Gap noted in Finding 4: no service-level end-to-end test, but the unit coverage
is sufficient.

### 4.6 Code style — CLEAN

- File lengths: 75 / 71 / 114 / 146 lines — all well under the 200-line ceiling.
- No `any` types in production code (`rg ": any|<any>|as any"` → 0 in the two
  `.ts` files). The two `as unknown as` casts are in specs only (one for the
  `undefined` from-state edge case, one typed `FactoryInternals`).
- New `DEFAULT_DOCKER_API_PORT` constant replaces the magic `2376` — improves
  readability, matches the named-constant pattern used elsewhere in the file.
- Methods are small, single-purpose, JSDoc'd. `parseHostUrl` / `extractPort` /
  `extractHostname` are appropriately `private`.

### 4.7 i18n / error messages — UNCHANGED

No user-facing strings changed. The two `throw new Error('illegal deployment run
transition: ...')` messages (`deployment-run-status.ts:59,63`) are byte-identical
to HEAD. The only string changes are JSDoc comments (developer-facing, not
user-facing). The factory's log message
(`Using Docker API (dockerode) for inventory: ...`) is unchanged.

### 4.8 Performance — NEGLIGIBLE

`new URL()` is called at most twice per `extractDockerOptions` invocation (once
each in `extractPort` and `extractHostname`). This runs once per server during
inventory collection — not a hot path. The `URL` constructor is O(input length)
and dwarfed by the network I/O that follows. No concern.

A trivial micro-optimization would be to parse once and reuse:
```ts
const parsed = this.parseHostUrl(host);
const port = parsed?.port ? Number(parsed.port) : DEFAULT_DOCKER_API_PORT;
const hostname = parsed?.hostname || host;
```
This would also incidentally fix Finding 2. Optional.

## 5. Open questions for architect

1. **`tls` field handling (Finding 5).** `dockerApiTls` is read from tags but
   the `tls ? {} : {}` expression discards it, and `DockerOptions` has no `tls`
   field anyway. Is this field wired anywhere, or is it vestigial config that
   should be removed (or properly mapped to `ca`/`cert`/`key`)?
2. **End-to-end regression test (Finding 4).** Worth adding a
   `deployment.service.spec.ts` case where `serverExecutor.execute` returns
   `blocked`, to lock down the full createRun path (not just the state machine)?
