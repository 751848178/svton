# Devpilot Reproducible Demo Runbook

This runbook gives a repeatable local path for showing Devpilot from setup to
agent task-pull completion evidence. It intentionally keeps live deployment
behind explicit flags so the default demo is safe on a developer machine.

## Scope

- Local MySQL and Redis for `apps/devpilot-api`.
- Devpilot API on `http://localhost:3101` and Web on `http://localhost:3100`.
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
export DATABASE_URL='mysql://root:password@127.0.0.1:3306/devpilot_demo_20260712'
export REDIS_HOST=127.0.0.1
export REDIS_PORT=6379
export JWT_SECRET=devpilot-demo-jwt-secret
export SERVER_EXECUTOR_AGENT_TASK_PULL_ENABLED=true
export SERVER_EXECUTOR_AGENT_TASK_PULL_TOKEN=devpilot-demo-task-token
export SERVER_EXECUTOR_AGENT_TASK_PULL_CONTRACT_ENABLED=true
export SERVER_EXECUTOR_AGENT_TASK_PULL_CONTRACT_TOKEN=devpilot-demo-task-token
export SERVER_EXECUTOR_AGENT_HEARTBEAT_ENABLED=true
export SERVER_EXECUTOR_AGENT_HEARTBEAT_TOKEN=devpilot-demo-heartbeat-token
```

## Local Services

Start or reuse local infrastructure:

```bash
docker run --name devpilot-demo-mysql -e MYSQL_ROOT_PASSWORD=password -e MYSQL_DATABASE=devpilot_demo_20260712 -p 3306:3306 -d mysql:8.0
docker run --name devpilot-demo-redis -p 6379:6379 -d redis:7-alpine
docker run --name devpilot-demo-target -p 18088:80 -d nginx:alpine
```

If the containers already exist, start them instead:

```bash
docker start devpilot-demo-mysql devpilot-demo-redis devpilot-demo-target
```

## Database And Apps

Generate Prisma and run migrations:

```bash
corepack pnpm --filter @svton/devpilot-api exec prisma generate
corepack pnpm --filter @svton/devpilot-api exec prisma migrate deploy
```

Start API and Web in separate terminals:

```bash
corepack pnpm --filter @svton/devpilot-api dev
NEXT_PUBLIC_API_URL=http://localhost:3101 corepack pnpm --filter @svton/devpilot-web dev
```

Health probes:

```bash
curl -i http://localhost:3101/api/auth/profile
curl -i http://localhost:3100/login
```

Expected: API profile returns `401` without a token, Web returns the login page.

## Demo Identity And Team

Create or reuse the demo user:

```bash
curl -sS http://localhost:3101/api/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"devpilot-demo@example.test","password":"DemoPass123","name":"Devpilot Demo"}'
```

If the user already exists, log in:

```bash
TOKEN=$(curl -sS http://localhost:3101/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"devpilot-demo@example.test","password":"DemoPass123"}' \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>console.log(JSON.parse(s).accessToken))')
```

Create a team if needed and keep the returned `id` as `TEAM_ID`:

```bash
curl -sS http://localhost:3101/api/teams \
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

1. Open `http://localhost:3100/projects/new`.
2. Create a demo project with one backend service.
3. Add MySQL and Redis resource settings.
4. Generate the project ZIP and confirm it appears in `/projects`.

Register the local target in the Servers page:

1. Open `/servers`.
2. Add `devpilot-demo-target` with endpoint `http://127.0.0.1:18088`.
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
corepack pnpm --filter @svton/cli svton agent task-pull run \
  --api-url http://localhost:3101/api \
  --team-id "$TEAM_ID" \
  --server-id "$SERVER_ID" \
  --task-pull-token devpilot-demo-task-token \
  --heartbeat-token devpilot-demo-heartbeat-token \
  --max-iterations 3 \
  --ack-renewal-interval-ms 30000 \
  --force-kill-grace-ms 5000 \
  --execute
```

The checkpoint is a CLI summary containing a claimed task and a terminal
`completed` finish result. Afterward, `/execution-governance` should show task
pull readiness and a completed job state.

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
DEVPILOT_WEB_URL=http://localhost:3100 \
DEVPILOT_E2E_OUTPUT_DIR=/tmp/codex-tool-runs/svton/devpilot-ui-e2e-demo \
PLAYWRIGHT_MODULE_PATH=/tmp/codex-tool-runs/svton/devpilot-playwright-runtime/node_modules/playwright \
node scripts/devpilot-ui-e2e.mjs
```

## Rollback Exercise

Only run live rollback against a disposable target:

```bash
export DEVPILOT_DEMO_ALLOW_LIVE=1
```

1. Trigger a live deployment against `devpilot-demo-target`.
2. Wait until deployment and server execution jobs show `completed`.
3. Trigger rollback from the deployment panel.
4. Confirm the rollback run reaches `completed`.
5. Check `/logs` and `/monitoring` for deployment, rollback, and smoke signals.

If a safe disposable target is not available, record the blocker as:

- no isolated target;
- missing task-pull token/heartbeat token;
- no live deployment command policy for the target;
- Docker/SSH transport unavailable.

## Evidence To Capture

- API/Web startup log paths.
- Migration log path.
- Browser E2E summary JSON and screenshot directory.
- CLI task-pull summary output.
- Deployment and rollback run ids.
- `/execution-governance`, `/logs`, and `/monitoring` screenshots.
