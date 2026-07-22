# CR — devpilot credential injection (s042)

- **Branch**: `codex/devpilot-credential-injection-s042`
- **Worktree**: `/Users/zhaoxingbo/Workspace/ai-driven/svton-credinject-s042`
- **Reviewer**: CR subagent (deep local review)
- **Date**: 2026-07-22
- **Scope**: credential injection into the deployment flow + picshare compose

## Verdict

**REQUEST CHANGES — blocking security defect.**

The feature's own stated security contract (investigation doc §E, lines 35/207/251:
"`secretEnv` … never persisted") is violated by the implementation. Real DB/Redis
passwords are persisted in plaintext into multiple JSON columns and exposed via an
API endpoint. This must not merge until the `secretEnv` field is stripped from every
persisted serialization of `steps`.

Type-check, build, and the full deployment/server-executor/resource-request test
suite (198 tests) all pass — the defect is a logic gap, not a regression.

## Re-verification log

| Check | Command | Result |
|---|---|---|
| Type-check | `pnpm type-check` (apps/devpilot-api) | PASS, no errors |
| Build | `pnpm build` (apps/devpilot-api) | PASS |
| Targeted tests | `pnpm test -- --testPathPattern="deployment-env-injection|deployment-command-builders|deployment.service|ssh-live-script"` | 3 suites / 35 tests PASS |
| Policy + SSH tests | `--testPathPattern="ssh-live|server-command-policy|server-executor-input-snapshot"` | 2 suites / 12 tests PASS |
| Broad tests | `--testPathPattern="deployment|server-executor|resource-request"` | 32 suites / 198 tests PASS |

## Findings by severity

### CRITICAL — F1: `secretEnv` (real plaintext credentials) is persisted into `DeploymentRun.commandPlan`

The redaction in `buildEnvWriteStep` is defeated by the fact that the same step object
also carries `secretEnv` with the real values, and every `commandPlan` builder
serializes `steps` wholesale via `toJsonValue(steps)` (= `JSON.parse(JSON.stringify(steps))`),
which includes `secretEnv`.

Leakage points (all write to `DeploymentRun.commandPlan`, a persisted JSON column —
`schema.prisma:968` per the investigation doc):

- `apps/devpilot-api/src/deployment/deployment.service.ts:358` — blocked-by-approval
  path: `commandPlan: this.toJsonValue(steps)`
- `apps/devpilot-api/src/deployment/deployment.service.ts:698` — rollback blocked path
- `apps/devpilot-api/src/server-executor/adapters/script-plan.adapter.ts:148` — live
  execution result: `steps: input.steps`
- `apps/devpilot-api/src/server-executor/server-executor-result.utils.ts:39` (cancelled),
  `:89` (queued)
- `apps/devpilot-api/src/server-executor/server-executor-blocked-result.utils.ts:118`
  (policy-blocked), `:147` (concurrency-blocked)

Reproduced empirically: a step built by `buildEnvWriteStep` with
`{ DATABASE_URL: 'mysql://SUPER:SECRET:PASSWORD@host/db' }` round-tripped through
`toJsonValue` keeps the real password in the `secretEnv` subobject while the sibling
`command` field shows `***REDACTED***`. The redaction is cosmetic only.

**This directly contradicts the feature's design** — the investigation doc
(`docs/todos/2026-07-22-devpilot-credential-injection-investigation.md:43-44`,
`:196-201`) explicitly calls out `input.steps` being persisted verbatim into
`commandPlan` as "Key risk #1", and states the `secretEnv` field must be "never
persisted". The implementation added the field but never added the strip step.

**Required fix**: strip `secretEnv` from every step before any `toJsonValue(steps)` /
`steps: input.steps` serialization. Simplest: a `redactStepsForPersistence(steps)`
helper mapped at each persistence site, or make `buildServerExecutionInputSnapshot`
and all `commandPlan` builders omit `secretEnv`.

### CRITICAL — F2: `secretEnv` is persisted into the job-queue `inputSnapshot` column and exposed via API

- `apps/devpilot-api/src/server-executor/server-executor-job-lifecycle-write.service.ts:60`
  stores `buildServerExecutionInputSnapshot(input)` into `serverExecutionJob.inputSnapshot`.
  That snapshot serializes `steps` including `secretEnv`
  (`server-executor-input-snapshot.utils.ts:37`).
- `apps/devpilot-api/src/server-executor/server-execution-job.controller.ts:134`
  exposes `job.inputSnapshot` through `getJsonAccessScope(job.inputSnapshot)` on the
  job-detail API. Any caller with read access to the job can read the plaintext
  credentials.

Note: `rehydrateServerExecutionInput` → `readCommandStepsSnapshot`
(`server-executor-input-snapshot.utils.ts:150-181`) does NOT read `secretEnv`, so the
field is silently dropped on rehydration. That masks the leak in the re-execution path
but does not remove it from the persisted column or the API response.

**Required fix**: omit `secretEnv` when building the input snapshot (or strip it in
`toJsonValue` at that site).

### HIGH — F3: `server_agent` transport would write `***REDACTED***` as the actual password

The real-heredoc reconstruction (`renderEnvWriteCommandReal`) is wired only into the
SSH adapter (`apps/devpilot-api/src/server-executor/adapters/ssh-live-script.utils.ts:17-20`).
The server-agent task-pull payload path
(`server-agent-task-pull-claimed-payload-details.utils.ts:38-49`,
`buildServerAgentTaskPullCommandStepPayload`) deliberately omits `secretEnv`, and
`rehydrateServerExecutionInput` drops it too. So a deployment whose target resolves to
the `server_agent` transport receives only the redacted `command`
(`cat > .env <<'EOF' ... ***REDACTED*** ... EOF`) and would write literal
`***REDACTED***` into the `.env` on the remote host — breaking the deploy silently.

This is the exact failure mode the review brief flagged in dimension #2. The SSH path
is correct; the agent path is not. Either (a) reconstruct the real heredoc in the agent
payload builder too, or (b) document that credential injection is SSH-only and
short-circuit `resolveEnvVarsSafe` to `{}` for agent targets.

### MEDIUM — F4: Heredoc delimiter injection via crafted credential value

`renderEnvWriteCommandReal` and `formatEnvFile` do not escape values. If any credential
value contains a line equal to `DEVPLOT_ENV_EOF`, the inner heredoc terminates early and
the following lines of the "value" execute as shell. Demonstrated:

```
cat > .env <<'DEVPLOT_ENV_EOF'
DATABASE_URL=normal_value
DEVPLOT_ENV_EOF          <- heredoc ends here
rm -rf / # injected      <- executed as shell
DEVPLOT_ENV_EOF
```

Credentials are attacker-influenced (a compromised/malicious provisioning result can set
a crafted password). Probability is low but the impact is arbitrary remote code
execution on the deploy target. Mitigations: pick a randomized delimiter per invocation
(the outer wrapper already uses `__DEVPILOT_SCRIPT_<uuid>`, reuse that pattern for the
inner heredoc), and/or validate that no value contains the delimiter.

### MEDIUM — F5: Policy regex / interpolation key-case mismatch can block valid deploys

`interpolateEnvTemplate` (`deployment-env-injection.utils.ts:124`) accepts env keys
matching `/^[A-Z_][A-Z0-9_]*$/i` (case-insensitive — lowercase keys pass). The
`write-env-file` policy rule
(`server-command-policy-deployment-rules.constants.ts:56`) requires
`[A-Z_][A-Z0-9_]*` (uppercase only). A resource type whose `envTemplate` emits a
lowercase key produces a redacted command the policy rejects → deploy blocked at the
allowlist. Tighten the interpolation regex to uppercase-only to match the policy (and
`.env` convention).

### MEDIUM — F6: Newline in a credential value breaks the heredoc and the policy regex

`formatEnvFile` does not escape values. A credential containing `\n` (e.g., a TLS cert
or multi-line key) inserts extra lines into the heredoc body, shifting the closing
delimiter and causing (a) the policy regex to fail to match → deploy blocked, and (b) a
malformed `.env` if it did match. Either reject values containing newlines in
`buildEnvWriteStep`, or base64-encode values, or use a quoting strategy that survives
multi-line content.

### LOW — F7: Multi-instance merge semantics are surprising/undocumented

`resolveDeploymentEnvVars` queries `orderBy: { createdAt: 'desc' }` and merges in array
order with last-write-wins per key. For two `mysql` instances (both yielding
`DATABASE_URL`), the OLDER instance wins (it appears later in the desc-ordered array and
overwrites the newer). This is counterintuitive for a "newest wins" mental model and is
undocumented. Either reverse the iteration so newest wins, or document the behavior, or
reject ambiguous duplicates.

### LOW — F8: SSH stdout/stderr capture could echo secrets from downstream commands

`ssh-live-completed-result.utils.ts:37,42` and `ssh-live-result.utils.ts:93,98` persist
`result.stdout`/`result.stderr` (truncated) into `DeploymentRun.logs`. The heredoc body
itself is not echoed by `cat`, but if a later step (e.g., a build/deploy command) prints
the env or runs `set -x`, the secret would be captured into `logs`. The investigation
doc notes `safety.secretsInOutput: 'must_mask_before_persisting'`
(`script-plan.adapter.ts:143`) — that masking is not implemented for captured output.
Consider scrubbing known secret values from stdout/stderr before persisting, or at least
documenting the residual risk.

### LOW — F9: picshare compose fallback defaults reference removed hosts

`picshare/docker-compose.devpilot.yml:20,33` — the `DATABASE_URL` and `REDIS_HOST`
fallback defaults still point at `picshare-mysql` / `picshare-redis`, but those services
are no longer in this compose (correctly removed). The header comment claims a manual
`docker compose up` "still works" without devpilot; it will start containers but they
cannot reach a database. Functionally harmless under devpilot (real values are injected
via `.env`), but the comment is misleading. Either drop the fallback defaults (require
`.env`) or update the comment.

## Dimensions checklist (brief)

1. **Credential leakage in logs/commandPlan/inputSnapshot/audit/policy** — FAIL. See
   F1/F2 (CRITICAL) and F8 (LOW). Policy decision records are safe (`evaluateStep`
   reads only `step.command`, the redacted form). Audit `metadata` written by
   `deployment.service` is safe (only `envVarsInjected: listEnvVarKeys(...)`, sorted
   keys — deployment.service.ts:535). The leak is confined to `commandPlan` and
   `inputSnapshot`.
2. **Redacted template safety / real reconstruction** — SSH path correct; agent path
   broken. See F3.
3. **Heredoc quoting / delimiter collision** — quoted delimiter correctly prevents
   shell expansion of the body; closing delimiter matches. But value-driven delimiter
   collision is an RCE vector. See F4.
4. **Command policy regex** — correctly matches only the redacted form and rejects real
   values; case mismatch and newline cases are gaps. See F5/F6.
5. **resolveDeploymentEnvVars robustness** — good: returns `{}` when no
   projectId/environmentId; tolerates decryption failure per-instance (drops to empty
   credentials, keeps delivery); skips instances with null `envTemplate`. Gaps: decrypt
   failure renders an empty-password URL rather than skipping the instance (test at
   spec line 250-276 asserts `mysql://u:@mysql-h:3306/d` — a working but
   credential-less DSN); multi-instance merge is surprising (F7).
6. **picshare compose correctness** — no `mysql`/`redis` services remain; no orphaned
   `volumes:`; `depends_on` for admin→backend is valid; backend does not reference
   `picshare-mysql`/`picshare-redis` except in the (now-stale) fallback defaults (F9).
7. **Prisma migration** — `prisma migrate deploy` against the empty `db_picshare` will
   create all tables from the existing migrations (`20251229152632_init` …); no
   conflict risk on a fresh DB. OK.
8. **Test quality** — good coverage of the pure-function security boundary
   (`buildEnvWriteStep` stores redacted `command` + real `secretEnv`;
   `renderEnvWriteCommandReal` reconstructs; policy rules accept redacted and reject
   real; missing-resources → `{}`; decrypt-failure tolerance). **Gap**: no test
   asserts that `secretEnv` is ABSENT from persisted `commandPlan`/`inputSnapshot` —
   which is exactly why F1/F2 slipped through. Add serialization-stripping tests.
9. **Code style / file sizes** — all new/changed files ≤ 200 lines:
   `deployment-env-injection.utils.ts` = 199, `deployment-command-builders.utils.ts` =
   114, `deployment-command-builders.utils.spec.ts` = 66,
   `deployment-env-injection.utils.spec.ts` = 301 (spec, exempt from the 200-line
   ceiling per the structural standard). OK.
10. **Module wiring / DI** — `DeploymentModule` imports `ResourceRequestModule` (new);
    `ResourceRequestModule` does NOT import `DeploymentModule` (no cycle).
    `ResourceRequestStatusWriterService` is now exported
    (`resource-request.module.ts:67`) and provided; its `decrypt(encryptedText)`
    signature matches `EnvInjectionCrypto`. The spec mock
    (`deployment.service.spec.ts:55`) `{ decrypt: jest.fn() }` matches. OK.

## Single most important finding

**F1/F2: `secretEnv` carrying real plaintext DB/Redis passwords is persisted into
`DeploymentRun.commandPlan` and `serverExecutionJob.inputSnapshot`, and the latter is
served verbatim through the `ServerExecutionJobController` API.** The redaction in
`step.command` is cosmetic because the sibling `secretEnv` field round-trips through
every `toJsonValue(steps)` / `steps: input.steps` serialization. This is the exact
"Key risk #1" the investigation doc warned about and it is unimplemented as a defense.
Blocking until a `redactStepsForPersistence` strip is applied at every persistence
site, plus a regression test asserting `secretEnv` never appears in a serialized
`commandPlan` or `inputSnapshot`.

## Remediation log (2026-07-22, architect subagent)

- F1 (CRITICAL): applied. New `stripSecretEnv()` in
  `deployment-secret-strip.utils.ts`, called at every persistence site:
  `deployment.service.ts` (blocked + rollback `commandPlan`),
  `script-plan.adapter.ts`, `server-executor-result.utils.ts` (cancelled +
  queued), `server-executor-blocked-result.utils.ts` (policy + concurrency),
  plus the SSH-live result builders (`ssh-live-result.utils.ts`,
  `ssh-live-completed-result.utils.ts`) which had the same defect on the live
  path. Stripped from both the persisted `commandPlan.steps` and the result's
  `commandSteps` (the latter is re-serialized into `commandPlan` by
  `server-executor-site-run-sync.service.ts`, so it is also a persistence
  vector).
- F2 (CRITICAL): applied. `buildServerExecutionInputSnapshot` strips
  `secretEnv` before serializing into `serverExecutionJob.inputSnapshot`
  (covers both inline + queued paths — `buildQueuedServerExecutionJobInputSnapshot`
  delegates to it).
- F3 (HIGH): documented as TODO in `buildEnvWriteStep` (agent transport is
  disabled; out of scope).
- F4 (MEDIUM): applied. `renderEnvWriteCommandReal` now uses a randomized,
  value-collision-free delimiter (`DEVPLOT_ENV_EOF_<8 hex>`); the fixed
  delimiter is retained only for the redacted/persisted form so the policy
  rule still matches.
- F5 (MEDIUM): applied. `interpolateEnvTemplate` key regex is uppercase-only,
  matching the `write-env-file` policy rule.
- F6 (MEDIUM): applied. `formatEnvFile` escapes literal newlines in values to
  `\n`.
- F7 (LOW): documented as TODO in `resolveDeploymentEnvVars`.
- F8 (LOW): documented as TODO in the SSH-live result builders.
- F9 (LOW): **out of scope for this worktree.** The target file
  `picshare/docker-compose.devpilot.yml` lives in a SEPARATE git repo at
  `/Users/zhaoxingbo/Workspace/ai-driven/picshare`, outside this worktree, so
  the edit cannot ship in this branch's commit. Fix to apply in the picshare
  repo:
  - line 20: `DATABASE_URL: ${DATABASE_URL:-mysql://CHANGE_ME}` (drop the
    `picshare-mysql` host reference; a missing/placeholder value is better
    than a wrong one — the platform injects the real DSN via `.env`).
  - line 33: `REDIS_HOST: ${REDIS_HOST:-}` (empty default; no `picshare-redis`).
  - lines 1-6: update the header comment to drop the "manual `docker compose
    up` still works without devpilot" claim (it starts containers but cannot
    reach a DB).
