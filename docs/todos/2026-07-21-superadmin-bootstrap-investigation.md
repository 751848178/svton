# Superadmin Bootstrap — Investigation

- Date: 2026-07-21
- Slice: superadmin bootstrap (system-level admin who can pass `@Roles('admin')`)
- Worktree: `svton-agent-deep-s030` / branch `codex/superadmin-bootstrap-s032`
- Status: investigation only — no code/schema changes

## 1. Authz deep dive — how a request hits `@Roles('admin')`

### 1.1 Components in the chain

| Layer | File | Role |
|---|---|---|
| Decorator | `packages/nestjs-authz/src/decorators/roles.decorator.ts:16` | `Roles(...roles)` writes metadata key `'roles'` |
| Guard export | `packages/nestjs-authz/src/index.ts:6` | `AuthzGuard` is literally `RolesGuard` (alias) |
| Guard impl | `packages/nestjs-authz/src/guards/roles.guard.ts:45` | `RolesGuard.canActivate` |
| Engine | `packages/authz/src/authorizer.ts:48` `createAuthorizer(schema)` | `hasRole` / `can` decisions |
| Scope match | `packages/authz/src/utils.ts:122` `matchesScope` | global vs scoped |
| Config | `apps/devpilot-api/src/authz.config.ts:77` `useAuthzConfig` | schema + `getAssignments` + `getScope` |

### 1.2 Request trace for `GET /admin/stats`

1. `JwtAuthGuard` runs. `JwtStrategy.validate` (`apps/devpilot-api/src/auth/strategies/jwt.strategy.ts:20`) calls `authService.validateJwtPayload`, which returns the **full Prisma `User` row** (`auth.service.ts:83-93`) — including the `role` field. This object becomes `request.user`.
2. `AuthzGuard` (= `RolesGuard`) runs (`admin.controller.ts:7-8`).
3. `RolesGuard.canActivate` (`roles.guard.ts:51`):
   - Reads required roles via `ROLES_KEY` metadata → `['admin']`.
   - Calls `resolveSubject` (`roles.guard.ts:139`).
4. `resolveSubject` (`roles.guard.ts:139-163`):
   - Calls `getAssignments(context)` from `authz.config.ts:92`. For an `/admin/*` route there is **no `teamId`** in params/query/body/header, so `resolveTeamId` returns `undefined`, `requiresTeamScope` returns `false` (no `team_`-prefixed role required), and `getAssignments` returns `{}` (`authz.config.ts:97-103`).
   - Calls `getUserRoles(user, 'role')` (`roles.guard.ts:147`, `userRoleField: 'role'` from `authz.config.ts:78`). For `user.role === 'admin'` this returns `['admin']`.
   - `normalizeRoleAssignments(['admin'])` (`utils.ts:184-196`) returns `[{ role: 'admin' }]` — **no `scope`**, i.e. a global assignment.
5. `getScope(context)` (`authz.config.ts:145`) returns `undefined` (no teamId).
6. `authorizer.hasRole({ subject, roles: ['admin'], scope: undefined })` (`authorizer.ts:184`):
   - For the assignment `{role:'admin'}`: `checkRoleAssignment` calls `matchesScope(assignment.scope=undefined, requestedScope=undefined)`.
   - **`matchesScope(undefined, undefined)` returns `true`** (`utils.ts:122-127`: `if (!assignmentScope) return true`).
   - `expandRoles('admin')` (`authorizer.ts:53`): `schema.roles['admin']` is `undefined` → `roleDefinition?.inherits ?? []` = `[]` → returns `['admin']`.
   - `requiredRoles.find(r => ['admin'].includes(r))` = `'admin'` → **allowed**.

### 1.3 Conclusion on the “latent bug”

The brief hypothesised that `getAssignments` must emit the global `'admin'` role. **That is not strictly true.** The `RolesGuard` already pulls `user.role` directly off the JWT-populated `request.user` via `userRoleField: 'role'` (`authz.config.ts:78`), independent of `getAssignments`. The team-scoped `getAssignments` is only responsible for team roles. So a `User` row with `role='admin'` and a valid password **does** pass `@Roles('admin')` today, because:

- the JWT strategy returns the full user (including `role`),
- `getUserRoles` reads `role` and produces an unscoped assignment,
- an unscoped assignment matches an unscoped request.

What `getAssignments` does NOT do is irrelevant for the admin gate. The only real defects are:

1. **No `User` row with `role='admin'` exists by default**, and there is no mechanism to create one with a known password.
2. **`schema.roles` (`authz.config.ts:82-90`) has no `admin` key.** The engine tolerates this (`expandRoles` returns `['admin']`), but it is implicit and fragile — adding the key makes intent explicit and allows future `inherits`/`permissions` declarations. Recommended as a robustness fix, not a functional prerequisite.

### 1.4 Global (unscoped) role support — confirmed

The engine fully supports global roles:

- `AuthzRoleAssignment.scope` is optional (`packages/authz/src/types.ts:44-47`).
- `matchesScope(undefined, undefined) === true` (`utils.ts:122-127`).
- An assignment with no scope is treated as global and matches any request whose resolved scope is also `undefined`.

So a global `'admin'` role requires **no scope plumbing** — it works as long as `request.user.role === 'admin'` and the request itself is unscoped (which `/admin/*` always is, since `getScope` only returns a team scope).

### 1.5 Schema extension required

`AuthzSchema.roles` (`types.ts:40-42`) is `Record<string, AuthzRoleDefinition>`. To make the admin role explicit, add:

```ts
admin: {
  // intentionally no permissions/inherits: '@Roles' checks role identity,
  // not permissions. Empty def = the role name itself is the grant.
}
```

No `inherits` is needed unless we want `admin` to also satisfy `team_*` checks (we do **not** — admin endpoints are unscoped, team endpoints resolve scope separately and would mismatch).

## 2. Current-state matrix — every `@Roles(...)` in `apps/devpilot-api/src`

| File:line | Required role | Scope | Currently satisfiable? | Why |
|---|---|---|---|---|
| `admin/admin.controller.ts:8` (class) | `admin` | none (unscoped) | **No (today)** / **Yes (after fix)** | Needs `User.role==='admin'`. After bootstrap, global role matches unscoped request. |
| `resource-pool/resource-pool.controller.ts:36` | `admin` | unscoped | No → Yes | Same as above. |
| `resource-pool/resource-pool.controller.ts:43` | `admin` | unscoped | No → Yes | Same. |
| `resource-pool/resource-pool.controller.ts:65` | `admin` | unscoped | No → Yes | Same. |
| `resource-pool/resource-pool.controller.ts:76` | `admin` | unscoped | No → Yes | Same. |
| `resource-pool/resource-pool.controller.ts:86` | `admin` | unscoped | No → Yes | Same. |
| `resource-request/resource-request.controller.ts:45` | `admin` | unscoped | No → Yes | Same. |
| `resource-request/resource-request.controller.ts:62` | `admin` | unscoped | No → Yes | Same. |
| `resource-request/resource-request.controller.ts:69` | `admin` | unscoped | No → Yes | Same. |
| `resource-pool/resource-pool.controller.ts:54` | `team_member` | team | Yes | `getAssignments` emits team role from `TeamMember` row. |
| `resource-pool/resource-pool.controller.ts:93,112,132` | `team_member` | team | Yes | Same. |
| `resource-request/resource-request.controller.ts:77,334,400` (class) | `team_member` | team | Yes | Same. |

Other `@Roles(...)` usages across the API (domain, git, backup, resource, application, monitoring*, project-webhook, site, deployment, cdn, project, control-access-policy, key-center, generator, server, audit-event, resource-control, server-executor*, project-environment*, operation-approval, preset, log-center) all use **team-scoped** roles (`team_member`/`team_admin`/`team_owner`) and are unaffected by this slice.

**Net:** 9 endpoints across 3 controllers require the global `'admin'` role; none are reachable today because no user can have `role='admin'` without manual DB fiddling, and there is no bootstrap path.

## 3. Gap analysis — what must change for `User.role === 'admin'` to grant the authz role

### 3.1 Functional gap (the only hard requirement)

**Create a `User` row with `role='admin'` and a bcrypt-hashed password.** Nothing else is functionally required — the existing guard already reads `user.role` and treats it as a global role. Verified by trace in §1.2.

### 3.2 Robustness / clarity gaps (recommended, not blocking)

1. **`authz.config.ts:82-90`** — add `admin: {}` to `schema.roles` so the role is declared explicitly. Without it, the role still works (engine falls back to identity match), but the schema reads as if only team roles exist, which is misleading.
2. **No idempotent bootstrap mechanism** — even if we SQL-upsert an admin once, a DB reset (e.g. `devpilot-docker-staging.mjs` drops the staging DB at `scripts/devpilot-docker-staging.mjs:32`) wipes it. We need an env-driven, idempotent upsert that runs on API startup so it survives resets.
3. **`authz.config.ts:77` `getAssignments`** does NOT need to emit `'admin'`. The brief suggested it might; it does not. `getUserRoles` already handles it. Touching `getAssignments` would be redundant and risks double-assignment. **Do not modify `getAssignments` for this purpose.**

### 3.3 Concrete shape of the authz.config change

```ts
schema: {
  roles: {
    admin: {},                 // <-- NEW: explicit global admin role (no scope, no inherits)
    [TEAM_MEMBER_AUTHZ_ROLE]: {},
    [TEAM_ADMIN_AUTHZ_ROLE]: { inherits: [TEAM_MEMBER_AUTHZ_ROLE] },
    [TEAM_OWNER_AUTHZ_ROLE]: { inherits: [TEAM_ADMIN_AUTHZ_ROLE] },
  },
},
```

`getAssignments` and `getScope` stay **unchanged** — they are team-scoped only, and the admin role flows in through `userRoleField: 'role'`.

## 4. Naming decision — `'admin'` vs `'superadmin'`

**Decision: use `role = 'admin'`.**

Rationale:

1. **Matches the existing schema comment** — `apps/devpilot-api/prisma/schema.prisma:19`: `role String @default("user") // user | admin (系统级别)` (“system-level”). The system already documents exactly two values: `user` and `admin`.
2. **Matches every decorator value** — all 9 `@Roles('admin')` sites use the literal string `'admin'`. Using `'superadmin'` would require either changing all decorators (out of scope, risk) or adding a mapping layer in `getUserRoles`/`getAssignments` to translate `superadmin` → `admin` (unnecessary complexity).
3. **Matches the JWT payload contract** — `JwtPayload.role: string` (`auth.service.ts:7-11`) is signed from `user.role` (`auth.service.ts:114-119`) and the guard reads it back verbatim.
4. **The Prisma field is a free `String`** — no enum migration needed; setting `role='admin'` is a plain update.

Rejected alternative — `'superadmin'`: would require either decorator edits or a translation map, gains nothing (there is no separate “regular admin” concept in the system), and diverges from the documented schema. Not recommended.

## 5. Bootstrap mechanism — options & decision

### 5.1 Options considered

- **(A) Env-driven bootstrap on API startup (`OnModuleInit`).** Read `DEVPILOT_BOOTSTRAP_ADMIN_EMAIL` / `DEVPILOT_BOOTSTRAP_ADMIN_PASSWORD`; on module init, upsert the `User` with `role='admin'`. Idempotent. Runs in every environment where the env vars are set.
- **(B) Standalone CLI script** (`scripts/devpilot-bootstrap-admin.mjs`) the operator runs once.
- **(C) Staging seed only** — extend `scripts/devpilot-docker-staging.mjs` to upsert the admin.

### 5.2 Project-convention scan

- `OnModuleInit` is already used by: `PrismaService` (`apps/devpilot-api/src/prisma/prisma.service.ts:5-12`), `RegistryService` (`registry/registry.service.ts:74-83`), `BaseIntervalScheduler` (`common/scheduler/base-interval-scheduler.ts:25-39`), `ServerExecutorService` (`server-executor/server-executor.service.ts:47-104`), `ResourceRequestService` (`resource-request/resource-request.service.ts:49-61`). The pattern is well-established and idiomatic here.
- The staging script (`scripts/devpilot-docker-staging.mjs`) **drops the database on every run** (`:32`), so any one-shot seed (C) is destroyed on the next staging cycle. This rules out (C) as the primary mechanism.
- No existing user-seed/bootstrap-admin code anywhere (`rg DemoPass123|bootstrap|seed` only hits the staging script’s demo user at `:118-119`, which is a normal `role='user'` account).
- Env validation is centralized in `apps/devpilot-api/src/common/config/env.schema.ts` (zod, `.passthrough()`), so adding new optional env vars is non-breaking.

### 5.3 Decision: **(A) env-driven `OnModuleInit` bootstrap**, with (C) as a thin complement for staging convenience.

Rationale:

- Minimal, idempotent, survives DB resets (re-runs on every API start).
- Works identically in staging and production (operator just sets the env vars).
- Matches the established `OnModuleInit` convention.
- Production-safe: if the env vars are absent, the bootstrap is a no-op (logs a debug line, returns). No accidental admin creation.
- The staging script will additionally set the env vars (so staging always has a known admin) — this is just env wiring, not duplicate logic.

## 6. Security considerations

| Concern | Decision | Rationale |
|---|---|---|
| Password hashing | **Use the existing `bcrypt` path** (`auth.service.ts:41,74`: `bcrypt.hash(pw, 10)` / `bcrypt.compare`). | Must be byte-identical to the register/login path or login fails. The bootstrap service must NOT invent its own hashing. Reuse `bcrypt.hash(dto.password, 10)` directly, or inject `AuthService`/a shared hasher. |
| Default password | Staging: `DemoPass123!` (matches the existing staging demo password family at `scripts/devpilot-docker-staging.mjs:118`). Production: **no default** — env var must be set explicitly; bootstrap is a no-op if unset. | Staging needs a known value for e2e; production must force the operator to choose. |
| Refuse to bootstrap if env unset? | **Yes — silently skip.** Do NOT throw. Throwing would block API startup in production where no bootstrap admin is wanted. Log at `debug` level: `Bootstrap admin env vars not set; skipping.` | Production-safe default. |
| Logging the password | **Never.** Log only the email and the action (“upserted” / “updated password” / “skipped”). | Standard hygiene. |
| Bootstrap also grant Team membership? | **No.** Global admin is sufficient. Verified: `/admin/*` queries (`admin.service.ts`) do not filter by `teamId`; they read across all users/resource-pools. Team-scoped queries are only on `team_member`-gated routes, which admin does not need. Adding a synthetic team would pollute the data model and is out of scope. | Keeps the slice minimal; matches the unscoped design of the admin endpoints. |
| Password rotation | If the env password changes between runs, the bootstrap should re-hash and update. | Operator can rotate without SQL. |
| Existing-user conflict | If a non-admin user already exists with the bootstrap email, the bootstrap must **promote** them (set `role='admin'`, update password hash). Idempotent upsert by `email`. | Avoids collisions with operator-created accounts. Log a `warn` when promoting an existing user. |
| Email/credential leakage in logs | Email is PII but acceptable at `log` level (it is already logged on register at `auth.service.ts:52`). Password is the only secret; never log it. | Matches existing logging posture. |

## 7. Verification plan

After implementation, verify end-to-end:

1. **JWT contains the role.**
   ```bash
   TOKEN=$(curl -s -X POST http://localhost:3101/api/auth/login \
     -H 'Content-Type: application/json' \
     -d '{"email":"<bootstrap-email>","password":"<bootstrap-password>"}' \
     | jq -r '.data.accessToken')
   # Decode payload (no verification):
   echo "$TOKEN" | awk -F. '{print $2}' | base64 -d 2>/dev/null | jq .role
   # Expect: "admin"
   ```
2. **Admin endpoint returns 200.**
   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' \
     -H "Authorization: Bearer $TOKEN" \
     http://localhost:3101/api/admin/stats
   # Expect: 200
   ```
3. **Idempotency — second startup does not duplicate.**
   ```bash
   # restart the API process, then:
   curl -s http://localhost:3101/api/admin/users -H "Authorization: Bearer $TOKEN" \
     | jq '.data.users | length'
   # Expect: the bootstrap email appears exactly once across restarts.
   ```
4. **Env-absent safety — removing the env var does not break startup.**
   ```bash
   # unset DEVPILOT_BOOTSTRAP_ADMIN_EMAIL, restart API.
   # Expect: API starts normally; bootstrap admin (if previously created) still works
   # via its existing DB row; no throw, no crash.
   ```
5. **Resource-pool / resource-request admin routes.**
   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' \
     -H "Authorization: Bearer $TOKEN" \
     http://localhost:3101/api/resource-pools
   # Expect: 200
   ```

## 8. Adversarial alternatives (rejected)

1. **“Just edit the staging seed to insert an admin row.”** Rejected — `devpilot-docker-staging.mjs:32` drops the DB on every staging cycle, so a seed would only live until the next run. Also gives production nothing. The env-driven `OnModuleInit` covers both and is idempotent across resets.
2. **“Hardcode the admin email/password in `auth.service.ts`.”** Rejected — secrets in source is a hard security violation, fails any review, and couples credentials to the binary. Env-driven keeps secrets out of the repo.
3. **“Add `admin` to `getAssignments` so it emits the role from `User.role`.”** Rejected — redundant. `RolesGuard.resolveSubject` already reads `user.role` via `userRoleField` (`roles.guard.ts:147`). Emitting it again from `getAssignments` would produce a duplicate assignment and muddy the team-only semantics of that function. The clean fix is the DB row (and optionally the `schema.roles.admin` entry for explicitness).
4. **“Introduce `role='superadmin'` + a decorator translation map.”** Rejected — see §4. Adds complexity, diverges from the documented schema comment (`schema.prisma:19`), and forces decorator edits.

## 9. References (load-bearing file:line)

- `apps/devpilot-api/src/authz.config.ts:78` — `userRoleField: 'role'` (the reason `User.role` already flows into the guard).
- `apps/devpilot-api/src/authz.config.ts:82-90` — `schema.roles` (no `admin` key today).
- `apps/devpilot-api/src/authz.config.ts:92-144` — `getAssignments` (team-only; do not touch for admin).
- `packages/nestjs-authz/src/guards/roles.guard.ts:139-163` — `resolveSubject` merges `user.role` + `getAssignments`.
- `packages/authz/src/utils.ts:122-127` — `matchesScope(undefined, undefined) === true` (global role support).
- `packages/authz/src/authorizer.ts:53-78,184-193` — `expandRoles`/`hasRole` tolerate missing schema entry.
- `apps/devpilot-api/src/auth/strategies/jwt.strategy.ts:20-26` — JWT validate returns full Prisma user (with `role`).
- `apps/devpilot-api/src/auth/auth.service.ts:41,74,114-119` — bcrypt + JWT payload includes `role`.
- `apps/devpilot-api/prisma/schema.prisma:19` — `role String @default("user") // user | admin`.
- `apps/devpilot-api/src/prisma/prisma.service.ts:5-12` — `OnModuleInit` precedent.
- `scripts/devpilot-docker-staging.mjs:32,118` — staging DB drop + demo user password family.
