# Picshare Onboarding + Deployment on Devpilot — Phase 1 Plan

Date: 2026-07-22
Companion: `2026-07-22-picshare-deployment-investigation.md` (background + evidence).
Scope: hybrid (reflective) onboarding. picshare is started by its own compose;
devpilot holds the project/application/service records and a real dry-run
DeploymentRun whose `healthCheckUrl` points at the live container.

All paths absolute. Run from `/Users/zhaoxingbo/Workspace/ai-driven`.

---

## 0. Pre-flight checks (verify each before proceeding)

```sh
# 0.1 devpilot API up and reachable
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3121/api/auth/profile
# expect: 401   (means API is up; needs auth)

# 0.2 devpilot API container does NOT have live executor enabled (confirms virtual deployment)
docker inspect devpilot-app-api --format '{{range .Config.Env}}{{println .}}{{end}}' \
  | grep -E 'SERVER_EXECUTOR_LIVE_ENABLED|SERVER_EXECUTOR_AGENT_TARGET_ENABLED' || echo 'both unset (expected)'
# expect: "both unset (expected)"

# 0.3 confirm target host ports are free
for p in 4100 4101 3311 6386; do
  lsof -iTCP:$p -sTCP:LISTEN >/dev/null 2>&1 && echo "PORT $p IN USE" || echo "PORT $p free"
done
# expect: all four "free"

# 0.4 confirm staging network exists and devpilot-app-api is on it
docker network inspect devpilot-g003-staging_default \
  --format '{{range .Containers}}{{.Name}} {{end}}' | tr ' ' '\n' | grep -E 'devpilot-app-api|devpilot-g003-mysql' >/dev/null \
  && echo "staging network ok" || echo "staging network MISSING"
# expect: "staging network ok"
```

If any check fails, stop and fix before continuing.

---

## 1. Start picshare containers (real deployment via picshare's own compose)

### 1.1 Create a devpilot-scoped compose override

Create `/Users/zhaoxingbo/Workspace/ai-driven/picshare/docker-compose.devpilot.yml`:

```yaml
# Picshare stack scoped for the devpilot staging network.
# Brings picshare's own MySQL + Redis (dedicated infra; see investigation doc C.1).
# Host ports: backend 4100, admin 4101, mysql 3311, redis 6386 (all verified free).
services:
  mysql:
    image: mysql:8.0
    container_name: picshare-mysql
    restart: unless-stopped
    command:
      - --performance-schema=OFF
      - --innodb-buffer-pool-size=96M
      - --max-connections=60
    environment:
      MYSQL_ROOT_PASSWORD: picshare_root
      MYSQL_DATABASE: picshare
      MYSQL_USER: picshare
      MYSQL_PASSWORD: picshare_pw
    ports:
      - '3311:3306'
    volumes:
      - picshare_mysql_data:/var/lib/mysql
    healthcheck:
      test: ['CMD-SHELL', 'mysqladmin ping -h 127.0.0.1 -u picshare -ppicshare_pw --silent']
      interval: 5s
      timeout: 5s
      retries: 20
    networks:
      - devpilot-staging

  redis:
    image: redis:7-alpine
    container_name: picshare-redis
    restart: unless-stopped
    ports:
      - '6386:6379'
    volumes:
      - picshare_redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 5s
      retries: 20
    networks:
      - devpilot-staging

  backend:
    build:
      context: .
      dockerfile: apps/backend/Dockerfile
    image: picshare-backend:devpilot
    container_name: picshare-backend
    restart: unless-stopped
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_healthy
    ports:
      - '4100:3000'
    environment:
      NODE_ENV: production
      PORT: '3000'
      DATABASE_URL: mysql://picshare:picshare_pw@picshare-mysql:3306/picshare?connection_limit=10&pool_timeout=20&connect_timeout=10
      JWT_SECRET: devpilot-picshare-jwt-secret-change-me
      JWT_ACCESS_EXPIRES_IN: 2h
      JWT_REFRESH_EXPIRES_IN: 7d
      CORS_ORIGIN: '*'
      LOG_LEVEL: warn
      STORAGE_TYPE: cos
      COS_SECRET_ID: ${COS_SECRET_ID:-}
      COS_SECRET_KEY: ${COS_SECRET_KEY:-}
      COS_BUCKET: ${COS_BUCKET:-picshare-dev-1252097503}
      COS_REGION: ${COS_REGION:-ap-guangzhou}
      COS_DOMAIN: ${COS_DOMAIN:-}
      COS_PREFIX: ${COS_PREFIX:-uploads}
      REDIS_HOST: picshare-redis
      REDIS_PORT: '6379'
      REDIS_PASSWORD: ''
      REDIS_DB: '2'
      SMS_PROVIDER: mock
      WECHAT_MINI_APP_ID: ''
      WECHAT_MINI_APP_SECRET: ''
      WECHAT_MINI_ALLOW_MOCK: 'true'
    networks:
      - devpilot-staging
    healthcheck:
      test: ['CMD', 'wget', '-q', '--spider', 'http://localhost:3000/api']
      interval: 15s
      timeout: 10s
      retries: 10
      start_period: 90s   # prisma migrate deploy + nest boot

  admin:
    build:
      context: .
      dockerfile: apps/admin/Dockerfile
      args:
        NEXT_PUBLIC_API_URL: http://localhost:4100/api
    image: picshare-admin:devpilot
    container_name: picshare-admin
    restart: unless-stopped
    depends_on:
      backend:
        condition: service_healthy
    ports:
      - '4101:3001'
    environment:
      NODE_ENV: production
    networks:
      - devpilot-staging
    healthcheck:
      test: ['CMD', 'wget', '-q', '--spider', 'http://localhost:3001']
      interval: 15s
      timeout: 10s
      retries: 10
      start_period: 45s

volumes:
  picshare_mysql_data:
  picshare_redis_data:

networks:
  devpilot-staging:
    name: devpilot-g003-staging_default
    external: true
```

> This is the only NEW file this slice creates. The investigation doc allows it
> (it is a deployment artifact, not source code). If the operator prefers zero
> new files, the same content can be passed inline via
> `docker compose -f docker-compose.yml -f -` with a heredoc, but the file form
> is far easier to re-run.

### 1.2 Build + start

```sh
cd /Users/zhaoxingbo/Workspace/ai-driven/picshare
docker compose -f docker-compose.devpilot.yml up -d --build
```

Save full output:
```sh
mkdir -p /tmp/codex-tool-runs/svton/picshare-deploy
docker compose -f docker-compose.devpilot.yml up -d --build \
  > /tmp/codex-tool-runs/svton/picshare-deploy/compose-up.log 2>&1
```

### 1.3 Wait for health

```sh
for i in $(seq 1 60); do
  s=$(docker inspect picshare-backend --format '{{.State.Health.Status}}' 2>/dev/null)
  a=$(docker inspect picshare-admin   --format '{{.State.Health.Status}}' 2>/dev/null)
  echo "$i: backend=$s admin=$a"
  [ "$s" = healthy ] && [ "$a" = healthy ] && break
  sleep 5
done
```

### 1.4 Verify picshare reachability

```sh
# Backend API (host-published)
curl -s -o /tmp/codex-tool-runs/svton/picshare-deploy/backend-health.json \
  -w 'backend HTTP %{http_code}\n' http://127.0.0.1:4100/api
# expect: HTTP 200 (or 401/404 if /api is gated — both mean it's alive)

# Admin UI (host-published)
curl -s -o /tmp/codex-tool-runs/svton/picshare-deploy/admin-health.html \
  -w 'admin HTTP %{http_code}\n' http://127.0.0.1:4101/
# expect: HTTP 200

# From inside the devpilot API container (proves staging-network DNS works)
docker exec devpilot-app-api wget -qO- -S http://picshare-backend:3000/api 2>&1 | head -5
# expect: an HTTP response line (200/401/404 — anything non-timeout)

# Confirm prisma migrations ran
docker exec picshare-mysql mysql -upicshare -ppicshare_pw picshare \
  -e 'SHOW TABLES;' 2>&1 | grep -v Warning | head -20
# expect: User, Workspace, Content, ... (from schema.prisma)
```

---

## 2. Onboard picshare into devpilot (exact API calls)

### 2.1 Login and capture token + team id

```sh
TOKEN=$(curl -s -X POST http://127.0.0.1:3121/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@devpilot.local","password":"DemoPass123!"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["accessToken"])')
TEAM_ID=cmrusn8mw0009fp5bnu9kuiin   # Test Org
echo "token length: ${#TOKEN}"
```

> All subsequent calls use `-H "Authorization: Bearer $TOKEN" -H "X-Team-Id: $TEAM_ID"`.
> The team id is from `docs/devpilot/local-test-data.md:22`.

### 2.2 Create the Project

```sh
curl -s -X POST http://127.0.0.1:3121/api/projects \
  -H "Authorization: Bearer $TOKEN" -H "X-Team-Id: $TEAM_ID" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Picshare",
    "description": "Picshare photo-sharing monorepo (NestJS backend + Next.js admin + Taro mobile).",
    "gitRepo": "https://github.com/svton/picshare",
    "config": {
      "framework": "nestjs",
      "nodeVersion": "20",
      "origin": "imported",
      "managementScope": "full",
      "deployment": {
        "targetType": "server",
        "workingDirectory": "/Users/zhaoxingbo/Workspace/ai-driven/picshare",
        "buildCommand": "docker compose -f docker-compose.devpilot.yml build backend admin",
        "deployCommand": "docker compose -f docker-compose.devpilot.yml up -d backend admin",
        "rollbackCommand": "docker compose -f docker-compose.devpilot.yml restart backend admin",
        "healthCheckUrl": "http://picshare-backend:3000/api"
      }
    }
  }' | tee /tmp/codex-tool-runs/svton/picshare-deploy/01-project.json
```

Capture:
```sh
PROJECT_ID=$(python3 -c 'import json;print(json.load(open("/tmp/codex-tool-runs/svton/picshare-deploy/01-project.json"))["data"]["id"])')
```

> Project creation auto-seeds `dev/test/staging/prod` environments
> (`local-test-data.md:36-41`). Fetch the `dev` env id next:
```sh
curl -s "http://127.0.0.1:3121/api/project-environments?projectId=$PROJECT_ID" \
  -H "Authorization: Bearer $TOKEN" -H "X-Team-Id: $TEAM_ID" \
  | tee /tmp/codex-tool-runs/svton/picshare-deploy/02-envs.json
DEV_ENV_ID=$(python3 -c '
import json
envs = json.load(open("/tmp/codex-tool-runs/svton/picshare-deploy/02-envs.json"))["data"]
print([e["id"] for e in envs if e["key"]=="dev"][0])
')
```

### 2.3 Create a Server record (FK target for ApplicationService)

```sh
curl -s -X POST http://127.0.0.1:3121/api/servers \
  -H "Authorization: Bearer $TOKEN" -H "X-Team-Id: $TEAM_ID" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Picshare Docker Host",
    "host": "picshare-backend",
    "port": 3000,
    "authType": "password",
    "username": "picshare",
    "password": "picshare",
    "tags": ["picshare", "local-test", "deploy-target"]
  }' | tee /tmp/codex-tool-runs/svton/picshare-deploy/03-server.json
SERVER_ID=$(python3 -c 'import json;print(json.load(open("/tmp/codex-tool-runs/svton/picshare-deploy/03-server.json"))["data"]["id"])')
```

> `host` is the in-network DNS name (NOT `127.0.0.1`), per the gotcha at
> `local-test-data.md:234-238`. The credentials are fictional — server-executor
> is disabled, so nothing ever SSHes here; the record exists only to satisfy the
> ApplicationService FK and to make `POST /api/servers/:id/test` report `online`
> via the TCP-ping path.

Verify connectivity from devpilot:
```sh
curl -s -X POST "http://127.0.0.1:3121/api/servers/$SERVER_ID/test" \
  -H "Authorization: Bearer $TOKEN" -H "X-Team-Id: $TEAM_ID" \
  | tee /tmp/codex-tool-runs/svton/picshare-deploy/03b-server-test.json
# expect: success=true, status=online (picshare-backend:3000 is reachable on staging net)
```

### 2.4 Create the Application

```sh
curl -s -X POST http://127.0.0.1:3121/api/applications \
  -H "Authorization: Bearer $TOKEN" -H "X-Team-Id: $TEAM_ID" \
  -H 'Content-Type: application/json' \
  -d "{
    \"projectId\": \"$PROJECT_ID\",
    \"name\": \"Picshare Application\",
    \"description\": \"picshare backend + admin services\",
    \"repositoryUrl\": \"https://github.com/svton/picshare\",
    \"defaultBranch\": \"main\"
  }" | tee /tmp/codex-tool-runs/svton/picshare-deploy/04-application.json
APP_ID=$(python3 -c 'import json;print(json.load(open("/tmp/codex-tool-runs/svton/picshare-deploy/04-application.json"))["data"]["id"])')
```

### 2.5 Create ApplicationService: backend

```sh
curl -s -X POST "http://127.0.0.1:3121/api/applications/$APP_ID/services" \
  -H "Authorization: Bearer $TOKEN" -H "X-Team-Id: $TEAM_ID" \
  -H 'Content-Type: application/json' \
  -d "{
    \"environmentId\": \"$DEV_ENV_ID\",
    \"name\": \"backend\",
    \"kind\": \"container\",
    \"runtime\": \"node:20-alpine\",
    \"image\": \"picshare-backend:devpilot\",
    \"serverId\": \"$SERVER_ID\",
    \"ports\": [3000],
    \"env\": {
      \"NODE_ENV\": \"production\",
      \"PORT\": \"3000\",
      \"DATABASE_URL\": \"mysql://picshare:picshare_pw@picshare-mysql:3306/picshare\",
      \"REDIS_HOST\": \"picshare-redis\",
      \"REDIS_PORT\": \"6379\",
      \"JWT_SECRET\": \"devpilot-picshare-jwt-secret-change-me\"
    },
    \"deployConfig\": {
      \"targetType\": \"server\",
      \"workingDirectory\": \"/Users/zhaoxingbo/Workspace/ai-driven/picshare\",
      \"buildCommand\": \"docker compose -f docker-compose.devpilot.yml build backend\",
      \"deployCommand\": \"docker compose -f docker-compose.devpilot.yml up -d backend\",
      \"rollbackCommand\": \"docker compose -f docker-compose.devpilot.yml restart backend\",
      \"healthCheckUrl\": \"http://picshare-backend:3000/api\"
    }
  }" | tee /tmp/codex-tool-runs/svton/picshare-deploy/05-service-backend.json
BACKEND_SVC_ID=$(python3 -c 'import json;print(json.load(open("/tmp/codex-tool-runs/svton/picshare-deploy/05-service-backend.json"))["data"]["id"])')
```

### 2.6 Create ApplicationService: admin

```sh
curl -s -X POST "http://127.0.0.1:3121/api/applications/$APP_ID/services" \
  -H "Authorization: Bearer $TOKEN" -H "X-Team-Id: $TEAM_ID" \
  -H 'Content-Type: application/json' \
  -d "{
    \"environmentId\": \"$DEV_ENV_ID\",
    \"name\": \"admin\",
    \"kind\": \"container\",
    \"runtime\": \"node:20-alpine\",
    \"image\": \"picshare-admin:devpilot\",
    \"serverId\": \"$SERVER_ID\",
    \"ports\": [3001],
    \"env\": {
      \"NODE_ENV\": \"production\",
      \"PORT\": \"3001\"
    },
    \"deployConfig\": {
      \"targetType\": \"server\",
      \"workingDirectory\": \"/Users/zhaoxingbo/Workspace/ai-driven/picshare\",
      \"buildCommand\": \"docker compose -f docker-compose.devpilot.yml build admin\",
      \"deployCommand\": \"docker compose -f docker-compose.devpilot.yml up -d admin\",
      \"rollbackCommand\": \"docker compose -f docker-compose.devpilot.yml restart admin\",
      \"healthCheckUrl\": \"http://picshare-admin:3001\"
    }
  }" | tee /tmp/codex-tool-runs/svton/picshare-deploy/06-service-admin.json
ADMIN_SVC_ID=$(python3 -c 'import json;print(json.load(open("/tmp/codex-tool-runs/svton/picshare-deploy/06-service-admin.json"))["data"]["id"])')
```

### 2.7 Create a DeploymentRun (dry-run — reflects the running state)

```sh
curl -s -X POST "http://127.0.0.1:3121/api/deployments/projects/$PROJECT_ID/runs" \
  -H "Authorization: Bearer $TOKEN" -H "X-Team-Id: $TEAM_ID" \
  -H 'Content-Type: application/json' \
  -d "{
    \"environmentId\": \"$DEV_ENV_ID\",
    \"applicationId\": \"$APP_ID\",
    \"applicationServiceId\": \"$BACKEND_SVC_ID\",
    \"dryRun\": true,
    \"source\": \"manual\",
    \"trigger\": \"onboarding\"
  }" | tee /tmp/codex-tool-runs/svton/picshare-deploy/07-deployment-run.json
```

Expected response fields (per `script-plan.adapter.ts:85-115`):
- `status: "completed"`
- `mode: "dry_run"`
- `executorKey: "server-executor"`
- `adapterKey: "script-plan"`
- `result.executable: true` (because `deployCommand` + `healthCheckUrl` are set)
- `commandPlan` JSON containing the 4 steps: `checkout`, `build`, `deploy`,
  `health_check`, with the real `docker compose ...` and
  `curl -fsS http://picshare-backend:3000/api` commands.

> If `status: "blocked"` comes back, it means `collectWarnings()` found a missing
> field — most likely `deployCommand` or `healthCheckUrl`. Re-PUT the service with
> the missing field (`deployment-command-builders.utils.ts:56-64`).

Repeat for admin:
```sh
curl -s -X POST "http://127.0.0.1:3121/api/deployments/projects/$PROJECT_ID/runs" \
  -H "Authorization: Bearer $TOKEN" -H "X-Team-Id: $TEAM_ID" \
  -H 'Content-Type: application/json' \
  -d "{
    \"environmentId\": \"$DEV_ENV_ID\",
    \"applicationId\": \"$APP_ID\",
    \"applicationServiceId\": \"$ADMIN_SVC_ID\",
    \"dryRun\": true,
    \"source\": \"manual\",
    \"trigger\": \"onboarding\"
  }" | tee /tmp/codex-tool-runs/svton/picshare-deploy/08-deployment-run-admin.json
```

### 2.8 (Optional) Create a Site for the admin UI

```sh
curl -s -X POST http://127.0.0.1:3121/api/sites \
  -H "Authorization: Bearer $TOKEN" -H "X-Team-Id: $TEAM_ID" \
  -H 'Content-Type: application/json' \
  -d "{
    \"projectId\": \"$PROJECT_ID\",
    \"environmentId\": \"$DEV_ENV_ID\",
    \"name\": \"Picshare Admin Site\",
    \"domain\": \"picshare.lt-test.local\",
    \"runtime\": \"reverse_proxy\",
    \"runtimeConfig\": { \"upstream\": \"http://picshare-admin:3001\" },
    \"serverId\": \"$SERVER_ID\"
  }" | tee /tmp/codex-tool-runs/svton/picshare-deploy/09-site.json
# expect: status 201; site created in 'draft' (live nginx sync is gated on
# SERVER_EXECUTOR_LIVE_ENABLED — see investigation D.2).
```

---

## 3. Verification (acceptance criteria)

Each criterion must pass; capture evidence under
`/tmp/codex-tool-runs/svton/picshare-deploy/`.

| # | Criterion | Command | Expected |
|---|-----------|---------|----------|
| V1 | picshare-backend container is healthy | `docker inspect picshare-backend --format '{{.State.Health.Status}}'` | `healthy` |
| V2 | picshare-admin container is healthy | `docker inspect picshare-admin --format '{{.State.Health.Status}}'` | `healthy` |
| V3 | picshare-mysql has picshare tables (prisma migrated) | `docker exec picshare-mysql mysql -upicshare -ppicshare_pw picshare -e 'SHOW TABLES;'` | ≥10 tables incl. `User` |
| V4 | Backend reachable from host | `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:4100/api` | 200/401/404 |
| V5 | Admin reachable from host | `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:4101/` | 200 |
| V6 | Backend reachable from devpilot API container | `docker exec devpilot-app-api wget -qO- -S http://picshare-backend:3000/api 2>&1 \| head -1` | HTTP response line |
| V7 | devpilot Project exists | `curl -s "http://127.0.0.1:3121/api/projects/$PROJECT_ID" -H "Authorization: Bearer $TOKEN" -H "X-Team-Id: $TEAM_ID"` | `name: "Picshare"` |
| V8 | devpilot Application has 2 services | `curl -s "http://127.0.0.1:3121/api/applications/$APP_ID" -H "Authorization: Bearer $TOKEN" -H "X-Team-Id: $TEAM_ID"` | `services: [backend, admin]` |
| V9 | devpilot Server tests online | `curl -s -X POST "http://127.0.0.1:3121/api/servers/$SERVER_ID/test" -H "Authorization: Bearer $TOKEN" -H "X-Team-Id: $TEAM_ID"` | `success: true, status: online` |
| V10 | DeploymentRun completed (dry-run) | `curl -s "http://127.0.0.1:3121/api/deployments/runs?projectId=$PROJECT_ID" -H "Authorization: Bearer $TOKEN" -H "X-Team-Id: $TEAM_ID"` | run with `status: completed`, `mode: dry_run`, `adapterKey: script-plan` |
| V11 | DeploymentRun commandPlan contains healthcheck cmd | parse V10 response JSON `commandPlan.steps[]` | one step with `command: "curl -fsS http://picshare-backend:3000/api"` |
| V12 | DB has expected new records | `docker exec devpilot-g003-api-mysql mysql -uroot -ppassword devpilot_g003_staging -e "SELECT name FROM Project WHERE name='Picshare'; SELECT name FROM ApplicationService WHERE name IN ('backend','admin');"` | 1 + 2 rows |

All 12 must pass for the slice to be considered done.

---

## 4. Rollback plan

In order (reverse of installation):

```sh
# 4.1 Delete devpilot records (API, in reverse FK order)
curl -s -X DELETE "http://127.0.0.1:3121/api/sites/<siteId>" -H "Authorization: Bearer $TOKEN" -H "X-Team-Id: $TEAM_ID"   # if created
# DeploymentRuns cascade-delete with the project; no explicit DELETE endpoint.
curl -s -X DELETE "http://127.0.0.1:3121/api/applications/$APP_ID/services/$BACKEND_SVC_ID" -H "Authorization: Bearer $TOKEN" -H "X-Team-Id: $TEAM_ID"
curl -s -X DELETE "http://127.0.0.1:3121/api/applications/$APP_ID/services/$ADMIN_SVC_ID"   -H "Authorization: Bearer $TOKEN" -H "X-Team-Id: $TEAM_ID"
curl -s -X DELETE "http://127.0.0.1:3121/api/applications/$APP_ID" -H "Authorization: Bearer $TOKEN" -H "X-Team-Id: $TEAM_ID"
curl -s -X DELETE "http://127.0.0.1:3121/api/servers/$SERVER_ID"   -H "Authorization: Bearer $TOKEN" -H "X-Team-Id: $TEAM_ID"
curl -s -X DELETE "http://127.0.0.1:3121/api/projects/$PROJECT_ID" -H "Authorization: Bearer $TOKEN" -H "X-Team-Id: $TEAM_ID"

# 4.2 Stop & remove picshare containers + volumes
cd /Users/zhaoxingbo/Workspace/ai-driven/picshare
docker compose -f docker-compose.devpilot.yml down -v

# 4.3 Remove generated images (optional)
docker rmi picshare-backend:devpilot picshare-admin:devpilot 2>/dev/null || true

# 4.4 Remove the compose file (optional)
rm /Users/zhaoxingbo/Workspace/ai-driven/picshare/docker-compose.devpilot.yml
```

> DeploymentRun deletion: there is no public DELETE endpoint for runs in
> `deployment.controller.ts`. They cascade-delete with the Project (verified by
> Prisma schema convention `DeploymentRun.projectId` FK with onDelete cascade).
> If a stale run remains after project delete, drop it directly:
> `docker exec devpilot-g003-api-mysql mysql -uroot -ppassword devpilot_g003_staging -e "DELETE FROM DeploymentRun WHERE projectId='<id>';"`

---

## 5. Out of scope (follow-up slices)

- Enabling `SERVER_EXECUTOR_LIVE_ENABLED=true` on the API container and wiring a
  real SSH/docker host target so devpilot literally runs `docker compose up`.
  (See investigation G.1 for the full cost.)
- Live `Site` nginx sync for `picshare.lt-test.local` (also gated on the live
  executor — `docs-internal/devpilot/project-onboarding-control-plane-roadmap.md:258`).
- picshare mobile (`apps/mobile`, Taro) — not part of "deploy backend + admin".
- Real WeChat mini-program / Tencent SMS / COS provider wiring (mock defaults
  suffice for smoke).
- Production HTTPS termination via `picshare/nginx/picshare.conf` (local HTTP
  ports 4100/4101 are enough for staging).
- Shared-infra variant (picshare DB on `devpilot-g003-mysql` instead of dedicated
  `picshare-mysql`) — investigation C.1 documents how to switch if desired.

---

## 6. Honest scope statement (for the user)

> Devpilot's deployment executor is **virtual** in the current staging container
> (`SERVER_EXECUTOR_LIVE_ENABLED` unset; `script-plan` adapter returns `blocked`
> for every non-dryRun — see investigation §A.3). Therefore devpilot does not
> literally `git clone` + `docker compose up` picshare. What this slice delivers:
>
> 1. picshare is **actually running** and reachable (started by picshare's own
>    docker-compose on the shared staging network; backend @ `:4100`, admin @
>    `:4101`, with its own MySQL + Redis).
> 2. picshare is **onboarded into devpilot** as a first-class Project with
>    Application, two ApplicationServices, a Server, and a real (dry-run)
>    DeploymentRun whose `commandPlan` records the exact build/deploy/healthcheck
>    commands and whose `healthCheckUrl` resolves to the live container.
>
> To make devpilot *actually* start/stop picshare, a follow-up slice must enable
> the live executor + provision an SSH/docker-host target (see §5).
