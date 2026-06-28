# Infrastructure Control Plane

## Goal

Evolve Devpilot from resource request and credential management into an infrastructure control plane that can inventory and eventually operate server-hosted Docker resources, Docker-deployed middleware, and cloud resources such as RDS, SLS, and Tencent COS.

## Scope

- In scope: unified managed-resource inventory, sync-run tracking, server-dimension Docker inventory, cloud-resource inventory placeholders, front-end control-plane entry, and svton ecosystem reuse notes.
- In scope: clearly mark first-pass sync as inventory-only and adapter-backed so it can later swap to SSH, Docker API, or cloud SDK execution.
- Out of scope for this pass: real SSH command execution, Docker start/stop/delete, database backup/restore, cloud mutations, long-running worker queues, and fine-grained approval workflow for dangerous actions.

## Product Evolution

1. Inventory first: connect servers and cloud accounts, then show all resources by server, provider, kind, status, endpoint, and sync time.
2. Safe read operations next: real Docker inspect/ps/log tail, RDS/SLS/COS list APIs, resource health, usage, and ownership mapping.
3. Guarded control actions later: container start/stop/restart, DB backup, Redis flush protection, COS bucket policy updates, SLS project retention changes.
4. Automation last: scheduled sync, drift detection, alerts, quota checks, and project-level binding to generated apps.

## svton Ecosystem Resources To Reuse

- `ServerService`: encrypted SSH credential storage, team ownership, connection test, and service detection entry point.
- `Resource`, `ResourceInstance`, `ResourcePool`: existing credential, delivered-resource, and pool-allocation models for project generation.
- `TeamCredential`: reusable cloud-account credential container for CDN and future Aliyun/Tencent adapters.
- `packages/nestjs-object-storage` and `packages/nestjs-object-storage-tencent-cos`: object storage abstraction and Tencent COS adapter.
- `packages/nestjs-logger`: Aliyun SLS and Tencent CLS transport configuration patterns.
- `packages/nestjs-redis` and `packages/nestjs-cache`: Redis connection and cache configuration patterns.
- Devpilot `domain`, `cdn-config`, `proxy-config`, and `key-center` modules: adjacent infrastructure configuration surfaces.

## Functional TODO Breakdown

### F1. Unified Inventory Model

Purpose: Store any server or cloud resource in a single queryable inventory without leaking credentials.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F1.1 | done | Add `ManagedResource` for discovered or manually managed resources. | Prisma schema and migration. | Stores source type, provider, kind, status, endpoint, config, metadata, owning team, optional server/project/resource/credential links. |
| F1.2 | done | Add `ResourceSyncRun` for server/cloud sync attempts. | Prisma schema and migration. | Stores provider, scope, actor, status, discovered count, metadata, error, and finish time. |
| F1.3 | done | Add scheduled sync and stale-resource marking. | Resource control scheduler. | Added default-off `ResourceControlSchedulerService`; it marks stale server/cloud resources using `ManagedResource.status/lastSyncAt/syncError` and can batch scheduled Docker sync through Server executor when enabled. |

### F2. Server Docker Inventory

Purpose: Let teams view server resources from the server dimension.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F2.1 | done | Add API to sync Docker inventory for a server. | `resource-control` module. | `POST /resource-control/servers/:serverId/sync-docker` creates a sync run and upserts inventory records. |
| F2.2 | done | Represent Docker containers, Docker MySQL, and Docker Redis as managed resources. | `ManagedResource` records. | Uses `kind` values `docker_container`, `mysql`, and `redis` grouped under the server. |
| F2.3 | done | Replace simulated Docker inventory with a Server executor Docker inventory adapter. | `resource-control` plus Server executor command policy. | `syncServerDocker()` now tries read-only Server executor live inventory via `docker ps -a --no-trunc --format '{{json .}}'`, parses Docker JSON lines into container/MySQL/Redis resources, records execution/parser metadata, and only uses an explicitly labelled stub fallback when live inventory is unavailable. |

### F3. Cloud Resource Inventory

Purpose: Bring RDS, SLS, and Tencent COS into the same control plane.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F3.1 | done | Add API to sync cloud inventory by provider. | `resource-control` module. | `POST /resource-control/cloud/sync` supports `all`, `aliyun-rds`, `aliyun-sls`, and `tencent-cos`. |
| F3.2 | done | Map cloud resources to shared resource kinds. | `ManagedResource` records. | Uses `database`, `log_service`, and `object_storage`. |
| F3.3 | done | Wire cloud provider inventory adapters for Aliyun and Tencent resources. | Provider response mapping and `TeamCredential` resource binding. | Added cloud inventory adapter mapping Aliyun RDS, Aliyun SLS, and Tencent COS response shapes to `ManagedResource` seeds; cloud sync now records explicit provider/fallback metadata instead of opaque `inventory_stub`. |
| F3.4 | done | Enable Tencent COS live SDK transport for cloud inventory. | Tencent COS SDK client and encrypted `TeamCredential` use. | Added `CloudProviderInventoryService`, direct `cos-nodejs-sdk-v5` API dependency, encrypted/plaintext TeamCredential config parsing, live bucket listing behind `RESOURCE_CONTROL_CLOUD_INVENTORY_LIVE_ENABLED=true`, provider-error fallback metadata, and COS live/fallback unit tests. |
| F3.5 | done | Enable Aliyun RDS and SLS live SDK transport for cloud inventory. | Aliyun provider SDK clients and encrypted `TeamCredential` use. | Added `@alicloud/pop-core` RDS inventory, `@alicloud/sls20201230` SLS project/logstore inventory, encrypted/plaintext `cloud_aliyun` config parsing, page-size/max-page guards, provider-error fallback metadata, and Aliyun live/fallback unit tests. |
| F3.6 | done | Harden cloud inventory runtime with SDK timeout, retry/backoff, and Aliyun cross-region batching. | Cloud inventory runtime behavior that can be unit-tested without real cloud credentials. | Added provider call timeout, retry/backoff policy, requestPolicy metadata, `inventoryRegions` support for Aliyun RDS/SLS, and tests for timeout, retry, and cross-region reads. |
| F3.7 | done | Expose cloud provider inventory diagnostics in sync history. | Resource-control UI and existing sync-run metadata contract. | `/resource-control` now renders per-provider live/fallback mode, parsed/skipped counts, regions, SDK package, request timeout/retry policy, fallback reason, and provider errors from `ResourceSyncRun.metadata.providers[]`. |
| F3.8 | in_progress | Verify cloud inventory with real staging credentials and provider quota observability. | Runtime behavior outside unit tests and current rule-based monitoring model. | F3.8.a, F3.8.c, and F3.8.d are done; real staging e2e remains pending. |
| F3.8.a | done | Add rule-based repeated cloud provider sync failure alerting. | Monitoring rule evaluation over `ResourceSyncRun` metadata; do not write ad hoc alert events from sync code. | `MonitoringService` evaluates `resource/cloud_provider_sync_failure` rules across recent scoped `ResourceSyncRun` metadata, separates live provider failures from configuration fallback, creates normal `AlertEvent` records, and `/monitoring` can create project/all-project cloud sync rules with provider filtering. |
| F3.8.b | pending | Verify cloud inventory with safe staging credentials. | Real Aliyun RDS/SLS and Tencent COS accounts outside unit tests. | Requires user-provided or staging-managed credentials and non-production resources. |
| F3.8.c | done | Add provider quota/rate-limit dashboard from sync metadata. | Provider observability beyond per-run sync history, using existing `ResourceSyncRun.metadata.providers[]` signals. | Added `/resource-control/cloud/provider-health`, readable-sync-run scoped aggregation, quota/rate-limit/timeout/provider failure counters, and a `/resource-control` cloud provider health panel. |
| F3.8.d | done | Add provider notification hooks. | Alert delivery beyond in-app `AlertEvent`. | Added `AlertNotificationChannel` and `AlertNotificationDelivery`, `/monitoring/notification-channels`, `/monitoring/notification-deliveries`, project-scoped read/write policy checks, `/monitoring` notification channel UI, planned dry-run delivery by default, and opt-in live delivery; Feishu/DingTalk/enterprise WeChat robot adapters are covered by F36, retry by F37/F43, email by F44, and escalation by F45. |

### F4. Control Plane UI

Purpose: Give users a single page for infrastructure resources.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F4.1 | done | Add sidebar entry under infrastructure. | Devpilot web sidebar. | `资源管控` links to `/resource-control`. |
| F4.2 | done | Add resource-control dashboard with sync actions and grouped resources. | Devpilot web page. | Page loads capabilities, servers, resources, and sync runs. |
| F4.3 | done | Add resource detail drawers and action history. | Devpilot web page. | `/resource-control` now opens a per-resource drawer with identity, bindings, redacted config/metadata, action buttons, and recent action/connection/query histories from loaded run data. |

### F5. Verification

Purpose: Prove the new control-plane base compiles and the data model is valid.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F5.1 | done | Regenerate Prisma Client after schema changes. | `pnpm --filter @svton/devpilot-api prisma:generate`. | Prisma Client generated successfully. |
| F5.2 | done | Run API and web type checks. | Devpilot API/web packages. | `pnpm --filter @svton/devpilot-api type-check` and `pnpm --filter @svton/devpilot-web type-check` passed. |
| F5.3 | done | Run API and web builds plus Prisma validate. | Devpilot API/web packages. | Prisma validate, API build, web build, and `git diff --check` passed; web build only warned that Browserslist data is stale. |

### F6. Credential And Executor Adapter Layer

Purpose: Keep the current version on Server executor while making future Server agent and cloud SDK executors pluggable.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F6.1 | done | Add a resource action run model for controlled-operation audit trails. | Prisma schema and migration only. | Added `ResourceActionRun` and `20260624100000_resource_action_runs` migration. |
| F6.2 | done | Add action registry definitions for Docker, MySQL, Redis, SLS, and COS actions. | `resource-control` module only. | Added `RESOURCE_ACTIONS` with provider/kind/source matching and risk metadata. |
| F6.3 | done | Add credential resolver interface and implementation. | `resource-control/credentials` only. | Added `DefaultCredentialResolver` with server/cloud credential references and redacted metadata. |
| F6.4 | done | Add executor interface, router, and Server script executor. | `resource-control/executors` only. | Added executor contract, Server script executor, cloud SDK executor, and executor router. |
| F6.5 | done | Keep real transport behind adapter boundaries and default to script-plan dry runs. | Service and executor wiring. | `executeResourceAction()` defaults to dry run and live execution returns blocked until transport is enabled. |

### F7. Resource Action API And UI

Purpose: Let users see supported actions and create controlled action runs without adding an agent.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F7.1 | done | Add API endpoints for action registry, action runs, and action execution. | `ResourceControlController` and service. | Added `GET /actions`, `GET /action-runs`, and `POST /resources/:resourceId/actions`. |
| F7.2 | done | Show available resource actions and recent action runs in the control-plane UI. | `/resource-control` page only. | Resource rows now render matching action buttons; page loads and displays recent action runs. |
| F7.3 | done | Surface dry-run/script-plan status clearly in UI. | `/resource-control` copy and run result. | Action calls send `dryRun: true`; UI labels action runs as `dry run`, and executor results use script/SDK plan modes. |

### F8. Control Access Policy Coverage

Purpose: Keep the control plane safe as resource operations expand beyond team-role-only administration.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F8.1 | done | Add policy-backed write checks for resource control operations. | `ResourceControlController` and service access-scope helpers. | Resource actions, binding changes, connection probes, query runs, Docker sync, and cloud sync call `ControlAccessPolicyService.assertCanWrite()`. |
| F8.2 | done | Add policy-backed write checks for application and service operations. | `ApplicationController` and `ApplicationService` scope helpers. | Application create/update/archive, service create/update/archive, and service operations now use project/environment-scoped access checks. |
| F8.3 | done | Add policy-backed write checks for backup, log, and monitoring operations. | `BackupController`, `LogCenterController`, `MonitoringController` plus scope helpers. | Backup plan/run, log stream/collection/append, alert rule/evaluate, and alert acknowledge write paths now use the shared access policy gate. |
| F8.4 | done | Extend policy checks to remaining historical write surfaces. | Server, CDN, key, resource request, resource pool, and legacy resource credential APIs. | Server, CDN config/team credential, legacy resource credential, key, resource request/instance, and team resource-pool allocation write paths now call `ControlAccessPolicyService`; platform-level admin resource type/pool management remains global admin. |
| F8.5 | done | Add first read visibility and sensitive-read gates. | Key center and resource request/instance APIs. | `ControlAccessPolicyService` now supports `control_read` and `sensitive_read`; key lists, key value, key export, resource request list/detail, and resource instance list/detail use read policy checks. |
| F8.6 | done | Extend read visibility filtering to operational state surfaces. | ResourceControl, logs, and monitoring read APIs. | Resource lists, resource action/connection/query/sync runs, log streams/entries/collection runs, alert rules, and alert events now filter through `ControlAccessPolicyService.canRead()`; resource-scoped action lookup and stream-entry lookup assert read access before returning data. |
| F8.7 | done | Extend read visibility filtering to remaining historical and infrastructure surfaces. | Execution history, audit logs, sites, CDN, servers, and legacy resource credential read APIs. | Server execution jobs/leases, server command policy templates, audit events, site lists/details/sync runs, CDN configs, team credentials, servers, and legacy resource credentials now use `ControlAccessPolicyService` read filtering or assertions. |
| F8.8 | done | Run a final read-authorization audit across non-infrastructure product surfaces. | Deployment runs, operation approvals, applications/services, backups, project environments, project webhooks, projects, and remaining dashboard read APIs. | Deployment run lists, operation approval lists, application/service lists/details/operation runs, backup plan/run lists, project environment lists/server bindings, project webhooks/deliveries, project lists/details, and legacy proxy configs now use `ControlAccessPolicyService` read filtering or assertions; deployment, webhook, and proxy write paths also gained scoped policy gates. |
| F8.9 | done | Add seeded authorization regression coverage for representative allow/deny cases. | API service and controller tests around read filtering, sensitive reads, and high-risk writes. | Added package-local Jest config plus `ControlAccessPolicyService`, `DeploymentController`, and `ProjectController` specs covering owner bypass, deny precedence, default role gates, explicit policy allow, sensitive reads, deployment run filtering, live rollback high-risk write gates, and project-detail nested-resource filtering. |

### F9. Alert Noise Control

Purpose: Make monitoring usable during real maintenance windows by suppressing noisy alert notifications without hiding the underlying event or audit trail.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F9.1 | done | Add alert silence windows for scoped notification suppression. | Monitoring schema, API, evaluation flow, and `/monitoring` page. | Added `AlertSilence`, `/monitoring/silences`, scoped read/write policy checks, active-window matching by project/environment/category/metric/severity, suppressed alert events, notification dispatch skipping for suppressed events, `/monitoring` silence UI, and MonitoringService coverage for suppression. |

### F10. Log Collection Ingestion

Purpose: Turn completed log collection runs into searchable log entries without introducing a server agent in the current version.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F10.1 | done | Persist ingestion state on log collection runs. | Prisma schema and migration. | Added `ingestionStatus`, `ingestedEntryCount`, `ingestionError`, `ingestedAt`, and an ingestion-status index on `LogCollectionRun`. |
| F10.2 | done | Parse completed collection output into `LogEntry` records. | `log-center` ingestion service. | Added `LogCollectionIngestionService` to extract stdout/stderr or executor logs, parse timestamp/level, redact secret-like values and bearer tokens, bulk insert entries, and update `LogStream` last-entry metadata. |
| F10.3 | done | Trigger ingestion from both direct collection and queued executor completion. | `LogCenterService` and `ServerExecutorService`. | Direct completed collection runs and `LogCollectionRun` queue bridge completions call the shared ingestion service; dry-run and incomplete runs are marked skipped. |
| F10.4 | done | Surface ingestion state in the log center UI. | `/logs` page. | Recent collection runs display ingestion status, ingested entry count, and ingestion errors. |
| F10.5 | done | Add service-level regression coverage. | Jest unit test. | Added coverage for completed-output parsing/redaction/write behavior and dry-run skip behavior. |

### F11. Log Stats And Alerting

Purpose: Connect searchable log entries to operational alerting so log spikes can create standard alert events and notifications.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F11.1 | done | Add scoped log level statistics. | Log API, service query, and read-policy filtering. | Added `/logs/stats`; controller resolves readable stream ids through existing log read policy before counting recent entries by level. |
| F11.2 | done | Add log-count alert evaluation. | Monitoring service rule evaluation. | Added `category=log` / `log_error_count` evaluation over recent `LogEntry` windows with configurable `windowMinutes`, `threshold`, `levels`, and optional `streamId`. |
| F11.3 | done | Surface log stats and log alert creation in UI. | `/logs` and `/monitoring` pages. | Log center shows recent level distribution; monitoring can create project/all-project log error rules and evaluate them through the standard alert event path. |
| F11.4 | done | Add regression coverage and verification. | Jest, type checks, builds, and whitespace checks. | Added targeted service specs for log stats and log alert firing/ok behavior; verified with API/web type checks, full API Jest, Prisma validate, API/web builds, `git diff --check`, and explicit whitespace scanning. |

### F12. Log Retention Cleanup

Purpose: Keep log storage governable by applying each stream's `retentionDays` policy through audited dry-run and cleanup runs.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F12.1 | done | Add retention cleanup run records. | Prisma schema and migration. | Added `LogRetentionRun` with stream scope, dry-run flag, cutoff, matched/deleted counts, status, error, actor, indexes, and `AuditEvent.logRetentionRunId`. |
| F12.2 | done | Add retention cleanup API. | LogCenter service/controller and access policy. | Added `/logs/retention-runs` and `POST /logs/streams/:streamId/retention/cleanup`; cleanup defaults to dry-run, live cleanup uses high-risk write policy, refreshes stream last-entry metadata, and writes audit events. |
| F12.3 | done | Add retention UI. | `/logs` page. | Log center now shows selected stream retention days, dry-run/live cleanup controls, and recent retention runs with matched/deleted counts and cutoff time. |
| F12.4 | done | Add regression coverage and verification. | Jest, type checks, builds, and whitespace checks. | Added targeted service specs for dry-run count and live delete/metadata refresh; verified with API/web type checks, full API Jest, Prisma validate, API/web builds, `git diff --check`, and explicit whitespace scanning. |

### F13. Scheduled Log Retention

Purpose: Move log retention from manual operation to safe automation while keeping destructive cleanup opt-in.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F13.1 | done | Add default-off scheduled retention cleanup. | LogCenter scheduler service and module wiring. | Added `LogRetentionSchedulerService`; `LOG_RETENTION_SCHEDULER_ENABLED` controls the timer, and `LOG_RETENTION_SCHEDULER_DRY_RUN` defaults to true. |
| F13.2 | done | Batch active streams safely. | Prisma stream selection and LogCenter cleanup API reuse. | Scheduler processes active streams with `retentionDays > 0` in bounded batches, reuses audited `cleanupRetention()`, continues after failures, and reports deleted counts. |
| F13.3 | done | Add regression coverage and verification. | Jest, type checks, builds, and whitespace checks. | Added scheduler tests for disabled, dry-run, live opt-in, failure continuation, and running guard; verified with API/web type checks, full API Jest, Prisma validate, API/web builds, `git diff --check`, and explicit whitespace scanning. |

### F14. SLS Query Backfill Plan

Purpose: Let SLS log streams use the same LogCollectionRun surface as server logs, with a concrete provider-query contract before live credentials are enabled.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F14.1 | done | Add concrete SLS collection plan. | LogCenter provider collection plan. | SLS log streams now generate `cloud-sdk` / `aliyun-sls-query-plan` dry-run plans with project/logstore/query/window/limit, GetLogs planned call metadata, result contract, redacted preview rows, and live prerequisites. |
| F14.2 | done | Expose SLS logstore/query params in UI. | `/logs` page. | Log stream creation now accepts `sourceKey`, and selected SLS streams expose query/window/limit controls that are passed to collection params. |
| F14.3 | done | Add regression coverage and verification. | Jest, type checks, builds, and whitespace checks. | Added LogCenter service coverage for SLS dry-run GetLogs plans and blocked live behavior; verified with targeted Jest and type checks before full verification. |

### F15. Configurable Log Redaction Policy

Purpose: Keep LogEntry persistence safe by applying a shared redaction contract to collected logs and manually appended logs, while allowing teams to broaden masking for PII or source-specific fields without weakening baseline secret masking.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F15.1 | done | Add shared log redaction helper. | `log-center` backend only. | Added a shared helper with always-on baseline password/token/authorization masking plus stream metadata support for extra key masking, email masking, and IP masking. |
| F15.2 | done | Apply redaction to all LogEntry write paths. | Collection ingestion and manual append. | Collection ingestion and manual append now use the same helper before persisting `message`, JSON payload fields, and stream last-message summaries. |
| F15.3 | done | Surface per-stream redaction policy in UI. | `/logs` page. | Selected log streams can save extra mask keys and optional email/IP masking into `metadata.redaction` without overwriting unrelated metadata. |
| F15.4 | done | Add regression coverage and verification. | Jest, type checks, builds, and whitespace checks. | Added targeted coverage for collected-log and manual-append redaction; verified with targeted Jest, API/web type checks, full API Jest, Prisma validate, API/web builds, `git diff --check`, and explicit whitespace scanning. |

### F16. Near Real-Time Log Tail

Purpose: Let operators follow a selected log stream from the log center without opening a server shell, while keeping the existing log read policy and LogEntry persistence model.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F16.1 | done | Add policy-gated log tail API. | LogCenter controller/service. | Added `GET /logs/streams/:streamId/tail` with bounded limit, composite cursor filtering, newest cursor metadata, and `log.stream.tail` read-policy enforcement. |
| F16.2 | done | Add log-center tail UI. | `/logs` page. | Selected streams can fetch tail entries, enable 3-second auto-refresh, merge cursor-based new entries, clear tail mode, and keep the normal search/list flow available. |
| F16.3 | done | Add regression coverage and verification. | Jest, type checks, builds, and whitespace checks. | Added service/controller coverage for bounded tail queries, cursor filtering, and access-policy call path; verified with targeted Jest, API/web type checks, full API Jest, Prisma validate, API/web builds, `git diff --check`, and explicit whitespace scanning. |

### F48. Streaming Log Tail Channel

Purpose: Move log following from periodic UI polling toward a real streaming channel over persisted `LogEntry` data, while preserving existing log read policy and cursor semantics.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F48.1 | done | Add a policy-gated SSE endpoint for log tail events. | LogCenter controller/service only; no schema migration. | Added `GET /logs/streams/:streamId/events`, reusing `log.stream.tail` read policy and existing cursor tail semantics to emit ready/entries/heartbeat/error SSE frames. |
| F48.2 | done | Add a streaming mode to the log center page. | `/logs` page and API client only. | API client now supports authenticated stream fetches; Logs page can open/abort a real-time stream, merge streamed entries, and show connection/heartbeat state. |
| F48.3 | done | Add regression coverage and update product docs. | Log center tests, docs, and verification commands. | Added controller regression coverage, updated product docs, and verified with targeted log-center Jest, full API Jest, API/Web type-check, Prisma validate, API/Web build, `git diff --check`, and conflict-marker scan. |

### F49. Streaming Log Resume And Reconnect

Purpose: Make the SSE log tail usable across transient network drops by resuming from the last cursor and surfacing reconnect state without adding a server agent.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F49.1 | done | Add SSE resume metadata to the log event endpoint. | LogCenter controller and controller tests only. | `GET /logs/streams/:streamId/events` now accepts `Last-Event-ID`, starts from that cursor when no query cursor is supplied, and emits SSE `id`/`retry` metadata with ready/entries/heartbeat/error frames. |
| F49.2 | done | Add client-side reconnect with cursor resume. | `/logs` page and API stream headers only. | Logs page now keeps the latest cursor in a ref, reconnects SSE streams with 1/2/5/10/30s backoff, sends both query cursor and `Last-Event-ID`, and shows reconnect count/next retry time. |
| F49.3 | done | Update product docs and run verification. | Devpilot roadmap, TODO evidence, and verification commands. | Product docs updated; verified with targeted log-center Jest, full API Jest, API/Web type-check, Prisma validate, API/Web build, `git diff --check`, and conflict-marker scan. Lint remains blocked by missing API ESLint config and interactive `next lint` setup. |

### F50. Streaming Log Session Governance

Purpose: Make log streaming connections governable by exposing session identity and bounded lifetime while keeping resume/reconnect behavior non-agent based.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F50.1 | done | Add session metadata and max duration to the SSE endpoint. | LogCenter DTO, controller, and controller tests only. | `GET /logs/streams/:streamId/events` now normalizes `maxSessionMs`, emits `sessionId`/`expiresAt`/`maxSessionMs` in SSE payloads and response headers, sends a `closing` event at max duration, and closes the response for client resume. |
| F50.2 | done | Surface log stream session state in the UI. | `/logs` page stream state only. | Logs page requests a bounded stream session, updates session id/expiresAt from SSE payloads, shows session/expiry status, and treats `closing` as a resumable stream handoff. |
| F50.3 | done | Update product docs and run verification. | Devpilot roadmap, TODO evidence, and verification commands. | Product docs updated; verified with targeted log-center Jest, full API Jest, API/Web type-check, Prisma validate, API/Web build, `git diff --check`, and conflict-marker scan. Lint remains blocked by missing API ESLint config and interactive `next lint` setup. |

### F51. Streaming Log Active Session Control

Purpose: Let operators see and intentionally close live log streaming sessions, with a first per-stream active-session limit to prevent runaway connections.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F51.1 | done | Add active stream session registry and policy-gated controls. | LogCenter in-memory registry, module, controller, and controller tests only. | Added in-memory `LogStreamSessionRegistry`, `/logs/stream-sessions`, `/logs/stream-sessions/:sessionId/close`, read/write policy checks, manual-close SSE `closing` events, and per-stream active session limit via `LOG_STREAM_MAX_ACTIVE_SESSIONS_PER_STREAM`. |
| F51.2 | done | Surface active stream sessions in the log center UI. | `/logs` page API reads and controls only. | Logs page now loads active stream sessions, can refresh the selected stream's sessions, shows session timing/status, and can request low-risk session close. |
| F51.3 | done | Update product docs and run verification. | Devpilot roadmap, TODO evidence, and verification commands. | Product docs updated; verified with targeted log-center Jest, full API Jest, API/Web type-check, Prisma validate, API/Web build, `git diff --check`, and conflict-marker scan. Lint remains blocked by missing API ESLint config and interactive `next lint` setup. |

### F52. Streaming Log Session Audit Closure

Purpose: Make active log stream session control auditable so operators can trace who intentionally closed a live tail session and which stream/project/environment it belonged to.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F52.1 | done | Write an audit event when an active stream session is manually closed. | LogCenter controller and AuditEvent integration only; no schema migration. | `POST /logs/stream-sessions/:sessionId/close` now writes `AuditEvent` with `category=log`, `action=log.stream_session.close`, `targetType=log_stream_session`, `targetId=sessionId`, `logStreamId`, project/environment scope, and session metadata. |
| F52.2 | done | Add regression coverage and update product docs. | Log center controller spec, roadmap, progress docs, and verification commands. | Controller spec asserts the audit payload; docs updated; verified with targeted log-center Jest, full API Jest, API type-check, API build, Prisma validate, `git diff --check`, and conflict-marker scan. API lint remains blocked by missing ESLint config. |

### F53. Streaming Log Tenant Session Limits

Purpose: Add tenant and actor guardrails to the SSE log tail channel so a team or single user cannot exhaust API process streaming capacity by opening many different log streams.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F53.1 | done | Add team and actor active-session counters and limits. | LogStreamSessionRegistry and LogCenter controller only; no schema migration. | `GET /logs/streams/:streamId/events` now enforces `LOG_STREAM_MAX_ACTIVE_SESSIONS_PER_ACTOR` and `LOG_STREAM_MAX_ACTIVE_SESSIONS_PER_TEAM` in addition to per-stream limits, and exposes the normalized limits in response headers and ready payloads. |
| F53.2 | done | Add regression coverage and update product docs. | Log center controller spec, roadmap, progress docs, and verification commands. | Controller spec covers team/user limit rejection and limit metadata; docs updated; verified with targeted controller Jest, log-center Jest, full API Jest, API type-check, API build, Prisma validate, `git diff --check`, and conflict-marker scan. |

### F54. Scheduled Server Log Follow

Purpose: Move server-side Docker/Nginx/server log streams closer to continuous follow without adding an agent by scheduling bounded Server executor collection windows that feed persisted `LogEntry` and the existing SSE tail channel.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F54.1 | done | Add a default-off Server executor log follow scheduler. | Log center scheduler only; no schema migration. | Added `LogServerFollowSchedulerService`; it is disabled by default, scans active `docker`/`nginx`/`server_executor` streams, only processes streams with `metadata.serverFollow.enabled=true`, skips streams with recent collection runs, defaults to dry-run, and requires stream-level live confirmation before live collection. |
| F54.2 | done | Surface per-stream Server follow configuration in the log center UI. | `/logs` page metadata controls only. | Docker/Nginx/server log streams now expose `metadata.serverFollow` controls for enable/live/confirmation/queue/tail/interval/maxAttempts. |
| F54.3 | done | Add regression coverage and update product docs. | Log center scheduler tests, module wiring, roadmap, progress docs, and verification commands. | Scheduler spec covers disabled, opt-in dry-run, recent-run skip, confirmed live queue, and missing-confirmation block; docs updated; verified with scheduler Jest, log-center Jest, full API Jest, API/Web type-check, API/Web build, Prisma validate, `git diff --check`, and conflict-marker scan. API lint remains blocked by missing ESLint config; Web lint remains blocked by interactive Next lint setup. |

### F17. Docker Container Metrics Action

Purpose: Add a first observability-oriented resource action so Docker containers can expose safe CPU, memory, network, block IO, and process-count collection plans through the same Credential/Auth and Executor adapter path as other resource operations.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F17.1 | done | Add Docker stats action definition. | Resource action registry. | Added low-risk read action `docker.container.stats` for server-sourced Docker container resources. |
| F17.2 | done | Add Server executor command plan and result contract. | `server-script` executor and command policy. | Server executor now generates a narrow `docker stats --no-stream --format '{{json .}}' <container>` plan with metrics preview, and the built-in command policy allowlists only that JSON snapshot form. |
| F17.3 | done | Surface action in resource-control UI. | `/resource-control` page. | Resource-control action labels and live-read eligibility now include `docker.container.stats`, reusing existing dry-run/live/queue controls. |
| F17.4 | done | Add regression coverage and verification. | Jest, type checks, builds, and whitespace checks. | Added action/executor and command-policy specs; verified with targeted Jest, API/web type checks, full API Jest, Prisma validate, API/web builds, `git diff --check`, and explicit whitespace scanning. |

### F18. Docker Metrics Snapshot Persistence

Purpose: Turn one-off Docker stats action output into persisted resource metric snapshots so resource health, trend views, and future alerts have a durable data source without introducing a server agent in the current version.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F18.1 | done | Add a resource metric snapshot persistence contract. | Prisma schema, migration, ResourceControl query DTO/API, and read-policy filtering. | Added `ResourceMetricSnapshot`, migration `20260627006000_resource_metric_snapshots`, `GET /resource-control/metric-snapshots`, and `resource_metric_snapshot.read` filtering. |
| F18.2 | done | Parse Docker stats JSON output into normalized CPU, memory, network, block IO, and PID metrics. | Pure resource-control metrics helper and unit tests. | Added `docker-stats-metrics.ts` parser with JSON-line extraction, byte/percent normalization, duplicate suppression, and targeted Jest coverage. |
| F18.3 | done | Persist snapshots from direct and queued Docker stats action completions. | `ResourceControlService` direct action completion and `ServerExecutorService` resource-action queue bridge. | Direct and queued `docker.container.stats` completions now parse `result/logs` and write idempotent snapshots for completed non-dry-run runs. |
| F18.4 | done | Surface latest and recent resource metrics in the control-plane UI. | `/resource-control` page resource rows and detail drawer. | Resource-control loads `/metric-snapshots`, shows latest CPU/memory badges in resource rows, and shows recent metric history in the resource detail drawer. |
| F18.5 | done | Verify regression coverage and update product roadmap. | API/web tests, type checks/builds, Prisma validate, docs. | Verified with Prisma generate/validate, targeted parser/ResourceControlService/ServerExecutorService Jest, full API Jest, API/web type checks, API/web builds, global `git diff --check`, and explicit whitespace scans. |

### F19. Scheduled Docker Metrics And Trend Summary

Purpose: Move Docker metrics from manual snapshot collection toward continuous observability by queueing safe stats collection on a default-off scheduler and showing short-window trend summaries in resource-control.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F19.1 | done | Extend the existing scheduler with default-off Docker metrics collection. | `ResourceControlSchedulerService` only, reusing `ResourceControlService.executeResourceAction()`. | Added `RESOURCE_CONTROL_SCHEDULE_DOCKER_METRICS_ENABLED=false` default behavior, bounded batch/min-interval/max-attempt config, recent-snapshot skipping, and queued `docker.container.stats` submission through the existing Server executor path. |
| F19.2 | done | Add metric trend summary API with read-policy filtering. | ResourceControl service/controller/DTO only. | Added `GET /resource-control/metric-trends`, resource-scope read filtering, bounded `windowMinutes`, and CPU/memory/network/block/PID latest/average/max/delta summaries grouped by resource and metric source. |
| F19.3 | done | Surface metric trend summaries in resource-control UI. | `/resource-control` page only. | Resource-control now loads metric trends, shows CPU/memory trend badges in resource rows, and shows a per-resource trend panel in the detail drawer. |
| F19.4 | done | Add regression coverage and verification. | Scheduler/service tests, type checks/builds, docs. | Verified with targeted scheduler/ResourceControlService Jest, full API Jest, API/web type checks, Prisma validate, API/web builds, `git diff --check`, and explicit whitespace scans. |

### F20. Resource Metric Threshold Alerts

Purpose: Connect persisted resource metrics to standard alert rules so Docker CPU, memory, and PID signals can trigger the existing alert event, silence, notification, audit, and policy paths without introducing a separate monitoring model.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F20.1 | done | Add `resource_metric_threshold` evaluation over `ResourceMetricSnapshot`. | `MonitoringService` only; no schema migration. | Added metric field whitelist, windowed snapshot query, latest/average/max aggregation, comparison operators, and standard AlertEvent values that inherit existing silence, notification, audit, and policy paths. |
| F20.2 | done | Add monitoring UI controls for resource metric threshold rules. | `/monitoring` page only. | Monitoring page can create resource metric threshold rules for CPU, memory, memory usage, and PIDs with aggregation/operator/threshold/window controls. |
| F20.3 | done | Add regression coverage and verification. | MonitoringService tests, API/web checks/builds, docs. | Verified with targeted MonitoringService Jest, full API Jest, API/web type checks, Prisma validate, API/web builds, `git diff --check`, and explicit whitespace scans. |

### F21. Scheduled Alert Rule Evaluation

Purpose: Move alert rules from manual-only checks toward continuous monitoring by evaluating explicitly scheduled rules on a default-off scheduler while reusing the existing AlertRule, AlertEvent, silence, notification, audit, and policy model.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F21.1 | done | Add a default-off monitoring scheduler for due scheduled rules. | `monitoring` module only; no schema migration. | Added `MonitoringSchedulerService`; `MONITORING_SCHEDULER_ENABLED=false` by default, bounded batch size, running guard, due-rule filtering by `evaluationMode=schedule` and `intervalSeconds`, and failure continuation. |
| F21.2 | done | Allow scheduler-triggered evaluations to run as system actor while preserving manual user actor audits. | `MonitoringService.evaluateRule()` and audit call path only. | `evaluateRule()` now accepts `userId=null`; scheduled evaluations create AlertEvent/AuditEvent with null actor while manual controller calls still pass the authenticated user. |
| F21.3 | done | Surface evaluation mode and interval when creating rules. | `/monitoring` page only. | Monitoring page can create manual or scheduled rules and configure `intervalSeconds`; rule cards display manual/scheduled evaluation mode. |
| F21.4 | done | Add regression coverage and verification. | Scheduler/service tests, API/web checks/builds, docs. | Verified with targeted MonitoringSchedulerService/MonitoringService Jest, full API Jest, API/web type checks, Prisma validate, API/web builds, `git diff --check`, and explicit whitespace scans. |

### F22. Site Certificate Expiry Alerts

Purpose: Start the Site/TLS lifecycle by evaluating certificate expiry metadata through the existing AlertRule, AlertEvent, silence, notification, audit, and scheduled evaluation paths without adding a server agent.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F22.1 | done | Add `certificate_expiry` evaluation for site alert rules. | `MonitoringService` only; no schema migration. | Site rules can read expiry from `Site.tls` common fields such as `expiresAt`, `notAfter`, `certificateExpiresAt`, and nested certificate metadata, then fire when days remaining is below `thresholdDays`. |
| F22.2 | done | Add monitoring UI controls for site certificate rules. | `/monitoring` page only. | Monitoring page now separates `站点` status rules from `站点证书` expiry rules and lets users configure the expiry threshold in days. |
| F22.3 | done | Add regression coverage and verification. | MonitoringService tests, API/web checks/builds, docs. | Verified with targeted MonitoringService Jest, full API Jest, API/web type checks, Prisma validate, API/web builds, `git diff --check`, and explicit whitespace scans. |

### F23. Site TLS Probe And Metadata Refresh

Purpose: Let Site/TLS lifecycle collect certificate expiry metadata through Server executor so certificate alerts do not depend on manual JSON edits.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F23.1 | done | Add a Server executor TLS probe operation for sites. | Site API/service/DTO and command policy only; no schema migration. | Added `POST /sites/:id/tls-probe`, `site.tls_probe` operation metadata, and a narrow OpenSSL command-policy allowlist scoped to `nginx-site-plan/site.tls_probe`. |
| F23.2 | done | Parse OpenSSL probe output and merge certificate metadata into `Site.tls`. | Pure helper plus direct and queued Server executor completion paths. | Added `site-tls-probe` helper; direct SiteService execution and queued ServerExecutor completion both merge expiry, issuer, serial, fingerprint, probe time, and days remaining into `Site.tls`. |
| F23.3 | done | Surface TLS probe and certificate metadata in the site UI. | `/sites` page only. | Site cards show certificate expiry summary and expose a `证书探测`/queued probe action; sync history labels `tls_probe` separately and only sync runs can be rollback sources. |
| F23.4 | done | Add regression coverage and verification. | Site/Server executor tests, API/web checks/builds, docs. | Verified with targeted SiteService/ServerExecutor/ServerCommandPolicy Jest, full API Jest, API/web type checks, Prisma validate, API/web builds, `git diff --check`, and explicit whitespace scans; lint remains blocked by missing/interactive ESLint config. |

### F24. Scheduled Site TLS Probe

Purpose: Move site certificate metadata refresh from manual operation to safe automation by queueing default-off TLS probes through the existing Server executor path.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F24.1 | done | Add a default-off Site TLS probe scheduler. | Site module only, reusing `SiteService.createTlsProbe()` and Server executor queue. | Added `SiteTlsProbeSchedulerService`, controlled by `SITE_TLS_PROBE_SCHEDULER_ENABLED=false` by default, with interval, batch size, max attempts, and minimum probe interval env knobs. |
| F24.2 | done | Skip ineligible or recently probed sites safely. | Scheduler selection/filtering behavior only. | Scheduler only selects non-error sites bound to servers, skips sites without TLS enabled/configured, and skips sites with recent `Site.tls` probe metadata or recent `SiteSyncRun mode=tls_probe` activity. |
| F24.3 | done | Add regression coverage and verification. | Scheduler tests, API/web checks/builds, docs. | Verified with targeted Site TLS/Server executor/command policy Jest, full API Jest, API type-check, Prisma validate, API build, Web type-check/build, `git diff --check`, and touched-file whitespace scan. Lint remains blocked by missing/interactive ESLint config. |

### F25. Controlled Site TLS Renewal Plan

Purpose: Add a safe renewal step after certificate discovery by generating and optionally queueing a policy-gated Let’s Encrypt renewal operation through Server executor before any later automatic renewal scheduler exists.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F25.1 | done | Add Site TLS renewal API and execution plan. | Site controller/service/DTO only, reusing `SiteSyncRun` and Server executor. | Added `POST /sites/:id/tls-renew`; default dry-run creates a certbot renewal rehearsal plan, while non-dry-run renewal creates an approval-blocked SiteSyncRun before any execution. |
| F25.2 | done | Add narrow certbot renewal command policy. | Built-in Server command policy only. | Added `certbot-renew-dry-run` and `certbot-renew` built-in allowlist rules scoped to `nginx-site-plan/site.tls_renew`. |
| F25.3 | done | Surface manual renewal in site UI. | `/sites` page only. | Let’s Encrypt sites now expose `续期演练` and approval-gated `申请续期` actions, respecting the existing queue toggle. |
| F25.4 | done | Add regression coverage and verification. | Site/command-policy tests, API/web checks/builds, docs. | Verified with targeted Site/Server executor/command-policy Jest, full API Jest, API/web type checks, Prisma validate, API/web builds, `git diff --check`, and touched-file whitespace scan. Lint remains blocked by missing/interactive ESLint config. |

### F26. Scheduled Site TLS Renewal

Purpose: Move TLS renewal from manual-only operation toward safe automation by scheduling due Let’s Encrypt sites through the existing approval/Server executor path, while keeping dry-run rehearsal as the default.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F26.1 | done | Add a default-off Site TLS renewal scheduler. | Site module only, reusing `SiteService.createTlsRenew()` and `SiteSyncRun`. | Added `SiteTlsRenewSchedulerService`, controlled by `SITE_TLS_RENEW_SCHEDULER_ENABLED=false`, with dry-run, interval, batch size, max attempts, renew-before-days, and min-renew-interval env knobs. |
| F26.2 | done | Select only due Let’s Encrypt sites and skip recent renewal runs. | Scheduler filtering behavior only. | Scheduler only selects non-error sites bound to servers, requires `Site.tls.enabled=true/type=letsencrypt`, requires certificate expiry metadata, renews only inside the configured threshold window, and skips recent `SiteSyncRun mode=tls_renew` records. |
| F26.3 | done | Add scheduler regression coverage. | Site scheduler tests only. | Added coverage for disabled scheduler, due-site selection, recent-run skipping, dry-run default, live-request mode, failure continuation, and concurrent tick skipping. |
| F26.4 | done | Update roadmap and run verification. | Docs and API/web verification. | Verified with targeted Site TLS scheduler/service/Server executor/command-policy Jest, full API Jest, API/web type checks, Prisma validate, API/web builds, `git diff --check`, and touched-file whitespace scan. Lint remains blocked by missing/interactive ESLint config. |

### F27. Site TLS Renewal Result Metadata

Purpose: Close the loop after TLS renewal execution by writing renewal rehearsal/live results back into `Site.tls`, so certificate operations become visible resource state instead of only historical run records.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F27.1 | done | Parse certbot renewal output into stable Site TLS metadata. | Site TLS helper only; no schema migration. | Added `site-tls-renew` parser/merger for `succeeded/not_due/failed/unknown`, dry-run/live markers, run linkage, timestamps and summaries. |
| F27.2 | done | Refresh `Site.tls` after direct and queued `tls_renew` execution. | `SiteService` and `ServerExecutorService` completion paths only. | Direct Site TLS renewal and queued SiteSyncRun completion now merge renewal metadata into `Site.tls.renewal`, including dry-run rehearsal results. |
| F27.3 | done | Add regression coverage and update product status docs. | Site/Server executor tests, Sites UI and Devpilot docs. | Verified with targeted Site TLS/Server executor Jest, full API Jest, API/web type checks, Prisma validate, API/web builds, `git diff --check`, and touched-file whitespace scan. Lint remains blocked by missing/interactive ESLint config. |

### F28. Site TLS Renewal Follow-Up Probe

Purpose: After a successful live TLS renewal, refresh the observed certificate metadata automatically so `Site.tls` reflects the real served certificate rather than only the certbot renewal status.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F28.1 | done | Queue a follow-up TLS probe after successful direct live renewal. | `SiteService` only, reusing `createTlsProbe()` and Server executor queue. | Successful non-dry-run `tls_renew` now creates a queued `tls_probe` run with `trigger=renewal_follow_up_tls_probe` and records follow-up probe status in `Site.tls.renewal.followUpProbe`. |
| F28.2 | done | Queue the same follow-up TLS probe after queued live renewal completion. | `ServerExecutorService` worker completion path only. | Queued `tls_renew` completion now creates a linked `SiteSyncRun mode=tls_probe`, queues a ServerExecutionJob, and records the follow-up run/job ids in `Site.tls`. |
| F28.3 | done | Add regression coverage and update product status docs. | Site/Server executor tests, Sites UI and Devpilot docs. | Verified with targeted Site TLS/Server executor Jest, full API Jest, API/web type checks, Prisma validate, API/web builds, `git diff --check`, and touched-file whitespace scan. Lint remains blocked by missing/interactive ESLint config. |

### F29. Site TLS Renewal Failure Alert

Purpose: Make TLS renewal automation observable by letting monitoring rules fire when certbot renewal or the renewal follow-up probe fails.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F29.1 | done | Add `tls_renewal_failure` site alert evaluation. | `MonitoringService` only, reading `Site.tls.renewal` metadata. | `category=site/metric=tls_renewal_failure` now fires on certbot renewal failure or follow-up TLS probe failure, returns insufficient data when no renewal metadata exists, and includes renewal/probe run details in event value. |
| F29.2 | done | Surface TLS renewal failure rules in the monitoring UI. | `/monitoring` page only. | Monitoring rule creation now has a `TLS 续期` target type that creates `metric=tls_renewal_failure`, and rule/event target formatting shows TLS renewal context. |
| F29.3 | done | Add regression coverage and update product status docs. | Monitoring tests and Devpilot docs. | Verified with targeted MonitoringService Jest, full API Jest, API/web type checks, Prisma validate, API/web builds, `git diff --check`, and touched-file whitespace scan. Lint remains blocked by missing/interactive ESLint config. |

### F30. Site TLS Certificate Asset Snapshot

Purpose: Start certificate asset management by keeping observed certificate snapshots from TLS probes inside `Site.tls.assets`, without storing private keys or adding a schema migration yet.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F30.1 | done | Merge TLS probe metadata into stable certificate asset snapshots. | `site-tls-probe` helper only. | TLS probe metadata now updates `Site.tls.assets`, keyed by certificate fingerprint or serial number, with first/last seen timestamps, observation count, active flag, and current asset id. |
| F30.2 | done | Surface certificate asset summary on the Sites page. | `/sites` page only. | Site cards now include certificate asset count and a short fingerprint in the certificate summary. |
| F30.3 | done | Add regression coverage and update product status docs. | Site/Server executor tests and Devpilot docs. | Verified with targeted Site TLS/Server executor/Monitoring Jest, full API Jest, API/web type checks, Prisma validate, API/web builds, `git diff --check`, and touched-file whitespace scan. Lint remains blocked by missing/interactive ESLint config. |

### F31. Site TLS Certificate Asset Change Alert

Purpose: Make observed certificate asset history actionable by firing monitoring events when a production site’s active certificate asset changes unexpectedly within a configured time window.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F31.1 | done | Add `certificate_asset_change` site alert evaluation. | `MonitoringService` only, reading `Site.tls.assets` metadata. | `category=site/metric=certificate_asset_change` now fires when the active certificate asset changed inside a configurable `windowHours`, skips first observation by default, and returns insufficient data when no asset snapshots exist. |
| F31.2 | done | Surface certificate asset change rules in the monitoring UI. | `/monitoring` page only. | Monitoring rule creation now has a `证书变化` target type that creates `metric=certificate_asset_change` and lets users configure the change window in hours. |
| F31.3 | done | Add regression coverage and update product status docs. | Monitoring tests and Devpilot docs. | Verified with targeted MonitoringService Jest, full API Jest, API/web type checks, Prisma validate, API/web builds, `git diff --check`, and touched-file whitespace scan. Lint remains blocked by missing/interactive ESLint config. |

### F32. SLS Credential-Backed Live Log Query Adapter

Purpose: Move SLS log collection from dry-run query plans to a guarded credential-backed live read adapter so cloud logs can be pulled into Devpilot log streams without opening a server shell.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F32.1 | done | Add an Aliyun SLS live log query adapter. | Log center provider adapter only, using `TeamCredential` and SDK read operations. | Added `AliyunSlsLogQueryAdapter` with default-off live enablement, `cloud_aliyun` TeamCredential parsing, SLS SDK loading, timeout/retry policy, paged GetLogs reads, and redacted result shaping. |
| F32.2 | done | Wire SLS live reads into `LogCenterService` collection runs. | Log collection run lifecycle and ingestion contract. | `LogCenterService` now routes non-dry-run SLS collection through the live adapter when credential, feature flag, and confirmation gates are satisfied; completed live runs keep using the existing ingestion path to write redacted LogEntry rows. |
| F32.3 | done | Surface guarded SLS live collection in the logs UI. | `/logs` page only. | The Logs page now keeps SLS dry-run as default and exposes explicit live-read plus confirmation controls before sending `dryRun=false` and `params.confirmLiveRead=true`. |
| F32.4 | done | Add regression coverage and update product status docs. | Log center tests and Devpilot docs. | Verified with targeted LogCenterService/Aliyun SLS adapter Jest, full API Jest, API/web type checks, Prisma validate, API/web builds, `git diff --check`, and conflict-marker scan. Lint remains blocked by missing/interactive ESLint config. |

### F33. Scheduled SLS Log Backfill

Purpose: Turn SLS live read capability into a default-off scheduled backfill loop so opted-in log streams can keep Devpilot LogEntry data fresh without manual pulls.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F33.1 | done | Add a default-off SLS backfill scheduler. | Log center scheduler only. | Added `LogSlsBackfillSchedulerService`; it is disabled by default, scans active SLS streams, only processes streams with `metadata.slsBackfill.enabled=true`, skips streams with recent collection runs, and can run dry-run or explicitly confirmed live backfill. |
| F33.2 | done | Store per-stream SLS backfill configuration from the logs UI. | `/logs` page metadata only. | The Logs page now stores per-stream `slsBackfill` query/window/limit/interval/live confirmation metadata and creates SLS source streams for Aliyun SLS managed resources. |
| F33.3 | done | Add regression coverage and product docs. | Log center scheduler tests and Devpilot docs. | Verified with targeted SLS backfill scheduler/LogCenterService Jest, full API Jest, API/web type checks, Prisma validate, API/web builds, `git diff --check`, and conflict-marker scan. Lint remains blocked by missing/interactive ESLint config. |

### F34. Resource Metric Time-Series

Purpose: Turn persisted Docker metric snapshots into a chartable resource time-series view so the control plane starts to feel like an operational console instead of only a recent-history ledger.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F34.1 | done | Add a policy-filtered metric series API. | Resource-control DTO/controller/service only; no schema migration. | Added `GET /resource-control/metric-series` over existing `ResourceMetricSnapshot` data with bounded window/limit, metric field whitelist, read-policy filtering, chronological points, and latest/average/max/delta summary. |
| F34.2 | done | Surface resource metric time-series in the resource-control UI. | `/resource-control` detail drawer only. | Resource detail now loads selected-resource metric series and renders a compact SVG line chart with metric/window controls for CPU, memory, network, block IO, and PID fields. |
| F34.3 | done | Add regression coverage and update product status docs. | ResourceControlService tests and Devpilot docs. | Verified with targeted ResourceControlService Jest, full API Jest, API/web type checks, Prisma validate, API/web builds, and `git diff --check`; lint remains blocked by missing/interactive ESLint config. |

### F35. Monitoring Resource Metric Dashboard

Purpose: Lift resource metrics from a single-resource drawer into the monitoring page so operators can scan resource health, coverage, and hotspots across visible projects/environments.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F35.1 | done | Add a policy-filtered resource metric dashboard API. | Monitoring DTO/controller/service only; no schema migration. | Added `/monitoring/resource-metrics/dashboard` backed by existing `ResourceMetricSnapshot` rows; controller filters visible resource rows before summary aggregation so hidden resources do not affect dashboard counts. |
| F35.2 | done | Surface the resource metric dashboard in monitoring UI. | `/monitoring` page only. | Monitoring now shows resource metric coverage, warning/critical/stale counts, CPU/memory/PID peaks, a time-window selector, and hotspot resource rows. |
| F35.3 | done | Add regression coverage and update product docs. | MonitoringService tests and Devpilot docs. | Verified with targeted MonitoringService Jest, full API Jest, API/web type checks, Prisma validate, API/web builds, `git diff --check`, and touched-file whitespace/conflict scans; lint remains blocked by missing/interactive ESLint config. |

### F36. Alert Notification Channel Adapters

Purpose: Move alert notification beyond a generic webhook by adding provider-specific channel types and payload adapters while preserving default-dry-run delivery and the existing live POST feature flag.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F36.1 | done | Add notification channel provider types and payload adapters. | Monitoring DTO/service only; no schema migration. | Added `webhook`, `feishu`, `dingtalk`, and `wecom` channel types with provider-specific request payload shapes and redacted target metadata. |
| F36.2 | done | Surface provider selection in monitoring UI. | `/monitoring` page only. | Added channel type selector, provider-aware labels/placeholders, and provider badges for alert notification channels and deliveries. |
| F36.3 | done | Add regression coverage and update product docs. | MonitoringService tests and Devpilot docs. | Added provider-specific payload coverage and product docs updates; verified with targeted/full API Jest, API/web type checks, Prisma validate, API/web builds, diff checks, and touched-file scans; lint scripts remain blocked by current ESLint configuration gaps. |

### F37. Alert Notification Delivery Retry

Purpose: Make alert notification delivery operationally reliable enough for a control plane by allowing failed or planned deliveries to be retried through the same channel adapter, live/dry-run flag, permission, and audit boundaries.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F37.1 | done | Add a policy-gated notification delivery retry API. | Monitoring controller/service only; no schema migration. | Added `POST /monitoring/notification-deliveries/:deliveryId/retry`; it only retries failed/planned records, requires an active matching channel, reuses the current channel adapter/live flag, creates a new delivery attempt, and writes an audit event. |
| F37.2 | done | Surface retry action in monitoring UI. | `/monitoring` page only. | Recent failed/planned deliveries now show a retry button with loading state and refreshed delivery history. |
| F37.3 | done | Add regression coverage and update product docs. | MonitoringService tests and Devpilot docs. | Added targeted retry coverage and product docs updates; verified with targeted/full API Jest, API/web type checks, Prisma validate, API/web builds, `git diff --check`, and touched-file scans; lint scripts remain blocked by current ESLint configuration gaps. |

### F38. Service SLO Dashboard

Purpose: Add a first service-level objective view so the monitoring page can show service reliability, deployment health, operation success, and alert impact by project/environment before introducing configurable SLO policies.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F38.1 | done | Add a policy-filtered service SLO dashboard API. | Monitoring DTO/controller/service only; no schema migration. | Added `/monitoring/service-slo/dashboard` over ApplicationService, non-dry-run DeploymentRun, non-dry-run ApplicationServiceOperationRun, and service AlertEvent data with bounded window/limit, target percent, and read-policy filtering before summary aggregation. |
| F38.2 | done | Surface service SLO overview in monitoring UI. | `/monitoring` page only. | Monitoring now shows service SLO summary, target/window selectors, service rows, deployment/operation failures, alert impact, burn rate, and error-budget remaining. |
| F38.3 | done | Add regression coverage and update product docs. | MonitoringService tests and Devpilot docs. | Added targeted SLO dashboard coverage and product docs updates; verified with targeted/full API Jest, API/web type checks, Prisma validate, API/web builds, `git diff --check`, and touched-file scans; lint scripts remain blocked by current ESLint configuration gaps. |

### F39. Service SLO Breach Alert

Purpose: Turn the first service SLO dashboard into an actionable monitoring rule so SLO regressions can flow through the existing AlertRule, AlertEvent, silence, notification, and audit paths.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F39.1 | done | Add service SLO breach rule evaluation. | Monitoring service only; no schema migration. | Added `category=service` / `metric=service_slo_breach` evaluation using non-dry-run deployment runs, service operation runs, and service alert impact while excluding prior SLO breach events. |
| F39.2 | done | Surface service SLO alert creation in monitoring UI. | `/monitoring` page only. | Added service SLO target type with target percent, burn-rate threshold, and window controls. |
| F39.3 | done | Add regression coverage and update product docs. | MonitoringService tests and Devpilot docs. | Added targeted service SLO breach firing/resolved/insufficient coverage and product docs updates; verified with full API Jest, API/web type checks, Prisma validate, API/web builds, `git diff --check`, and touched-file scans; lint scripts remain blocked by current ESLint configuration gaps. |

### F40. Multi-window Service SLO Alert Strategy

Purpose: Move service SLO alerting closer to production SRE practice by supporting paired short/long windows and different burn-rate thresholds without breaking existing single-window rules.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F40.1 | done | Define a backward-compatible SLO condition shape and impact map. | Monitoring service, monitoring UI, and existing service SLO tests only; no schema migration. | Using `condition.windows[]` plus `matchPolicy` while preserving legacy `windowMinutes` / `targetPercent` / `burnRateThreshold`. |
| F40.2 | done | Evaluate service SLO breach rules across multiple windows. | `MonitoringService.evaluateServiceSloBreach` and helpers only. | Added backward-compatible parsing for legacy single-window rules and new `windows[]` / `matchPolicy` multi-window evaluation; targeted MonitoringService tests cover partial all-policy and all-window breach behavior. |
| F40.3 | done | Surface single-window versus multi-window creation controls. | `/monitoring` page only. | Monitoring rule creation now supports single-window and short/long-window service SLO strategies, with target percent, window, and burn-rate controls. |
| F40.4 | done | Add regression coverage and update product docs. | MonitoringService tests and Devpilot docs. | Added targeted multi-window SLO alert coverage and product docs updates; verified with targeted MonitoringService Jest, full API Jest, API/web type checks, Prisma validate, API/web builds, `git diff --check`, and touched-file scans; lint scripts remain blocked by current ESLint configuration gaps. |

### F41. Service Error Budget Alert Policy

Purpose: Let operators alert before a service fully breaches its SLO by watching remaining error budget from the same deployment, service operation, and alert-impact signals.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F41.1 | done | Define a first error-budget rule contract. | Monitoring service and `/monitoring` page only; no schema migration. | Use `AlertRule category=service` / `metric=service_error_budget` with `targetPercent`, `windowMinutes`, and `remainingThresholdPercent`. |
| F41.2 | done | Evaluate service error budget rules from existing SLO signals. | `MonitoringService` helper reuse only. | Added `service_error_budget` evaluation over deployment, service operation, and alert-impact signals; targeted MonitoringService tests cover firing, resolved, and insufficient-data paths. |
| F41.3 | done | Surface service error budget rule creation and summaries in UI. | `/monitoring` page only. | Monitoring rule creation now supports service error budget target type with target percent, remaining-budget threshold, and window controls; rule/event summaries render error-budget conditions. |
| F41.4 | done | Add regression coverage and update product docs. | MonitoringService tests and Devpilot docs. | Added targeted service error budget firing/resolved/insufficient coverage and product docs updates; verified with targeted MonitoringService Jest, full API Jest, API/web type checks, Prisma validate, API/web builds, `git diff --check`, and touched-file scans; lint scripts remain blocked by current ESLint configuration gaps. |

### F42. Alert Event Deduplication Suppression

Purpose: Reduce noisy scheduled alert evaluations by suppressing repeated same-state alert events within a configurable window while keeping rule state and audit evidence current.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F42.1 | done | Define first-pass dedupe contract. | Monitoring service only; no schema migration. | Suppress duplicate `firing` / `error` / `suppressed` events for the same rule/status/category/metric inside `condition.dedupeWindowMinutes` or a 30-minute default; `condition.dedupeEnabled=false` disables suppression. |
| F42.2 | done | Apply dedupe before event creation and notification dispatch. | `MonitoringService.evaluateRule` only. | Duplicate abnormal evaluations update rule last state and write `alert.evaluate.deduped` audit without creating a new `AlertEvent` or notification delivery; resolved recovery events are never deduped. |
| F42.3 | done | Add regression coverage and update product docs. | MonitoringService tests and Devpilot docs. | Added targeted dedupe and recovery-event coverage plus product docs updates; verified with targeted MonitoringService Jest, full API Jest, API/web type checks, Prisma validate, API/web builds, `git diff --check`, and touched-file scans; lint scripts remain blocked by current ESLint configuration gaps. |

### F43. Alert Notification Auto Retry

Purpose: Make outbound alert notifications recover from transient webhook failures without adding a separate worker or retry schema yet, while keeping live sends default-off and preserving audit evidence.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F43.1 | done | Define the first automatic retry contract. | Monitoring scheduler/service only; no schema migration. | Retry only stale `failed` deliveries, skip `planned` dry-run records, skip old failures that already have newer attempts, and cap recent attempts per event/channel. |
| F43.2 | done | Add a default-off retry scheduler path. | `MonitoringSchedulerService` and `MonitoringService` only. | Added `retryFailedNotificationDeliveries()` and `ALERT_NOTIFICATION_RETRY_SCHEDULER_ENABLED=false` scheduler wiring with batch size, minimum age, max attempts, and attempt-window knobs. |
| F43.3 | done | Add regression coverage and update product docs. | Monitoring scheduler/service tests and Devpilot docs. | Added automatic retry coverage in MonitoringService and MonitoringSchedulerService plus product docs updates; verified with targeted and full API Jest, API/web type checks, Prisma validate, API/web builds, `git diff --check`, and touched-file scans; lint scripts remain blocked by current ESLint configuration gaps. |

### F44. Alert Notification Email Channel

Purpose: Add a production-oriented email notification channel for teams that need alert delivery beyond robot/webhook integrations, while keeping live SMTP sends explicitly gated and audited through the existing delivery model.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F44.1 | done | Define the email channel contract. | Monitoring DTO/service/UI only; no schema migration. | Added `type=email`, recipient list, optional subject prefix, default dry-run planned deliveries, and live SMTP gating via `ALERT_NOTIFICATION_EMAIL_ENABLED=true`. |
| F44.2 | done | Add backend email delivery adapter and configuration. | Monitoring service only, reusing `AlertNotificationChannel` / `AlertNotificationDelivery`. | Email channels store public target/recipient count in `config`, keep recipients in `secretConfig`, generate planned deliveries by default, and can send through SMTP when enabled with host/from config. |
| F44.3 | done | Surface email channel creation in monitoring UI. | `/monitoring` page only. | Monitoring notification form now supports email channel type, recipient list input, subject prefix input, and existing project/status/severity filters. |
| F44.4 | done | Add regression coverage and update product docs. | MonitoringService tests and Devpilot docs. | Added email channel creation and planned-delivery coverage plus product docs updates; verified with targeted MonitoringService Jest, full API Jest, API/web type checks, Prisma validate, API/web builds, `git diff --check`, and touched-file scans; lint scripts remain blocked by current ESLint configuration gaps. |

### F45. Alert Escalation Policy

Purpose: Turn long-running high-severity alert events into an operational escalation signal by redispatching them through notification channels when they remain unacknowledged, while avoiding schema churn and repeated notification storms.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F45.1 | done | Define the first escalation contract. | Monitoring service/scheduler only; no schema migration. | Escalate unacknowledged `firing` / `error` critical events older than a threshold; default off; dedupe by recent escalation deliveries for the same event/channel. |
| F45.2 | done | Add default-off escalation scheduler wiring. | `MonitoringSchedulerService` and `MonitoringService` only. | Added `escalateStaleAlertEvents()` plus `ALERT_ESCALATION_SCHEDULER_ENABLED=false` scheduler wiring with batch size, minimum age, dedupe window, and severity knobs. |
| F45.3 | done | Add regression coverage and update product docs. | MonitoringService/MonitoringSchedulerService tests and Devpilot docs. | Added stale critical alert escalation and dedupe coverage plus scheduler wiring tests and product docs updates; verified with targeted MonitoringService/MonitoringSchedulerService Jest, full API Jest, API/web type checks, Prisma validate, API/web builds, `git diff --check`, and touched-file scans; lint scripts remain blocked by current ESLint configuration gaps. |

### F46. Service SLO Templates

Purpose: Let operators create service SLO and error-budget alert rules from standard presets instead of manually tuning every SLO window, burn-rate, and budget threshold.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F46.1 | done | Add a static service SLO template contract. | Monitoring service/controller only; no schema migration. | Added `GET /monitoring/service-slo/templates` returning standard API availability, high-reliability burn-rate, and error-budget guardrail presets. |
| F46.2 | done | Surface templates in the monitoring rule creation flow. | `/monitoring` page only. | Monitoring page now loads service SLO templates and can apply presets into target type, name, severity, evaluation mode, interval, SLO windows, burn-rate, and error-budget threshold fields. |
| F46.3 | done | Add regression coverage and update product docs. | Monitoring tests, docs, and verification commands. | Added MonitoringService template coverage; updated roadmap/requirements; verified with targeted/full API Jest, API/web type checks, Prisma validate, API/web builds, `git diff --check`, and conflict-marker scan. API/Web lint remain blocked by existing ESLint configuration prompts/gaps. |

### F47. Error Budget Exhaustion Forecast

Purpose: Extend service error-budget alerting from a static remaining-budget threshold to an exhaustion forecast that warns when the current burn rate would consume the remaining budget soon.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F47.1 | done | Add a `service_error_budget_exhaustion` rule evaluation contract. | Monitoring service only; no schema migration. | Added forecast evaluation using existing service SLO signals, remaining budget, burn rate, and `exhaustionWithinMinutes`. |
| F47.2 | done | Surface exhaustion forecast rule creation and summaries. | `/monitoring` page and SLO templates only. | Monitoring page can create budget exhaustion forecast rules, render summaries/events, and apply the forecast template. |
| F47.3 | done | Add regression coverage and update product docs. | Monitoring tests, docs, and verification commands. | Added targeted MonitoringService coverage and updated product docs; verified with targeted/full API Jest, API/web type checks, Prisma validate, API/web builds, `git diff --check`, and conflict-marker scan. API/Web lint remain blocked by existing ESLint configuration prompts/gaps. |

### F55. Environment Configuration Sync Suggestions

Purpose: Help imported or deployment-only projects see which environments are missing comparable servers, services, resources, sites, CDN, secrets, and deployment readiness before any risky automatic copy operation exists.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F55.1 | done | Add a read-only environment sync suggestion API. | `project-environment` controller/service only; no mutation and no schema migration. | Added `GET /project-environments/sync-suggestions`, permission-filtered reference selection, environment profiles, difference labels, and suggested next actions. |
| F55.2 | done | Surface backend suggestions in the project environment workspace. | Project detail page only, reusing existing scoped navigation targets. | Project detail now loads environment sync suggestions and renders up to four scoped action links per environment in the cross-environment configuration area. |
| F55.3 | done | Add regression coverage and update product docs. | ProjectEnvironmentService tests and Devpilot docs. | Added ProjectEnvironmentService sync-suggestion tests and Devpilot docs updates; verified with targeted/full API Jest, API/web type checks, API/web builds, Prisma validate, `git diff --check`, and conflict-marker scan. API/Web lint remain blocked by existing ESLint configuration gaps. |

### F56. Environment Sync Apply Plan

Purpose: Let operators turn cross-environment suggestions into a confirmed, bounded execution plan for build/deploy readiness while avoiding unsafe automatic copying of production credentials or infrastructure bindings.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F56.1 | done | Add a dry-run/apply API for environment sync suggestions. | `project-environment` service/controller only; no schema migration. | Added `POST /project-environments/sync-suggestions/apply`, source read and target write policy gates, target confirmation for non-dry-run, and audit event writing. |
| F56.2 | done | Limit first apply scope to non-sensitive application service skeletons and deployConfig fields. | ApplicationService records only; server/site/resource/CDN/secret changes stay plan-only. | Apply only creates missing ApplicationService skeletons or fills missing deployConfig fields; it never copies env, secretKeyIds, serverId, siteId, managedResourceId, CDN, resource, or secret records. |
| F56.3 | done | Surface dry-run/apply controls in the project environment workspace. | Project detail page only. | Project detail now exposes per-environment plan/apply controls under sync suggestions and renders recent planned/applied/skipped steps. |
| F56.4 | done | Add regression coverage, docs, and verification. | ProjectEnvironmentService tests, Devpilot docs, and targeted checks. | Added ProjectEnvironmentService coverage for dry-run plans, deployConfig apply, missing-service skeleton creation, and confirmation protection; verified with targeted/full API Jest, API/web type checks, API/web builds, Prisma validate, `git diff --check`, and conflict-marker scan. API/Web lint remain blocked by existing ESLint configuration gaps. |

### F57. Environment Resource Bulk Binding

Purpose: Let imported and resource-only projects assign already-owned but environmentless resources into a target environment with a dry-run plan, confirmation, audit, and no secret value reads.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F57.1 | done | Add a dry-run/apply API for unbound project resource environment binding. | `project-environment` service/controller only; no schema migration. | Added `POST /project-environments/resources/bulk-bind`, target environment write policy gate, target confirmation for non-dry-run, and audit event writing. |
| F57.2 | done | Support first resource types: Site, ManagedResource, ResourceInstance, CDNConfig, and SecretKey. | Environment ownership fields only; no resource copying or credential value changes. | Bulk binding updates only `environmentId` for existing project resources with no environment; it does not read SecretKey values or modify credentials/provider config. |
| F57.3 | done | Surface bulk binding controls in the project environment workspace. | Project detail page only. | Project detail now lets operators preview or confirm binding all currently unassigned project resources into the selected environment and shows recent binding steps. |
| F57.4 | done | Add regression coverage, docs, and verification. | ProjectEnvironmentService tests, Devpilot docs, and targeted checks. | Added ProjectEnvironmentService coverage for dry-run resource binding, live binding across five resource types, and confirmation protection; verified with targeted/full API Jest, API/web type checks, API/web builds, Prisma validate, `git diff --check`, and conflict-marker scan. API/Web lint remain blocked by existing ESLint configuration gaps. |

### F58. Environment Resource Selection Binding

Purpose: Let operators select exactly which environmentless resources should be assigned into the current environment, so imported and resource-only projects can be onboarded without accidentally moving every unbound resource at once.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F58.1 | done | Confirm the existing bulk-bind API supports selective resource types and IDs. | `project-environment` DTO/service/tests only. | Added regression coverage proving `resourceTypes/resourceIds` limits queries and updates to selected ManagedResource/ResourceInstance IDs while skipping unselected Site/CDN/SecretKey types. |
| F58.2 | done | Add a project-detail selection panel for unbound resources. | Project detail page only; no schema migration. | Project detail now groups unbound ManagedResource, ResourceInstance, Site, CDNConfig, and SecretKey records with all-select, clear, and per-resource checkboxes. |
| F58.3 | done | Send selected resource IDs to dry-run/apply calls and keep all-resource fallback explicit. | Project detail page calling existing API. | Preview/apply calls now require at least one selected resource and send only selected resource types plus selected IDs to `/project-environments/resources/bulk-bind`. |
| F58.4 | done | Update docs and run targeted verification. | ProjectEnvironmentService tests, Devpilot docs, type checks/builds. | Updated Devpilot progress/roadmap docs; verified with targeted/full API Jest, API/web type checks, API/web builds, Prisma validate, `git diff --check`, and conflict-marker scan. API/Web lint remain blocked by existing ESLint configuration gaps. |

### F59. Environment Server Binding Confirmation

Purpose: Let operators explicitly bind existing team servers into a project environment as deploy/runtime/database/edge capacity, making server ownership visible before Docker, site, deployment, and log operations depend on it.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F59.1 | done | Add audit coverage to server bind/unbind operations. | `project-environment` service/controller tests only; no schema migration. | `bindServer`/`unbindServer` now write `project_environment.server.bind` and `project_environment.server.unbind` audit events with project/environment/server/role metadata. |
| F59.2 | done | Add project-detail server selection and role confirmation controls. | Project detail page plus existing `/servers` and `/project-environments/:id/servers` APIs. | Environment workspace now lists current server bindings, supports unbind confirmation, and lets operators select a readable team server plus deploy/runtime/database/edge/mixed role before binding. |
| F59.3 | done | Update product docs and route next milestones. | Devpilot docs only. | Devpilot progress and roadmap docs now mark server binding confirmation as available and route next work to cross-environment copy APIs/RBAC. |
| F59.4 | done | Run targeted and regression verification. | ProjectEnvironmentService tests, type checks, builds, Prisma validate. | Verified with targeted/full API Jest, API/web type checks, API/web builds, Prisma validate, `git diff --check`, and conflict-marker scan. API/Web lint remain blocked by existing ESLint configuration gaps. |

### F60. Cross-Environment Site Copy Plan

Purpose: Let operators copy Site configuration skeletons from one environment into another with a dry-run/apply contract, while keeping real server/proxy bindings and certificate assets manual.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F60.1 | done | Add a safe dry-run/apply API for copying Site skeletons between project environments. | `project-environment` DTO/service/controller only; no schema migration. | Added `POST /project-environments/sites/copy` with source read and target write policy gates, target confirmation for non-dry-run, explicit target domain requirement, and audit output. |
| F60.2 | done | Sanitize copied Site data. | Site records only. | Apply creates draft Site skeletons only; it does not copy `serverId`, `proxyConfigId`, Nginx sync state, certificate observation assets, renewal state, or real TLS certificate content. |
| F60.3 | done | Add regression coverage and docs. | ProjectEnvironmentService tests and Devpilot docs. | Added coverage for missing target-domain skip behavior and sanitized draft Site creation; product docs now mark cross-environment Site copy API as available. |
| F60.4 | done | Run targeted and regression verification. | API tests/type checks/builds and web checks if touched. | Verified with targeted/full API Jest, API/web type checks, API/web builds, Prisma validate, `git diff --check`, and conflict-marker scan. API/Web lint remain blocked by existing ESLint configuration gaps. |

### F61. Cross-Environment Site Copy Frontend

Purpose: Let operators use the safe Site copy API from the project environment workspace by choosing a source environment, entering explicit target domains, previewing the copy plan, and confirming draft Site creation.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F61.1 | done | Add project-detail state and request handling for Site copy dry-run/apply. | Project detail page only; reuse existing `/project-environments/sites/copy` API. | Project detail now stores source environment, per-site target domain overrides, recent copy results, and calls `/project-environments/sites/copy` with explicit `siteIds`, `targetDomainOverrides`, dry-run/apply mode, and target confirmation. |
| F61.2 | done | Add an environment workspace panel for source environment selection, per-site target domains, duplicate warnings, and recent results. | Project detail page UI only. | Environment workspace now lets operators pick a source environment, enter target domains per source Site, see duplicate target-domain warnings, preview the copy plan, create draft Sites, and review recent step results. |
| F61.3 | done | Update product docs and run verification. | Devpilot docs plus Web/API checks. | Updated Devpilot progress/roadmap docs; verified with Web type-check/build, API type-check, targeted ProjectEnvironmentService Jest, `git diff --check`, and conflict-marker scan. API lint remains blocked by missing ESLint config; Web lint remains blocked by deprecated interactive `next lint` setup. |

### F62. Cross-Environment CDN Config Copy Plan

Purpose: Let operators prepare CDN config skeletons for another project environment through an explicit dry-run/apply API while avoiding hidden cloud credential reuse or provider-side changes.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F62.1 | done | Add a safe dry-run/apply API for copying CDN config skeletons between project environments. | `project-environment` DTO/service/controller only; no schema migration. | Added `POST /project-environments/cdn-configs/copy` with source read and target write policy gates, target confirmation for non-dry-run, dry-run/apply result steps, and audit output. |
| F62.2 | done | Require explicit target domain, origin, and credential mapping before apply. | CDNConfig records only; no provider API calls or credential value reads. | Copy skips configs without explicit target domain, target origin, or target credentialId; apply creates pending CDNConfig skeletons only and does not copy `providerData` or `syncError` or read credential values. |
| F62.3 | done | Add regression coverage, docs, and verification. | ProjectEnvironmentService tests and Devpilot docs. | Added ProjectEnvironmentService tests for missing target mapping skip behavior and pending skeleton creation; updated Devpilot progress/roadmap docs; verified with targeted/full API Jest, API type-check/build, Web type-check/build, Prisma validate, `git diff --check`, and conflict-marker scan. API/Web lint remain blocked by existing ESLint configuration gaps. |

### F63. Cross-Environment CDN Config Copy Frontend

Purpose: Let operators use the safe CDN config copy API from the project environment workspace by selecting a source environment, entering target domains/origins, choosing target CDN credentials, previewing the plan, and confirming pending CDNConfig creation.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F63.1 | done | Load readable team credentials and add project-detail state/request handling for CDN copy dry-run/apply. | Project detail page only; reuse `/team-credentials` and `/project-environments/cdn-configs/copy`. | Project detail now loads readable team credentials, stores source environment, per-CDN target domain/origin/credential mappings, recent copy results, and calls `/project-environments/cdn-configs/copy` with explicit mappings and target confirmation. |
| F63.2 | done | Add an environment workspace panel for source environment selection, per-CDN target domain/origin/credential input, duplicate warnings, and recent results. | Project detail page UI only. | Environment workspace now lets operators pick a source environment, enter target domains/origins per source CDNConfig, choose compatible CDN credentials, see duplicate target-domain warnings, preview the copy plan, create pending CDN configs, and review recent step results. |
| F63.3 | done | Update product docs and run verification. | Devpilot docs plus Web/API checks. | Updated Devpilot progress/roadmap docs; verified with Web type-check/build, API type-check, targeted ProjectEnvironmentService Jest, `git diff --check`, and conflict-marker scan. API lint remains blocked by missing ESLint config; Web lint remains blocked by deprecated interactive `next lint` setup. |

### F64. Cross-Environment Resource And Secret Copy Plan

Purpose: Let operators prepare ManagedResource and SecretKey skeletons for another project environment through an explicit dry-run/apply API while avoiding hidden external-resource reuse, credential reuse, or secret-value reads.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F64.1 | done | Add a safe dry-run/apply API for copying ManagedResource and SecretKey skeletons between project environments. | `project-environment` DTO/service/controller only; no schema migration. | Added `POST /project-environments/resources/copy` with source read and target write policy gates, target confirmation for non-dry-run, dry-run/apply result steps, and audit output. |
| F64.2 | done | Require explicit target mappings before apply. | ManagedResource and SecretKey records only; no provider calls and no source secret reads. | ManagedResource copy requires explicit target `externalId` and optional target server/credential validation; apply creates `unknown` skeletons without `metadata`, `config`, `syncError`, `lastSyncAt`, or `resourceInstanceId`. SecretKey copy requires an explicit new target value, encrypts only that value, does not select the source value, and keeps secret values out of audit metadata. |
| F64.3 | done | Add regression coverage, docs, and verification. | ProjectEnvironmentService tests and Devpilot docs. | Added ProjectEnvironmentService tests for missing mapping skip behavior and safe skeleton creation with encrypted explicit target values; updated Devpilot progress/roadmap docs; verified targeted ProjectEnvironmentService Jest, full API Jest, API type-check/build, `git diff --check`, and conflict-marker scan. API lint remains blocked by the existing missing ESLint config. |

### F65. Cross-Environment Resource And Secret Copy Frontend

Purpose: Let operators use the safe resource/secret copy API from the project environment workspace by selecting a source environment, entering explicit target resource identifiers and new secret values, previewing the plan, and confirming skeleton creation.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F65.1 | done | Add project-detail state/request handling for resource and secret copy dry-run/apply. | Project detail page only; reuse `/project-environments/resources/copy`, existing servers, and team credentials already loaded by the page. | Project detail stores source environment, per-resource target externalId/name/endpoint/server/credential mappings, per-secret target name/value/description mappings, running state, recent results, and calls `/project-environments/resources/copy` for dry-run/apply. |
| F65.2 | done | Add an environment workspace panel for source environment selection, per-resource target externalId/server/credential/endpoint inputs, per-secret target name/value inputs, duplicate warnings, and recent results. | Project detail page UI only. | Environment workspace now lets operators pick a source environment, fill ManagedResource and SecretKey target mappings, see target duplicate warnings, preview copy plans, create resource/secret skeletons, and review recent step results. |
| F65.3 | done | Update product docs and run verification. | Devpilot docs plus Web/API checks. | Updated Devpilot progress/roadmap docs; verified Web type-check/build. |

### F66. Resource Copy Post-Copy Takeover Entry

Purpose: Let operators move from a copied ManagedResource skeleton into the existing resource-control takeover workflow immediately, with a focused resource detail view and safe connection-probe planning.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F66.1 | done | Support `resourceId` deep-link focus in the resource-control page. | Resource-control page only; no API/schema changes. | Resource-control now reads `resourceId` from URL params and opens the matching resource detail drawer after resources load. |
| F66.2 | done | Add post-copy takeover actions to project-detail resource copy results. | Project detail page only; use existing `/resource-control/resources/:id/connection-probe` dry-run API and resource-control links. | Applied ManagedResource copy result steps now show `查看/接管` deep links and `连接探测计划` buttons that call the existing dry-run connection-probe API; SecretKey steps do not expose probe actions. |
| F66.3 | done | Update product docs and run verification. | Devpilot docs plus Web/API checks. | Updated Devpilot progress/roadmap docs; verified Web type-check/build, `git diff --check`, and conflict-marker scan. Web lint remains blocked by the existing interactive Next lint setup. |

### F67. Site Copy Post-Copy Takeover Entry

Purpose: Let operators move from a copied draft Site into the existing site-control workflow immediately, with a focused site detail view and safe Nginx/TLS planning actions.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F67.1 | done | Support `siteId` deep-link focus in the sites page. | Sites page only; no API/schema changes. | `/sites` now reads `siteId`, highlights the matching Site, and shows a focused takeover panel with safe Nginx/OpenResty and TLS dry-run plan actions. |
| F67.2 | done | Add post-copy takeover actions to project-detail Site copy results. | Project detail page only; use existing `/sites/:id/sync-plan` and `/sites/:id/tls-probe` dry-run APIs and site-control links. | Applied Site copy steps now show `查看/接管`, `Nginx/OpenResty 计划`, and `TLS 探测计划` actions using existing dry-run Site APIs. |
| F67.3 | done | Update product docs and run verification. | Devpilot docs plus Web checks. | Updated Devpilot progress/roadmap docs; verified Web type-check/build, `git diff --check`, and conflict-marker scan. Web lint remains blocked by the existing interactive Next lint setup. |

### F68. Site Takeover Binding Form

Purpose: Let operators turn a copied draft Site into a server-bound, TLS-aware Site configuration before live Nginx/OpenResty operations, without touching remote servers.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F68.1 | done | Add server and TLS asset binding state to the focused Site takeover panel. | Sites page only; reuse existing `/sites/:id` update API. | Focused Site takeover panel now exposes server selection, TLS enable/type/email/certName fields, and observed certificate asset selection from `Site.tls.assets`. |
| F68.2 | done | Persist takeover bindings through existing Site update flow. | No schema/API changes; write only Site `serverId` and `tls` metadata. | `保存绑定` calls `PUT /sites/:id` with `serverId`, merged TLS metadata, and preserved Site status; it does not execute Nginx, TLS issuance, or remote commands. |
| F68.3 | done | Update product docs and run verification. | Devpilot docs plus Web checks. | Updated Devpilot progress/roadmap docs; verified Web type-check/build, `git diff --check`, and conflict-marker scan. Web lint remains blocked by the existing interactive Next lint setup. |

### F69. Site Smoke Check

Purpose: Let operators verify a server-bound Site's reachable runtime state through low-risk Server executor checks before or after live Nginx/OpenResty sync.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F69.1 | done | Add a low-risk Site smoke-check operation. | Site API/service and Server command policy only; no schema migration. | Added `POST /sites/:id/smoke-check`, `site.smoke_check` SiteSyncRun mode, low-risk Server executor plan for public-domain curl, local Nginx Host curl, and upstream curl, plus bounded command-policy allowlist and regression coverage. |
| F69.2 | done | Surface smoke checks in the sites UI. | Sites page only; reuse SiteSyncRun history and existing plan display. | Sites page now exposes `Smoke 检查` / `Smoke 入队` actions in both the focused takeover panel and site rows, reusing existing SiteSyncRun history and plan display. |
| F69.3 | done | Update product docs and run verification. | Devpilot docs plus API/Web checks. | Updated Devpilot progress/roadmap docs; verified API/Web type-check, API/Web build, targeted SiteService and command-policy Jest, full API Jest, `git diff --check`, and conflict-marker scan. API lint remains blocked by missing ESLint config; Web lint remains blocked by the existing interactive Next lint setup. |

### F70. Site Smoke Check Failure Alert

Purpose: Turn manual or queued Site smoke checks into actionable monitoring signals so failed public-domain, local Nginx Host, or upstream checks can trigger the existing alert, silence, notification, audit, and escalation chain.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F70.1 | done | Add `site_smoke_check_failure` evaluation over recent `SiteSyncRun mode=smoke_check` records. | Monitoring service only; no schema migration. | Monitoring now evaluates recent non-dry-run `SiteSyncRun mode=smoke_check` records, counts failed terminal runs against `windowRuns/failureThreshold`, and emits standard AlertEvent values for firing/resolved/insufficient-data paths. |
| F70.2 | done | Surface Site smoke-check failure rules in the monitoring UI. | `/monitoring` page only; reuse existing site target selector. | Monitoring rule creation now has a `Smoke 检查` target type that creates `metric=site_smoke_check_failure`, exposes recent-run and failure-threshold controls, and formats rule/event targets with Smoke context. |
| F70.3 | done | Update product docs and run verification. | Devpilot docs plus API/Web checks. | Updated Devpilot progress/roadmap docs; verified targeted MonitoringService Jest, full API Jest, API/Web type-check, API/Web build, `/sites` and `/monitoring` 200 checks, current dev bundle content, `git diff --check`, and conflict-marker scan. API lint remains blocked by missing ESLint config; Web lint remains blocked by the existing interactive Next lint setup. |

### F71. OpenResty Runtime Status Probe

Purpose: Move Site from config-centric control toward runtime governance by letting operators inspect Nginx/OpenResty process/config status through safe read-only Server executor commands.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F71.1 | done | Add a low-risk `site.openresty_status` operation and fixed command policy rules. | Site API/service and Server command policy only; no schema migration. | Added `POST /sites/:id/openresty-status`, `site.openresty_status` SiteSyncRun mode, safe read-only Nginx/OpenResty config/version/service/process commands, fixed command-policy allowlist, and SiteService / command-policy regression coverage. |
| F71.2 | done | Surface OpenResty status probes in the Sites UI. | Sites page only; reuse SiteSyncRun history and plan display. | Sites page now exposes `运行态探测` / `运行态入队` in the focused takeover panel and `OpenResty 状态` / `状态入队` in site rows, with `openresty_status` run labels in SiteSyncRun history. |
| F71.3 | done | Update product docs and run verification. | Devpilot docs plus API/Web checks. | Updated Devpilot progress/roadmap docs; verified targeted SiteService and command-policy Jest, full API Jest, API/Web type-check, API/Web build, `/sites` 200 check, current dev bundle content, `git diff --check`, targeted trailing-whitespace scan, and conflict-marker scan. API lint remains blocked by missing ESLint config; Web lint remains blocked by the existing interactive Next lint setup. |

### F72. OpenResty Module Inventory

Purpose: Extend Site runtime governance from status probing to module capability inventory so operators can see whether an Nginx/OpenResty runtime has the compiled and dynamic modules expected by a Site.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F72.1 | done | Add a low-risk `site.openresty_modules` operation and fixed read-only module command policy rules. | Site API/service and Server command policy only; no schema migration. | Added `POST /sites/:id/openresty-modules`, `site.openresty_modules` SiteSyncRun mode, safe read-only Nginx/OpenResty compile-argument and dynamic module file inventory commands, fixed command-policy allowlist, and SiteService / command-policy regression coverage. |
| F72.2 | done | Surface OpenResty module inventory in the Sites UI. | Sites page only; reuse SiteSyncRun history and plan display. | Sites page now exposes `模块盘点` / `模块入队` in the focused takeover panel and `OpenResty 模块` / `模块入队` in site rows, with `openresty_modules` run labels in SiteSyncRun history. |
| F72.3 | done | Update product docs and run verification. | Devpilot docs plus API/Web checks. | Updated Devpilot progress/roadmap docs; verified targeted SiteService and command-policy Jest, full API Jest, API/Web type-check, API/Web build, `/sites` 200 check, current dev bundle content, `git diff --check`, targeted trailing-whitespace scan, and conflict-marker scan. API lint remains blocked by missing ESLint config; Web lint remains blocked by the existing interactive Next lint setup. |

### F73. OpenResty Module Baseline Check

Purpose: Turn module inventory into a low-risk runtime capability check so operators can quickly see whether a Site's Nginx/OpenResty runtime has common required capabilities for TLS, HTTP/2, proxy IP handling, status visibility, stream forwarding, and Lua/OpenResty workloads.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F73.1 | done | Add a low-risk `site.openresty_module_baseline` operation and fixed read-only baseline command policy rules. | Site API/service and Server command policy only; no schema migration and no user-provided shell snippets. | Added `POST /sites/:id/openresty-module-baseline`, `site.openresty_module_baseline` SiteSyncRun mode, fixed baseline checks for TLS, HTTP/2/3, realip, stub_status, stream, and Lua/OpenResty capabilities, bounded command-policy allowlist, and SiteService / command-policy regression coverage. |
| F73.2 | done | Surface OpenResty module baseline checks in the Sites UI. | Sites page only; reuse SiteSyncRun history and plan display. | Sites page now exposes `基线检查` / `基线入队` in the focused takeover panel and `模块基线` / `基线入队` in site rows, with `openresty_module_baseline` run labels in SiteSyncRun history. |
| F73.3 | done | Update product docs and run verification. | Devpilot docs plus API/Web checks. | Updated Devpilot progress/roadmap docs; verified targeted SiteService and command-policy Jest, full API Jest, API/Web type-check, API/Web build, `/sites` 200 check, current dev bundle content, `git diff --check`, targeted trailing-whitespace scan, and conflict-marker scan. API lint remains blocked by missing ESLint config; Web lint remains blocked by the existing interactive Next lint setup. |

### F74. Failed Deployment Retry

Purpose: Let operators recover from failed deployment runs without recreating project deployment inputs, while preserving the failed run, webhook delivery, audit, approval, and executor boundaries.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F74.1 | done | Add a controlled retry endpoint for failed deploy runs. | Deployment API/service only; reuse `createRun` so approval, queue, and Server executor behavior stay centralized. | Added `POST /deployments/runs/:runId/retry`; failed deploy runs can create a new deploy run with original project/environment/application/service/server/ref and command overrides, `manual_retry` trigger, retry-source metadata, approval/queue reuse, and guards for non-failed runs and dry-run-to-live escalation. |
| F74.2 | done | Surface retry controls in the project deployment run list. | Project detail page only; no new schema. | Failed deploy rows now show `生成重试计划` / `重试 dry-run 入队`; failed live deploy rows also show `申请 Live 重试`. |
| F74.3 | done | Update product docs and run verification. | Devpilot docs plus API/Web checks. | Updated Devpilot progress/roadmap docs; verified targeted deployment controller/service Jest, full API Jest, Prisma CLI validate, API/Web type-check, API/Web build, `/projects` and `/projects/devpilot-preview-check` 200 checks, dev bundle content, `git diff --check`, and conflict-marker scan. API lint remains blocked by missing ESLint config; Web lint remains blocked by interactive Next lint setup. |

### F75. Deployment Smoke Check

Purpose: Let operators verify a completed DeploymentRun independently after deploy, retry, or rollback, so deployment health can become a first-class signal for later alerts and automatic rollback.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F75.1 | done | Add a low-risk deployment smoke-check endpoint. | Deployment API/service and existing Server executor curl allowlist only; no schema migration. | Added `POST /deployments/runs/:runId/smoke-check`; completed deploy/rollback runs with a healthCheckUrl can create `DeploymentRun mode=smoke_check`, reuse Server executor inline/queue execution, write retryable job linkage, and audit `deployment.smoke_check` / `deployment.smoke_check.queue`. |
| F75.2 | done | Surface deployment smoke-check controls in the project deployment run list. | Project detail page only; reuse DeploymentRun history and queued job link. | Completed deploy/rollback rows with healthCheckUrl now expose `Smoke 计划` / `Smoke 入队` and low-risk `执行 Smoke` / `Live Smoke 入队`; smoke runs show `Smoke` mode and source-run context. |
| F75.3 | done | Update product docs and run verification. | Devpilot docs plus API/Web checks. | Updated Devpilot progress/roadmap docs; verified targeted deployment/controller/policy Jest, full API Jest, Prisma CLI validate, API/Web type-check, API/Web build, `/projects` and `/projects/devpilot-preview-check` 200 checks, current dev bundle content, `git diff --check`, and conflict-marker scan. API lint remains blocked by missing ESLint config; Web lint remains blocked by interactive Next lint setup. |

### F76. Deployment Smoke Check Failure Alert

Purpose: Turn post-deploy `DeploymentRun mode=smoke_check` records into actionable monitoring signals so failed deployment health checks can enter the same alert, silence, notification, audit, and escalation chain as Site smoke failures.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F76.1 | done | Add `deployment_smoke_check_failure` evaluation over recent `DeploymentRun mode=smoke_check` records. | Monitoring service only; no schema migration. | Monitoring now evaluates recent non-dry-run `DeploymentRun mode=smoke_check` records, counts failed terminal runs against `windowRuns/failureThreshold`, serializes source run/job/health-check context, and targeted MonitoringService Jest passes. |
| F76.2 | done | Surface Deployment smoke-check failure rules in the monitoring UI. | `/monitoring` page only; reuse project target selector and Smoke window controls. | Monitoring rule creation now has a `部署 Smoke` target type that creates `metric=deployment_smoke_check_failure`, reuses recent-run/failure-threshold controls, and formats rule/event targets with Deployment Smoke context. |
| F76.3 | done | Update product docs and run verification. | Devpilot docs plus API/Web checks. | Updated Devpilot progress/roadmap docs; verified targeted MonitoringService Jest, full API Jest, Prisma validate, API/Web type-check, API/Web build, `/monitoring` 200 check, build/dev bundle content, `git diff --check`, and conflict-marker scan. API lint remains blocked by missing ESLint config; Web lint remains blocked by interactive Next lint setup. |

### F77. Deployment Smoke Failure Rollback

Purpose: Let operators respond to a failed live Deployment Smoke check by generating a controlled rollback to the previous successful live deploy, while keeping live rollback behind existing approval and Server executor boundaries.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F77.1 | done | Add a protected smoke-failure rollback endpoint that targets the previous successful live deploy, not the failed Smoke source version. | Deployment API/service only; reuse existing rollback approval and executor path. | Added `POST /deployments/runs/:runId/smoke-failure-rollback`; failed Smoke runs choose the previous successful live deploy before the Smoke source run, live rollback remains high-risk and approval-gated through existing `rollbackRun`, and deployment service/controller Jest passes. |
| F77.2 | done | Surface failed Smoke rollback controls in the project deployment run list. | Project detail page only; no new schema. | Failed live Smoke rows now expose `生成 Smoke 回滚计划` / queued dry-run controls and `申请 Smoke 失败回滚`, calling the protected smoke-failure rollback endpoint. |
| F77.3 | done | Update product docs and run verification. | Devpilot docs plus API/Web checks. | Updated Devpilot progress/roadmap docs; verified targeted DeploymentService/DeploymentController Jest, full API Jest, Prisma validate, API/Web type-check, API/Web build, local `/projects` and project detail 200 checks, source content checks, `git diff --check`, and conflict-marker scan. API lint remains blocked by missing ESLint config; Web lint remains blocked by interactive Next lint setup. |

### F78. Deployment Smoke Failure Auto Rollback Policy

Purpose: Let teams opt in to unattended post-Smoke recovery without bypassing approval or Server executor boundaries: a failed live Smoke run can automatically create a dry-run/queued rollback plan, while live rollback remains an approval-protected request.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F78.1 | done | Add a default-off auto rollback policy path for failed live Deployment Smoke checks. | Deployment API/service and scheduler only; no schema migration; reuse `DeploymentRun.params` for policy/idempotency metadata. | Smoke DTO accepts auto rollback options, failed live Smoke runs store `params.autoRollback`, synchronous failures and the default-off `DeploymentAutoRollbackSchedulerService` can idempotently create a rollback plan/approval request through existing `requestSmokeFailureRollback`; targeted service/scheduler Jest and API type-check pass. |
| F78.2 | done | Surface an explicit project-page opt-in for automatic failed-Smoke rollback plans. | Project detail deployment controls only. | Project detail deployment panel now has `Live Smoke 失败后自动生成回滚计划`; only Live Smoke requests send the auto rollback policy and the deployment list refreshes after the request so generated rollback runs can appear. |
| F78.3 | done | Update product docs and run verification. | Devpilot docs plus API/Web checks. | Product progress/roadmap docs updated; verified targeted DeploymentService and DeploymentAutoRollbackScheduler Jest, full API Jest, Prisma validate, API/Web type-check, API/Web build, local `/projects` and project detail 200 checks, build/source content checks, `git diff --check`, and conflict-marker scan. API lint remains blocked by missing ESLint config; Web lint remains blocked by interactive Next lint setup. |

### F79. Deployment Post-Rollback Smoke Check

Purpose: Let teams verify that a completed live rollback actually restored service health by automatically creating a low-risk Smoke check through the existing DeploymentRun and Server executor path.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F79.1 | done | Add an opt-in post-rollback Smoke policy and idempotent scheduler path. | Deployment API/service and scheduler only; no schema migration; reuse `DeploymentRun.params` for policy metadata. | Rollback DTO accepts post-rollback Smoke options, live rollback runs store `params.postRollbackSmokeCheck`, synchronous completed live rollbacks and the default-off `DeploymentPostRollbackSmokeSchedulerService` can idempotently create queued/dry-run Smoke checks through existing `smokeCheckRun`; targeted service/scheduler Jest and API type-check pass. |
| F79.2 | done | Surface an explicit project-page toggle for live rollback post-Smoke. | Project detail deployment controls only. | Project detail deployment panel now has `Live 回滚完成后自动 Smoke`; live rollback, failure rollback, and live Smoke-failure rollback requests can opt into post-rollback Smoke generation. |
| F79.3 | done | Update product docs and run verification. | Devpilot docs plus API/Web checks. | Product progress/roadmap docs updated; verified targeted DeploymentService and DeploymentPostRollbackSmokeScheduler Jest, full API Jest, Prisma validate, API/Web type-check, API/Web build, local `/projects` and project detail 200 checks after restarting stale Next dev server, source/build content checks, `git diff --check`, and conflict-marker scan. API lint remains blocked by missing ESLint config; Web lint remains blocked by interactive Next lint setup. |

### F80. PR Preview Webhook Deployment Runs

Purpose: Let pull request / merge request events create safe preview deployment runs with PR metadata, so Devpilot starts covering PR Preview without introducing live temporary infrastructure yet.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F80.1 | done | Add a `preview` webhook deployment mode that accepts PR/MR events and creates dry-run queued DeploymentRun records with preview metadata. | ProjectWebhook service/DTO and DeploymentRun params only; no schema migration and no live deploy. | ProjectWebhook DTO accepts `deploymentMode=preview`; GitHub pull_request and GitLab merge_request events normalize to preview triggers, use source branch/head SHA, ignore closed actions, and create dry-run queued DeploymentRun records with `params.preview` metadata; targeted ProjectWebhookService Jest and API type-check pass. |
| F80.2 | done | Surface PR Preview webhook creation in the project detail Git Webhook panel. | Project detail page only. | Project detail Git Webhook panel now has a Push/PR Preview type selector; PR Preview creates `eventTypes=['pull_request','merge_request']`, `branchPattern='*'`, `deploymentMode='preview'`, and webhook rows show event type labels. |
| F80.3 | done | Update product docs and run verification. | Devpilot docs plus API/Web checks. | Product progress/roadmap docs updated; verified targeted ProjectWebhookService Jest, full API Jest, Prisma validate, API/Web type-check, API/Web build, local `/projects` and project detail 200 checks, source/build content checks, `git diff --check`, tab scan, and conflict-marker scan. API lint remains blocked by missing ESLint config; Web lint remains blocked by interactive Next lint setup. |

### F81. PR Preview Environment Skeleton

Purpose: Move PR Preview from a deployment-run-only record toward real temporary environments by creating or reusing a stable preview `ProjectEnvironment` for each PR/MR and binding preview DeploymentRun records to it.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F81.1 | done | Add preview environment provisioning to `ProjectWebhookService` for accepted PR/MR events. | Webhook service only; reuse `ProjectEnvironment` and avoid schema migration/live infrastructure. | `deploymentMode=preview` now creates or reuses a stable preview environment key such as `preview-pr-42` / `preview-mr-17` before creating the DeploymentRun. |
| F81.2 | done | Store lifecycle-safe preview metadata on both the environment config and DeploymentRun params. | `ProjectEnvironment.config` and DeploymentRun `params.preview` only; no secret values. | Preview environment config stores lifecycle/source/webhook/provider/PR branch metadata and `lastSeenAt`; DeploymentRun `params.preview` stores the preview environment id/key/name and base environment id. |
| F81.3 | done | Add regression coverage for GitHub and GitLab preview environment creation/reuse. | `project-webhook.service.spec.ts` only. | Added coverage for GitHub PR preview environment creation, ignored closed PR without provisioning, GitLab MR preview environment creation, and repeated PR event environment reuse/update. |
| F81.4 | done | Update product docs and run targeted verification. | Devpilot docs plus API checks tied to webhook/environment behavior. | Updated Devpilot progress/roadmap docs; verified targeted ProjectWebhookService Jest, full API Jest, Prisma validate, API type-check, API build, `git diff --check`, and conflict-marker scan. API lint remains blocked by missing ESLint config. |

### F82. PR Preview Environment Archive On Close

Purpose: Close the first preview environment lifecycle loop by archiving the preview `ProjectEnvironment` when a PR/MR is closed or merged, without deleting real infrastructure until a later guarded teardown executor exists.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F82.1 | done | Split preview webhook action handling into deploy, archive, and ignore outcomes. | `ProjectWebhookService` event handling only. | Preview webhook handling now resolves `deploy`, `archive`, or `ignore` dispositions before creating delivery side effects. |
| F82.2 | done | Archive existing preview environments on close/merge events without creating DeploymentRun records. | `ProjectEnvironment.status/config` only; no server, site, container, or cloud mutation. | GitHub `closed` PR and GitLab merged MR events update the matching preview `ProjectEnvironment` to `status=archived`, set `config.preview.status=archived`, and record `teardown.status=not_started` without creating DeploymentRun records. |
| F82.3 | done | Add regression coverage for GitHub closed PR and GitLab merged MR behavior. | `project-webhook.service.spec.ts` only. | Added targeted tests proving closed/merged events archive preview environments and do not call `DeploymentService.createRun()`. |
| F82.4 | done | Update product docs and run API verification. | Devpilot docs plus API checks tied to webhook lifecycle behavior. | Updated Devpilot progress/roadmap docs; verified targeted ProjectWebhookService Jest, full API Jest, Prisma validate, API type-check, API build, `git diff --check`, and conflict-marker scan. API lint remains blocked by missing ESLint config. |

### F83. PR Preview Draft Site Placeholder

Purpose: Connect PR Preview environments to the Site control model by creating a draft placeholder Site for accepted PR/MR preview deployments, making later temporary domain, TLS, Nginx/OpenResty, and teardown work attach to a first-class Site object.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F83.1 | done | Create or reuse a draft preview Site after preview environment provisioning when the webhook has a creator. | `ProjectWebhookService` and `Site` records only; no DNS, TLS, Nginx, or server mutation. | Accepted PR/MR preview webhooks now create or reuse a `draft` Site with deterministic `preview-pr-*` / `preview-mr-*` domain and no live infrastructure mutation. |
| F83.2 | done | Store placeholder Site metadata on both Site runtime config and preview environment config. | `Site.runtimeConfig` and `ProjectEnvironment.config.preview.site` only. | `Site.runtimeConfig.preview` stores placeholder status, provider/event/env metadata and sync block reason; `ProjectEnvironment.config.preview.site` stores the Site id/name/domain/status. |
| F83.3 | done | Add a Site sync warning for placeholder Sites so live sync is blocked until operators configure a real runtime/domain. | `SiteService.collectWarnings()` only. | `SiteService.collectWarnings()` adds `runtimeConfig.syncBlockedReason` when `syncBlocked=true`; SiteService regression covers preview placeholder warning propagation to Server executor. |
| F83.4 | done | Add regression coverage, update product docs, and run API verification. | ProjectWebhook/Site tests, Devpilot docs, and API checks. | Added ProjectWebhookService and SiteService regressions, updated Devpilot progress/roadmap docs, and verified targeted Jest, full API Jest (29 suites / 220 tests), Prisma validate, API type-check, API build, tracked-file `git diff --check`, targeted trailing-whitespace scan, and conflict-marker scan. API lint remains blocked by missing ESLint config. |

### F84. PR Preview Site Takeover Readiness

Purpose: Let operators turn a webhook-created draft preview Site into a sync-ready Site by explicitly binding a server and upstream runtime, clearing the placeholder sync block, and generating a safe dry-run Nginx/OpenResty plan without touching live infrastructure.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F84.1 | done | Add a preview Site takeover API that only accepts draft preview placeholders, requires a target server and safe upstream URL, and clears the placeholder sync block. | `SiteController`, `SiteService`, and Site DTO only; no schema migration or live execution. | Added `POST /sites/:id/preview-takeover`; it rejects non-preview or archived placeholders, validates target server and safe upstream URL, clears `syncBlocked`, marks Site `pending`, and can generate a dry-run sync plan. |
| F84.2 | done | Surface preview takeover fields and action in the focused Sites page panel. | `/sites` page only, reusing existing sync-plan display. | Focused Site panel now detects PR Preview placeholders, asks for target server/upstream/WebSocket, and calls preview takeover to show the resulting dry-run plan. |
| F84.3 | done | Add regression coverage and update product docs. | Site tests and Devpilot docs. | Added SiteService tests for successful preview takeover and non-preview rejection; updated Devpilot progress/roadmap docs with preview Site takeover readiness. |
| F84.4 | done | Run API/Web verification and static scans. | API/Web checks tied to Site takeover behavior. | Verified targeted SiteService Jest, full API Jest (29 suites / 222 tests), Prisma validate, API/Web type-check, API/Web build, tracked-file `git diff --check`, targeted trailing-whitespace scan, and conflict-marker scan. API lint remains blocked by missing ESLint config. |

## Open Decisions

- Decide whether server execution should use SSH command allowlists, a lightweight agent, or Docker remote API per server.
- Decide whether cloud credentials live only in `TeamCredential` or need provider-specific typed credential records.
- Decide which operations require approval: container restart, destructive deletion, Redis flush, DB restore, bucket policy edits, and log-retention changes.
- Decide how to handle multi-region cloud scans and cross-team quota visibility.
- Current decision: first executable architecture uses Server executor, not Agent; Server agent should be a later executor adapter that implements the same contract.
- Current decision: first action runs are controlled script plans and dry runs, not arbitrary SSH command execution.

## Change Log

- 2026-06-24 00:00: Added first control-plane plan and marked inventory-only MVP boundaries.
- 2026-06-24 00:00: Implemented unified inventory, sync-run tracking, server/cloud sync APIs, resource-control UI, and verification.
- 2026-06-24 00:00: Started action execution architecture for Credential/Auth and Executor adapters without introducing an agent.
- 2026-06-24 00:00: Implemented action registry, credential resolver, executor adapters, action run API, and action UI dry-run flow.
- 2026-06-26 00:00: Extended control access policies to resource control, application/service, backup, log, and monitoring write interfaces.
- 2026-06-26 00:00: Extended control access policies to remaining historical write surfaces: server, CDN config, team credential, key center, legacy resource credential, resource request/instance, and team resource-pool allocation paths.
- 2026-06-26 00:00: Added first read/sensitive-read policy gates for key center and resource request/instance visibility.
- 2026-06-26 00:00: Completed the second read-visibility pass for resource control, logs, and monitoring state; split the remaining historical/infrastructure read paths into F8.7.
- 2026-06-26 00:00: Verified F8.6 with API/web type checks, API/web builds, `git diff --check`, and explicit whitespace scanning for touched files.
- 2026-06-26 00:00: Started F8.7 read-authorization pass for remaining historical and infrastructure surfaces.
- 2026-06-26 00:00: Completed F8.7 read-authorization pass for execution governance, audit logs, sites, CDN configs, servers, team credentials, and legacy resource credentials; added F8.8 for the final non-infrastructure read audit.
- 2026-06-26 00:00: Verified F8.7 with API/web type checks, API/web builds, `git diff --check`, and explicit whitespace scanning for touched files. The first parallel web type-check raced with Next build generated types, then passed when rerun after build.
- 2026-06-26 00:00: Started F8.8 final read-authorization audit for deployment, approval, application, backup, project environment, webhook, and remaining dashboard read surfaces.
- 2026-06-26 00:00: Completed F8.8 read-authorization audit for deployment, approval, application/service, backup, project environment, project webhook, project detail, and legacy proxy-config surfaces; added F8.9 for seeded authorization regression coverage.
- 2026-06-26 00:00: Verified F8.8 with API type-check, API build, web build, web type-check, `git diff --check`, and explicit whitespace scanning for touched files.
- 2026-06-26 00:00: Started F8.9 authorization regression coverage with service-level policy tests and a package-local Jest configuration.
- 2026-06-26 00:00: Completed F8.9 authorization regression coverage with service and controller specs; verified with API Jest, API type-check, and API build.
- 2026-06-26 00:00: Started F4.3 resource detail drawer and per-resource history UI on the resource-control page.
- 2026-06-26 00:00: Completed F4.3 resource detail drawer and per-resource history UI; verified with web type-check, web build, `git diff --check`, and explicit whitespace scanning. Web lint did not run because `next lint` opened the interactive ESLint migration prompt.
- 2026-06-26 00:00: Started F2.3 Server executor Docker inventory adapter; first scope is read-only Docker inventory parsing without introducing a server agent.
- 2026-06-26 00:00: Completed F2.3 Server executor Docker inventory adapter with Docker JSON-line parser, command-policy allowlist, parser unit tests, API type-check, API build, full API Jest, `git diff --check`, and explicit whitespace scanning.
- 2026-06-26 00:00: Started F1.3 scheduled sync and stale-resource marking with a default-off ResourceControl scheduler.
- 2026-06-26 00:00: Completed F1.3 scheduled sync and stale-resource marking; added scheduler unit tests and stale status UI copy, then verified with API Jest/type-check/build and web type-check/build.
- 2026-06-26 00:00: Started F3.3 cloud provider inventory adapter work; first scope is Aliyun/Tencent response-to-ManagedResource mapping and explicit SDK fallback metadata.
- 2026-06-26 00:00: Completed F3.3 cloud provider inventory adapters and response mapping tests for Aliyun RDS, Aliyun SLS, and Tencent COS; added F3.4 for live SDK transport wiring.
- 2026-06-26 00:00: Started F3.4 Tencent COS live SDK inventory transport, guarded by `RESOURCE_CONTROL_CLOUD_INVENTORY_LIVE_ENABLED`; split Aliyun RDS/SLS live SDK transport into F3.5.
- 2026-06-26 00:00: Completed F3.4 Tencent COS live SDK inventory transport; cloud sync now delegates to `CloudProviderInventoryService`, records live/fallback/sdk metadata per provider, and keeps Aliyun RDS/SLS live SDK transport as F3.5.
- 2026-06-26 00:00: Completed F3.5 Aliyun RDS/SLS live SDK inventory transport; cloud sync can now use `@alicloud/pop-core` for RDS and `@alicloud/sls20201230` for SLS when `RESOURCE_CONTROL_CLOUD_INVENTORY_LIVE_ENABLED=true`, while F3.6 tracks real-credential e2e and provider hardening.
- 2026-06-26 00:00: Completed F3.6 cloud inventory runtime hardening with provider SDK timeout, retry/backoff policy, Aliyun `inventoryRegions` cross-region batching, sync metadata requestPolicy, and provider inventory unit tests.
- 2026-06-26 00:00: Completed F3.7 cloud provider inventory diagnostics in the resource-control sync history; split real staging credentials, provider quota dashboards, and repeated provider-failure alerting into F3.8.
- 2026-06-26 00:00: Completed F3.8.a rule-based cloud provider sync failure alerting through Monitoring rules and events; F3.8.b/F3.8.c remain pending for real staging credentials and provider quota/rate-limit dashboards.
- 2026-06-26 00:00: Completed F3.8.c cloud provider health dashboard from sync metadata; F3.8.b/F3.8.d remain pending for real staging credentials and outbound notification hooks.
- 2026-06-26 00:00: Completed F3.8.d generic webhook notification hooks with dry-run planned deliveries by default, opt-in live POST, policy-gated channel management, delivery history, UI wiring, and MonitoringService webhook delivery tests; F3.8.b remains pending for real staging credentials.
- 2026-06-27 00:00: Completed F9.1 alert silence windows; matching events are marked `suppressed`, still audited and visible, and notification dispatch is skipped during maintenance windows.
- 2026-06-27 00:00: Completed F10 log collection ingestion; completed non-dry-run collection runs now parse/redact stdout, stderr, or executor logs into LogEntry records, and queued LogCollectionRun completion triggers the same ingestion path.
- 2026-06-27 00:00: Started F11 log stats and log alerting to connect LogEntry windows with standard AlertRule evaluation.
- 2026-06-27 00:00: Implemented F11 log stats API, log-count alert evaluation, and UI entry points; full verification is in progress.
- 2026-06-27 00:00: Completed F11 log stats and log alerting; verified with API/web type checks, full API Jest, Prisma validate, API/web builds, `git diff --check`, and explicit whitespace scanning.
- 2026-06-27 00:00: Started F12 log retention cleanup with audited dry-run/live cleanup runs.
- 2026-06-27 00:00: Implemented F12 log retention cleanup records, API, UI controls, and targeted service tests; full verification is in progress.
- 2026-06-27 00:00: Completed F12 log retention cleanup; verified with API/web type checks, full API Jest, Prisma validate, API/web builds, `git diff --check`, and explicit whitespace scanning.
- 2026-06-27 00:00: Started F13 scheduled log retention cleanup with default-off, dry-run-first automation.
- 2026-06-27 00:00: Implemented F13 scheduled log retention cleanup; scheduler is default-off, dry-run by default, bounded by batch size, and reuses audited retention cleanup runs.
- 2026-06-27 00:00: Completed F13 scheduled log retention cleanup; verified with API/web type checks, full API Jest, Prisma validate, API/web builds, `git diff --check`, and explicit whitespace scanning.
- 2026-06-27 00:00: Started F14 SLS query backfill plan to connect SLS log streams to concrete LogCollectionRun collection contracts.
- 2026-06-27 00:00: Completed F14 SLS query backfill plan; SLS log streams now produce GetLogs dry-run plans through the provider adapter boundary, expose sourceKey/query/window/limit controls in the log center, and keep live reads blocked until a credential-backed SDK adapter is implemented.
- 2026-06-27 00:00: Completed F15 configurable log redaction policy; collected and manually appended logs now share baseline secret masking plus per-stream extra key, email, and IP masking, with log-center UI controls and regression coverage.
- 2026-06-27 00:00: Completed F16 near real-time log tail; log streams now expose a policy-gated cursor tail API and the log center can manually refresh or auto-refresh selected stream logs without opening a server shell.
- 2026-06-27 00:00: Completed F17 Docker container metrics action; Docker container resources now expose a low-risk `docker.container.stats` action backed by a narrow Server executor command policy and resource-control UI entry.
- 2026-06-27 00:00: Started F18 Docker metrics snapshot persistence to turn `docker.container.stats` execution output into durable resource metric snapshots for health trends and future alerts.
- 2026-06-27 00:00: Implemented F18 Docker metrics snapshot persistence model, parser, direct/queued action completion ingestion, resource-control metric snapshot API, and UI display; full verification is in progress.
- 2026-06-27 00:00: Completed F18 Docker metrics snapshot persistence; verified with Prisma generate/validate, targeted Jest, full API Jest, API/web type checks, API/web builds, `git diff --check`, and whitespace scans.
- 2026-06-27 00:00: Started F19 scheduled Docker metrics and trend summary; scheduler remains default-off and will submit safe `docker.container.stats` collection through existing Server executor queue boundaries.
- 2026-06-27 00:00: Implemented F19 scheduled Docker metrics and trend summary; scheduler can queue safe Docker stats collection when explicitly enabled, and resource-control now exposes metric trend summaries by resource.
- 2026-06-27 00:00: Completed F19 scheduled Docker metrics and trend summary; verified with targeted Jest, full API Jest, API/web type checks, Prisma validate, API/web builds, `git diff --check`, and explicit whitespace scans.
- 2026-06-27 00:00: Started F20 resource metric threshold alerts to connect Docker metric snapshots with standard AlertRule evaluation and notification paths.
- 2026-06-27 00:00: Implemented F20 resource metric threshold alerts; resource rules can evaluate recent metric snapshots with latest/average/max aggregation and threshold comparisons.
- 2026-06-27 00:00: Completed F20 resource metric threshold alerts; verified with targeted MonitoringService Jest, full API Jest, API/web type checks, Prisma validate, API/web builds, `git diff --check`, and explicit whitespace scans.
- 2026-06-27 00:00: Started F21 scheduled alert rule evaluation; scheduler remains default-off and only evaluates rules explicitly set to `evaluationMode=schedule`.
- 2026-06-27 00:00: Implemented F21 scheduled alert rule evaluation; monitoring scheduler can evaluate due scheduled rules as system actor and the monitoring page can create scheduled rules.
- 2026-06-27 00:00: Completed F21 scheduled alert rule evaluation; verified with targeted scheduler/service Jest, full API Jest, API/web type checks, Prisma validate, API/web builds, `git diff --check`, and explicit whitespace scans.
- 2026-06-27 00:00: Started F22 site certificate expiry alerts to move Site/TLS lifecycle beyond Nginx config generation into scheduled monitoring.
- 2026-06-27 00:00: Implemented F22 site certificate expiry alerts; monitoring rules can evaluate common `Site.tls` certificate expiry metadata and `/monitoring` can create site certificate rules.
- 2026-06-27 00:00: Completed F22 site certificate expiry alerts; verified with targeted MonitoringService Jest, full API Jest, API/web type checks, Prisma validate, API/web builds, `git diff --check`, and explicit whitespace scans.
- 2026-06-27 00:00: Started F23 site TLS probe and metadata refresh; scope is Server executor OpenSSL probe, queued/direct metadata merge, site UI display, and regression coverage.
- 2026-06-27 00:00: Implemented F23 site TLS probe and metadata refresh; direct and queued Server executor paths can refresh `Site.tls`, and `/sites` exposes certificate probe plus expiry summary.
- 2026-06-27 00:00: Completed F23 site TLS probe and metadata refresh; verified with targeted and full API Jest, API/web type checks, Prisma validate, builds, diff checks, and whitespace scans; lint scripts are blocked by current ESLint configuration gaps.
- 2026-06-27 00:00: Started F24 scheduled site TLS probe to complete the probe-refresh-alert automation chain with a default-off scheduler.
- 2026-06-27 00:00: Implemented F24 scheduled site TLS probe; default-off scheduler queues due TLS probes as system actor through Server executor, skips non-TLS/recent sites, and avoids duplicate recent probe submissions.
- 2026-06-27 00:00: Completed F24 scheduled site TLS probe; verified with targeted and full API Jest, API/web type checks, Prisma validate, builds, diff checks, and whitespace scans; lint scripts remain blocked by current ESLint configuration gaps.
- 2026-06-27 00:00: Started F25 controlled Site TLS renewal plan to bridge certificate probe/alerting with a safe certbot renewal execution path.
- 2026-06-27 00:00: Implemented F25 controlled Site TLS renewal plan; Let’s Encrypt sites can generate renewal rehearsals or approval-gated renewal runs through Server executor and a narrow certbot allowlist.
- 2026-06-27 00:00: Completed F25 controlled Site TLS renewal plan; verified with targeted and full API Jest, API/web type checks, Prisma validate, builds, diff checks, and whitespace scans; lint scripts remain blocked by current ESLint configuration gaps.
- 2026-06-27 00:00: Started F26 scheduled Site TLS renewal to move renewal from manual-only operation toward default-off safe automation.
- 2026-06-27 00:00: Implemented F26 scheduled Site TLS renewal; scheduler submits due Let’s Encrypt sites through the existing renewal run path, dry-run rehearsal by default, and skips missing-expiry/not-due/recent-renewal candidates.
- 2026-06-27 00:00: Completed F26 scheduled Site TLS renewal; verified with targeted and full API Jest, API/web type checks, Prisma validate, builds, diff checks, and whitespace scans; lint scripts remain blocked by current ESLint configuration gaps.
- 2026-06-27 00:00: Started F27 Site TLS renewal result metadata to make certbot rehearsal/live output visible as Site TLS resource state.
- 2026-06-27 00:00: Implemented F27 Site TLS renewal result metadata; direct and queued `tls_renew` runs now merge renewal status, dry-run/live flags, run id, timestamp and summary into `Site.tls.renewal`, and the Sites page shows the latest renewal summary.
- 2026-06-27 00:00: Completed F27 Site TLS renewal result metadata; verified with targeted and full API Jest, API/web type checks, Prisma validate, API/web builds, diff checks and whitespace scans; lint scripts remain blocked by current ESLint configuration gaps.
- 2026-06-27 00:00: Started F28 Site TLS renewal follow-up probe to refresh observed certificate metadata after successful live renewal.
- 2026-06-27 00:00: Implemented F28 Site TLS renewal follow-up probe; successful direct or queued live `tls_renew` now queues a linked `tls_probe` run and records follow-up probe run/job status in `Site.tls.renewal.followUpProbe`.
- 2026-06-27 00:00: Completed F28 Site TLS renewal follow-up probe; verified with targeted and full API Jest, API/web type checks, Prisma validate, API/web builds, diff checks and whitespace scans; lint scripts remain blocked by current ESLint configuration gaps.
- 2026-06-27 00:00: Started F29 Site TLS renewal failure alert to surface renewal and follow-up probe failures through Monitoring.
- 2026-06-27 00:00: Implemented F29 Site TLS renewal failure alert; monitoring rules can now evaluate `category=site/metric=tls_renewal_failure` and the monitoring page can create TLS renewal failure rules.
- 2026-06-27 00:00: Completed F29 Site TLS renewal failure alert; verified with targeted MonitoringService Jest, full API Jest, API/web type checks, Prisma validate, API/web builds, diff checks and whitespace scans; lint scripts remain blocked by current ESLint configuration gaps.
- 2026-06-27 00:00: Started F30 Site TLS certificate asset snapshot to make observed certificates visible as asset history before adding a full certificate vault.
- 2026-06-27 00:00: Implemented F30 Site TLS certificate asset snapshot; successful TLS probes now update `Site.tls.assets` with stable observed certificate asset snapshots and the Sites page shows asset count plus fingerprint summary.
- 2026-06-27 00:00: Completed F30 Site TLS certificate asset snapshot; verified with targeted Site TLS/Server executor/Monitoring Jest, full API Jest, API/web type checks, Prisma validate, API/web builds, diff checks and whitespace scans; lint scripts remain blocked by current ESLint configuration gaps.
- 2026-06-27 00:00: Started F31 Site TLS certificate asset change alert to make certificate rotation or unexpected served-certificate changes observable.
- 2026-06-27 00:00: Implemented F31 Site TLS certificate asset change alert; monitoring rules can now evaluate `category=site/metric=certificate_asset_change` and the monitoring page can create certificate-change rules with a configurable window.
- 2026-06-27 00:00: Completed F31 Site TLS certificate asset change alert; verified with targeted MonitoringService Jest, full API Jest, API/web type checks, Prisma validate, API/web builds, diff checks and whitespace scans; lint scripts remain blocked by current ESLint configuration gaps.
- 2026-06-27 00:00: Started F32 SLS credential-backed live log query adapter to move SLS log collection beyond dry-run plans.
- 2026-06-27 00:00: Implemented F32 SLS live log query adapter; SLS streams can now keep dry-run as default or, with feature flag, TeamCredential and explicit confirmation, execute read-only GetLogs live queries and ingest redacted results into LogEntry.
- 2026-06-27 00:00: Completed F32 SLS credential-backed live log query adapter; verified with targeted and full API Jest, API/web type checks, Prisma validate, API/web builds, diff checks and conflict-marker scans; lint scripts remain blocked by current ESLint configuration gaps.
- 2026-06-27 00:00: Started F33 scheduled SLS log backfill to keep opted-in SLS LogEntry data fresh without manual pulls.
- 2026-06-27 00:00: Implemented F33 scheduled SLS log backfill; the default-off scheduler only processes active SLS streams with `metadata.slsBackfill.enabled=true`, skips recent runs, and the Logs page can save per-stream backfill query/window/limit/interval/live metadata.
- 2026-06-27 00:00: Completed F33 scheduled SLS log backfill; verified with targeted and full API Jest, API/web type checks, Prisma validate, API/web builds, diff checks and conflict-marker scans; lint scripts remain blocked by current ESLint configuration gaps.
- 2026-06-27 00:00: Started F34 resource metric time-series to chart persisted Docker metric snapshots without adding a new schema model or changing the Server executor boundary.
- 2026-06-27 00:00: Implemented F34 resource metric time-series; resource-control now exposes a bounded metric series API and the resource detail drawer can chart CPU, memory, network, block IO, and PID metrics from persisted snapshots.
- 2026-06-27 00:00: Completed F34 resource metric time-series; verified with targeted and full API Jest, API/web type checks, Prisma validate, API/web builds, and diff checks; lint scripts remain blocked by current ESLint configuration gaps.
- 2026-06-27 00:00: Started F35 monitoring resource metric dashboard to make persisted resource metrics visible as a platform-level monitoring overview.
- 2026-06-27 00:00: Implemented F35 monitoring resource metric dashboard; monitoring now exposes a read-filtered resource metric dashboard API and UI panel for coverage, health counts, peaks, and hotspot resources.
- 2026-06-27 00:00: Completed F35 monitoring resource metric dashboard; verified with targeted and full API Jest, API/web type checks, Prisma validate, API/web builds, diff checks, and touched-file scans; lint scripts remain blocked by current ESLint configuration gaps.
- 2026-06-27 00:00: Started F36 alert notification channel adapters to support Feishu, DingTalk, and enterprise WeChat style robot webhooks beyond the generic webhook payload.
- 2026-06-27 00:00: Implemented F36 alert notification channel adapters; Monitoring can now create generic webhook, Feishu, DingTalk, and enterprise WeChat robot channels, format provider-specific payloads, and show provider-aware UI copy.
- 2026-06-27 00:00: Completed F36 alert notification channel adapters; verified with targeted MonitoringService Jest, full API Jest, API/web type checks, Prisma validate, API/web builds, `git diff --check`, and touched-file scans; lint scripts remain blocked by current ESLint configuration gaps.
- 2026-06-27 00:00: Started F37 alert notification delivery retry to let operators retry failed/planned notification deliveries without introducing a new schema or worker yet.
- 2026-06-27 00:00: Implemented F37 alert notification delivery retry; failed/planned deliveries can be retried through current channel policy and adapter settings, with a new delivery record, UI retry action, and audit event.
- 2026-06-27 00:00: Completed F37 alert notification delivery retry; verified with targeted MonitoringService Jest, full API Jest, API/web type checks, Prisma validate, API/web builds, `git diff --check`, and touched-file scans; lint scripts remain blocked by current ESLint configuration gaps.
- 2026-06-27 00:00: Started F38 service SLO dashboard to make service reliability visible from existing deployment, operation, and alert records before configurable SLO policies.
- 2026-06-27 00:00: Implemented F38 service SLO dashboard; Monitoring now exposes a read-filtered service SLO dashboard and UI panel using deployment, service operation, and alert impact signals.
- 2026-06-27 00:00: Completed F38 service SLO dashboard; verified with targeted MonitoringService Jest, full API Jest, API/web type checks, Prisma validate, API/web builds, `git diff --check`, and touched-file scans; lint scripts remain blocked by current ESLint configuration gaps.
- 2026-06-27 00:00: Started F39 service SLO breach alert to route SLO regressions into the standard AlertRule/Event, silence, notification, and audit chain.
- 2026-06-27 00:00: Implemented F39 service SLO breach alert; service rules can now evaluate SLO percent, burn rate, error-budget remaining, and critical alert impact from deployment, service operation, and alert-event signals.
- 2026-06-27 00:00: Completed F39 service SLO breach alert; verified with full API Jest, API/web type checks, Prisma validate, API/web builds, `git diff --check`, and touched-file scans; lint scripts remain blocked by current ESLint configuration gaps.
- 2026-06-27 00:00: Started F40 multi-window service SLO alert strategy; the first pass will keep the existing single-window condition compatible and add `windows[]` plus `matchPolicy` for paired burn-rate checks.
- 2026-06-27 00:00: Implemented F40 multi-window service SLO alert strategy; service SLO rules can now use legacy single-window conditions or short/long `windows[]` with `matchPolicy=all`, and `/monitoring` exposes matching creation controls.
- 2026-06-27 00:00: Completed F40 multi-window service SLO alert strategy; verified with targeted MonitoringService Jest, full API Jest, API/web type checks, Prisma validate, API/web builds, `git diff --check`, and touched-file scans; lint scripts remain blocked by current ESLint configuration gaps.
- 2026-06-27 00:00: Started F41 service error budget alert policy to warn on low remaining error budget before a full SLO breach.
- 2026-06-27 00:00: Implemented F41 service error budget alert policy; Monitoring now evaluates `service_error_budget` from existing service SLO signals and exposes a service error budget rule type on `/monitoring`.
- 2026-06-27 00:00: Completed F41 service error budget alert policy; verified with targeted MonitoringService Jest, full API Jest, API/web type checks, Prisma validate, API/web builds, `git diff --check`, and touched-file scans; lint scripts remain blocked by current ESLint configuration gaps.
- 2026-06-27 00:00: Started F42 alert event deduplication suppression to reduce repeated scheduled alert noise without adding a schema migration.
- 2026-06-27 00:00: Implemented F42 alert event deduplication suppression; repeated abnormal evaluations now reuse recent same-rule events, skip notification dispatch, update rule state, and write a deduped audit event.
- 2026-06-27 00:00: Completed F42 alert event deduplication suppression; verified with targeted MonitoringService Jest, full API Jest, API/web type checks, Prisma validate, API/web builds, `git diff --check`, and touched-file scans; lint scripts remain blocked by current ESLint configuration gaps.
- 2026-06-27 00:00: Started F43 alert notification auto retry to recover stale failed webhook deliveries through the existing delivery adapter and audit path, default-off and without retrying dry-run planned records.
- 2026-06-27 00:00: Implemented F43 alert notification auto retry with stale failed-delivery scanning, newer-attempt suppression, recent-attempt caps, default-off scheduler wiring, and targeted MonitoringService/MonitoringSchedulerService tests.
- 2026-06-27 00:00: Completed F43 alert notification auto retry; verified with targeted MonitoringService/MonitoringSchedulerService Jest, full API Jest, API/web type checks, Prisma validate, API/web builds, `git diff --check`, and touched-file scans; lint scripts remain blocked by current ESLint configuration gaps.
- 2026-06-27 00:00: Started F44 alert notification email channel to add default-dry-run email delivery with explicitly gated SMTP live sends.
- 2026-06-27 00:00: Implemented F44 alert notification email channel with email channel DTOs, SMTP-gated delivery adapter, monitoring UI creation controls, and targeted MonitoringService coverage.
- 2026-06-27 00:00: Completed F44 alert notification email channel; verified with targeted MonitoringService Jest, full API Jest, API/web type checks, Prisma validate, API/web builds, `git diff --check`, and touched-file scans; lint scripts remain blocked by current ESLint configuration gaps.
- 2026-06-27 00:00: Started F45 alert escalation policy to redispatch stale unacknowledged critical alerts through existing notification channels with default-off scheduler controls.
- 2026-06-27 00:00: Implemented F45 alert escalation policy; stale unacknowledged critical alerts can now be escalated through matching notification channels, deduped by recent escalation deliveries, audited as `alert.escalate`, and scheduled by a default-off scheduler path.
- 2026-06-27 00:00: Completed F45 alert escalation policy; verified with targeted MonitoringService/MonitoringSchedulerService Jest, full API Jest, API/web type checks, Prisma validate, API/web builds, `git diff --check`, and touched-file scans; lint scripts remain blocked by current ESLint configuration gaps.
- 2026-06-27 00:00: Started F46 service SLO templates so monitoring rules can be created from standard availability, burn-rate, and error-budget presets.
- 2026-06-27 00:00: Completed F46 service SLO templates with static template API, monitoring page template application, product docs, and full verification.
- 2026-06-27 00:00: Started F47 error budget exhaustion forecast to alert on projected budget depletion from current burn rate.
- 2026-06-27 00:00: Completed F47 error budget exhaustion forecast with Monitoring evaluation, UI creation, SLO template preset, product docs, and verification.
- 2026-06-27 20:18: Started F52 streaming log session audit closure so manual active-session close operations are traceable in AuditEvent.
- 2026-06-27 20:18: Completed F52 streaming log session audit closure with controller audit write, regression coverage, docs, and verification; API lint remains blocked by missing ESLint config.
- 2026-06-27 20:26: Started F53 streaming log tenant session limits to add team and actor guardrails around the SSE tail channel.
- 2026-06-27 20:26: Completed F53 streaming log tenant session limits with registry counters, controller limits/metadata, regression coverage, docs, and verification.
- 2026-06-27 20:40: Started F54 scheduled server log follow to keep Docker/Nginx/server log streams fresh through bounded Server executor collection windows without adding an agent.
- 2026-06-27 20:44: Completed F54 scheduled server log follow with default-off scheduler, Logs UI metadata controls, regression coverage, docs, and verification.
- 2026-06-27 21:02: Started F55 environment configuration sync suggestions so imported and deployment-only projects can compare environment gaps before later copy/bind workflows.
- 2026-06-27 21:18: Implemented F55 read-only sync suggestion API and project-detail suggestion links; final verification is in progress.
- 2026-06-27 21:25: Completed F55 environment configuration sync suggestions with regression coverage, docs, and verification; lint scripts remain blocked by existing ESLint configuration gaps.
- 2026-06-27 21:32: Started F56 environment sync apply plan; first scope is dry-run/apply for missing application services and non-sensitive deployConfig fields only.
- 2026-06-27 21:48: Implemented F56 backend apply contract and project-detail controls; final docs and verification are in progress.
- 2026-06-27 21:55: Completed F56 environment sync apply plan with safe service/deployConfig scope, UI controls, regression coverage, docs, and verification; lint scripts remain blocked by existing ESLint configuration gaps.
- 2026-06-27 22:01: Started F57 environment resource bulk binding to assign existing environmentless project resources into a selected environment with dry-run and confirmation.
- 2026-06-27 22:02: Implemented F57 bulk binding API and project-detail controls for Site, ManagedResource, ResourceInstance, CDNConfig, and SecretKey; final docs and verification are in progress.
- 2026-06-27 22:03: Completed F57 verification and docs; lint remains blocked by the existing missing ESLint config / interactive Next lint setup.
- 2026-06-27 22:06: Started F58 environment resource selection binding to avoid all-or-nothing onboarding of imported/resource-only project resources.
- 2026-06-27 22:11: Implemented F58 selected-resource binding UI and API regression coverage; docs and final verification are in progress.
- 2026-06-27 22:15: Completed F58 environment resource selection binding with docs and verification; lint remains blocked by the existing missing ESLint config / interactive Next lint setup.
- 2026-06-27 22:18: Started F59 environment server binding confirmation so operators can attach existing servers to dev/test/staging/prod before live control actions rely on them.
- 2026-06-27 22:25: Completed F59 environment server binding confirmation with project-detail controls, bind/unbind audit events, docs, and verification; lint remains blocked by the existing missing ESLint config / interactive Next lint setup.
- 2026-06-27 22:27: Started F60 cross-environment Site copy plan to create safe draft Site skeletons without copying server/proxy bindings or certificate assets.
- 2026-06-27 22:33: Completed F60 cross-environment Site copy API with source read/target write policy gates, draft Site creation, TLS sanitization, docs, and verification; lint remains blocked by the existing missing ESLint config / interactive Next lint setup.
- 2026-06-27 22:38: Started F61 cross-environment Site copy frontend so operators can preview and confirm draft Site creation from the project environment workspace.
- 2026-06-27 22:48: Completed F61 with project-detail source environment selection, explicit target domains, dry-run/apply controls, recent result display, docs, and verification; lint remains blocked by the existing missing ESLint config / interactive Next lint setup.
- 2026-06-27 22:52: Started F62 cross-environment CDN config copy API with explicit target domain/origin/credential requirements.
- 2026-06-27 22:58: Completed F62 cross-environment CDN config copy API with explicit target mapping, pending skeleton creation, audit output, docs, and verification; lint remains blocked by the existing missing ESLint config / interactive Next lint setup.
- 2026-06-27 23:00: Started F63 cross-environment CDN config copy frontend so operators can preview and confirm pending CDNConfig creation from the project environment workspace.
- 2026-06-27 23:08: Completed F63 with project-detail source environment selection, explicit target domain/origin/credential mappings, dry-run/apply controls, recent result display, docs, and verification; lint remains blocked by the existing missing ESLint config / interactive Next lint setup.
- 2026-06-27 23:08: Started F64 cross-environment ManagedResource/SecretKey copy API with explicit target externalId and new secret value requirements.
- 2026-06-27 23:18: Completed F64 cross-environment ManagedResource/SecretKey copy API with explicit target mappings, encrypted new secret values, audit-safe metadata, regression coverage, full API tests, API type-check/build, and diff checks.
- 2026-06-27 23:21: Started F65 cross-environment ManagedResource/SecretKey copy frontend so operators can preview and confirm safe skeleton creation from the project environment workspace.
- 2026-06-27 23:25: Completed F65 with project-detail source environment selection, explicit resource/secret target mappings, dry-run/apply controls, recent result display, docs, and Web type-check/build.
- 2026-06-27 23:30: Started F66 resource copy post-copy takeover entry to deep-link copied resources into resource-control and generate safe connection-probe plans.
- 2026-06-27 23:38: Completed F66 with resource-control resourceId deep links, project-detail post-copy takeover actions, safe connection-probe plan generation, docs, Web type-check/build, and diff checks.
- 2026-06-27 23:44: Started F67 Site copy post-copy takeover entry to deep-link copied draft Sites into site-control and generate safe Nginx/TLS plans.
- 2026-06-27 23:58: Completed F67 with `/sites?siteId=...` focused takeover, project-detail Site copy post-copy links, safe Nginx/OpenResty and TLS dry-run plan actions, docs, Web type-check/build, and diff checks.
- 2026-06-27 23:55: Started F68 Site takeover binding form to let copied draft Sites bind server and TLS metadata before live operations.
- 2026-06-28 00:01: Completed F68 with focused Site takeover server/TLS binding form, observed certificate asset selection, existing Site update persistence, docs, Web type-check/build, and diff checks.
- 2026-06-28 00:08: Started F69 Site smoke check to verify public domain, local Nginx Host routing, and upstream reachability through low-risk Server executor commands.
- 2026-06-28 00:12: Completed F69 with low-risk `site.smoke_check` API/service mode, bounded curl command-policy rules, Site UI actions, docs, API/Web type-check/build, targeted/full API Jest, and diff checks.
- 2026-06-28 00:22: Started F70 Site smoke-check failure alerts to route failed smoke runs into Monitoring without adding a new schema model.
- 2026-06-28 00:35: Implemented F70 Site smoke-check failure alerts with Monitoring evaluation, UI creation controls, docs, targeted MonitoringService Jest, and API/Web type-check; broader verification is in progress.
- 2026-06-28 00:48: Completed F70 with site smoke-check failure Monitoring rule evaluation, `/monitoring` rule creation controls, docs, full verification, and local `/sites` plus `/monitoring` health checks.
- 2026-06-28 01:02: Started F71 OpenResty runtime status probe to add safe read-only process/config introspection before deeper module and tuning controls.
- 2026-06-28 01:22: Implemented F71 OpenResty runtime status probe API/service mode, bounded command-policy rules, Sites UI entry points, and targeted regression tests; broader build and page health checks are in progress.
- 2026-06-28 01:42: Completed F71 with OpenResty/Nginx runtime status probe UI/API, fixed read-only command allowlist, docs, full API Jest, API/Web type-check/build, and `/sites` health checks; lint remains blocked by existing project lint configuration gaps.
- 2026-06-28 01:48: Started F72 OpenResty module inventory to add safe read-only compiled/dynamic module introspection before module baseline checks and tuning controls.
- 2026-06-28 01:57: Implemented F72 OpenResty module inventory API/service mode, fixed read-only command-policy rules, Sites UI entry points, and targeted regression tests; broader verification is in progress.
- 2026-06-28 02:11: Completed F72 with OpenResty/Nginx module inventory UI/API, fixed read-only command allowlist, docs, full API Jest, API/Web type-check/build, and `/sites` health checks; lint remains blocked by existing project lint configuration gaps.
- 2026-06-28 02:17: Started F73 OpenResty module baseline check to compare common runtime capabilities through fixed read-only commands before deeper module policy and tuning controls.
- 2026-06-28 02:24: Implemented F73 OpenResty module baseline check API/service mode, fixed read-only command-policy rules, Sites UI entry points, and targeted regression tests; broader verification is in progress.
- 2026-06-28 02:34: Completed F73 with OpenResty/Nginx fixed module baseline check UI/API, bounded read-only command allowlist, docs, full API Jest, API/Web type-check/build, and `/sites` health checks; lint remains blocked by existing project lint configuration gaps.
- 2026-06-28 01:06: Started F74 failed deployment retry to close a deployment recovery gap after Git/Webhook-triggered runs fail.
- 2026-06-28 01:06: Implemented F74 failed deployment retry API/service path, project detail retry controls, product docs, and targeted deployment Jest; broader verification is in progress.
- 2026-06-28 01:13: Completed F74 with failed DeploymentRun retry API/UI, docs, full API Jest, Prisma validate, API/Web type-check/build, local project page health checks, and bundle content verification; lint remains blocked by existing project lint configuration gaps.
- 2026-06-28 01:15: Started F75 deployment smoke check to make post-deploy health verification independently runnable from DeploymentRun history.
- 2026-06-28 01:25: Completed F75 with low-risk DeploymentRun smoke-check API/UI, bounded curl policy coverage, docs, full API Jest, Prisma validate, API/Web type-check/build, local project page health checks, and bundle content verification; lint remains blocked by existing project lint configuration gaps.
- 2026-06-28 01:31: Started F76 deployment smoke-check failure alerts to route failed deployment health checks into Monitoring without adding a new schema model.
- 2026-06-28 01:37: Completed F76 with DeploymentRun smoke-check failure Monitoring evaluation, `/monitoring` rule creation controls, docs, full verification, and local `/monitoring` health check.
- 2026-06-28 01:44: Started F77 deployment smoke-failure rollback to connect failed live Smoke checks with controlled rollback approval.
- 2026-06-28 01:50: Completed F77 with protected failed live Smoke rollback plans/applications to the previous successful live deploy, docs, full API/Web verification, and local project page health checks.
- 2026-06-28 01:54: Started F78 deployment smoke-failure auto rollback policy with default-off scheduler and explicit project-page opt-in.
- 2026-06-28 02:02: Completed F78 with explicit project-page Live Smoke auto rollback plan opt-in, default-off scheduler, idempotent failed-Smoke processing, docs, full API/Web verification, and local page health checks.
- 2026-06-28 02:17: Started F79 deployment post-rollback Smoke check to prove live rollback recovery through the existing DeploymentRun smoke path.
- 2026-06-28 02:25: Implemented F79 backend policy/scheduler and project-page live rollback post-Smoke opt-in; broader verification is in progress.
- 2026-06-28 02:36: Completed F79 with post-rollback Smoke policy/scheduler/UI, docs, full API/Web verification, and local page health checks; lint remains blocked by existing project lint configuration gaps.
- 2026-06-28 02:42: Started F80 PR Preview webhook deployment runs to let PR/MR events generate safe preview DeploymentRun plans.
- 2026-06-28 02:53: Implemented F80 backend preview webhook mode and project-page PR Preview webhook creation; broader verification is in progress.
- 2026-06-28 03:02: Completed F80 with PR/MR preview webhook mode, preview DeploymentRun metadata, project-page PR Preview creation, docs, full API/Web verification, and local page health checks; lint remains blocked by existing project lint configuration gaps.
- 2026-06-28 03:17: Started F81 PR Preview environment skeleton so accepted PR/MR events can bind preview DeploymentRun records to stable preview ProjectEnvironment records before real temporary infrastructure is introduced.
- 2026-06-28 03:48: Completed F81 with per-PR/MR preview ProjectEnvironment provisioning/reuse, DeploymentRun preview environment metadata, docs, full API verification, and static checks; API lint remains blocked by missing ESLint config.
- 2026-06-28 04:05: Started F82 PR Preview environment archive-on-close to handle PR/MR close or merge events as safe environment lifecycle updates rather than deployment triggers.
- 2026-06-28 04:17: Completed F82 with preview deploy/archive/ignore dispositions, close/merge environment archival, teardown metadata, regression coverage, docs, and full API verification; API lint remains blocked by missing ESLint config.
- 2026-06-28 04:24: Started F83 PR Preview draft Site placeholder so preview environments enter the Site control workflow before real temporary domains or Nginx/OpenResty sync exist.
- 2026-06-28 04:35: Implemented F83 PR Preview draft Site placeholder with deterministic preview Site creation/reuse, Site metadata on preview environments, close/merge archival metadata, sync-block warnings, and targeted ProjectWebhook/Site regression tests; broader API verification is in progress.
- 2026-06-28 04:42: Completed F83 with docs and API verification: targeted ProjectWebhook/Site Jest, full API Jest, Prisma validate, API type-check, API build, tracked-file diff check, targeted trailing-whitespace scan, and conflict-marker scan pass; API lint remains blocked by missing ESLint config.
- 2026-06-28 04:50: Started F84 PR Preview Site takeover readiness so draft preview Site placeholders can be explicitly bound to a server/upstream and enter safe dry-run Nginx/OpenResty planning.
- 2026-06-28 05:00: Implemented F84 backend and focused Sites UI takeover path; preview Site placeholders can now be explicitly bound to a server/upstream, clear sync blocking, and create a safe dry-run Nginx/OpenResty sync plan.
- 2026-06-28 05:08: Completed F84 with SiteService regressions, Devpilot docs, targeted/full API Jest, Prisma validate, API/Web type-check, API/Web build, diff checks, whitespace scan, and conflict-marker scan; API lint remains blocked by missing ESLint config.
