# Devpilot Full Flow Validation

routing: todo-plan + noisy-tools + product-flow audit. The task crosses auth, seed data, resource simulation, API/Web verification, and product-level E2E flows, so noisy logs are isolated under `/tmp/codex-tool-runs/svton/`.

## Auth And Redirect Integrity

- status: done
- goal: 401/Unauthorized from client and server-rendered dashboard flows must redirect to login instead of rendering broken product pages.
- evidence:
  - done: middleware added for protected dashboard route redirects
  - done: client API 401 now clears auth and redirects with a safe redirect target
  - done: server-rendered dashboard pages rethrow unauthorized as login redirects before empty-state fallback
  - pending: unauthenticated dashboard navigation check
  - pending: expired-token API check

## Mock Product Data And Virtual Resources

- status: done
- goal: create realistic teams, users, projects, environments, servers, resources, sites, apps, monitoring, approvals, logs, keys, proxy/CDN, backup, git, and governance records for all modules.
- evidence:
  - done: fresh DB migrated at `devpilot_full_flow_202607111816`
  - done: seed script output `/tmp/codex-tool-runs/svton/devpilot-full-flow-20260711/seed-rerun.log`
  - done: Docker HTTP resource `devpilot-virtual-nginx` on `127.0.0.1:18088`
  - done: Docker Redis resource `devpilot-virtual-redis` on `127.0.0.1:6383`
  - blocked: Docker OpenSSH image pull was interrupted by local Docker credential helper failure; server executor is covered by dry-run/queued records instead

## Product Flow E2E Matrix

- status: done
- goal: validate full module workflows end-to-end from product entry points, not only page reachability.
- evidence:
  - done: flow matrix JSON `/tmp/codex-tool-runs/svton/devpilot-full-flow-20260711/e2e-full-flow/summary.json`
  - done: Playwright screenshots `/tmp/codex-tool-runs/svton/devpilot-full-flow-20260711/e2e-full-flow/screenshots`
  - done: 77 API checks passed with 0 failures
  - done: 28 desktop module pages and 4 mobile pages passed

## UI And I18n Audit

- status: done
- goal: verify desktop/mobile layouts, no raw i18n keys in active locale, no visible Unauthorized pages, and no obvious overflow or broken components.
- evidence:
  - done: no visible Unauthorized pages in E2E
  - done: no raw i18n keys in E2E visible text
  - done: no console MISSING_MESSAGE errors
  - done: no mobile overflow on selected critical pages

## Final Verification

- status: done
- goal: type-check/build/test plus final full-flow E2E pass.
- evidence:
  - done: API/Web production build log `/tmp/codex-tool-runs/svton/devpilot-full-flow-20260711/build-after-auth-seed.log`
  - done: Web rebuild logs after fixes under `/tmp/codex-tool-runs/svton/devpilot-full-flow-20260711/`
  - done: final E2E log `/tmp/codex-tool-runs/svton/devpilot-full-flow-20260711/full-flow-e2e-rerun2.log`

## S010 Demo Runbook And Browser UI E2E

- status: done
- goal: make the deliverability proof repeatable by adding a local demo runbook and a browser-level UI E2E script for the remaining demo evidence gaps.
- evidence:
  - done: runbook path `docs/devpilot/demo-runbook.md`
  - done: browser E2E script path `scripts/devpilot-ui-e2e.mjs`
  - done: isolated browser E2E log `/tmp/codex-tool-runs/svton/s010-ui-e2e-20260713-001121.log`
  - done: browser E2E summary/screenshots `/tmp/codex-tool-runs/svton/s010-ui-e2e-20260713-001121`
  - done: live fake-target deploy -> task-pull completed -> rollback completed on ports `3211`/`3210`; final evidence `/tmp/codex-tool-runs/svton/live-deploy-rollback-20260713-001800/final-live-summary.json`
  - done: product screenshots for `/execution-governance`, `/logs`, and `/monitoring` captured under `/tmp/codex-tool-runs/svton/live-deploy-rollback-20260713-001800/screenshots`
  - fixed: CLI task-pull now unwraps Devpilot API response envelopes and skips optional empty command steps before executing terminal lifecycle jobs

## S011 Demo Trace Cleanup And Runbook Hardening

- status: done
- goal: keep the S005 live evidence auditable while preventing historical failed/blocked rehearsal rows from being mistaken for current task-pull readiness risk.
- evidence:
  - done: server-executor supervisor job health now counts only unfinished terminal jobs as current blocked/failed/cancelled pressure; finished terminal rows remain visible in job history and audit.
  - done: runbook path `docs/devpilot/demo-runbook.md` now includes reusable API/Web/CORS/MySQL/Redis/virtual-nginx/agent-token/queue-worker/task-pull configuration, demo cleanup strategy, and demo-safe/production-safe command policy templates.
  - done: S005 evidence directory kept as the source of truth for historical blockers and final live proof: `/tmp/codex-tool-runs/svton/live-deploy-rollback-20260713-001800`.
  - done: focused API regression test updated for the supervisor current-pressure semantics.

## S012 Production Config Pack

- status: done
- goal: separate demo-safe exports from production-ready configuration values, defaults, and enablement gates.
- evidence:
  - done: production config pack path `docs/devpilot/production-config-pack.md`
  - done: source-backed baseline covers API/Web origins, DB, Redis, JWT, encryption, cache, logging, live execution gates, task-pull API/CLI, scheduler groups, and generated artifact cleanup.
  - done: demo runbook now points production handoff readers to the production config pack instead of copying demo exports.

## S013 Command Policy Safety Templates

- status: done
- goal: provide command policy templates that are safe to copy into demo and production environments before live execution is enabled.
- evidence:
  - done: command policy template pack path `docs/devpilot/command-policy-templates.md`
  - done: demo and production templates use explicit `regex:` prefixes so the server command policy matcher interprets them as regular expressions instead of micromatch globs.
  - done: production template uses one-command execution steps and blocks shell chaining, pipes, redirection, command substitution, inline secrets, SSH/SCP, and broad destructive classes.

## S014 Agent Production Operating Mode

- status: done
- goal: define how the server-agent task-pull process should run in production without relying on an interactive demo shell.
- evidence:
  - done: agent production runbook path `docs/devpilot/agent-production-runbook.md`
  - done: runbook covers API enablement gates, service-manager env file, systemd service shape, pid file, heartbeat/TTL, cwd boundary, restart behavior, token rotation, and blockers.
  - done: demo runbook and production config pack link to the production agent runbook.

## S015 Failure Record And Rehearsal Trace Governance

- status: done
- goal: keep historical failures auditable while preventing finished rehearsal traces from being misread as current readiness pressure.
- evidence:
  - done: rehearsal trace governance path `docs/devpilot/rehearsal-trace-governance.md`
  - done: governance classifies current pressure, audit history, rehearsal artifacts, and throwaway data.
  - done: demo and production config docs link to the reusable trace governance rules.

## S016 Permission And Tenant E2E

- status: blocked_external
- goal: verify cross-team denial and own-team happy path through real API requests.
- evidence:
  - done: E2E script path `scripts/devpilot-permission-tenant-e2e.mjs`
  - done: runbook path `docs/devpilot/permission-tenant-e2e.md`
  - blocked: current local environment does not expose a verified Devpilot API for creating disposable users/teams; rerun the script with `DEVPILOT_API_URL` pointing at staging.

## S017 Resource Request Minimum Loop

- status: done
- goal: define and verify the minimal resource-request loop needed for production MVP handoff.
- evidence:
  - done: resource request loop runbook path `docs/devpilot/resource-request-minimum-loop.md`
  - done: runbook covers create/list/detail/review/complete/provisioning-runs/replay/reconcile/supervisor/process-next/recover-stale endpoints.
  - done: failure states and recovery actions are explicit.

## S018 Backup Restore Upgrade Checklist

- status: done_with_blockers
- goal: provide final production handoff checklist and direct readiness judgment.
- evidence:
  - done: checklist path `docs/devpilot/backup-restore-upgrade-checklist.md`
  - done: backup, migration, rollback, upgrade, owner, and evidence checkpoints are listed.
  - blocker: restore is not source-backed as a first-class product endpoint in the inspected backup module, so production handoff requires a rehearsed manual restore runbook or implementation evidence.
  - cleared: S019 later cleared the S016 live permission/tenant E2E blocker against a disposable local Devpilot API.

## S019 Clear Permission Tenant Live E2E Blocker

- status: done
- goal: run the permission/tenant E2E against a reachable disposable Devpilot API and update the G003 blocker state from real HTTP evidence.
- evidence:
  - done: local candidate stack used `devpilot-mysql` on `127.0.0.1:3310`, `devpilot-virtual-redis` on `127.0.0.1:6383`, and API port `3211`.
  - done: disposable DB `devpilot_g003_s019` was reset and migrated before E2E.
  - done: `scripts/devpilot-permission-tenant-e2e.mjs` passed owner, cross-tenant denial, resource-control team header denial, and happy-path checks.
  - done: final E2E log `/tmp/codex-tool-runs/svton/s019-permission-tenant-e2e-rerun2-20260713-103938.log`.
  - done: temporary API server was stopped after verification; log `/tmp/codex-tool-runs/svton/s019-api-stopped-20260713-104023.log`.
  - remaining: staging or production release signoff should rerun the same script with approved endpoints; restore/provider/backup/rollback blockers remain.

## S020 Source-Backed Backup Restore Readiness Path

- status: done
- goal: clear the restore blocker by adding a first-class restore dry-run endpoint/job with permission gates, audit evidence, validation query, and rollback plan metadata.
- evidence:
  - in_progress: CodeGraph is uninitialized, so backup module shape was mapped by scoped source reads.
  - in_progress: `backup.service.ts` is already 729 lines; restore logic must live in a focused restore service instead of expanding that file.
  - done: added `POST /api/backups/runs/:runId/restore` through `BackupRestoreService` with dry-run restore plan evidence and default-blocked live restore.
  - done: restore write gate uses `backup.restore` with medium dry-run risk and high live risk.
  - done: restore audit metadata includes source backup id, validation query, rollback plan, and restore run status.
  - done: focused backup Jest passed; log `/tmp/codex-tool-runs/svton/s020-backup-jest-20260713-104803.log`.
  - done: API type-check passed; log `/tmp/codex-tool-runs/svton/s020-api-type-check-20260713-104844.log`.
  - remaining: production restore rehearsal remains a release-signoff activity; live provider/resource provisioning and production backup/rollback rehearsals still require approved credentials and targets.

## S021 Docker-Backed Staging Matrix

- status: done
- goal: replace the local verification blocker with a disposable Docker-backed, production-like staging matrix without touching real cloud or production resources.
- evidence:
  - done: Docker compose matrix added at `docker-compose.devpilot-staging.yml` for MySQL, Redis, virtual nginx, fake provider, and backup target.
  - done: staging runner added at `scripts/devpilot-docker-staging.mjs` with helper `scripts/devpilot-staging-http.mjs`.
  - done: final run passed with summary `/tmp/codex-tool-runs/svton/g003-docker-staging-20260713035954/summary.json`.
  - done: resource request -> approval -> fake provider provisioning completed.
  - done: deployment approval -> queued live deploy -> CLI task-pull completed; deployment run `cmrip2hx20011634jhqivj7fw` reached `completed`.
  - done: backup dry-run and restore dry-run completed; restore run `cmrip2md7001h634j3viyahl6` reached `completed`.
  - done: rollback approval -> queued rollback -> CLI task-pull completed; rollback run `cmrip2mfy001y634j7npsvw54` reached `completed`.
  - done: observability checks returned HTTP 200 for server jobs, log streams, monitoring dashboard, and audit events.
  - remaining: this is Docker-backed staging evidence only; real provider credentials, real staging/prod targets, and live production backup/restore execution remain external release-signoff items.

## G003 Docker Staging Judgment

- status: production_like_staging_passed_external_signoff_required
- evidence:
  - done: local bounded slices S011-S020 are complete with board results and verification logs.
  - done: S019 cleared the S016 live permission/tenant E2E blocker.
  - done: S020 cleared the restore first-class product implementation blocker.
  - done: S021 cleared the local staging verification blocker with disposable Docker-backed provider/resource/deploy/task-pull/backup/restore/rollback evidence.
  - remaining: do not claim real cloud/provider production validation from S021; real provider/resource provisioning and production backup/rollback rehearsals still require approved credentials and targets.

## S022 Release Evidence Package

- status: done
- goal: package the G003 release evidence and final hygiene for commit readiness without rerunning S011-S021 or claiming real provider/production signoff.
- evidence:
  - done: release evidence index written at `.agent-board/release-evidence/G003-S022-release-evidence-index.md`.
  - done: JSON parse passed for board, G003, S011-S022 slices/results/verification, and S021 summary; log `/tmp/codex-tool-runs/svton/g003-s022-final-hygiene/svton/g003-s022-post-index-json-parse-20260713-135618.log`.
  - done: `git diff --check` passed; log `/tmp/codex-tool-runs/svton/g003-s022-final-hygiene/svton/g003-s022-post-index-diff-check-20260713-135618.log`.
  - done: focused API Jest passed for backup restore and server-executor current-pressure behavior; log `/tmp/codex-tool-runs/svton/g003-s022-final-hygiene/svton/g003-s022-api-focused-jest-20260713-135250.log`.
  - done: API type-check passed; log `/tmp/codex-tool-runs/svton/g003-s022-final-hygiene/svton/g003-s022-api-type-check-20260713-135250.log`.
  - done: `.zcode/` remains local untracked state and is not part of the release evidence package.
  - remaining: real provider/resource provisioning, production backup/rollback rehearsal, and live restore approval/isolation/rollback validation remain external signoff items.
