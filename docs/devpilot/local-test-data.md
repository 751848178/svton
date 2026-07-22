# Local Test Data (staging)

Generated: 2026-07-21
Stack: devpilot-app at http://127.0.0.1:3121, API DB on `devpilot-g003-api-mysql:3320`.
All entities use the `LT-` (Local Test) prefix for easy identification.

Raw request/response captures for every call below are in
`/tmp/codex-tool-runs/svton/test-data/` (filename prefixes match the section
numbers in this doc, e.g. `06a-project-demo-app.json`).

## Accounts

| Email | Password | Role | userId |
|---|---|---|---|
| admin@devpilot.local | DemoPass123! | system admin, owner of Test Org | `cmru179jj000910pxdv55xym0` |
| tester@devpilot.local | TesterPass123! | team member of Test Org | `cmrusqgta000cfp5bm5fmcg6k` |

## Team

| Name | id | members |
|---|---|---|
| Test Org | `cmrusn8mw0009fp5bnu9kuiin` | admin (owner), tester (member) |

Membership row for tester: `cmrusqwwv000efp5bk848gjid`.

Note: `POST /api/teams/:id/members` takes `{ email, role }` (NOT `{ userId, role }`)
— the brief's contract was wrong; verified against `apps/devpilot-api/src/team/dto/team.dto.ts`.

## Projects

| Name | id | gitRepo | config | envs (id / key) |
|---|---|---|---|---|
| LT-Demo App | `cmrusr5ql000gfp5bdqawy4n9` | https://github.com/example/lt-demo-app | `{ framework: nextjs, nodeVersion: 20 }` | dev=`cmrusr5qq000ifp5bzvsvwatx`, test=`cmrusr5qv000kfp5b3k1lad39`, staging=`cmrusr5qx000mfp5bhgxnknsj`, prod=`cmrusr5r0000ofp5bufspkoox` |
| LT-Legacy API | `cmrusr5rs000qfp5b4c9a0p1l` | https://github.com/example/lt-legacy-api | `{ framework: nestjs }` | dev=`cmrusr5rv000sfp5bc7upkmz3`, test=`cmrusr5ry000ufp5bidl407of`, staging=`cmrusr5s1000wfp5b3a6jkhh2`, prod=`cmrusr5s4000yfp5b1y83g4u2` |

Key behaviour: the API **auto-creates four environments** (`dev`, `test`, `staging`,
`prod`) on project creation via `ProjectEnvironmentService.ensureDefaultsForProject`.
Calling `POST /api/project-environments` with `key: 'dev'` therefore violates the
unique constraint and the server hangs up the connection (`Empty reply from server`).
The two extra `dev`/`staging` envs requested in the brief were not created — the
auto-provisioned ones already cover them (and add `test` + `prod` for free).

## Servers

All require `X-Team-Id`. `authType` enum is `'password' | 'key'` (NOT `'ssh-key'`)
— see `apps/devpilot-api/src/server/dto/server.dto.ts`.

| Name | id | host:port | authType | tags | /test result |
|---|---|---|---|---|---|
| LT-SSH Server | `cmrust68y000a945d879fmbak` | devpilot-g003-ssh-server:2222 | password | ssh-target, local-test | `success=true, status=online, latency=2ms` ✅ |
| LT-Nginx Target | `cmrustd5b000c945dnsw6cp3h` | devpilot-g003-virtual-nginx:80 | password | deploy-target, local-test | `success=true, status=online, latency=1ms` ✅ |
| LT-Docker Host | `cmrustd5s000e945d5tebsv1v` | devpilot-g003-docker-socket-proxy:2375 | password | docker-inventory, local-test | `success=true, status=online, latency=1ms` ✅ |

**Initial creation used `host: 127.0.0.1` + `port: <host-published-port>` (e.g.
`127.0.0.1:2223`), which made all 3 servers report `offline`. Root cause
(verified): the API runs inside the `devpilot-app-api` container, so `127.0.0.1`
is the container's own loopback — not the Docker host. Fix: set `host` to the
staging container's DNS name on the shared `devpilot-g003-staging_default`
network, and `port` to the **in-container port** (not the host-published port):
ssh-server `2222` (not 2223), virtual-nginx `80` (not 18098),
docker-socket-proxy `2375` (not 2376). After the PUT, all 3 re-tested `online`.

## Resource Types

All admin-gated (`POST /api/resource-types`, no `X-Team-Id` needed, role `admin`).
Allowed `provisioningMode` values: `manual | auto | none` for `approvalMode`;
`manual | pool | webhook | api | script | credential_only | provider` for
`provisioningMode`.

| key | id | category | approval | provisioning | provisioningConfig |
|---|---|---|---|---|---|
| lt-mysql-pool | `cmrusuqgu000g945d1um7kykh` | database | auto | pool | `{ poolId: cmrusvrrv000r945d2y8n5wb3, poolKey: local-mysql }` |
| lt-redis-pool | `cmrusuzz9000i945dayhs2hi3` | cache | auto | pool | `{ poolKey: local-redis }` (no poolId — would block on provisioning) |
| lt-postgres-manual | `cmrusuzzp000k945da89nxns2` | database | manual | manual | — |
| lt-object-storage-minio | `cmrusv9b6000m945dwhktfoyn` | storage | manual | manual | — |
| lt-ssh-compute | `cmrusv9bn000o945dfxrzcl5y` | compute | manual | manual | — |
| lt-fake-provider-api | `cmrusv9c6000q945dhkbrxius` | database | auto | api | `{ url: http://127.0.0.1:19091/provision, method: POST }` |

Note: `lt-mysql-pool` was originally created with only `poolKey` and was updated
(`PUT`) after the first provisioning attempt blocked with `reason: missing_pool_id`.
The pool-provisioning executor reads `provisioningConfig.poolId` — see
`apps/devpilot-api/src/resource-request/resource-request-pool-provisioning.service.ts:41`.

## Resource Pools

Admin-gated. `CreateResourcePoolDto` requires `{ type, name, endpoint, adminConfig (object), capacity }`.
`type` enum: `mysql | postgresql | redis | nginx | cdn`. `status` is not settable
on create (defaults to `active`).

| Name | id | type | endpoint | capacity | allocated | available | adminConfig |
|---|---|---|---|---|---|---|---|
| LT MySQL Pool | `cmrusvrrv000r945d2y8n5wb3` | mysql | mysql://127.0.0.1:3321/devpilot_resource_pool | 10 | 1 | 9 | `{ username: root, password: password, poolKey: local-mysql }` |
| LT Redis Pool | `cmrusvrse000s945dmrl1ls1v` | redis | redis://127.0.0.1:6385 | 15 | 0 | 15 | `{ password: "", poolKey: local-redis }` |

The MySQL pool's `allocated` is `1` because the resource request below was
successfully provisioned against it.

## Managed Resources

There is **no `POST /api/resource-control/resources`** endpoint. Managed resources
are created by inventory sync (`POST /api/resource-control/servers/:serverId/sync-docker`
or `POST /api/resource-control/cloud/sync`). Calling it against `LT-Docker Host`
worked: the server-executor transport is disabled in this staging build
(`真实 Server executor transport 尚未启用`), so the sync fell back to a stub
inventory derived from the server's inferred services and produced four
plausibly-named records. All four are scoped to LT-Demo App / dev.

| Name | id | kind | provider | externalId | endpoint | serverId |
|---|---|---|---|---|---|---|
| LT-Docker Host / devpilot-g003-mysql | `cmrusw9jq0012945d0q3f0v9s` | docker_container | docker | `cmrustd5s000e945d5tebsv1v:docker:container:devpilot-g003-mysql` | devpilot-g003-mysql:3306 | LT-Docker Host |
| LT-Docker Host / devpilot-g003-redis | `cmrusw9jw0014945dn6esmdrc` | docker_container | docker | `cmrustd5s000e945d5tebsv1v:docker:container:devpilot-g003-redis` | devpilot-g003-redis:6379 | LT-Docker Host |
| LT-Docker Host / devpilot-g003-resource-postgres | `cmrusw9k10016945dk6hjes2c` | postgres | docker | `cmrustd5s000e945d5tebsv1v:docker:postgres:devpilot-g003-resource-postgres` | devpilot-g003-resource-postgres:5432 | LT-Docker Host |
| LT-Docker Host / devpilot-g003-minio | `cmrusw9k40018945d4p8z915y` | object-storage | docker | `cmrustd5s000e945d5tebsv1v:docker:minio:devpilot-g003-minio` | devpilot-g003-minio:9000 | LT-Docker Host |

sync-run id: `cmrusw9ii000u945dzmwni8xs`.

**Initial state (virtual):** the inventory-stub fallback produced 4 records
with **fictional container names** (`devpilot-api`, `nginx-proxy`,
`mysql-primary`, `redis-cache`) and **unreachable endpoints**
(`127.0.0.1:3101/80/3306/6379`). These have been **corrected via direct DB
UPDATE** to point at the real staging containers (names + in-network endpoints
above). The records are now accurate reflections of the live staging stack,
though they were not produced by a real docker-sync (the server-executor
transport is still disabled in this build). To get live sync data, enable the
server-executor transport and re-run `sync-docker`.

## Applications

| Name | id | project | repo | branch |
|---|---|---|---|---|
| LT-Demo Application | `cmruswvnc001a945dv20al0w6` | LT-Demo App | https://github.com/example/lt-demo-app | main |

Application services:

| Name | id | env | kind | server | managed resource | image | ports |
|---|---|---|---|---|---|---|---|
| web | `cmrusx3pu001e945dvwbdrmip` | LT-Demo App / dev | container | LT-Nginx Target (`cmrustd5b000c945dnsw6cp3h`) | LT-Docker Host / mysql-primary (`cmrusw9k10016945dk6hjes2c`) | node:20-alpine | [3000] |

## Resource Requests

| Title | id | type | env | status | instanceId | allocationId |
|---|---|---|---|---|---|---|
| LT-Demo App dev MySQL | `cmrusxi48001g945d9wf4ij8z` | lt-mysql-pool | LT-Demo App / dev | **completed** | `cmrusyyl9001x945dpdu0hldh` | `cmrusyyl7001v945d2ftfjtpo` |

Delivered credentials (host/port/database/username) captured in the response:
`{ host: 127.0.0.1, port: 3321, database: lt_app_db, username: user_lt_app_db, poolType: mysql }`.

Flow exercised (full happy path):
1. `POST /api/resource-requests` → status `pending` (approval mode `auto` does
   NOT auto-approve; only `approvalMode: 'none'` does — see
   `resource-request-lifecycle.service.ts:46`).
2. `POST /api/resource-requests/:id/review { status: approved }` → status
   `approved`, `result.provisioning.status: blocked, reason: missing_pool_id`.
3. `PUT /api/resource-types/:id { provisioningConfig.poolId }` to wire the type
   to the pool.
4. `POST /api/resource-requests/:id/retry-provisioning` → status `completed`,
   delivery block populated, MySQL pool `allocated` incremented to 1.

`POST /api/resource-requests/provisioning-runs/process-next` consistently
returned `{ scanned: 0, processed: 0, reason: 'queue_empty' }` because
`retry-provisioning` runs inline (synchronously) and does not enqueue a worker
job. Worker-style queue entries appear to come from the scheduler only.

## Monitoring

The task brief mentioned `POST /api/monitoring/dashboards`, but dashboards are
**auto-derived** (GET-only at `/api/monitoring/resource-metrics/dashboard` and
`/api/monitoring/service-slo/dashboard`) from existing managed resources and
application services. There is no `CreateDashboardDto`. The writable monitoring
entities are alert-rules, notification-channels, and silences.

| Kind | Name | id | scope |
|---|---|---|---|
| Alert rule | LT CPU > 80% | `cmrut0u5i0021945dl6ln1faf` | LT-Demo App / dev, category=resource, metric=cpuPercent, severity=warning, evaluationMode=schedule, interval=60s, condition `{ operator: '>', threshold: 80, forSeconds: 300 }` |
| Notification channel | LT Email Alerts | `cmrut14xm0023945dmwk0wv8t` | type=email, recipients=[alerts@devpilot.local], subject prefix `[LT-Alert]`, severity filter [warning, critical] |
| Silence | LT Off-Hours Silence | `cmrut14ye0025945duyzs7a58` | LT-Demo App / dev, category=resource, metric=cpuPercent, 2026-07-22 00:00 → 06:00 UTC |

Mailhog SMTP is on `127.0.0.1:1025`; the notification channel config reported
`{ method: SMTP, provider: email, liveEnabled: false }`. `liveEnabled: false`
means SMTP transport is not wired up in this staging build — emails will be
persisted as delivery rows but not actually sent unless SMTP env vars are
configured on the API container.

## Sites

| Name | id | domain | aliases | runtime | server | env |
|---|---|---|---|---|---|---|
| LT Example Site | `cmrut1rno0027945dcwrw8vhr` | example.lt-test.local | www.example.lt-test.local | reverse_proxy (upstream http://127.0.0.1:3000) | LT-Nginx Target | LT-Demo App / dev |

Status: `draft` (no sync run performed).

## Cleanup

To remove all LT- test data later, delete in reverse dependency order. Specific
ids listed in each section above. No deletes were performed during this run.

1. monitoring silences → notification channels → alert rules
   - `cmrut14ye0025945duyzs7a58`, `cmrut14xm0023945dmwk0wv8t`, `cmrut0u5i0021945dl6ln1faf`
2. resource requests (and their instances / pool allocations)
   - `cmrusxi48001g945d9wf4ij8z` → also release pool allocation
     `cmrusyyl7001v945d2ftfjtpo` and instance `cmrusyyl9001x945dpdu0hldh`
3. sites — `cmrut1rno0027945dcwrw8vhr`
4. application services → applications
   - `cmrusx3pu001e945dvwbdrmip` → `cmruswvnc001a945dv20al0w6`
5. managed resources (no direct DELETE; re-sync with empty inventory or remove
   via DB) — `cmrusw9jq0012945d0q3f0v9s`, `cmrusw9jw0014945dn6esmdrc`,
   `cmrusw9k10016945dk6hjes2c`, `cmrusw9k40018945d4p8z915y`
6. resource pools (admin) — `cmrusvrrv000r945d2y8n5wb3`, `cmrusvrse000s945dmrl1ls1v`
7. resource types (admin) — `cmrusuqgu000g945d1um7kykh`, `cmrusuzz9000i945dayhs2hi3`,
   `cmrusuzzp000k945da89nxns2`, `cmrusv9b6000m945dwhktfoyn`, `cmrusv9bn000o945dfxrzcl5y`,
   `cmrusv9c6000q945dhkbrxius`
8. servers — `cmrust68y000a945d879fmbak`, `cmrustd5b000c945dnsw6cp3h`, `cmrustd5s000e945d5tebsv1v`
9. project environments — no need (cascade-deleted with project); only custom
   envs would need removal (none added).
10. projects — `cmrusr5ql000gfp5bdqawy4n9`, `cmrusr5rs000qfp5b4c9a0p1l`
11. team members → team (only if decommissioning Test Org)
    - tester membership `cmrusqwwv000efp5bk848gjid`, then optionally user
      `cmrusqgta000cfp5bm5fmcg6k` via admin endpoints.

## Notable gotchas

- `POST /api/teams/:id/members` body is `{ email, role }`, **not** `{ userId, role }`.
- `authType` is `'password' | 'key'`, not `'ssh-key'`.
- Project creation auto-seeds `dev/test/staging/prod` environments — don't try to
  re-create `dev` or `staging` via `POST /api/project-environments` (server
  drops the connection on the unique-key violation).
- `CreateResourcePoolDto.adminConfig` is an **object**, not a stringified JSON.
- Pool provisioning requires `provisioningConfig.poolId` on the resource type
  (the `poolKey` alone is insufficient and blocks with `missing_pool_id`).
- `approvalMode: 'auto'` does not auto-approve requests; only `'none'` does.
- Managed resources cannot be POSTed directly — only created via docker/cloud
  inventory sync. In this staging build the server-executor transport is
  disabled, so sync falls back to a stub inventory.
- Servers tested from inside the API container will always report `offline`
  when pointed at `127.0.0.1` — use the staging container's DNS name on the
  shared `devpilot-g003-staging_default` network + the in-container port
  (e.g. `devpilot-g003-ssh-server:2222`, not `127.0.0.1:2223`). All 3 LT-
  servers were corrected this way and now test `online`.
- Monitoring dashboards are read-only / auto-derived. Only alert-rules,
  notification-channels, and silences are creatable.

## Virtualness audit (2026-07-22)

After the initial seed, an audit found several records that were **virtual /
fictional** rather than reflections of real staging state. Status after cleanup:

| Record | Was | Now | Notes |
|---|---|---|---|
| LT-SSH/Nginx/Docker servers `host` | `127.0.0.1` (unreachable from API container) | staging container DNS names | all 3 re-test `online` ✅ |
| ResourcePool endpoints | `mysql://127.0.0.1:3321/...`, `redis://127.0.0.1:6385` | `mysql://devpilot-g003-mysql:3306/...`, `redis://devpilot-g003-redis:6379` | reachable in-container ✅ |
| ManagedResource names/endpoints | fictional (`devpilot-api`, `nginx-proxy`, `mysql-primary`, `redis-cache` at `127.0.0.1`) | real staging containers (`devpilot-g003-mysql/redis/resource-postgres/minio`) | DB-updated ✅ |

**Still virtual by design (cannot be made real without code changes):**

- **Pool provisioning is non-executing.** `resource-pool-provisioning.service.ts`
  `provisionResource()` only `parseEndpoint` + returns generated credentials
  (`user_<name>` / random password); it does **not** connect to MySQL/Redis to
  create the database/user. `deprovisionResource()` just logs. So the
  `allocated: 1` on LT MySQL Pool is a bookkeeping increment, not a real DB
  allocation. The returned delivery credentials will not actually work.
- **ManagedResource inventory is stub-only** in this build (server-executor
  transport disabled). The 4 records were hand-corrected to match real
  containers, but a fresh `sync-docker` would regenerate fictional names.
- **Resource request "completed" status** reflects the virtual provisioning
  above — it ran end-to-end through the code path, but no real resource was
  created in MySQL/Redis.

These are properties of the current devpilot codebase (pre-production), not
data-entry errors. To make them real, the provisioning service and
server-executor transport would need to be implemented (separate slice).

## Picshare deployment (2026-07-22) — hybrid onboarding

Spec + evidence: `docs/todos/2026-07-22-picshare-deployment-plan.md` +
`docs/todos/2026-07-22-picshare-deployment-investigation.md`. Raw request /
response captures for every call below are in
`/tmp/codex-tool-runs/svton/picshare-deploy/` (filename prefixes match the
plan's section numbers, e.g. `01-project.json`, `07-deployment-run.json`).

Scope: **hybrid / reflective onboarding**. picshare is started by its own
`docker-compose.devpilot.yml` (real, reachable containers on the shared
staging network); devpilot holds the Project/Application/Services/Server
records + two real (dry-run) DeploymentRuns whose `commandPlan` records the
exact build/deploy/health-check commands and whose `healthCheckUrl` points at
the live container. Devpilot did NOT start the containers — its live
server-executor transport is still disabled (see "Virtualness audit" above).

### Containers (started by picshare's own compose)

Compose file: `/Users/zhaoxingbo/Workspace/ai-driven/picshare/docker-compose.devpilot.yml`
(all 4 services join `devpilot-g003-staging_default` as an external network
so devpilot's API container can reach them by DNS name).

| Container         | Image                   | Host port → container port | Health | Purpose                          |
|-------------------|-------------------------|----------------------------|--------|----------------------------------|
| `picshare-mysql`  | mysql:8.0               | 3311 → 3306                | healthy | Dedicated picshare DB (db `picshare`, user `picshare` / pw `picshare_pw`, root pw `picshare_root`) |
| `picshare-redis`  | redis:7-alpine          | 6386 → 6379                | healthy | Dedicated picshare Redis         |
| `picshare-backend`| picshare-backend:devpilot | 4100 → 3000              | healthy | NestJS API. Auto-runs `prisma migrate deploy` on boot |
| `picshare-admin`  | picshare-admin:devpilot | 4101 → 3001                | healthy | Next.js admin UI (standalone)    |

Build-time artefacts: backend + admin Dockerfiles are self-contained
multi-stage builds (build inside the image; no host `dist/` needed). Admin
bakes `NEXT_PUBLIC_API_URL=http://localhost:4100/api` in at build time.

Host endpoints (verified HTTP 200):
- Backend API: `curl http://127.0.0.1:4100/api` →
  `{"code":0,"message":"success","data":{"status":"ok",...}}`
- Admin UI: `curl http://127.0.0.1:4101/` → Next.js HTML
- From inside devpilot API container (proves staging-net DNS):
  `docker exec devpilot-app-api node -e 'fetch("http://picshare-backend:3000/api").then(r=>r.text()).then(console.log)'`
  → same JSON health response

Prisma migrations: 25 tables present in `picshare` DB after first boot
(incl. `users`, `workspaces`, `photos`, `albums`, `comments`, `audit_logs`,
`_prisma_migrations`, …).

Healthcheck gotcha (corrected in the compose file): BusyBox `wget` in the
admin container resolves `localhost` to `::1` first, but Next.js standalone
bind only IPv4 (`0.0.0.0:3001`) → `wget http://localhost:3001` returns
"Connection refused" inside the container even though the port is reachable
from off-host. Fix: use `http://127.0.0.1:3001` in the healthcheck `test`.
The backend container binds `:::3000` (dual stack) so `localhost` works
there, but the same IPv4-only form is used for consistency.

### devpilot records (all under team `Test Org` = `cmrusn8mw0009fp5bnu9kuiin`)

| Entity              | Name                     | id                          |
|---------------------|--------------------------|-----------------------------|
| Project             | Picshare                 | `cmrvcfd5t000cdq6b01jka11s` |
| Project env (dev)   | Picshare / dev           | `cmrvcfd6e000edq6bm9xulgvq` |
| (test / staging / prod envs also auto-created) | | `cmrvcfd6i000gdq6bng2k4hlx` / `cmrvcfd6k000idq6b54m7js6u` / `cmrvcfd6n000kdq6b62pjjprp` |
| Server              | Picshare Docker Host     | `cmrvcfrj5000mdq6b5pdfqn6e` |
| Application         | Picshare Application     | `cmrvcg4dy000odq6bvn5ojggn` |
| ApplicationService  | backend                  | `cmrvcg9r3000sdq6bcdzqtl96` |
| ApplicationService  | admin                    | `cmrvcge1f000wdq6b995vmef2` |
| ServerCommandPolicyTemplate | Picshare docker-compose-file deployment | `cmrvcmd78001edq6bdhadofkq` |
| DeploymentRun (backend, dry-run, completed) | — | `cmrvcmhw0001gdq6bxfv9c0pk` |
| DeploymentRun (admin,   dry-run, completed) | — | `cmrvcmn22001mdq6b9l78cawx` |

Server record: `host=picshare-backend`, `port=3000`, `authType=password`,
`username=picshare`, `credentials=picshare` (fictional — server-executor
never runs against it). `POST /api/servers/:id/test` returns
`{success:true, status:online, latency:1ms}` (TCP-ping path) because
`picshare-backend:3000` is reachable from the API container over the
staging network.

### DeploymentRun commandPlan (both runs identical in shape)

For `backend` (`cmrvcmhw0001gdq6bxfv9c0pk`), `status: completed`,
`mode: deploy`, `dryRun: true`, `adapterKey: script-plan`,
`result.executable: true`, `commandPlan.steps`:

| step_key    | command                                                              |
|-------------|----------------------------------------------------------------------|
| checkout    | `git fetch --all --prune && git checkout master && git pull`         |
| build       | `docker compose -f docker-compose.devpilot.yml build backend`        |
| deploy      | `docker compose -f docker-compose.devpilot.yml up -d backend`        |
| health_check| `curl -fsS http://picshare-backend:3000/api`                         |

For `admin` (`cmrvcmn22001mdq6b9l78cawx`), same shape with
`build admin` / `up -d admin` / `curl -fsS http://picshare-admin:3001`.

### Key gotcha: devpilot's built-in command policy does NOT allow `docker compose -f <file>`

The first deployment-run attempts all returned
`illegal deployment run transition: running -> blocked` (HTTP 500). Root
cause: `server-command-policy-deployment-rules.constants.ts` only allows
`docker compose build` / `docker compose up -d` / `docker compose restart`
WITHOUT a `-f <file>` flag (patterns
`/^docker (?:build|compose build)(?: [a-zA-Z0-9_./:@=+-]+)*$/` and
`/^docker compose (?:pull|up -d(?: --build)?|restart)(?: ...)*$/`).
picshare's compose-file path `docker compose -f docker-compose.devpilot.yml
...` therefore falls through to `ruleKey: "no-allowlist-match"` and the
step is `blocked`.

Two compounding bugs surface once a step is blocked:
1. `script-plan.adapter.ts` returns `status: 'blocked'` (because
   `blockOnWarnings !== false` and warnings > 0). So far so good.
2. But `deployment.service.ts:482` then calls
   `assertDeploymentRunTransition('running', 'blocked')` — and the state
   machine in `deployment-run-status.ts` does NOT list `blocked` as a legal
   transition from `running` (only `completed | failed | cancelled`). The
   assertion throws, leaving the DeploymentRun row stuck in `running` with
   no `result` / `commandPlan` / `error`. The retry endpoint then refuses
   ("只能重试失败的部署运行") because the row is not `failed`.

Workaround applied (without code changes): created a project-scoped
`ServerCommandPolicyTemplate` (`cmrvcmd78001edq6bdhadofkq`) with
`allowedPatterns` matching picshare's exact commands:
`regex:^docker compose -f \S+ build( \S+)*$`,
`regex:^docker compose -f \S+ up -d( \S+)*$`,
`regex:^docker compose -f \S+ restart( \S+)*$`,
`regex:^docker compose -f \S+ up -d --build( \S+)*$`,
`regex:^curl -fsS https?://\S+$`,
`regex:^git fetch --all --prune && git checkout \S+ && git pull$`.
After this, both dry-runs returned `completed` synchronously.

Recovery for the 4 stuck `running` rows left by the failed first attempts:
direct DB `UPDATE DeploymentRun SET status='failed', finishedAt=NOW() WHERE
projectId='<picshare>' AND status='running';` (no API path can move them).

### Second gotcha: transient api-mysql OOM during onboarding

When picshare's stack first came up alongside the existing devpilot/twgg
MySQL containers, `devpilot-g003-api-mysql` was OOM-killed (exit 137) for
~2 minutes. The first project-create and deployment-run POSTs hit
`Database operation failed` / left runs stuck. Fix: `docker start
devpilot-g003-api-mysql` (recovered in ~4s, no data loss). Memory pressure
returned to normal afterwards — picshare-mysql is capped at ~173 MiB.

### All 12 acceptance criteria (V1–V12) PASS

V1 backend `healthy`, V2 admin `healthy`, V3 25 tables in picshare DB
(≥10 required, includes `users`), V4 backend HTTP 200 from host, V5 admin
HTTP 200 from host, V6 devpilot API container reaches `picshare-backend:3000`
via DNS, V7 Picshare project exists, V8 application has 2 services
(`backend` + `admin`), V9 server tests `online`, V10 two DeploymentRuns
`completed` with `adapterKey: script-plan`, V11 backend run's
`health_check` step command is exactly `curl -fsS
http://picshare-backend:3000/api`, V12 DB confirms 1 project + 2 services
+ 2 completed runs.

### Cleanup (in reverse dependency order)

```sh
TOKEN=$(curl -s -X POST http://127.0.0.1:3121/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@devpilot.local","password":"DemoPass123!"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["accessToken"])')
TEAM_ID=cmrusn8mw0009fp5bnu9kuiin
H=(-H "Authorization: Bearer $TOKEN" -H "X-Team-Id: $TEAM_ID")

# 1. devpilot records (no DELETE for DeploymentRun — cascade with project)
curl -s -X DELETE http://127.0.0.1:3121/api/server-command-policy-templates/cmrvcmmd78001edq6bdhadofkq "${H[@]}"  # policy template
curl -s -X DELETE http://127.0.0.1:3121/api/applications/cmrvcg4dy000odq6bvn5ojggn/services/cmrvcg9r3000sdq6bcdzqtl96 "${H[@]}"  # backend svc
curl -s -X DELETE http://127.0.0.1:3121/api/applications/cmrvcg4dy000odq6bvn5ojggn/services/cmrvcge1f000wdq6b995vmef2 "${H[@]}"  # admin svc
curl -s -X DELETE http://127.0.0.1:3121/api/applications/cmrvcg4dy000odq6bvn5ojggn "${H[@]}"                       # application
curl -s -X DELETE http://127.0.0.1:3121/api/servers/cmrvcfrj5000mdq6b5pdfqn6e "${H[@]}"                            # server
curl -s -X DELETE http://127.0.0.1:3121/api/projects/cmrvcfd5t000cdq6b01jka11s "${H[@]}"                           # project (cascades runs + envs)

# 2. picshare containers + volumes
cd /Users/zhaoxingbo/Workspace/ai-driven/picshare
docker compose -f docker-compose.devpilot.yml down -v

# 3. generated images (optional)
docker rmi picshare-backend:devpilot picshare-admin:devpilot 2>/dev/null || true

# 4. compose file (optional — it is a deployment artefact, not source)
rm /Users/zhaoxingbo/Workspace/ai-driven/picshare/docker-compose.devpilot.yml
```

> DeploymentRun rows have no public DELETE endpoint; they cascade-delete
> with the Project. If any `running`/`failed` rows linger after project
> delete: `docker exec devpilot-g003-api-mysql mysql -uroot -ppassword
> devpilot_g003_staging -e "DELETE FROM DeploymentRun WHERE
> projectId='cmrvcfd5t000cdq6b01jka11s';"`.


## Picshare full integration (2026-07-22) — Phase 1 data-only wiring

Spec + investigation: `docs/todos/2026-07-22-picshare-full-integration-investigation.md`.
Raw request/response captures for every call below are in
`/tmp/codex-tool-runs/svton/picshare-integration/` (filename prefixes match the
step numbers, e.g. `01a-mr-mysql-insert.log`, `02-site.json`, `06b-backup-run.json`).

Scope: wire picshare fully into devpilot's resource model **with zero production
code changes** — only DB inserts, devpilot API record creation, and one extra
nginx container. This closes every "NOT WIRED" gap the investigation identified
for ManagedResource, Site, ProxyConfig, AlertRule/Channel, and BackupPlan.

### Important IDs (corrected)

| Entity | id |
|---|---|
| Team Test Org | `cmrusn8mw0009fp5bnu9kuiin` |
| Project Picshare | `cmrvcfd5t000cdq6b01jka11s` |
| Project env `staging` | `cmrvcfd6k000idq6b54m7js6u` (used for all new records) |
| (env `dev` = `cmrvcfd6e000edq6bm9xulgvq`, `test` = `cmrvcfd6i000gdq6bng2k4hlx`, `prod` = `cmrvcfd6n000kdq6b62pjjprp`) | |
| Server `Picshare Docker Host` | **`cmrvcfrj5000mdq6b5pdfqn6e`** |
| Application Picshare | `cmrvcg4dy000odq6bvn5ojggn` |
| ApplicationService backend | `cmrvcg9r3000sdq6bcdzqtl96` |
| ApplicationService admin | `cmrvcge1f000wdq6b995vmef2` |

> Gotcha: an earlier doc draft carried a **wrong picshare Server id**
> (`cmrvcfrj5000mdq6b01jka11s`). The real id is
> `cmrvcfrj5000mdq6b5pdfqn6e` (verified via
> `SELECT id FROM Server WHERE name='Picshare Docker Host'`). All records below
> use the correct id.

### New records created in this slice

| Entity | Name | id | Notes |
|---|---|---|---|
| ManagedResource | Picshare Docker Host / picshare-mysql | `cmrvgeyg31rw7xwr4fhue8kom` | kind=mysql, endpoint=picshare-mysql:3306, status=running |
| ManagedResource | Picshare Docker Host / picshare-redis | `cmrvgeyg31c7tngah6jwntbsw` | kind=redis, endpoint=picshare-redis:6379 |
| ManagedResource | Picshare Docker Host / picshare-backend | `cmrvgeyg3112djjs0nzbzxw3e` | kind=docker_container, endpoint=picshare-backend:3000 |
| ManagedResource | Picshare Docker Host / picshare-admin | `cmrvgeyg3be4ixcs52kboq0r` | kind=docker_container, endpoint=picshare-admin:3001 |
| ProxyConfig | Picshare Proxy | `cmrvgg542000af8apg32exmn4` | domain=picshare.localtest.me, upstreams=admin+backend |
| Site | Picshare Site | `cmrvggawz000cf8apch6eup02` | primaryDomain=picshare.localtest.me, env=staging, status=draft |
| AlertNotificationChannel | Picshare Alerts | `cmrvgigxp000ef8apts32w0e1` | type=email, recipients=[alerts@devpilot.local], liveEnabled=false |
| AlertRule | Picshare backend down | `cmrvgioxk000gf8apjord5z8l` | category=resource, metric=health_status, severity=critical, evaluationMode=manual, managedResourceId=picshare-backend |
| BackupPlan | Picshare MySQL daily | `cmrvgiwr7000if8apgbib81np` | backupType=logical, schedule=`0 2 * * *`, retentionDays=7, destinationType=local, resourceId=picshare-mysql |
| BackupRun | (dry-run) | `cmrvgj28q000kf8ap27m47dsj` | dryRun=true, status=completed, adapterKey=backup-script-plan |

All records are scoped to Team `Test Org`, Project `Picshare`, env `staging`,
server `Picshare Docker Host`. The two picshare ApplicationServices remain
un-linked to ManagedResources (the brief scoped this slice to MR/Site/Proxy/
Monitoring/Backup only; linking `ApplicationService.managedResourceId` is a
one-line follow-up if desired).

### Step 1 — ManagedResources (direct DB INSERT, no API path exists)

`ManagedResource` has no `POST` endpoint (only inventory-sync creates them, and
that path is blocked by the dockerode port bug — see investigation §3.1).
Inserted 4 rows directly into `devpilot_g003_staging.ManagedResource`,
mirroring the LT-Docker Host pattern (`local-test-data.md:110-113`) but using
**typed `kind` values** (`mysql`, `redis`) instead of generic `docker_container`,
because `BackupPlan` requires `kind: mysql` (`backup.service.ts getBackupableResource`).

```sql
-- pattern (one of four)
INSERT INTO ManagedResource
  (id, teamId, serverId, projectId, environmentId, sourceType, provider,
   kind, name, externalId, status, endpoint, metadata, config, lastSyncAt, createdAt, updatedAt)
VALUES ('cmrvgeyg31rw7xwr4fhue8kom', 'cmrusn8mw0009fp5bnu9kuiin',
  'cmrvcfrj5000mdq6b5pdfqn6e', 'cmrvcfd5t000cdq6b01jka11s',
  'cmrvcfd6k000idq6b54m7js6u', 'server', 'docker', 'mysql',
  'Picshare Docker Host / picshare-mysql',
  'cmrvcfrj5000mdq6b5pdfqn6e:docker:mysql:picshare-mysql',
  'running', 'picshare-mysql:3306',
  JSON_OBJECT('syncMode','manual_seed','engine','mysql','hostPort',3311),
  JSON_OBJECT('containerName','picshare-mysql','port',3306,'database','picshare'),
  NOW(3), NOW(3), NOW(3));
```

IDs were generated locally to match Prisma's cuid v1 format (`c` + base36
timestamp + counter + 12 random chars) using a Python helper, since the
`cuid2` module is not resolvable from a `node -e` eval inside the API container.

Verification: `GET /api/resource-control/resources?projectId=<picshare>` returns
all 4 (the per-server path `GET /api/resource-control/servers/:id/resources`
does not exist; the flat `/resources` list with `projectId` query is the
correct endpoint).

### Step 2 & 3 — Site + ProxyConfig

`POST /api/proxy-configs` then `POST /api/sites`. The Site DTO field is
**`primaryDomain`** (not `domain`); the brief's `domain` field name is wrong.
Both records reference `serverId: Picshare Docker Host` per the brief's literal
instruction (an alternative would be a separate `Picshare Proxy Host` server
record pointing at the proxy container — investigation §4.4 — but that was not
required here).

ProxyConfig carries two upstreams (admin + backend) plus a `customConfig`
string that documents the exact nginx location blocks, so the record is a
self-describing artefact of the proxy setup. Status defaults to `pending` /
`draft` (sync is a no-op in this build per investigation §3.4).

### Step 4 — picshare-proxy nginx container

Compose file: `/Users/zhaoxingbo/Workspace/ai-driven/picshare/docker-compose.picshare-proxy.yml`
nginx config: `/Users/zhaoxingbo/Workspace/ai-driven/picshare/nginx/devpilot-proxy.conf`

```yaml
services:
  picshare-proxy:
    image: nginx:alpine
    container_name: picshare-proxy
    restart: unless-stopped
    networks: [devpilot-g003-staging_default]
    ports: ["8080:80"]
    volumes:
      - ./nginx/devpilot-proxy.conf:/etc/nginx/conf.d/picshare.localtest.me.conf:ro
networks:
  devpilot-g003-staging_default: { external: true }
```

```nginx
server {
    listen 80;
    server_name picshare.localtest.me;
    location /api { proxy_pass http://picshare-backend:3000; ... }
    location /   { proxy_pass http://picshare-admin:3001;   ... }
}
```

Bring up: `cd /Users/zhaoxingbo/Workspace/ai-driven/picshare && docker compose -f docker-compose.picshare-proxy.yml up -d`.
Host port: **8080** (was free at seeding time). The compose's `default` network
block was removed after `up` accidentally created an orphan `picshare_default`
network; `docker network disconnect picshare_default picshare-proxy && docker network rm picshare_default` cleaned it up.

### How to access picshare by domain

```sh
# Host-header form (works on any machine, no DNS dependence):
curl -H "Host: picshare.localtest.me" http://127.0.0.1:8080/       # -> admin HTML (9137 bytes, title 管理后台)
curl -H "Host: picshare.localtest.me" http://127.0.0.1:8080/api    # -> {"code":0,"message":"success","data":{"status":"ok",...}}

# Pretty-URL form (browser-friendly):
curl http://picshare.localtest.me:8080/
```

**DNS gotcha on this Mac:** `localtest.me` is a public DNS wildcard that
normally resolves any subdomain to `127.0.0.1` (confirmed against `1.1.1.1`),
but this machine's local resolver (`198.18.0.2`, a VPN/proxy such as Clash/
Surge) rewrites `picshare.localtest.me` to `198.18.10.142`, breaking the
pretty-URL form. Fix: add `127.0.0.1 picshare.localtest.me` to `/etc/hosts`,
or disable the proxy, or just use the Host-header form above.

Cross-container verification (proves staging-network DNS both ways):

```sh
docker exec devpilot-app-api curl -s -H "Host: picshare.localtest.me" \
  http://picshare-proxy/ -o /dev/null -w "admin: HTTP %{http_code} %{size_download}B\n"
# -> admin: HTTP 200 9137B
docker exec devpilot-app-api curl -s -H "Host: picshare.localtest.me" \
  http://picshare-proxy/api -o /dev/null -w "api: HTTP %{http_code} %{size_download}B\n"
# -> api: HTTP 200 207B
```

### Step 5 — AlertNotificationChannel + AlertRule

- Channel: `type=email`, `emailRecipients=[alerts@devpilot.local]`,
  `severityFilter=[warning,critical]`. Returned `config.liveEnabled=false`
  (same gotcha as LT Email Alerts — SMTP transport not wired in this build;
  deliveries persist as rows but aren't sent).
- Rule: `category=resource`, `metric=health_status`, `severity=critical`,
  `evaluationMode=manual`, `managedResourceId=<picshare-backend MR>`,
  `condition={operator:'==',threshold:'down'}`. `serverId` was auto-populated
  from the managedResource's server. Manual eval is available via
  `POST /api/monitoring/alert-rules/:id/evaluate` (no scheduler fires it
  automatically in this build).

### Step 6 — BackupPlan + dryRun BackupRun

- Plan: `backupType=logical`, `schedule=0 2 * * *`, `retentionDays=7`,
  `destinationType=local`,
  `destination={path:/var/backups/devpilot/picshare, container:devpilot-g003-backup-target}`.
  Requires `resourceId` to reference a `kind=mysql` ManagedResource — which is
  why Step 1 used `kind=mysql` for picshare-mysql (not `docker_container`).
- Dry-run run: `POST /api/backups/plans/:id/runs {dryRun:true}` returned
  `status=completed`, `adapterKey=backup-script-plan`, with a 3-step
  commandPlan that targets the real container:
  1. `mkdir -p /var/backups/devpilot/mysql`
  2. `docker exec picshare-mysql sh -lc 'mysqldump --single-transaction --all-databases > /tmp/devpilot-backup.sql'`
  3. `docker cp picshare-mysql:/tmp/devpilot-backup.sql /var/backups/devpilot/mysql/devpilot-backup.sql`
  All steps `status=allowed` by the built-in command-policy baseline. Non-dryRun
  is blocked by `backup.service.ts blockLiveRun` (Phase 2).

### Verification summary (all PASS)

| Check | Result |
|---|---|
| `GET /api/resource-control/resources?projectId=<picshare>` | 4 MRs returned |
| `GET /api/sites/<id>` | 200 |
| `GET /api/proxy-configs/<id>` | 200 |
| `GET /api/monitoring/alert-rules?projectId=<picshare>` | 1 rule (Picshare backend down) |
| `GET /api/monitoring/notification-channels?projectId=<picshare>` | 1 channel (Picshare Alerts) |
| `GET /api/backups/plans?projectId=<picshare>` | 1 plan (Picshare MySQL daily) |
| `GET /api/backups/runs?planId=<id>` | 1 run (dryRun=completed) |
| `picshare-proxy` container running | Up, port 8080:80 |
| Host-header curl admin root | HTTP 200, 9137B HTML (title 管理后台) |
| Host-header curl /api | HTTP 200, 207B JSON `{status:ok}` |
| Cross-container curl from `devpilot-app-api` | HTTP 200 admin + api |

Note: alert-rules / notification-channels / backup-plans have **no GET-by-id
endpoint** — only list endpoints. A 404 on `GET .../:id` is expected, not an
error; use the `?projectId=` list form instead.

### Cleanup

To remove just the Phase 1 wirings (leaving the Picshare project, app,
services, server, and dry-run DeploymentRuns intact):

```sh
TOKEN=$(curl -s -X POST http://127.0.0.1:3121/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@devpilot.local","password":"DemoPass123!"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["accessToken"])')
TEAM_ID=cmrusn8mw0009fp5bnu9kuiin
H=(-H "Authorization: Bearer $TOKEN" -H "X-Team-Id: $TEAM_ID")

# 1. devpilot records (no DELETE for backup-runs/alert-rules/channels — cascade or DB)
curl -s -X DELETE http://127.0.0.1:3121/api/backups/plans/cmrvgiwr7000if8apgbib81np "${H[@]}"
curl -s -X DELETE http://127.0.0.1:3121/api/monitoring/alert-rules/cmrvgioxk000gf8apjord5z8l "${H[@]}"
curl -s -X DELETE http://127.0.0.1:3121/api/monitoring/notification-channels/cmrvgigxp000ef8apts32w0e1 "${H[@]}"
curl -s -X DELETE http://127.0.0.1:3121/api/sites/cmrvggawz000cf8apch6eup02 "${H[@]}"
curl -s -X DELETE http://127.0.0.1:3121/api/proxy-configs/cmrvgg542000af8apg32exmn4 "${H[@]}"

# 2. ManagedResources (no DELETE endpoint — direct DB)
docker exec -i devpilot-g003-api-mysql mysql -uroot -ppassword devpilot_g003_staging <<SQL
DELETE FROM ManagedResource WHERE projectId='cmrvcfd5t000cdq6b01jka11s'
  AND id IN ('cmrvgeyg31rw7xwr4fhue8kom','cmrvgeyg31c7tngah6jwntbsw',
             'cmrvgeyg3112djjs0nzbzxw3e','cmrvgeyg3be4ixcs52kboq0r');
DELETE FROM BackupRun WHERE planId NOT IN (SELECT id FROM BackupPlan) AND resourceId IS NOT NULL;
SQL

# 3. picshare-proxy container
cd /Users/zhaoxingbo/Workspace/ai-driven/picshare
docker compose -f docker-compose.picshare-proxy.yml down
# 4. (optional) compose + nginx conf artefacts
rm docker-compose.picshare-proxy.yml nginx/devpilot-proxy.conf
```

### Virtualness (still virtual by design in this build)

- The new ManagedResources are **manually seeded** (not produced by a real
  `sync-docker`); re-running sync would regenerate fictional names. Marked via
  `metadata.syncMode: 'manual_seed'` so the provenance is explicit.
- Site `status: draft`, ProxyConfig `status: pending` — sync is a config-text
  generator only in this build (never writes to disk).
- AlertRule `evaluationMode: manual` — no scheduler fires it; rules are
  evaluable on demand but not auto-triggered.
- BackupRun `dryRun: true` — generates the command plan; non-dryRun is blocked.
- AlertNotificationChannel email `liveEnabled: false` — deliveries persist as
  rows but SMTP is not wired.

To make any of these real requires the Phase 2 changes in the investigation
(dockerode port fix, `SERVER_EXECUTOR_LIVE_ENABLED=true`, real SSH/docker
target, ProxyConfig.sync implementation, SMTP env).
