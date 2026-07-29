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

---

# F383 Release Mainchain — SUCCESS (2026-07-29, real 6-stage deploy)

The real 6-stage Picshare release on `master` over password SSH now reaches
**succeeded** end-to-end. This update supersedes the earlier "blocked by
private-repo git auth" status.

## Final successful ReleasePlan

- **Plan ID**: `cms5kc2rp009z14kkn2ch9lqb` — `F383 final closure 2026-07-29T04:06`
- **Branch**: `master` (from `Project.config.source.branch`)
- **Status**: `succeeded`
- **All 6 stages succeeded** (real Attempts + Jobs/DeploymentRuns):

| Stage | Status | Attempt | Job/DeploymentRun |
|---|---|---|---|
| backend schema_migration | succeeded | cms5kcedf00bk | SEJ cms5kceei00bq |
| backend bootstrap | succeeded | cms5kd1hx00cn | SEJ cms5kd1i600cr |
| backend application_deploy | succeeded | cms5kdoni00d8 | DR cms5kdooh00dl |
| backend health_check | succeeded | cms5kebsy00ee | SEJ cms5kebt900ei |
| admin application_deploy | succeeded | cms5keyyd00f3 | DR cms5keyz100fe |
| admin health_check | succeeded | cms5kfm4700g5 | SEJ cms5kfm4h00g9 |

- **2 successful DeploymentRuns** (backend + admin), both `completed`.
- **Containers**: `picshare-backend` Up (healthy), `picshare-admin` Up (healthy).
- **API re-read** (refresh): plan=succeeded, branch=master, all 6 stages succeeded.

## Evidence bridge (§1) linkage — verified

`ApplicationServiceInitialization` row `cms5h9whs`: status=completed,
releasePlanId=cms5kc2rp, releaseStageId, releaseStageAttemptId (bootstrap attempt),
releaseEvidenceStatus=**verified**. Parent-child linkage auditable; release-driven
deploy verified the evidence instead of re-running initialization.

## Approval bridge — verified

4 derived `deployment` approvals, all `metadata.bridgedBy=release-deployment-approval-bridge`
with parent release-approval id. No orphan/other-plan approvals.

## Zero-leak — verified

`DeploymentRun.commandPlan` scan for the plaintext DB password token: **0 hits**.
write_env command persisted as `***REDACTED***`; real heredoc rendered in-memory only.

## Additional fixes this session (commits b06a3b70 → fc7ba77b)

| Commit | Fix |
|---|---|
| b06a3b70 | deployment-run adapter resolves project name for live-executor confirmationText |
| 9d7d2291 | ssh-live heredoc-aware indent (write_env .env heredoc closes correctly) |
| c42f67f5 | reapply deployment .env secrets at queue boundary (write_env step) |
| 033a7d6a | write-env-file policy matches execution-boundary real heredoc form (REVERTED — zero-leak: reapply sets secretEnv only, policy stays redacted-only) |
| bb286806 | health_check step BusyBox retry loop + curl-health-check policy matches loop form |
| 984b0cbb | health-check sentinel: expand $code/$i + strip base64 newlines |
| fc7ba77b | zero-leak reapply (secretEnv only) + remove stale queue-env warning |

Picshare repo (separate): `docker-compose.devpilot.yml` healthcheck path fixed to
`/api` (was `/api/health/readiness` which returns 404) + BusyBox-compatible retry loop.

## Status: F383 release mainchain complete; F383 overall stays in-progress

The 6-stage release mainchain is verified green end-to-end. F383 overall is NOT
marked done (next session: UI deep-link + zero-leak verifier), per the completion boundary.

---

# F383 Reproducible Clean-Master Rerun — SUCCESS (2026-07-29)

> 执行者：OpenAI Codex（GPT-5 系列）
>
> 工具：Git、Docker Compose、MySQL/Prisma 数据回读、真实 Devpilot 页面、真实容器秘密值零泄漏扫描
>
> 完整日志：`/tmp/codex-tool-runs/svton/f383-clean-rerun/`

本节取代上一节把计划 `cms5kc2rp009z14kkn2ch9lqb` 作为最终可复现证据的结论。
旧计划的运行结果真实，但当时 Picshare 健康检查修复未进入其记录的
`master@9506a051`，部署目标又把本机 Picshare 工作区挂载为
`/workspace/picshare`，因此成功依赖未提交文件。旧计划只保留为运行问题排查证据。

## Picshare source boundary

- 健康检查修复独立提交：`8e7c465d56e68dafcef0dfbc480fe721044b0fb3`
  （`fix(deploy): make backend healthcheck BusyBox-compatible`）。
- 已推送 `origin/master`；本地 `master`、`origin/master` 与部署挂载目录 HEAD 一致。
- 发布前、发布中、发布后 Picshare 工作区均无未提交改动。
- Compose 结构校验通过；Backend 健康检查使用 BusyBox 兼容重试循环和真实 `/api` 端点。

## Final reproducible ReleasePlan

- **Plan ID**：`cms5m7z2001ow14kkg3jg0l87`
- **Branch / commit**：`master` /
  `8e7c465d56e68dafcef0dfbc480fe721044b0fb3`
- **Mode / status**：`live` / `succeeded`
- **Started / finished**：2026-07-29 04:59:30 / 05:02:57（数据库时间）

| Stage | Attempt | Job / DeploymentRun | Result |
|---|---|---|---|
| backend schema_migration | `cms5m8kkc01r714kkv9b53rfm` | SEJ `cms5m8kko01rb14kksfudwxtf` | succeeded |
| backend bootstrap | `cms5m97q301rk14kkktbck0hf` | SEJ `cms5m97qb01ro14kktsjngv7r` | succeeded |
| backend application_deploy | `cms5m9uvp01st14kk9ct2cfri` | DR `cms5m9uwe01sy14kk7u4uig00` | succeeded / completed |
| backend health_check | `cms5mai0x01tb14kkyk6kaj0v` | SEJ `cms5mai1201tf14kkhisk032p` | succeeded |
| admin application_deploy | `cms5mb56g01uk14kksxwh12zn` | DR `cms5mb56z01up14kkj2kgyda8` | succeeded / completed |
| admin health_check | `cms5mbsc201v214kkmxv5dgb8` | SEJ `cms5mbsc901v614kkz24cks4s` | succeeded |

两条 DeploymentRun 均为非 dry-run，且分支/提交与计划完全一致。4 条本计划
release-stage 审批及 2 条派生 deployment 审批均为 approved。

## Initialization evidence and zero-leak read-back

- `ApplicationServiceInitialization`：`cms5h9whs00iti73u07yggiel`
  为 completed / verified，并绑定本计划、bootstrap stage/attempt/SEJ。
- 零泄漏扫描从当前 Picshare Backend/Admin 容器提取真实秘密候选值但不回显，
  扫描本计划 2 条 DeploymentRun 与 4 条 ServerExecutionJob 的持久化参数、
  命令计划、日志、结果、错误及元数据：**0 hits / PASS**。
- 扫描结果：`/tmp/codex-tool-runs/svton/f383-clean-rerun/zero-leak.log`。

## Runtime and browser evidence

- `picshare-backend` running / healthy，`http://127.0.0.1:4100/api` 返回 200。
- `picshare-admin` running / healthy，`http://127.0.0.1:4101` 返回 200。
- 实际 Devpilot 发布页默认选中该新计划，展示
  `succeeded`、`master`、`8e7c465d`、开发环境及六项“成功”状态。

## Completion boundary

第一批“可复现的干净 master 六阶段主链”和第二批精确执行/部署深链接、计划级
零泄漏验证均已完成，F383 状态为 done。

2026-07-29 的 F383 + F384 集成验收进一步在
`codex/devpilot-f383-f384-integration` 上复验计划
`cms5m7z2001ow14kkg3jg0l87`：六阶段、六次尝试、两条 DeploymentRun、四条
ServerExecutionJob 和审批关联均与 Picshare
`master@8e7c465d56e68dafcef0dfbc480fe721044b0fb3` 一致；真实与伪造运行深链、
克隆数据库读回和零泄漏扫描均通过。权威集成结论见
`docs-internal/devpilot/f383-f384-integration-report.md`。
