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
