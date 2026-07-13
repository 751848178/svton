# Devpilot External Signoff Pack

This pack lists the external approvals and evidence needed before Devpilot can be
called production MVP ready. It must not be used to imply real cloud, staging, or
production validation has already passed.

## Provider And Resource Provisioning

Required inputs:

- approved provider account or staging cloud credentials;
- target tenant, team, project, environment, and resource pool ids;
- allowed resource classes and quota limits;
- command policy profile for any execution steps;
- operator and release owner for the run window;
- evidence directory path under `/tmp/codex-tool-runs/svton/` or the approved
  release evidence archive.

Minimum approval:

- provider credential owner confirms the credentials may be used for this run;
- release owner confirms the target is staging or production and that resource
  creation is allowed;
- operations confirms cleanup, quota, and rollback responsibility.

Evidence to capture:

- resource request id, approval id, provisioning run id, provider state result;
- provider API or fake-provider substitute response summary;
- audit event ids and log stream links;
- monitoring dashboard result after provisioning;
- cleanup or deprovisioning plan.

## Production Backup And Rollback Rehearsal

Required inputs:

- backup target, retention policy, and credential owner;
- database, Redis, artifact, and environment snapshot identifiers;
- deployment run id or release artifact id to roll back from;
- rollback owner and approved time window;
- smoke check URL or command plus expected success condition.

Minimum approval:

- release owner approves the rehearsal window;
- operations approves backup destination and rollback target isolation;
- product owner accepts the rollback validation criteria.

Evidence to capture:

- backup run id and server execution job id;
- rollback run id and task-pull job id;
- post-rollback smoke result;
- migration version and image or commit SHA before and after rehearsal;
- evidence archive path and owner signoff.

## Live Restore Approval

Live restore remains intentionally blocked until all of these conditions exist:

- restore approval from release owner and data owner;
- isolated restore target that cannot overwrite production data accidentally;
- source backup id and restore run id;
- validation query or application-level verification path;
- rollback plan for a failed restore;
- operator identity and time window;
- explicit confirmation that `dryRun:false` is authorized.

Without those inputs, only restore dry-run evidence may be collected.

## Boss / Operations Approval Checklist

- Approve real provider credentials and target ids for provisioning.
- Approve resource creation quota and cleanup responsibility.
- Approve production backup target and retention settings.
- Approve rollback rehearsal target, owner, and smoke validation.
- Approve live restore target isolation, validation query, and rollback plan.
- Confirm where final evidence must be archived.

## Declaration Boundary

Current local evidence supports `production_like_ready_external_signoff_required`.
It does not support `production_mvp_ready` until the external approvals above are
granted and their run evidence is captured.
