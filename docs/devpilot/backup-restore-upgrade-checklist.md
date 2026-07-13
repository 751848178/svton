# Devpilot Backup, Restore, And Upgrade Checklist

This is the final production MVP handoff checklist. It separates implemented
source-backed checkpoints from required operator evidence and known blockers.

## Backup

Source-backed API:

- `GET /api/backups/plans`
- `POST /api/backups/plans`
- `PUT /api/backups/plans/:planId`
- `POST /api/backups/plans/:planId/runs`
- `GET /api/backups/runs`
- `POST /api/backups/runs/:runId/restore`

Production checklist:

- Create at least one active backup plan per production resource class.
- Run a dry-run backup first; live backup uses high-risk write policy.
- Confirm backup run status is visible in `/backups` and execution governance.
- Keep backup destination, retention days, and credential owner in the handoff.
- Store the backup run id and server execution job id in the evidence summary.

## Restore

Source evidence now includes a first-class restore dry-run endpoint/job:

- `POST /api/backups/runs/:runId/restore`
- dry-run restore plans are recorded as `BackupRun` rows with restore metadata;
- the write gate uses `backup.restore` with medium risk for dry-run and high
  risk for live restore requests;
- restore audit events record source backup id, validation query, rollback plan,
  and resulting restore run id;
- `dryRun:false` is intentionally blocked until restore approval, target
  isolation, and rollback validation are implemented for live execution.

Restore rehearsal evidence must include source backup id, target environment,
operator, restore command or job id, validation query, and rollback plan.

## Upgrade

Before upgrade:

- Snapshot database and Redis.
- Save current `.env`/secret version references.
- Save current image, commit SHA, migration version, and artifact ids.
- Run `corepack pnpm --filter @svton/devpilot-api exec prisma migrate deploy`
  in staging before production.
- Run API type-check/build and the focused readiness suites listed in
  `.agent-board/verification`.

During upgrade:

- Deploy API before Web when API schema changes are backward compatible.
- Keep `SERVER_EXECUTOR_*` and `RESOURCE_REQUEST_*` live workers paused unless
  the migration is known to be worker-safe.
- Resume queue workers only after health checks, auth/team checks, and
  execution-governance pages are green.

After upgrade:

- Run permission/tenant E2E against staging.
- Run resource request minimum-loop validation.
- Run backup dry-run and confirm the new run is visible.
- Trigger a deployment rollback rehearsal or record the approved external
  blocker.

## Rollback

Source-backed rollback evidence exists for deployment runs and post-rollback
smoke checks. Production rollback handoff still requires:

- rollback owner;
- rollback command policy template;
- target project/environment;
- source deployment run id;
- rollback run id;
- post-rollback smoke result;
- evidence directory path.

## Final G003 judgment

Status: `not_deliverable_until_external_blockers_clear`.

Completed in G003:

- current worktree closure;
- production config pack;
- command policy safety templates;
- agent production operating runbook;
- rehearsal trace governance;
- permission/tenant E2E script, runbook, and disposable local API proof;
- resource request minimum-loop runbook;
- backup/restore/upgrade checklist;
- backup restore dry-run endpoint/job.

Blocking before production MVP handoff:

- Live provider/resource provisioning and production backup/rollback rehearsals
  must be run with approved credentials and targets.
