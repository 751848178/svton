# Local Test Data (staging) — clean rebuild

Rebuilt: 2026-07-23
Stack: devpilot-app API at http://127.0.0.1:3121 (admin token, team `Test Org`).
API DB on `devpilot-g003-api-mysql:3320`. Resource-pool MySQL on
`devpilot-g003-mysql:3321` (db `devpilot_resource_pool`, root/password). Resource-pool
Redis on `devpilot-g003-redis:6385`. Deploy target is the `devpilot-deploy-target`
container (SSH on `deploy-target:2222`, host port `127.0.0.1:2224`).

This is a **full end-to-end rebuild from a verified clean state** (0 projects, 0
servers, 0 applications, 0 ResourceRequests/Instances/Pools) that proves the complete
flow: resource request -> real pool provisioning -> credential injection -> live SSH
deployment -> picshare runs against the platform DB, reachable via a devpilot-managed
nginx vhost.

Raw request/response captures for every call below are in
`/tmp/codex-tool-runs/svton/rebuild/` (filename prefixes match the step numbers).

## Accounts / Team

| Email | Password | Role | userId |
|---|---|---|---|
| admin@devpilot.local | DemoPass123! | system admin, owner of Test Org | `cmru179jj000910pxdv55xym0` |

| Name | id |
|---|---|
| Test Org | `cmrusn8mw0009fp5bnu9kuiin` |

All create/ mutate calls below use `Authorization: Bearer <admin jwt>` +
`X-Team-Id: cmrusn8mw0009fp5bnu9kuiin`. Admin-gated routes (resource-pools,
resource-types) do not need the team header.

## Step 1 — Resource Pools (MySQL + Redis)

Both pools back onto the staging containers. `adminConfig` is an **object** (per
`resource-pool.dto.ts`), not a string.

| Pool | id | endpoint | capacity | allocated |
|---|---|---|---|---|
| Staging MySQL Pool | `cmrwxht3k000f6enjd9en7aft` | `mysql://devpilot-g003-mysql:3306/devpilot_resource_pool` | 20 | 1 |
| Staging Redis Pool | `cmrwxhzey000g6enju3klnfu1` | `redis://devpilot-g003-redis:6379` | 20 | 1 |

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  http://127.0.0.1:3121/api/resource-pools \
  -d '{"type":"mysql","name":"Staging MySQL Pool","endpoint":"mysql://devpilot-g003-mysql:3306/devpilot_resource_pool","adminConfig":{"username":"root","password":"password"},"capacity":20}'
```

Default ResourceTypes still exist (`mysql`, `redis`, …) but ship with
`provisioningMode: "manual"`. Pool provisioning only fires when
`resourceType.provisioningConfig.poolId` is set, so the types were switched to
`provisioningMode: "pool"` (PUT `/api/resource-types/:id`) before requesting
resources:

| ResourceType | id | provisioningMode | provisioningConfig |
|---|---|---|---|
| MySQL 数据库 | `cmru179h5000010pxeo009ddf` | pool | `{ poolId: "cmrwxht3k000f6enjd9en7aft" }` |
| Redis 缓存 | `cmru179hq000210pxwqcsqigt` | pool | `{ poolId: "cmrwxhzey000g6enju3klnfu1" }` |

## Step 2 — Server (deploy-target)

The deploy-target container's SSH user is **`deploy`** (NOT `devpilot` — the brief
was wrong; verified against `docker-compose.deploy-target.yml` `USER_NAME: deploy`
and `/etc/passwd`). Key auth only.

| Server | id | host:port | username | authType | status |
|---|---|---|---|---|---|
| Deploy Target | `cmrwxk1ip000i6enjv5dbp3mf` | deploy-target:2222 | deploy | key | online |

Private key lives at `/tmp/codex-tool-runs/svton/dataplane/deploy-target-key`
(public key injected into the container's `/config/.ssh/authorized_keys` via the
compose `PUBLIC_KEY_FILE` mount). The PEM is passed verbatim as the `credentials`
field of `POST /api/servers`.

`POST /api/servers/:id/test` -> `{ success: true, status: "online", latency: 3 }`.

## Step 3 — Project / Application / Services

| Entity | id |
|---|---|
| Project "Picshare" | `cmrwxl1ks000k6enjiclutd5a` |
| Application "Picshare App" | `cmrwxlfdx000u6enjsmokffno` |
| Environment "dev" | `cmrwxl1kw000m6enjykspj1lz` |
| ApplicationService "backend" | `cmrwxm1tl000y6enjwoz2k2jq` |
| ApplicationService "admin" | `cmrwxma8100126enjsltztinh` |

Project auto-creates four environments (dev/test/staging/prod) on creation via
`ProjectEnvironmentService.ensureDefaultsForProject` — the `dev` env id above is
read from `GET /api/project-environments?projectId=...`. The Application was given
`defaultBranch: "main"` (PUT `/api/applications/:id`) so the deployment plan emits
no "未配置默认分支" warning (a warning makes the live plan non-executable).

Both services use `deployConfig.targetType: "server"`, `workingDirectory:
"/Users/zhaoxingbo/Workspace/ai-driven/picshare"` (this host path is bind-mounted
into the deploy-target container), and docker-compose `-f
docker-compose.devpilot.yml` build/deploy commands. healthCheckUrl points at the
in-container service names (`http://picshare-backend:3000/api`,
`http://picshare-admin:3001`).

## Step 4 — MySQL resource request -> real provisioning

Request created with `spec.resourceName: "db_picshare"` (must match
`^(db|redis|res)_[a-z0-9]+$`, enforced by `assertSafeResourceName`).

| ResourceRequest | id | status |
|---|---|---|
| Picshare MySQL DB | `cmrwxnaim00146enjy6tpkif7` | completed |
| ResourceInstance | `cmrwxnk5s001d6enjn4lsjb5d` | active |
| Pool allocation | `cmrwxnk5p001b6enjian79fp4` | — |

`approvalMode: "manual"` -> request starts `pending`; `POST
/resource-requests/:id/review {status:"approved"}` triggers
`runApprovedProvisioningProcessor` -> `provisionFromPool`, which calls the mysql
provisioning util (`CREATE DATABASE / CREATE USER / GRANT`).

Delivery (non-secret):

```json
{ "host": "devpilot-g003-mysql", "port": 3306, "database": "db_picshare",
  "username": "user_db_picshare", "resourceName": "db_picshare",
  "poolAllocationId": "cmrwxnk5p001b6enjian79fp4" }
```

The password is generated server-side and stored only encrypted in
`ResourceInstance.credentials`; it is delivered to the deployment through the
credential-injection path, never through the API response.

Verification on the real MySQL:

```bash
$ docker exec devpilot-g003-mysql mysql -uroot -ppassword -e "SHOW DATABASES LIKE 'db_picshare'"
Database: db_picshare
$ docker exec devpilot-g003-mysql mysql -uroot -ppassword -e \
    "SELECT User,Host FROM mysql.user WHERE User='user_db_picshare'"
User: user_db_picshare  Host: %
```

## Step 5 — Redis resource request -> real provisioning

| ResourceRequest | id | status |
|---|---|---|
| Picshare Redis | `cmrwxoq68001h6enj1wjjq5b0` | completed |
| ResourceInstance | `cmrwxoqa4001q6enjqn72b5yd` | active |
| Pool allocation | `cmrwxoqa2001o6enjdg192gzs` | — |

Delivery: `{ host: "devpilot-g003-redis", port: 6379, db: 11, keyPrefix:
"res_picshare:", resourceName: "res_picshare" }`. The Redis provisioning allocates
a real DB index (1..15) from the pool; here DB **11**. Both pools now show
`allocated: 1 / 20`.

## Step 6 — Backend live deployment with credential injection

### Command-policy template (required)

The built-in deployment command rules (`server-command-policy-deployment-rules.constants.ts`)
allow `docker compose build` / `docker compose up -d` but **not** the `-f <file>`
form (`docker compose -f docker-compose.devpilot.yml build backend`), so the dry-run
policy blocks with "命令未匹配 Server executor 白名单". A team command-policy
template was created to allow the `-f` form, scoped to the Picshare project:

| Template | id | scope | allowed pattern |
|---|---|---|---|
| Picshare docker-compose -f allow | `cmrwxvbw500206enjkptt6eyv` | project `cmrwxl1ks000k6enjiclutd5a`, adapter `deployment-script-plan`, ops `deployment.run`/`deployment.rollback` | `regex:^docker compose -f [a-zA-Z0-9_./:@=+-]+ (?:build\|up -d(?: --build)?\|restart)(?: [a-zA-Z0-9_./:@=+-]+)*$` |

After this template, the dry-run policy is `passed` with no warnings and the
generated command plan contains a `write_env` step:

```
cat > .env <<'DEVPLOT_ENV_EOF'
REDIS_HOST=***REDACTED***
REDIS_PORT=***REDACTED***
REDIS_PASSWORD=***REDACTED***
REDIS_DB=***REDACTED***
DATABASE_URL=***REDACTED***
DEVPLOT_ENV_EOF
```

The redaction is plan-time only; real values are injected at execution time via the
step's `secretEnv` (never persisted).

### Live deploy flow (SshLiveServerExecutorAdapter)

`SERVER_EXECUTOR_LIVE_ENABLED=true` on the API container. The live adapter
(`supports` -> transport ssh + `dryRun===false`) is selected. Three gates must
clear, in this order, by re-POSTing `POST /deployments/projects/:projectId/runs`
with progressively more fields:

1. **Operation approval** — non-dryRun deploys auto-create a pending
   `OperationApproval`; `POST /operation-approvals/:id/review {decision:"approved"}`
   (the review DTO accepts **only** `decision`, no `comment`).
2. **Confirmation text** — `requiredConfirmationText = project.name` ("Picshare"),
   satisfied by passing `confirmationText: "Picshare"` in the deploy body.
3. **Executable plan** — `warnings.length === 0 && steps.every(required -> command)`,
   satisfied by setting the Application `defaultBranch: "main"` (and passing
   `branch: "main"` in the body).

The approved `approvalId` must be passed back in the deploy body so
`resolveApproved` consumes it.

| Run | id | status | result.mode | exitCode |
|---|---|---|---|---|
| backend live deploy | `cmrwy5o5a002x6enj5p4yywcv` | failed | executed | 7 |
| OperationApproval | `cmrwxwcbc00296enjqfsn7lun` | approved | — | — |

The run is marked `failed` **only** because the synchronous live executor runs the
embedded `health_check` (`curl -fsS http://picshare-backend:3000/api`) immediately
after `docker compose up -d` returns, before the container's 90s `start_period`
elapses — so curl exits 7 (connection refused). The deployment itself fully
succeeded; the container becomes healthy seconds later. This is a known timing
limitation of the synchronous live executor, not a deployment failure.

### Verification — the load-bearing proof

`.env` written on deploy-target (real plaintext, secrets present at execution):

```bash
$ docker exec devpilot-deploy-target cat /Users/zhaoxingbo/Workspace/ai-driven/picshare/.env
REDIS_HOST=devpilot-g003-redis
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=11
DATABASE_URL=mysql://user_db_picshare:65a75047aeb000b0f79bc59af9c7fdf1@devpilot-g003-mysql:3306/db_picshare
```

picshare-backend resolves the **platform** DATABASE_URL at runtime (not its own
container's DB):

```bash
$ docker exec picshare-backend sh -lc 'echo $DATABASE_URL'
mysql://user_db_picshare:65a75047aeb000b0f79bc59af9c7fdf1@devpilot-g003-mysql:3306/db_picshare
```

Prisma migrations ran against the platform DB (20 picshare tables created):

```bash
$ docker exec devpilot-g003-mysql mysql -uroot -ppassword db_picshare -e "SHOW TABLES"
_prisma_migrations, access_grants, albums, analytics_field_configs, audit_logs,
comments, configs, contents, dictionaries, download_limits, invites,
photo_analytics, photo_categories, photos, project_members, projects,
share_links, subscription_plans, user_identities, …
```

picshare-backend logs show `Database connected successfully` + `Redis connected`,
and the health endpoint returns 200:

```bash
$ curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4100/api
200
```

## Step 7 — Admin service deployment

Same flow as Step 6 (approval -> review -> re-deploy with confirmationText +
approvalId).

| Run | id | status | result.mode | exitCode |
|---|---|---|---|---|
| admin live deploy | `cmrwy7ts5003e6enjpibs6ac4` | failed | executed | 7 |
| OperationApproval | `cmrwy7ipo00366enjyp4v4mpa` | approved | — | — |

Same exitCode-7 health-check timing behaviour; the admin container is Up (healthy)
and serving HTTP 200 on host port 4101.

## Step 8 — Site + domain (devpilot-managed nginx)

| Site | id | primaryDomain | runtimeType | upstream | serverId |
|---|---|---|---|---|---|
| Picshare Site | `cmrwydxma003m6enjjb0cr3yj` | picshare.localtest.me | reverse_proxy | `http://picshare-admin:3001` | `cmrwxk1ip000i6enjv5dbp3mf` |
| SiteSyncRun | (latest) | status: completed | exitCode: 0 | — | — |
| OperationApproval | `cmrwyesmk003v6enjh4oz6li0` | approved | — | — | — |

Site sync (`POST /sites/:id/sync-plan`) writes an nginx vhost and reloads nginx on
the deploy-target via the live SSH executor. It needs the same approval + confirmation
flow; `requiredConfirmationText = site.name` ("Picshare Site"). Dry-run first
(passed, no warnings), then real.

The generated vhost on the deploy-target:

```nginx
# /etc/nginx/conf.d/picshare.localtest.me.conf
server {
    listen 80;
    listen [::]:80;
    server_name picshare.localtest.me;
    location / {
        proxy_pass http://picshare-admin:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Verification (localtest.me resolves to 127.0.0.1; deploy-target publishes
127.0.0.1:80):

```bash
$ curl -s -o /dev/null -w "%{http_code}\n" http://picshare.localtest.me/
200
```

## Summary — does it work?

| Claim | Result | Evidence |
|---|---|---|
| picshare-backend connects to the **platform** `db_picshare` (not its own container) | PASS | `$DATABASE_URL` inside `picshare-backend` -> `mysql://user_db_picshare:…@devpilot-g003-mysql:3306/db_picshare` |
| `.env` on deploy-target contains the real `DATABASE_URL` | PASS | `cat .env` shows the plaintext `DATABASE_URL` + Redis vars, written by the `write_env` step |
| Prisma migrations ran on the platform DB | PASS | 20 picshare tables in `db_picshare` on `devpilot-g003-mysql` |
| Resource request -> real provisioning (MySQL) | PASS | `SHOW DATABASES LIKE 'db_picshare'` returns the DB; `user_db_picshare@%` exists |
| Resource request -> real provisioning (Redis) | PASS | DB index 11 allocated from the pool |
| picshare.localtest.me reachable | PASS | `curl http://picshare.localtest.me/` -> 200 via devpilot-managed nginx -> picshare-admin:3001 |
| Live SSH executor runs the real deploy | PASS | `result.mode: executed`; containers Up (healthy) |

### Known limitation (not a blocker)

The synchronous live executor's embedded health_check runs immediately after
`docker compose up -d` returns, so it exits 7 for containers with a long
`start_period` (picshare-backend has 90s). The DeploymentRun is therefore marked
`failed` even though the deploy fully succeeded. The fix would be for the live
executor to poll the healthCheckUrl with retries/backoff (or to defer to the
container's compose healthcheck) before declaring failure. Documented honestly
here rather than papered over.
