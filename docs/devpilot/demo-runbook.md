# Devpilot Reproducible Demo Runbook

This runbook gives a repeatable local path for showing Devpilot from setup to
agent task-pull completion evidence. It intentionally keeps live deployment
behind explicit flags so the default demo is safe on a developer machine.
For production handoff values, use
[`production-config-pack.md`](./production-config-pack.md) instead of copying
the demo exports directly. For production server-agent operation, use
[`agent-production-runbook.md`](./agent-production-runbook.md).

## Scope

- Local MySQL and Redis for `apps/devpilot-api`.
- Devpilot API on `http://127.0.0.1:$DEVPILOT_API_PORT` and Web on
  `http://127.0.0.1:$DEVPILOT_WEB_PORT`.
- A demo user/team/project with at least one server-agent target.
- Resource sync, deployment dry-run, task-pull `completed`, logs, monitoring,
  and rollback checks.

## Prerequisites

- Node and pnpm available through the repo toolchain.
- Docker running locally.
- MySQL reachable by `DATABASE_URL`.
- Redis reachable by `REDIS_HOST` and `REDIS_PORT`.
- Optional for browser proof: Chromium dependencies for Playwright.

Use a throwaway database name for demos, for example:

```bash
export DEVPILOT_API_PORT=3211
export DEVPILOT_WEB_PORT=3210
export DATABASE_URL='mysql://root:password@127.0.0.1:3306/devpilot_demo_20260713'
export REDIS_HOST=127.0.0.1
export REDIS_PORT=6383
export REDIS_PASSWORD=''
export JWT_SECRET=devpilot-demo-jwt-secret
export CORS_ORIGIN=http://127.0.0.1:3210,http://localhost:3210
export SERVER_EXECUTOR_LIVE_ENABLED=true
export SERVER_EXECUTOR_QUEUE_WORKER_ENABLED=true
export SERVER_EXECUTOR_AGENT_TASK_PULL_ENABLED=true
export SERVER_EXECUTOR_AGENT_TASK_PULL_TOKEN=devpilot-demo-task-token
export SERVER_EXECUTOR_AGENT_TASK_PULL_CONTRACT_ENABLED=true
export SERVER_EXECUTOR_AGENT_TASK_PULL_CONTRACT_TOKEN=devpilot-demo-task-token
export SERVER_EXECUTOR_AGENT_HEARTBEAT_ENABLED=true
export SERVER_EXECUTOR_AGENT_HEARTBEAT_TOKEN=devpilot-demo-heartbeat-token
```

Reusable demo configuration:

| Area | Demo value | Production note |
| --- | --- | --- |
| API | `PORT=$DEVPILOT_API_PORT`, `http://127.0.0.1:3211/api` | Use the real API origin behind TLS. |
| Web | `PORT=$DEVPILOT_WEB_PORT`, `NEXT_PUBLIC_API_URL=http://127.0.0.1:3211` | Use the public API origin that browsers can reach. |
| CORS | `CORS_ORIGIN=http://127.0.0.1:3210,http://localhost:3210` | List exact Web origins; do not use `*` with credentials. |
| MySQL | throwaway DB such as `devpilot_demo_20260713` | Use an isolated schema or database for rehearsal data. |
| Redis | `REDIS_HOST=127.0.0.1`, `REDIS_PORT=6383`, empty password for local Docker | Set `REDIS_PASSWORD` when Redis requires auth. |
| virtual-nginx | `devpilot-virtual-nginx` on `127.0.0.1:18088` | Must be disposable and outside production traffic. |
| queue worker | `SERVER_EXECUTOR_QUEUE_WORKER_ENABLED=true` | Keep enabled for queued live jobs; monitor lock TTL and stale recovery. |
| live executor | `SERVER_EXECUTOR_LIVE_ENABLED=true` | Enable only for approved environments with command policy templates. |
| task-pull token | `SERVER_EXECUTOR_AGENT_TASK_PULL_TOKEN` | Generate a secret per environment and rotate after shared demos. |
| heartbeat token | `SERVER_EXECUTOR_AGENT_HEARTBEAT_TOKEN` | Generate a separate secret; do not reuse the task-pull token. |
| agent cwd | CLI `--cwd /tmp` | Use a tighter disposable worktree path when available. |
| noisy logs | `/tmp/codex-tool-runs/svton/<run-id>` | Keep full logs outside the repo and link the summary path. |

## Local Services

Start or reuse local infrastructure:

```bash
docker run --name devpilot-demo-mysql -e MYSQL_ROOT_PASSWORD=password -e MYSQL_DATABASE=devpilot_demo_20260713 -p 3306:3306 -d mysql:8.0
docker run --name devpilot-virtual-redis -p 6383:6379 -d redis:7-alpine
docker run --name devpilot-virtual-nginx -p 18088:80 -d nginx:alpine
```

If the containers already exist, start them instead:

```bash
docker start devpilot-demo-mysql devpilot-virtual-redis devpilot-virtual-nginx
```

## Database And Apps

Generate Prisma and run migrations:

```bash
corepack pnpm --filter @svton/devpilot-api exec prisma generate
corepack pnpm --filter @svton/devpilot-api exec prisma migrate deploy
```

Start API and Web in separate terminals:

```bash
PORT=$DEVPILOT_API_PORT corepack pnpm --filter @svton/devpilot-api dev
PORT=$DEVPILOT_WEB_PORT NEXT_PUBLIC_API_URL=http://127.0.0.1:$DEVPILOT_API_PORT corepack pnpm --filter @svton/devpilot-web dev
```

Health probes:

```bash
curl -i http://127.0.0.1:$DEVPILOT_API_PORT/api/auth/profile
curl -i http://127.0.0.1:$DEVPILOT_WEB_PORT/login
```

Expected: API profile returns `401` without a token, Web returns the login page.

## Demo Identity And Team

Create or reuse the demo user:

```bash
curl -sS http://127.0.0.1:$DEVPILOT_API_PORT/api/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"devpilot-demo@example.test","password":"DemoPass123","name":"Devpilot Demo"}'
```

If the user already exists, log in:

```bash
TOKEN=$(curl -sS http://127.0.0.1:$DEVPILOT_API_PORT/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"devpilot-demo@example.test","password":"DemoPass123"}' \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{const r=JSON.parse(s); console.log((r.data||r).accessToken)})')
```

Create a team if needed and keep the returned `id` as `TEAM_ID`:

```bash
curl -sS http://127.0.0.1:$DEVPILOT_API_PORT/api/teams \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"name":"Devpilot Demo Team","description":"Local reproducible demo"}'
```

All later API calls should include:

```bash
-H "authorization: Bearer $TOKEN" -H "x-team-id: $TEAM_ID"
```

## Project And Agent Target

Use the Web project wizard for the user-facing path:

1. Open `http://127.0.0.1:$DEVPILOT_WEB_PORT/projects/new`.
2. Create a demo project with one backend service.
3. Add MySQL and Redis resource settings.
4. Generate the project ZIP and confirm it appears in `/projects`.

Register the local target in the Servers page:

1. Open `/servers`.
2. Add `devpilot-virtual-nginx` with endpoint `http://127.0.0.1:18088`.
3. Mark it for server-agent/task-pull execution if the form exposes those fields.

Then open `/resource-control` and run `Sync` on the Docker/server resource. The
demo passes this checkpoint when the resource card remains visible and the
Action runs panel records a completed or dry-run sync.

## Deployment Dry-Run

Use a deployment dry-run before any live command:

1. Open `/applications`.
2. Select the demo service.
3. Trigger deploy with dry-run enabled.
4. Confirm `/execution-governance` shows a queued or completed server execution job.

The dry-run checkpoint is the job row plus a deployment run whose status is not
`failed` or `blocked`.

## Task-Pull Completed

Run a bounded local agent loop:

```bash
corepack pnpm --filter @svton/cli exec svton agent task-pull run \
  --api-url http://127.0.0.1:$DEVPILOT_API_PORT/api \
  --team "$TEAM_ID" \
  --server "$SERVER_ID" \
  --agent devpilot-demo-agent \
  --runner devpilot-demo-runner \
  --token devpilot-demo-task-token \
  --heartbeat-token devpilot-demo-heartbeat-token \
  --cwd /tmp \
  --max-iterations 3 \
  --ack-renewal-interval-ms 30000 \
  --force-kill-grace-ms 5000
```

The checkpoint is a CLI summary containing a claimed task and a terminal
`completed` finish result. Afterward, `/execution-governance` should show task
pull readiness and a completed job state.

If command steps use a narrower absolute disposable worktree, replace `--cwd
/tmp` with that path. Do not use the repository root as the live agent cwd for
a demo.

## Demo Cleanup And Archive Strategy

Do not delete production execution data to make a demo look clean. Keep the
history auditable and make the current scope explicit. The reusable governance
rules live in [`rehearsal-trace-governance.md`](./rehearsal-trace-governance.md):

1. Save the run ids, job ids, approval ids, and known historical blockers in the
   evidence summary. The live rehearsal used
   `/tmp/codex-tool-runs/svton/live-deploy-rollback-20260713-001800/final-live-summary.json`.
2. Demo the current run through scoped views such as
   `/execution-governance?serverId=$SERVER_ID&jobStatus=completed` or
   `/execution-governance?operationKey=deployment.run&jobStatus=completed`.
3. Use `/logs` and `/monitoring` after deploy and rollback finish, and call out
   that old `failed` or `blocked` rows are historical audit records when they
   appear in a non-scoped list.
4. Treat terminal server-agent jobs with `finishedAt` set as history. They must
   remain searchable in the job list but should not be used as current task-pull
   readiness blockers.
5. If a demo database must be reset, reset the throwaway database and Redis only:
   stop the local API/Web, drop the `devpilot_demo_*` schema, recreate it, rerun
   Prisma migrations, and keep the old evidence directory instead of editing
   production rows.

The S005 live rehearsal left two intentional historical blockers before the
successful path: a policy-blocked deployment run and a checkout-failed run. Keep
those ids in the evidence summary; do not remove them from a shared production
database.

## Command Policy Templates

Create policy templates before enabling live deploy. Keep demo-safe and
production-safe templates separate. Template patterns are micromatch globs by
default; use `regex:` for regular expressions. The reusable template pack lives
in [`command-policy-templates.md`](./command-policy-templates.md).

Demo-safe template:

```json
{
  "name": "demo-safe-disposable-nginx",
  "description": "Only allows disposable /tmp worktree deploy and rollback commands for the local nginx target.",
  "enabled": true,
  "priority": 100,
  "adapterKeys": ["deployment-script-plan"],
  "operationKeys": ["deployment.run", "deployment.rollback"],
  "allowedPatterns": [
    "regex:^git fetch --all --prune$",
    "regex:^git checkout [a-zA-Z0-9._/@-]+$",
    "regex:^git pull --ff-only$",
    "regex:^(pnpm|npm|yarn|bun) (install|ci|run build|build)( [a-zA-Z0-9_./:@=-]+)*$",
    "regex:^docker compose (pull|up -d( --build)?|restart)( [a-zA-Z0-9_./:@=+-]+)*$",
    "regex:^curl -fsS ('https?://[^']+'|https?://\\S+)$"
  ],
  "blockedPatterns": [
    "regex:.*\\brm\\b.*",
    "regex:.*\\bsudo\\b.*",
    "regex:.*\\bchmod\\s+777\\b.*",
    "regex:.*\\b(curl|wget)\\b.*\\|\\s*\\b(sh|bash)\\b.*",
    "regex:.*\\b(password|secret|token)=\\S+.*",
    "regex:.*(;|\\|\\||&&|`|\\$\\(|>|<).*"
  ]
}
```

Production-safe template:

```json
{
  "name": "production-safe-approved-deploy",
  "description": "Scoped deployment commands only; pair with human approval, SSH key auth, and environment-specific project/env scope.",
  "enabled": true,
  "priority": 200,
  "adapterKeys": ["deployment-script-plan"],
  "operationKeys": ["deployment.run", "deployment.rollback", "deployment.smoke_check"],
  "allowedPatterns": [
    "regex:^git fetch --all --prune$",
    "regex:^git checkout [a-fA-F0-9]{7,64}$",
    "regex:^git checkout (main|master|release/[a-zA-Z0-9._-]+)$",
    "regex:^git pull --ff-only$",
    "regex:^(pnpm|npm|yarn|bun) (install|ci|run build|build)( [a-zA-Z0-9_./:@=-]+)*$",
    "regex:^docker compose (pull|up -d --build|restart [a-zA-Z0-9_.-]+)$",
    "regex:^curl -fsS ('https://[^']+'|https://\\S+)$"
  ],
  "blockedPatterns": [
    "regex:.*\\brm\\s+-rf\\b.*",
    "regex:.*\\bsudo\\b.*",
    "regex:.*\\bchmod\\s+777\\b.*",
    "regex:.*\\bchown\\b.*",
    "regex:.*\\bscp\\b.*",
    "regex:.*\\bssh\\b.*",
    "regex:.*\\b(curl|wget)\\b.*\\|\\s*\\b(sh|bash)\\b.*",
    "regex:.*\\b(password|secret|token)=\\S+.*",
    "regex:.*(;|\\|\\||&&|`|\\$\\(|>|<).*"
  ]
}
```

For production, bind the template to the target project/environment whenever
possible and keep live approval required. Do not use a broad catch-all live
template for every project.

## Logs And Monitoring

Open these pages after task-pull finishes:

- `/logs`: confirm the log stream list, collection/retention panels, and recent
  entries or empty states render without auth errors.
- `/monitoring`: confirm SLO/alert panels render and no raw i18n keys appear.
- `/execution-governance`: confirm Supervisor, Agent readiness, task pull, job,
  and lease panels render.

Run the browser proof:

```bash
mkdir -p /tmp/codex-tool-runs/svton/devpilot-playwright-runtime
npm --prefix /tmp/codex-tool-runs/svton/devpilot-playwright-runtime install playwright
DEVPILOT_WEB_URL=http://127.0.0.1:$DEVPILOT_WEB_PORT \
DEVPILOT_E2E_OUTPUT_DIR=/tmp/codex-tool-runs/svton/devpilot-ui-e2e-demo \
PLAYWRIGHT_MODULE_PATH=/tmp/codex-tool-runs/svton/devpilot-playwright-runtime/node_modules/playwright \
node scripts/devpilot-ui-e2e.mjs
```

## Rollback Exercise

Only run live rollback against a disposable target:

```bash
export DEVPILOT_DEMO_ALLOW_LIVE=1
```

1. Trigger a live deployment against `devpilot-virtual-nginx`.
2. Wait until deployment and server execution jobs show `completed`.
3. Trigger rollback from the deployment panel.
4. Confirm the rollback run reaches `completed`.
5. Check `/logs` and `/monitoring` for deployment, rollback, and smoke signals.

If a safe disposable target is not available, record the blocker as:

- no isolated target;
- missing task-pull token/heartbeat token;
- no live deployment command policy for the target;
- Docker/SSH transport unavailable.

## Docker-Backed Staging Matrix

Use this matrix when real provider credentials or approved staging targets are
not available but local Docker is allowed. It is production-like rehearsal
evidence only; do not present it as real cloud or production validation.

| Target | Local default | Validation role |
| --- | --- | --- |
| API MySQL | `devpilot-g003-api-mysql` on `127.0.0.1:3320` | Disposable Devpilot database. |
| API Redis | `devpilot-g003-api-redis` on `127.0.0.1:6384` | Disposable API cache/queue dependency. |
| resource-mysql | `devpilot-g003-mysql` on `127.0.0.1:3321` (db `devpilot_resource_pool`) | Resource pool provisioning target plus `backup.service.ts` `docker exec` source (container name preserved on purpose). |
| resource-redis | `devpilot-g003-redis` on `127.0.0.1:6385` | Redis pool allocation target plus `docker cp` redis dump source. |
| postgres | `devpilot-g003-resource-postgres` on `127.0.0.1:5433` | PostgreSQL manual delivery endpoint for the `postgresql` default resource type. |
| ssh-server | `devpilot-g003-ssh-server` on `127.0.0.1:2223` (`devpilot`/`devpilot`) | Exercises the `ssh` transport for `server-executor` instead of forcing `server_agent`. |
| minio | `devpilot-g003-minio` S3 on `127.0.0.1:9100`, console on `127.0.0.1:9101` | S3-compatible endpoint standing in for `tencent-cos` / `qiniu` object storage flows. |
| docker-socket-proxy | `devpilot-g003-docker-socket-proxy` on `127.0.0.1:2376` | Read-only docker daemon target for `resource-control` dockerode inventory (`dockerApiHost`). |
| mailhog | `devpilot-g003-mailhog` SMTP on `127.0.0.1:1025`, UI on `127.0.0.1:8025` | SMTP sink for `SMTP_HOST`/`SMTP_PORT`/`MAIL_FROM` notification delivery config. |
| virtual nginx/app | `devpilot-g003-virtual-nginx` on `http://127.0.0.1:18098` | Live deploy, smoke, rollback, and task-pull command target. |
| fake provider | `devpilot-g003-fake-provider` on `http://127.0.0.1:19091` | Resource provisioning callback that returns redacted delivery evidence. |
| backup/restore | `devpilot-g003-backup-target` plus Devpilot backup/restore jobs | Backup dry-run and restore dry-run command-policy validation. |
| task-pull agent | local `svton agent task-pull run` with `--cwd /tmp/devpilot-g003-agent-work` | Claims queued deploy/rollback jobs and writes terminal completion. |

Run the full disposable staging rehearsal:

```bash
node scripts/devpilot-docker-staging.mjs run
```

Useful overrides:

```bash
DEVPILOT_STAGING_MYSQL_PORT=3321 \
DEVPILOT_STAGING_REDIS_PORT=6385 \
DEVPILOT_STAGING_NGINX_PORT=18099 \
DEVPILOT_STAGING_FAKE_PROVIDER_PORT=19092 \
node scripts/devpilot-docker-staging.mjs run
```

Stop and remove the disposable containers:

```bash
node scripts/devpilot-docker-staging.mjs down
```

The runner writes full logs and `summary.json` under
`/tmp/codex-tool-runs/svton/g003-docker-staging-*`. A passing run proves the
local matrix, resource request approval/provisioning, live deploy task-pull,
backup dry-run, restore dry-run, rollback task-pull, log stream, monitoring,
and audit endpoints. It does not clear real provider or production signoff.

### Disposable staging rehearsal with local Docker resources

The `run` command additionally brings up the local resource tier described in
the matrix above and seeds the rows that let the API exercise the wider flow
without real cloud credentials:

- `ResourceType` rows `local-mysql-pool`, `local-redis-pool`, `local-postgres`,
  `local-object-storage`, `local-ssh-server` (created by the runner — the
  defaults in `resource-type-defaults.constants.ts` are intentionally left
  untouched).
- `ResourcePool` rows for `mysql` and `redis` pointing at `resource-mysql:3306`
  and `resource-redis:6379` so pool provisioning (`resource-pool-provisioning.service.ts`)
  returns a real host/port/database delivery object.
- `Server` row with `tags: { dockerApiHost: 'tcp://docker-socket-proxy:2375' }`
  so `docker-inventory-executor.factory.ts` selects the dockerode inventory
  path; the live `mysql`/`redis`/`postgres`/`ssh-server`/`minio` containers
  become discoverable as `ManagedResource` rows.
- `TeamCredential` row carrying the MinIO S3-compatible shape so the
  `tencent-cos` / `qiniu` object-storage code paths have a local target.
- `SMTP_HOST`/`SMTP_PORT`/`MAIL_FROM` set to `127.0.0.1`/`1025`/`devpilot@staging.local`
  so `monitoring-notification-delivery-config.service.ts` validates against
  Mailhog.

The MinIO bucket `devpilot-test` is created by a one-shot profile service:

```bash
docker compose -f docker-compose.devpilot-staging.yml --profile seed run --rm minio-mc
```

After it runs, the bucket is visible in the MinIO console at
`http://127.0.0.1:9101` (login `minio` / `minio12345`).

The full summary JSON contains a `localResources` block with the seeded
`resourceTypeIds`, `poolIds`, `serverId`, and `credentialId`, and the
`observability` block contains `minioStatus` and `dockerProxyStatus` (both
expected to be `200` on a healthy stack). A non-200 `dockerProxyStatus`
indicates the host has no `/var/run/docker.sock` and is treated as a warning,
not a hard failure.

## Evidence To Capture

- API/Web startup log paths.
- Migration log path.
- Browser E2E summary JSON and screenshot directory.
- CLI task-pull summary output.
- Deployment and rollback run ids.
- `/execution-governance`, `/logs`, and `/monitoring` screenshots.
