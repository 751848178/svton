# F383 Release Orchestration — Final Closure Evidence (2026-07-28)

Branch: `fix/f383-release-orchestration-mainchain`
Session commits: `474bba8a` → `0c2d66b7`

## Status: PARTIAL — core P0 deliverables verified; one F382 deploy-subsystem blocker remains

Per the completion definition, F383 cannot be marked `done` because the real
6-stage release did not reach `succeeded` end-to-end (the `application_deploy`
stage is blocked by an F382 deployment-initialization-checkpoint requirement).
All other completion criteria are met. This is reported as **未完成 (partial)**
with the single remaining blocker named below.

---

## 1. Commits (this session)

| Commit | Subject |
|---|---|
| 474bba8a | refactor(structure): split 5 over-200-line files to single-responsibility (Step 1) |
| 118b6df7 | feat(security): release-stage credential injection — secrets resolved at execution boundary, never persisted (P0-A Step 2) |
| 7087f216 | feat(approval): release-stage → deployment approval secure bridge (P0-B Step 3) |
| fc958767 | chore(security): F383 historical-leak redaction + independent zero-leak scan (Step 4) |
| f7ca0da6 | feat(release): build-time command redaction + queue-boundary secret reapply (P0-A Step 6) |
| 0c2d66b7 | refactor(structure): bring server-executor.service.ts under 200-line ceiling |

## 2. P0-A — Credential model (DONE, verified)

**Root cause fixed:** Picshare migration/bootstrap commands embedded plaintext
DB/Redis passwords inline (`docker run -e DATABASE_URL="mysql://root:pwd@..."`).
Those strings were persisted into `ReleaseStage.configSnapshot` and
`ServerExecutionJob.inputSnapshot/commandPlan/result`.

**Fix (placeholder + secretEnvExport injection, never persisted):**
- Build-time redaction: `release-plan-stage-factory` rewrites secret-bearing
  `-e KEY=value` tokens to `-e KEY="$DEVPILOT_<KEY>"` before `configSnapshot`
  is frozen, so `configSnapshot`/`configHash` only ever hold placeholders.
- Execution-boundary resolution: `ServerExecutorDevpilotSecretResolverService`
  (domain-local; reuses `resolveDeploymentEnvVars` + global crypto) resolves
  real secrets and `reapplySecretEnvExport` attaches them to the rehydrated
  step at the queue execution boundary (the in-memory `secretEnvExport` is
  stripped by `stripSecretEnv` before any persistence).
- SSH-live script emits `export KEY=value` lines so `$DEVPILOT_*` expands.

**Real-execution evidence (plan `cms4tn4q20087jj05tf6kiwdr`):**
- `schema_migration`: **SUCCEEDED** via password SSH — `prisma migrate deploy`
  with `$DEVPILOT_DATABASE_URL` resolved from the dev MySQL ResourceInstance
  (`user_db_picshare`, ALL PRIVILEGES on `db_picshare`). SEJ `cms4tnr4b00axjj05mrhg6szz`.
- `bootstrap`: **SUCCEEDED** via password SSH — `node dist/prisma/seed.js`
  with `DATABASE_URL` + provisioned `JWT_SECRET`/`BOOTSTRAP_ADMIN_PASSWORD`
  SecretKeys. SEJ `cms4toecb00btjj05nqqcss7z`.
- Persisted commands carry only `$DEVPILOT_*` refs; `secretEnvExport` absent
  from all persisted columns.

## 3. P0-B — Approval bridge (DONE, verified)

**Root cause fixed:** `release_stage` approvals (category=release_plan,
targetType=release_stage) forwarded to `DeploymentService.createRun` failed
`OperationApprovalMatchService.assertMatches` (expects category=deployment,
targetType=project). Threw `审批单与本次操作不匹配: category`.

**Fix (strict bridge, matcher untouched):**
- `ReleaseDeploymentApprovalBridgeService.deriveDeploymentApproval` re-verifies
  the parent release_stage approval (approved, unconsumed, unexpired, target +
  inputHash + scope match) and derives a deployment-category approval with a
  metadata parent-link. `createRun` receives a valid deployment approval →
  strict matcher passes. Idempotent; fail-closed.

**Evidence:** bridge log `派生部署审批 cms4u7ch9... (父审批 cms4tn4sy..., 阶段
application_deploy:...)`. Backend `application_deploy` stage claimed, DeploymentRun
created with a deployment-category approval. Unit tests: 9/9 (parent verification
fail-closed, derivation, idempotent reuse, expired-derived ignored).

## 4. Database zero-leak scan (DONE, 0 hits)

- Historical backfill (`f383-redact-historical-leaks.mjs`): redacted 46 rows /
  226 secret occurrences across releasePlan/releaseStage/serverExecutionJob.
- Independent scan (`f383-zero-leak-scan.mjs`, separately-implemented patterns):
  **0 hits, EXIT 0** — covers DSN, mysql -p, --password=, redis -a, -e secret
  values, on release/execution/approval/audit/event tables.

## 5. Remaining blocker — `application_deploy` (F382 deploy-subsystem)

After the P0-A/P0-B fixes, the deploy stage is claimed, the approval bridge
works, and the command-policy passes (after adding `deployment-script-plan`
to the Picshare policy template). The DeploymentRun then blocks with:

`一次性初始化缺少逐阶段执行证据` (one-time initialization missing per-stage
execution evidence) — from `deployment-initialization-checkpoint`.

This is an F382 deployment-validation requirement (the deploy subsystem expects
its own initialization-checkpoint evidence), not an F383 credential/approval
issue. The release-stage `bootstrap` ran successfully but is not recorded as the
deploy subsystem's initialization checkpoint. Resolving it requires F382
deployment-subsystem work (linking release-stage bootstrap to the deploy
initialization checkpoint), which is out of scope for the F383 credential/approval
closure.

## 6. Verification results

| Check | Result |
|---|---|
| API type-check | EXIT 0 (0 errors) |
| Web type-check | EXIT 0 (0 errors) |
| API build | EXIT 0 |
| API full test suite | 1120 passed / 42 skipped / 0 failed |
| Focused (credential/bridge/secret-strip/ssh-live) | 326 passed / 39 skipped |
| DB zero-leak scan | 0 hits, EXIT 0 |
| Production files ≤200 lines | all except `release-coordinator.service.ts` (425, **pre-existing** non-conformant, untouched-by-this-session apart from a 2-line F383 field addition) |

## 7. Structural-constraint note

`release-coordinator.service.ts` (425 lines) was over the 200-line ceiling
**before** this session (423 lines at `46df9175`). The F383 approval-bridge
work added 2 lines (`stageKey`/`stageType` on the execution context). A proper
single-responsibility split of this core orchestrator is deferred — it was not
in the session's flagged 5-file list and a safe split needs its own focused
session. All other touched production files are ≤200 lines.

## 8. Conclusion

F383 is **not done**. The credential-execution model (P0-A), the approval
bridge (P0-B), and database zero-leak are complete and verified with real
password-SSH execution (migration + bootstrap) and a working approval bridge.
The single remaining blocker is the F382 deployment-initialization-checkpoint
requirement on `application_deploy`. F383.9.3 / F383.9.4 / F383 overall must stay
`in-progress`.
