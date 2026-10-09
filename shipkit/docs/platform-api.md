# Local Shipkit API and persistence

The API in `apps/shipkit-api` is NestJS 10 with the svton HTTP package configured for raw JSON. Business execution imports the ESM `shipkit/platform` entry point. The API does not parse private credentials or expose a shell command endpoint.

## Running

Run these commands from the repository root after workspace dependency installation and the Shipkit executor build:

```sh
pnpm --filter @svton/shipkit-api prisma:generate
pnpm --filter @svton/shipkit-api prisma:migrate
pnpm --filter @svton/shipkit-api build
pnpm --filter @svton/shipkit-api start
```

Defaults: API `http://127.0.0.1:8770`; SQLite and archived logs in `apps/shipkit-api/.data`. For a shared platform directory, set `SHIPKIT_DATA_DIR` to an absolute path and `DATABASE_URL=file:/absolute/path/platform.db` consistently for migration and startup. `PORT` changes the API port. The migration wrapper creates the parent directory and a private empty SQLite file before Prisma migrate deploy. The database enables WAL and initializes the `local` workspace and `local-controller` actor.

The formal Next application uses its own same-origin `/api` proxy. Mutations require JSON, `x-shipkit-local: 1`, a loopback Host and, when supplied, a trusted local Origin. Identity is server-derived; request bodies cannot select actors or workspaces. Every read checks workspace ownership; execution, cancellation, cleanup and metadata changes have explicit policy actions.

## HTTP contract

| Route | Behavior |
| --- | --- |
| `GET /api/projects` | Registered local project metadata. |
| `POST /api/projects` | Register valid directory/config references, inspect real spec/config, save server/service display metadata. |
| `GET/PATCH /api/projects/:id` | Read/edit display metadata and configured target selection; no identity renaming. Active tasks prevent target changes. |
| `GET /api/projects/:id/status` | `{project,live}` from real platform inspection. |
| `POST /api/projects/:id/checks` | Real readiness diagnostics and explicit verification levels. Registry configuration is not a pull/push verification. |
| `POST /api/projects/:id/plans` | Prepare an immutable release/rollback plan without starting execution. |
| `POST /api/projects/:id/tasks` | `{planId,idempotencyKey?}` explicitly starts one durable task. |
| `GET /api/projects/:id/tasks` | Recent task summaries including selected services. All task rows remain durable. |
| `GET /api/projects/:id/history` | Agent history, current baseline and snapshot availability. |
| `GET /api/tasks/:id` | `{task,plan,stages,remoteJobs,events}`; plan restores the wizard after refresh. |
| `GET /api/tasks/:id/events?after=N` | Persisted monotonic events with `nextSeq` and `complete`; at most 250 per page. |
| `GET /api/tasks/:id/logs?stage=build&service=api&offset=N` | UTF-8 log bytes, `nextOffset`, `totalBytes`, and completion state; bounded to 128 KiB per read. Omit service for a combined stage archive. |
| `POST /api/tasks/:id/cancel` | Persist cancellation request; remote acknowledgement determines completion. |
| `POST /api/tasks/:id/cleanup` | Controlled cleanup retry using the original plan/config digest, with an independent attempt, logs, result and audit. |

Plan requests contain `kind`, `services`, optional `targetKey`, `sourceMode`, `changeReleaseId`, `keepEnv`, and `keepBuilder`. Public project data contains only file references and display metadata. Public plans and outputs omit private keys; uncontrolled errors return a safe diagnostic without echoing configuration contents.

Optional registration strings may be empty and are treated as omitted. PATCH accepts explicit `null` for `serverName`, `services[].displayName` and `services[].entryUrl` to clear saved metadata. Required references such as provided `targetKey` and every `serviceKey` reject empty values.

## Database and durability

The checked-in Prisma schema and SQL migration define Workspace, Actor, Project, Target, Service, Plan, Task, Stage, RemoteJob, Event, LogArchive, ResourceLease and Audit. Creator and execution actors, project workspace and audit scope have real foreign keys. SQLite stores public JSON snapshots in validated serialized String columns.

| Model | Responsibility |
| --- | --- |
| Workspace | Local resource scope, replaceable by an authenticated workspace context. |
| Actor | Stable execution/audit identity; fixed local controller for this MVP. |
| Project | Validated directory/config references, deployment identity and workspace ownership. |
| Target | Display metadata keyed by unchanged configured environment identity. |
| Service | Display name and entry URL keyed by unchanged service identity. |
| Plan | Immutable public execution input, source/config fingerprints, baseline and expiry. |
| Task | Entire release/rollback round, concurrent scope, result, cancel/recovery/cleanup states. |
| Stage | Service-level stage status and cleanup retry attempts. |
| RemoteJob | Agent role/endpoint/job mapping and persisted event/log cursors. |
| Event | Monotonic durable stage, log-index, remote-intent and outcome evidence. |
| LogArchive | Private fsynced log files indexed by task, stage and service. |
| ResourceLease | Exact dynamic resource identity and independent cleanup result. |
| Audit | Actor, workspace, request, action, resource and outcome with identity foreign keys. |

Task creation and its unique nullable `activeScope` are committed before dispatch. The scope uses the plan's project identity and target, including Git source identity. Idempotency keys prevent repeated starts. Failed resource cleanup blocks another project task until repaired. Plans expire and executor-side fingerprints/baselines are rechecked before provisioning.

Awaited executor events pass through a per-task serialized queue. Stage/job/cursor updates and event sequence insertion share a transaction. Logs are indexed before append and fsynced before awaited events complete; stage-wide and per-service archives survive machine release and API restart. Long log bodies do not duplicate into Event rows. Terminal tasks close their archives; cleanup retries reopen and close their own evidence.

The executor emits `remote-intent` before a remote POST, with the durable task execution ID. A dropped connection before saving jobId therefore keeps the task interrupted and the concurrency gate held. Startup and a ten-second loop reconcile remote jobs by persisted mapping or task operation prefix. Reconciliation never replays a release. An interrupted task releases its gate only when the executor explicitly reports `output.safeToReleaseGate=true`; unavailable or active remote work remains gated.

Cancellation keeps requested, committing/noncancellable, cancelled and recovery states distinct; a safely closed task cannot be reopened by a cancellation request. Unexpected execution errors preserve already persisted cleanup/recovery evidence. Successful completion closes residual running service rows only when the matching overall stage/attempt has explicit succeeded or skipped evidence, while retaining failed rows. Cleanup is independent from application success, and health verification skipped remains visible. Historical platform tasks remain stored even when Agent snapshot retention makes an old rollback unavailable.

Cleanup retries archive task-owned terminal builder jobs before invoking provider release. They discover missing job mappings by execution ID on the builder only, verify endpoint and cloud lease ownership, require complete log/event cursors, and await durable emissions. Active jobs, unavailable evidence, changed configuration or changed leases refuse destruction. The provider compares the expected lease under its actual release lock. Missing local state does not prove cloud resource deletion and cannot be reported as released for an expected lease.

## Verification

```sh
pnpm --filter @svton/shipkit-api type-check
pnpm --filter @svton/shipkit-api build
pnpm --filter @svton/shipkit-api test
```

The database integration suite verifies migration, identity foreign keys, concurrent gates, idempotency, target mutation protection, event serialization, archived byte cursors, UTF-8 chunk boundaries, redaction, reopen persistence, plan expiry, cancellation commit protection, remote-intent interruption and startup reconciliation. HTTP integration uses the real platform inspector/planner with a dedicated read-only Agent fixture to verify registration, status, local-origin enforcement, metadata limits, no execution during planning, duplicate registration and safe configuration errors. Actual build/push/deploy/rollback/cancel behavior is verified separately by the platform's isolated Docker E2E suite; a read-only fixture is not deployment proof.

HTTP integration also verifies expired plans return `409 PLAN_EXPIRED`, missing historical snapshots return `409 SNAPSHOT_UNAVAILABLE`, and changed runtime baselines fail their durable task before any remote job starts. Local Host and exact Origin checks reject foreign hosts, null origins and origins containing a path. Secret checks inspect task summaries/details/events and every stage log. After real Docker E2E, run `node apps/shipkit-api/scripts/privacy-audit.mjs`; it reads only the isolated fixture's private references and reports counts, never secret values.

API verification logs are kept under `/tmp/codex-tool-runs/svton/shipkit-api-*`. Database and runtime artifacts are ignored; generated Prisma client and compiled output are regenerated from checked-in source.
