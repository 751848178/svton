# Devpilot Resource Request Minimum Loop

This is the production MVP handoff path for resource requests. It covers the
smallest loop that must work before delivery: request creation, review or
completion, provisioning execution, observable result, and recovery.

## API path

| Step | Endpoint | Production expectation |
| --- | --- | --- |
| Create request | `POST /api/resource-requests` | Team member creates a request inside an allowed project/environment scope. |
| List/request detail | `GET /api/resource-requests`, `GET /api/resource-requests/:id` | Results are filtered through project/environment read policy. |
| Review | `POST /api/resource-requests/:id/review` | Approver has write policy for the request scope. |
| Complete | `POST /api/resource-requests/:id/complete` | High-risk write policy is required; service must not complete after denial. |
| Provisioning runs | `GET /api/resource-requests/:id/provisioning-runs` | Runs are visible for the request scope. |
| Replay | `POST /api/resource-requests/:id/provisioning-runs/:runId/replay` | Medium-risk write policy is required. |
| Provider reconcile | `POST /api/resource-requests/:id/provisioning-runs/:runId/reconcile-provider-state` | High-risk write policy is required and provider state is written as evidence. |
| Supervisor | `GET /api/resource-requests/provisioning-runs/supervisor` | Shows queue/retry/stale/provider polling status for the team. |
| Queue worker | `POST /api/resource-requests/provisioning-runs/process-next` | Processes one queued run after write-policy approval. |
| Stale recovery | `POST /api/resource-requests/provisioning-runs/recover-stale` | Recovers stale runs without editing history manually. |

## Production switches

```bash
RESOURCE_REQUEST_PROVISIONING_HTTP_QUEUE_ENABLED=true
RESOURCE_REQUEST_PROVISIONING_QUEUE_WORKER_ENABLED=true
RESOURCE_REQUEST_PROVISIONING_QUEUE_WORKER_BATCH_SIZE=3
RESOURCE_REQUEST_PROVISIONING_RETRY_SCHEDULER_ENABLED=true
RESOURCE_REQUEST_PROVISIONING_RETRY_SCHEDULER_INTERVAL_SECONDS=60
RESOURCE_REQUEST_PROVISIONING_RUN_STALE_RECOVERY_ENABLED=true
RESOURCE_REQUEST_PROVISIONING_RUN_STALE_AFTER_SECONDS=1800
RESOURCE_REQUEST_PROVISIONING_PROVIDER_STATE_POLLING_ENABLED=true
```

Enable queueing, queue worker, retry, stale recovery, and provider polling one
at a time in staging. Keep provider credentials and tenant access policies in
place before enabling live provisioning.

## Failure states

- `queue_empty`: no queued run is ready; not a failure.
- `queue_claim_conflict`: another worker claimed the run; retry later.
- stale run recovered: verify the request status and audit log before replay.
- provider polling blocked: keep the provider state result and resolve the
  provider credential or external API blocker.
- write-policy denial: do not call the service mutation; fix access policy or
  use an approved operator.

## Verification

Focused automated coverage:

```bash
corepack pnpm --filter @svton/devpilot-api exec jest --runInBand \
  src/resource-request/resource-request.controller.spec.ts \
  src/resource-request/resource-request.service.spec.ts \
  src/resource-request/resource-request-provisioning-retry-scheduler.service.spec.ts
```

Live staging checklist:

1. Create a request in a disposable project/environment.
2. Review or complete it with an approved operator.
3. Confirm a provisioning run exists and is visible from the request detail.
4. Run `process-next` if queueing is enabled.
5. Confirm supervisor counts reflect queue/retry/stale/provider polling state.
6. Force a safe failure in staging, then verify replay or stale recovery records
   the result without deleting the original run.

### Local Docker staging checklist (Tier A resources)

When rehearsing against the disposable Docker stack in
`docker-compose.devpilot-staging.yml`, the following fixtures close the wider
flow gaps without claiming real cloud validation. Each item is wired in by
`node scripts/devpilot-docker-staging.mjs run`:

- **Pool provisioning** — `127.0.0.1:3321` (mysql) and `127.0.0.1:6385` (redis)
  back the seeded `ResourcePool` rows; `endpoint` is `mysql://127.0.0.1:3321/devpilot_resource_pool`
  and `redis://127.0.0.1:6385` (host-reachable because the API runs via
  `pnpm dev`, not inside compose), and `adminConfig` is encrypted with the
  API's CBC default key so `resource-pool-provisioning.service.ts` decrypts and
  returns a real host/port/database delivery object for the `local-mysql-pool`
  and `local-redis-pool` resource types. The provisioning service returns
  allocation credentials (random password + generated db/user names); it does
  not itself run DDL — the operator (or a downstream cloud adapter) does.
- **SSH transport** — `ssh-server` on `127.0.0.1:2223` (`devpilot`/`devpilot`)
  lets `script-plan` and `ssh-live` adapters run end-to-end instead of forcing
  the `server_agent` task-pull transport.
- **Object storage** — MinIO S3 endpoint on `127.0.0.1:9100` (bucket
  `devpilot-test`, seeded via the `--profile seed minio-mc` one-shot) stands in
  for `tencent-cos` / `qiniu` object storage; the seeded `TeamCredential` row
  carries the S3-compatible shape, encrypted with the API's GCM default key so
  `cloud-provider-inventory.service.ts` can decrypt it. The live S3 inventory
  path additionally requires `RESOURCE_CONTROL_CLOUD_INVENTORY_LIVE_ENABLED=true`
  AND a provider-specific adapter (`tencent-cos` / `aliyun-rds` / `aliyun-sls`);
  there is no `s3` adapter, so the seeded MinIO credential is decryptable but
  the dispatcher falls back to stub mode. By default the cloud inventory runs
  in stub mode and the runner does not set the flag.
- **PostgreSQL** — `postgres` on `127.0.0.1:5433` backs the seeded
  `local-postgres` resource type so the `postgresql` default has a real
  endpoint.
- **Docker inventory** — `docker-socket-proxy` on `127.0.0.1:2376` exposes
  the host docker daemon via GET-only endpoints (POST/EXEC disabled — see
  `docker-compose.devpilot-staging.yml` env block on `docker-socket-proxy`).
  The seeded `Server` row's `services.dockerApiHost = 'tcp://127.0.0.1:2376'`
  (host-reachable — the API runs on the host) makes
  `docker-inventory-executor.factory.ts` pick the dockerode path; the factory
  hard-codes `port: 2376`, so only the hostname matters. If the host has no
  `/var/run/docker.sock`, the proxy healthcheck fails fast and the runner
  records `dockerProxyStatus != 200` as a warning. All published staging
  ports bind to `127.0.0.1` so the stack is unreachable from the LAN.
- **Notification delivery** — `mailhog` on `127.0.0.1:1025` (UI `:8025`) sinks
  SMTP for the `SMTP_HOST`/`SMTP_PORT`/`MAIL_FROM` envs consumed by
  `monitoring-notification-delivery-config.service.ts`.
