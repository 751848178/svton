# Shipkit local platform MVP

## Runtime and ownership

`apps/shipkit-web` uses Next 15 / React 19 and svton UI/client packages. Web listens on 127.0.0.1:8769 and forwards `/api` to Nest 10 at 127.0.0.1:8770. `apps/shipkit-api` owns Prisma 5 SQLite, repositories, transport, local request policy, metadata, audit and durable task ledger. `shipkit/src/platform` owns the controlled executor and safe inspection, reusing existing CLI pipelines and Agent contracts. Dependencies flow web → API → executor → CLI/shared/Agent HTTP. No arbitrary shell execution API.

SQLite fits one local control plane: transactions and a unique nullable active-scope gate serialize project/environment writes across processes. JSON payloads use explicit serialized String columns because Prisma 5 SQLite does not support Json/enums. Schema and migration are source files; the isolated client is generated locally and ignored by Git. Logs live as private files with DB cursors and indices, not unbounded DB rows.

Request actor/workspace are server-derived signed-in user/`local`; body values never choose identity. A policy provider owns authorization calls. Every resource belongs to a workspace; creator/actor and request ID appear in audit. Server sessions implement login, expiry and revocation; Node scrypt hashes administrator-provisioned passwords. The svton authorizer grants all authenticated operations for MVP while preserving subject/action/workspace inputs for future policy. Write routes require loopback Host, explicitly configured page Origin when present, JSON and `x-shipkit-local: 1`; UI uses same-origin proxy. Private config remains a file reference and is never returned verbatim.

## Stable API contract (raw JSON)

- GET/POST `/api/projects`: `{items: Project[]}` / register `{name,rootPath,configPath,targetKey?,serverName?,services?:[{serviceKey,displayName?,entryUrl?}]}` → Project.
- GET/PATCH `/api/projects/:id`: project metadata; patch only display names/entry URLs/target selection.
- GET `/api/projects/:id/status`: `{project,live}`; actual config/spec/Git/Agent facts, unavailable checks explicit.
- POST `/api/projects/:id/plans`: `{kind:'release'|'rollback',services:string[],targetKey?,sourceMode?:'git'|'directory',changeReleaseId?,keepEnv?,keepBuilder?}` → `{id,kind,baseReleaseId,selection,expiresAt,detail}`.
- POST `/api/projects/:id/tasks`: `{planId,idempotencyKey?}` → Task; only this route starts execution.
- GET `/api/projects/:id/tasks`: `{items:Task[]}`. GET `/api/tasks/:id`: `{task,stages,remoteJobs,events}`.
- GET `/api/tasks/:id/events?after=N`: `{events,nextSeq,complete}`. Polling keeps persisted cursors and works across reloads.
- GET `/api/tasks/:id/logs?stage=build&service=api&offset=N`: `{text,nextOffset,totalBytes,complete}`.
- POST `/api/tasks/:id/cancel`, POST `/api/tasks/:id/cleanup`: returns current Task. Requested cancellation remains requested until Agent acknowledges.
- GET `/api/projects/:id/history`: `{items}` from authenticated Agent group history with current baseline and snapshot availability, separate from full platform task history.
- POST `/api/projects/:id/checks`: actual doctor diagnostics with redaction and precise verification level.

Task fields: `id,projectId,planId,kind,status,phase,cancelState,recoveryState,cleanupState,remoteReleaseId,previousReleaseId,error,output,createdAt,startedAt,finishedAt`. Status: queued/running/cancel-requested/succeeded/failed/cancelled/interrupted. Stage keys: provision/build/push/cleanup/deploy/verify; recover is reflected in recoveryState and events. Stage state: pending/running/succeeded/failed/skipped/cancelled. Stages include serviceKey and detail. All timestamps ISO strings. Metadata does not rename underlying target/environment identity.

## Executor contract

`shipkit/platform` exports `inspectProject(input)`, `preparePlan(input,request)`, `executeTask(input,plan,hooks)`, `reconcileTask(input,remoteJobs,hooks)`, `retryCleanup(input)` and `fetchHistory(input)`. `ProjectInput={rootPath,configPath,targetKey}`. `ExecutionPlan={kind,selection,baseReleaseId,changeReleaseId?,sourceMode,keepEnv,keepBuilder,fingerprint,detail}`. Hooks: awaited `emit(event)` and async `isCancellationRequested()`. Events are typed with `type,stageKey?,serviceKey?,remoteJob?,message?,detail?`; mapping, logs and stage transitions are flushed before builder release. Result carries status, output, cleanupState and recoveryState without secrets.

Plans freeze public source/config/spec fingerprints and remote baseline; execution rejects expired, changed or stale plans before provisioning. Release reuses build/push/deploy pipeline with baseline carried to Agent. History rollback `targetReleaseId` selects a historical change and restores its parent snapshot for selected services; `baseReleaseId` only prevents stale actions. Agent validates binding, service coverage and snapshot under the application lock. Permanent platform history may outlive available Agent snapshots; unavailable targets are rejected.

## Safety and restart

Agent cooperative cancellation supports safe points; activation cancellation restores the previous combination. Commit is noncancellable. Remote result, recovery failure and skipped probes remain distinct from healthy verified success. Cancellation is never inferred from killing CLI or stopping polling. Build/push logs are archived before releasing a dynamic builder. Builder cleanup failure is independent from application deployment and has an explicit retry.

API creates task/activeScope transactionally before dispatch. Persisted job mappings permit restart reconciliation; orphaned work is reconciled with remote truth, never silently marked successful. A build interrupted before deployment may require a fresh plan. A runtime job can be observed to completion after restart. No production TWGG writes or Agent upgrades are used in acceptance.

## Source map

release: `cmd-release` → selection/plan → `pipeline-multi` → `builder-lease` → `pipeline-group-deploy` → Agent `handlers-group-deploy`/activation/recovery/store. Rollback: `cmd-rollback` → group rollback pipeline → locked Agent handler/snapshots. Logs: `job-report`/shared HTTP → Agent JobStore → platform awaited hooks → API DB/file archive → frontend drawer.
