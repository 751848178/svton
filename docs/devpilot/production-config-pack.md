# Devpilot Production Config Pack

This pack is the production handoff companion to
[`docs/devpilot/demo-runbook.md`](./demo-runbook.md). The demo runbook uses
throwaway local ports, databases, Redis, and tokens. Production must replace
those values with environment-owned secrets, exact origins, and explicit
enablement decisions.
Use [`agent-production-runbook.md`](./agent-production-runbook.md) for the
server-agent service-manager shape.

## Source-backed baseline

| Area | Variable | Production value | Source-backed default or behavior |
| --- | --- | --- | --- |
| API port | `PORT` | API listener port behind the production proxy. | Defaults to `3101` in `apps/devpilot-api/src/main.ts`. |
| Web API URL | `NEXT_PUBLIC_API_URL` | Browser-reachable API origin, including scheme and host. | Web clients default to `http://localhost:3101`. |
| CORS | `CORS_ORIGIN` | Comma-separated exact Web origins. | Defaults to `http://localhost:3100`; credentials are enabled. |
| Database | `DATABASE_URL` | Production database connection string. | Prisma reads the configured database URL; CLI preflight warns on local-only hosts. |
| Redis | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB` | Production Redis endpoint and auth. | Defaults are `localhost`, `6379`, no password, and DB `0`. |
| JWT | `JWT_SECRET`, `JWT_EXPIRES_IN` | Long random secret and agreed token lifetime. | JWT falls back to `default-secret-change-me` and `7d`; production must override the secret. |
| Crypto | `ENCRYPTION_KEY` | Managed secret for encrypted credentials and request data. | Required by crypto-backed services before storing production secrets. |
| Cache | `CACHE_ENABLED`, `CACHE_TTL` | Keep enabled unless cache behavior is intentionally disabled. | Defaults are enabled and TTL `300`. |
| Logging | `NODE_ENV`, `LOG_LEVEL` | `NODE_ENV=production`; choose an operational log level. | Logger defaults to `development` and `debug`; pretty print is off only in production. |

## Live execution gates

All live execution gates are source-backed default-off. Do not enable them from
a demo shell without an environment-specific command policy and rollback plan.

| Capability | Required variables | Production guidance | Default or clamp |
| --- | --- | --- | --- |
| SSH live executor | `SERVER_EXECUTOR_LIVE_ENABLED=true` | Enable only for approved SSH targets with confirmation text, command policy templates, and rollback ownership. | Disabled by default. Remote kill timeout uses `SERVER_EXECUTOR_REMOTE_KILL_TIMEOUT_SECONDS`, clamped to 1-30 seconds and defaulting to 10. |
| Queue worker | `SERVER_EXECUTOR_QUEUE_WORKER_ENABLED=true` | Enable for queued live jobs; monitor stale locks and heartbeat. | Disabled by default. Interval defaults to 5 seconds; batch size defaults to 1 and is capped at 10. |
| Queue lock | `SERVER_EXECUTOR_QUEUE_LOCK_TTL_SECONDS`, `SERVER_EXECUTOR_QUEUE_HEARTBEAT_SECONDS`, `SERVER_EXECUTOR_CANCEL_POLL_SECONDS` | Set TTL longer than the longest expected command heartbeat gap. | Lock TTL defaults to 120 seconds; heartbeat is at most one third of lock TTL; cancellation poll is clamped to 0.5-10 seconds. |
| Stale remote cleanup | `SERVER_EXECUTOR_STALE_REMOTE_CLEANUP_ENABLED=true` | Enable only after remote kill behavior is tested on the target OS. | Disabled by default. |
| Server-agent dispatcher | `SERVER_EXECUTOR_AGENT_ENABLED=true`, `SERVER_EXECUTOR_AGENT_DISPATCHER_URL`, `SERVER_EXECUTOR_AGENT_DISPATCHER_TOKEN` | Use a private dispatcher URL and a separate bearer token. | Executor is disabled by default; dispatcher timeout defaults to 30 seconds and is clamped to 1-300. |
| Agent targets | `SERVER_EXECUTOR_AGENT_TARGET_ENABLED=true` | Enable only after server records have task-pull ownership and heartbeat expectations. | Disabled by default. |

## Task-pull API and CLI

Use separate task-pull and heartbeat tokens. The task-pull API falls back to the
heartbeat token only when `SERVER_EXECUTOR_AGENT_TASK_PULL_TOKEN` is absent, so
production should set both explicitly.

| Surface | Variable | Production guidance | Source-backed behavior |
| --- | --- | --- | --- |
| Task-pull contract | `SERVER_EXECUTOR_AGENT_TASK_PULL_CONTRACT_ENABLED`, `SERVER_EXECUTOR_AGENT_TASK_PULL_TOKEN` | Enable contract checks before live agents are allowed to execute jobs. | Disabled by default. |
| Task-pull runtime | `SERVER_EXECUTOR_AGENT_TASK_PULL_ENABLED`, `SERVER_EXECUTOR_AGENT_TASK_PULL_POLL_INTERVAL_SECONDS` | Enable only after queue worker and agent token rotation are ready. | Disabled by default; poll interval defaults to 60 seconds and is clamped to 30-300. |
| Heartbeat API | `SERVER_EXECUTOR_AGENT_HEARTBEAT_ENABLED`, `SERVER_EXECUTOR_AGENT_HEARTBEAT_TOKEN`, `SERVER_EXECUTOR_AGENT_HEARTBEAT_TTL_SECONDS` | Require heartbeat for production agents and rotate the token independently. | Heartbeat auth is disabled unless enabled; TTL is clamped to 30-3600 seconds. |
| CLI required config | `DEVPILOT_API_URL`, `DEVPILOT_AGENT_TASK_PULL_TOKEN`, `DEVPILOT_TEAM_ID`, `DEVPILOT_SERVER_ID`, `DEVPILOT_AGENT_ID` | Prefer environment variables from a service manager rather than shell history. | The CLI refuses to run without required values. |
| CLI loop bounds | `DEVPILOT_AGENT_TASK_PULL_INTERVAL_MS`, `DEVPILOT_AGENT_TASK_PULL_MAX_ITERATIONS`, `DEVPILOT_AGENT_TASK_PULL_IDLE_LIMIT` | Production service mode should set `--forever`; rehearsal mode should set a finite bound. | The run loop errors unless `--max-iterations`, `--idle-limit`, or `--forever` is set. |
| CLI heartbeat | `DEVPILOT_AGENT_HEARTBEAT_TOKEN`, `DEVPILOT_AGENT_HEARTBEAT_STATUS`, `DEVPILOT_AGENT_HEARTBEAT_HOSTNAME`, `DEVPILOT_AGENT_HEARTBEAT_VERSION`, `DEVPILOT_AGENT_HEARTBEAT_TTL_SECONDS` | Set stable hostname/version for observability. | Runner id defaults to host plus process id; heartbeat status is validated. |
| CLI execution cwd | `--cwd` | Use a disposable app worktree or release directory, not the repo root. | The demo runbook uses `/tmp`; production must be narrower. |

## Scheduler profile

Production should enable schedulers one group at a time and keep dry-run modes
until the target resources and alert channels are verified.

| Group | Variables | Production guidance | Defaults |
| --- | --- | --- | --- |
| Resource control | `RESOURCE_CONTROL_SCHEDULER_ENABLED`, `RESOURCE_CONTROL_SCHEDULE_DOCKER_SYNC_ENABLED`, `RESOURCE_CONTROL_SCHEDULE_DOCKER_METRICS_ENABLED`, `RESOURCE_CONTROL_STALE_AFTER_SECONDS` | Enable server sync first, then metrics after Docker resource volume is understood. | Main scheduler disabled; Docker sync defaults on inside the scheduler; metrics default off; stale-after defaults to 86400 seconds. |
| Resource requests | `RESOURCE_REQUEST_PROVISIONING_HTTP_QUEUE_ENABLED`, `RESOURCE_REQUEST_PROVISIONING_QUEUE_WORKER_ENABLED`, `RESOURCE_REQUEST_PROVISIONING_RETRY_SCHEDULER_ENABLED`, `RESOURCE_REQUEST_PROVISIONING_PROVIDER_STATE_POLLING_ENABLED`, `RESOURCE_REQUEST_PROVISIONING_RUN_STALE_AFTER_SECONDS` | Enable queueing and worker together only after provider credentials and tenant controls are verified. | Queue worker, retry, and provider polling default off; stale-after defaults to 1800 seconds. |
| Log center | `LOG_CENTER_SERVER_FOLLOW_SCHEDULER_ENABLED`, `LOG_CENTER_SERVER_FOLLOW_SCHEDULER_DRY_RUN`, `LOG_RETENTION_SCHEDULER_ENABLED`, `LOG_RETENTION_SCHEDULER_DRY_RUN`, `LOG_CENTER_SLS_LIVE_QUERY_ENABLED` | Start follow and retention schedulers in dry-run; enable SLS live query only after credentials and query limits are approved. | Follow and retention schedulers default off; follow dry-run defaults on; SLS query timeout defaults to 10000 ms. |
| Monitoring | `MONITORING_SCHEDULER_ENABLED`, `ALERT_NOTIFICATION_RETRY_SCHEDULER_ENABLED`, `ALERT_ESCALATION_SCHEDULER_ENABLED`, `ALERT_NOTIFICATION_WEBHOOKS_ENABLED`, `ALERT_NOTIFICATION_EMAIL_ENABLED` | Enable rule evaluation before live notification delivery; configure webhooks/SMTP separately. | Schedulers and notification delivery default off; retry and escalation batch sizes default to 20. |
| Generated artifacts | `DEVPILOT_GENERATED_PROJECTS_DIR`, `DEVPILOT_GENERATED_PROJECT_ARTIFACT_RETENTION_DAYS`, `PROJECT_ARTIFACT_CLEANUP_SCHEDULER_ENABLED` | Place generated ZIPs on managed storage and enable cleanup only after audit events are verified. | Cleanup scheduler defaults off; interval defaults to 86400 seconds. |
| Site TLS | `SITE_TLS_PROBE_SCHEDULER_ENABLED`, `SITE_TLS_RENEW_SCHEDULER_ENABLED` | Enable after production domains and certificate ownership are clear. | Probe and renew schedulers default off. |

## Production env skeleton

```bash
NODE_ENV=production
PORT=3101
NEXT_PUBLIC_API_URL=https://devpilot-api.example.com
CORS_ORIGIN=https://devpilot.example.com
DATABASE_URL=mysql://devpilot:<secret>@mysql.internal:3306/devpilot
REDIS_HOST=redis.internal
REDIS_PORT=6379
REDIS_PASSWORD=<secret>
REDIS_DB=0
JWT_SECRET=<long-random-secret>
JWT_EXPIRES_IN=7d
ENCRYPTION_KEY=<managed-secret>

SERVER_EXECUTOR_LIVE_ENABLED=false
SERVER_EXECUTOR_QUEUE_WORKER_ENABLED=false
SERVER_EXECUTOR_AGENT_TARGET_ENABLED=false
SERVER_EXECUTOR_AGENT_TASK_PULL_CONTRACT_ENABLED=false
SERVER_EXECUTOR_AGENT_TASK_PULL_ENABLED=false
SERVER_EXECUTOR_AGENT_HEARTBEAT_ENABLED=false
```

Change each `false` only when the matching runbook,
[`command-policy-templates.md`](./command-policy-templates.md), tenant gate,
and rollback evidence exist for that environment.
Use [`rehearsal-trace-governance.md`](./rehearsal-trace-governance.md) when
reviewing old failed or blocked records during readiness checks.
Use [`permission-tenant-e2e.md`](./permission-tenant-e2e.md) for the
cross-team access gate.
Use [`resource-request-minimum-loop.md`](./resource-request-minimum-loop.md)
for the resource request MVP loop.
Use [`backup-restore-upgrade-checklist.md`](./backup-restore-upgrade-checklist.md)
for the final production handoff checklist.

## Handoff checklist

- Replace every demo token, localhost origin, throwaway database, and disposable
  Redis setting before production.
- Keep task-pull, heartbeat, dispatcher, JWT, Redis, database, and encryption
  secrets separate in the secret manager.
- Record which schedulers are enabled, which remain default-off, and which are
  dry-run only.
- Link verification logs under `/tmp/codex-tool-runs/svton/` or the production
  evidence store.
- Do not delete rehearsal or failed job history; scope dashboards and readiness
  views instead.
