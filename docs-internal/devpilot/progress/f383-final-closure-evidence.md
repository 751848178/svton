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

---

# F383 Release Mainchain — Evidence Update (2026-07-29 session)

Branch: `fix/f383-release-orchestration-mainchain`
Session commits: `ca22005d` → `b06a3b70`

## Status: PARTIAL — release mainchain code complete + verified; live 6-stage deploy blocked by private-repo Git auth at the deploy target

This session implemented and verified the formal **release-initialization evidence
bridge** plus state-sync, branch-source, drive-script, and structural fixes. All
code-level verification is green (type-check/build/full-test/integration/SSH). The
real 6-stage deploy now reaches `schema_migration` + `bootstrap` succeeded over
password SSH, the evidence bridge records and verifies bootstrap evidence, and the
previously-stuck plan auto-terminates correctly. The deploy is blocked ONLY at the
`application_deploy` git-fetch step because the SSH target and API container have no
GitHub credentials for the private Picshare repo. This is an environment-auth gate,
not a code defect. F383 overall stays `in-progress`.

## 1. Commits (this session)

| Commit | Subject |
|---|---|
| `ca22005d` | feat(release): F383 release/deployment initialization evidence bridge + mainchain fixes |
| `b06a3b70` | fix(release): deployment-run adapter resolves project name for live-executor confirmationText |

## 2. Deliverables

- **Evidence bridge (§1)**: `ReleaseInitializationEvidenceService` (record/verify,
  fail-closed) + migration adding auditable parent columns
  (releasePlanId/releaseStageId/releaseStageAttemptId/serverExecutionJobId/releaseEvidenceStatus)
  on `ApplicationServiceInitialization`. `DeploymentService.createRun` verifies the
  ref from DB (scope/fingerprint/stage-type/succeeded) when `releaseApplicationOnly`;
  direct deploys keep original F382 semantics. Public controller strips all internal
  bridge fields.
- **State sync (§2)**: blocked (non-approval) DeploymentRun → release stage `failed`
  (fail-closed); orphan expired attempt → `failed` (not hung). Proven: the stuck
  plan `cms4tn4q2` auto-transitioned `running`→`failed`.
- **Branch source (§3)**: removed hardcoded `|| "main"`; orchestrator inherits
  `Project.config.source.branch` (Picshare = master); new branch-resolution utils.
- **Drive script (§4)**: env-injected creds, plan-scoped approvals only, precise
  matches, master asserted, safe logs.
- **Structural (§6)**: `release-coordinator.service.ts` 425→173; `server-executor-wiring-factory.service.ts` 211→190; all touched production files <200 lines.

## 3. Verification results

| Gate | Result | Log |
|---|---|---|
| API type-check | PASS | `/tmp/codex-tool-runs/svton/api-typecheck.log` |
| API build | PASS | `/tmp/codex-tool-runs/svton/api-build.log` |
| Web type-check | PASS | `/tmp/codex-tool-runs/svton/web-typecheck.log` |
| Web build | PASS | `/tmp/codex-tool-runs/svton/web-build.log` |
| API full test | 1144 passed, 42 skipped (integration-gated), 0 failed | `/tmp/codex-tool-runs/svton/api-fulltest.log` |
| Integration (real MySQL) | 44 passed, 3 skipped, 0 failed | `/tmp/codex-tool-runs/svton/api-integration-test2.log` |
| Password SSH (real sshd) | 3/3 passed (+ key regression) | `/tmp/codex-tool-runs/svton/ssh-integration-test.log` |
| Running API/Web = latest HEAD | YES (`ca22005d`/`b06a3b70` in container dist) | — |

## 4. Live deploy evidence (plan `cms5hnkib000bky71c746mhj0`, branch master, password SSH)

- `schema_migration` (backend): **succeeded** — job `cms5hnnt0001uky71bezo7dib`, attempt `cms5hnnsi001qky71epy6pjzg`, real password-SSH `prisma migrate deploy`.
- `bootstrap` (backend): **succeeded** — job `cms5hoayt002lky71ypoqv75s`, attempt `cms5hoayj002fky71fp4uvahq`; evidence recorded (verified by the bridge on the subsequent deploy).
- `application_deploy` (backend): **failed** at git checkout — `git fetch --all --prune` → `fatal: could not read Username for 'https://github.com'` (private repo, no credentials on the deploy target or API container).
- Approval bridge: 4 plan-scoped approvals bound (no orphan/other-plan approvals).

## 5. Remaining blocker (next session)

Provide GitHub read credentials to the deploy target (and/or API container) for
`github.com/751848178/picshare.git`, OR point the project gitRepo at an
auth-free mirror, then rerun `f383-drive-release.mjs` to complete the 6 stages.
The code path is verified correct up to the git-auth gate. Do NOT mark F383 done
until the live 6-stage deploy reaches `succeeded` and backend/admin are `healthy`.
