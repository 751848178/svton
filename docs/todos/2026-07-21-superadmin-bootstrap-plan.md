# Superadmin Bootstrap — Implementation Plan

- Date: 2026-07-21
- Companion: `docs/todos/2026-07-21-superadmin-bootstrap-investigation.md`
- Goal: a system-level admin who can log in and pass every `@Roles('admin')` gate.
- Naming: `User.role = 'admin'` (matches `schema.prisma:19` and all decorators).
- Mechanism: env-driven idempotent `OnModuleInit` upsert, no-op when env vars absent.

## 1. Files to modify / create

| # | Path | Action | Purpose |
|---|---|---|---|
| 1 | `apps/devpilot-api/src/authz.config.ts` | **Edit** (≈3 lines) | Add `admin: {}` to `schema.roles` for explicitness. Do NOT touch `getAssignments`/`getScope`. |
| 2 | `apps/devpilot-api/src/admin/admin-bootstrap.service.ts` | **Create** | `AdminBootstrapService implements OnModuleInit`. Reads env, bcrypt-hashes, idempotent upsert by email. |
| 3 | `apps/devpilot-api/src/admin/admin.module.ts` | **Edit** | Import `PrismaModule`, register `AdminBootstrapService` as a provider so `onModuleInit` fires. Optionally re-export nothing. |
| 4 | `apps/devpilot-api/src/admin/index.ts` | **Edit** (1 line) | Export `AdminBootstrapService` for discoverability. |
| 5 | `apps/devpilot-api/.env.example` | **Edit** | Document `DEVPILOT_BOOTSTRAP_ADMIN_EMAIL` / `DEVPILOT_BOOTSTRAP_ADMIN_PASSWORD`. |
| 6 | `apps/devpilot-api/src/common/config/env.schema.ts` | **Edit** (≈2 lines, optional but recommended) | Declare both as `z.string().optional()` so they pass the zod validation gate (`.passthrough()` already keeps them, but explicit is better). |
| 7 | `scripts/devpilot-docker-staging.mjs` | **Edit** (env wiring) | Pass `DEVPILOT_BOOTSTRAP_ADMIN_EMAIL=admin@devpilot.local` + `DEVPILOT_BOOTSTRAP_ADMIN_PASSWORD=DemoPass123!` to the API container env so staging always has a known admin. |

No changes to: `main.ts`, `app.module.ts`, `auth.service.ts`, `jwt.strategy.ts`, `schema.prisma`, `getAssignments`, `getScope`.

## 2. File-by-file spec

### 2.1 `authz.config.ts` — add admin role to schema

Locate `schema.roles` (`authz.config.ts:82-90`) and insert the `admin` entry:

```ts
schema: {
  roles: {
    admin: {},                                  // <-- NEW: explicit global admin role
    [TEAM_MEMBER_AUTHZ_ROLE]: {},
    [TEAM_ADMIN_AUTHZ_ROLE]: { inherits: [TEAM_MEMBER_AUTHZ_ROLE] },
    [TEAM_OWNER_AUTHZ_ROLE]: { inherits: [TEAM_ADMIN_AUTHZ_ROLE] },
  },
},
```

Everything else in the file stays byte-identical.

### 2.2 `admin/admin-bootstrap.service.ts` — new file

Responsibilities:

- `implements OnModuleInit`.
- Inject `PrismaService` and `ConfigService`.
- Read `DEVPILOT_BOOTSTRAP_ADMIN_EMAIL` and `DEVPILOT_BOOTSTRAP_ADMIN_PASSWORD` from `ConfigService`.
- If either is empty/undefined → log `debug` “Bootstrap admin env vars not set; skipping.” and return. **Never throw.**
- Otherwise:
  - `bcrypt.hash(password, 10)` — identical salt rounds to `auth.service.ts:41`.
  - `prisma.user.findUnique({ where: { email } })`.
    - If not found → `prisma.user.create({ data: { email, passwordHash, role: 'admin', name: 'System Administrator' } })`. Log `log` “Bootstrapped admin user: <email>”.
    - If found:
      - If `role !== 'admin'` → log `warn` “Promoting existing user <email> to admin”.
      - If `passwordHash` differs (always just overwrite — cheap and correct) → `prisma.user.update({ where: { email }, data: { role: 'admin', passwordHash } })`. Log `log` “Updated bootstrap admin: <email>”.
      - If already admin with same hash → no-op, log `debug`.
- **Never log the password.** Only the email and the action verb.
- Wrap the whole body in try/catch; on error log `error` with the message and **swallow** — bootstrap failure must not crash API startup (the system can still serve non-admin routes).

Skeleton (pseudo, implementer to finalize per `code-structure-standards`):

```ts
@Injectable()
export class AdminBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const email = this.config.get<string>('DEVPILOT_BOOTSTRAP_ADMIN_EMAIL');
    const password = this.config.get<string>('DEVPILOT_BOOTSTRAP_ADMIN_PASSWORD');

    if (!email || !password) {
      this.logger.debug('Bootstrap admin env vars not set; skipping.');
      return;
    }

    try {
      const passwordHash = await bcrypt.hash(password, 10);
      const existing = await this.prisma.user.findUnique({ where: { email } });

      if (!existing) {
        await this.prisma.user.create({
          data: { email, passwordHash, role: 'admin', name: 'System Administrator' },
        });
        this.logger.log(`Bootstrapped admin user: ${email}`);
        return;
      }

      if (existing.role !== 'admin') {
        this.logger.warn(`Promoting existing user ${email} to admin`);
      }
      await this.prisma.user.update({
        where: { email },
        data: { role: 'admin', passwordHash },
      });
      this.logger.log(`Updated bootstrap admin: ${email}`);
    } catch (err) {
      this.logger.error(`Admin bootstrap failed: ${(err as Error).message}`);
    }
  }
}
```

Constraints (per `code-structure-standards` skill): file stays under 200 lines, single responsibility (bootstrap only — no login, no JWT). Import `bcrypt` exactly as `auth.service.ts:3` does.

### 2.3 `admin/admin.module.ts` — register the bootstrap

```ts
import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminBootstrapService } from './admin-bootstrap.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AdminController],
  providers: [AdminService, AdminBootstrapService],
  exports: [AdminService],
})
export class AdminModule {}
```

`AdminBootstrapService` is a provider (not exported) — Nest instantiates it and calls `onModuleInit` automatically. `PrismaModule` is already global-ish but importing it explicitly is the documented pattern.

### 2.4 `admin/index.ts` — export

Append: `export * from './admin-bootstrap.service';`

### 2.5 `.env.example` — document env vars

Append a section:

```dotenv

# ---------- Bootstrap admin (optional) ----------
# When both are set, the API upserts a system-level admin (role=admin) on startup.
# Leave unset in environments where no bootstrap admin is desired (no-op).
DEVPILOT_BOOTSTRAP_ADMIN_EMAIL=
DEVPILOT_BOOTSTRAP_ADMIN_PASSWORD=
```

### 2.6 `env.schema.ts` — explicit optional entries

Add inside the `.object({...})`:

```ts
DEVPILOT_BOOTSTRAP_ADMIN_EMAIL: z.string().optional(),
DEVPILOT_BOOTSTRAP_ADMIN_PASSWORD: z.string().optional(),
```

(Strictly optional due to `.passthrough()`, but explicit declaration documents intent and gets typed config reads.)

### 2.7 `scripts/devpilot-docker-staging.mjs` — staging env wiring

Add the two env vars to the API container’s environment block (the exact insertion point depends on how the script composes the docker environment — implementer to grep for existing `NODE_ENV`/`DATABASE_URL` passes to the API container and mirror them). Suggested staging values:

- `DEVPILOT_BOOTSTRAP_ADMIN_EMAIL=admin@devpilot.local`
- `DEVPILOT_BOOTSTRAP_ADMIN_PASSWORD=DemoPass123!`

These match the existing staging demo-password family (`scripts/devpilot-docker-staging.mjs:118`). Staging-only; production sets its own.

## 3. Acceptance criteria (all must be verifiable)

| # | Criterion | Verification |
|---|---|---|
| AC1 | API starts normally with env vars unset; no admin created. | Unset both vars, `pnpm --filter devpilot-api start`, confirm process up, log line `Bootstrap admin env vars not set; skipping.` |
| AC2 | API starts with env vars set; admin User exists after startup. | Set vars, start API, `SELECT email, role FROM User WHERE email='<email>'` → role='admin'. |
| AC3 | Login returns a JWT whose `role` claim is `'admin'`. | `POST /api/auth/login` → decode `accessToken` payload → `role === 'admin'`. |
| AC4 | `@Roles('admin')` endpoints return 200. | `GET /api/admin/stats`, `GET /api/resource-pools` with the token → both 200. |
| AC5 | Idempotency: second startup does not duplicate. | Restart API, count users with bootstrap email → exactly 1. |
| AC6 | Password rotation via env works. | Change `DEVPILOT_BOOTSTRAP_ADMIN_PASSWORD`, restart, login with new password succeeds, old password fails. |
| AC7 | Existing-user promotion works. | Pre-create a normal user with the bootstrap email, start API → user is promoted (role='admin'), login with bootstrap password succeeds. |
| AC8 | Password never appears in logs. | `grep` API logs for the password string → 0 hits; email may appear. |
| AC9 | `schema.roles.admin` is declared. | `rg "admin:\s*\{" apps/devpilot-api/src/authz.config.ts` → 1 hit. |
| AC10 | Existing tests still pass. | `pnpm --filter devpilot-api test` — `admin.service.spec.ts` unaffected (no change to `AdminService`). |

## 4. Sequencing constraints

1. **Edit `authz.config.ts` first** (independent, no runtime dependency on the bootstrap service).
2. **Create `admin-bootstrap.service.ts`** before editing the module (module references it).
3. **Edit `admin.module.ts`** to import `PrismaModule` and register the service.
4. **Edit `admin/index.ts`** (export).
5. **Edit `env.schema.ts`** and **`.env.example`** (documentation/gate).
6. **Edit `scripts/devpilot-docker-staging.mjs`** last (only affects staging runs).
7. Verify per §3 acceptance criteria in order AC1 → AC10.

## 5. Out of scope (explicitly)

- No changes to `getAssignments`, `getScope`, `JwtStrategy`, `AuthService`, `schema.prisma`, or any controller.
- No new Team membership for the admin (global role is sufficient — see investigation §6).
- No CLI script (option B rejected — investigation §8).
- No `superadmin` role value (naming decision — investigation §4).
- No password complexity enforcement beyond what the operator chooses (the env var is the source of truth).

## 6. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Bootstrap throws and crashes API startup. | try/catch swallows; logs `error`. Non-admin routes unaffected. |
| Operator forgets to set env in prod → no admin. | Documented in `.env.example`; AC1 confirms no-op behaviour. Operator-run concern, not a code defect. |
| Staging password `DemoPass123!` leaked. | Staging only; documented; production uses its own env. |
| Double-assignment if someone also edits `getAssignments`. | Explicitly forbidden in this plan; investigation §3.3 explains why. |
| bcrypt cost mismatch with login. | Use identical `bcrypt.hash(pw, 10)` as `auth.service.ts:41`. |
