# F383 + F384 Integration Acceptance Report

## Decision

**可以合并到 `master`。**

The integration branch preserves the complete F383/F384 history, resolves the
local-master divergence without dropping later master fixes, passes the
database/API/Web and affected regression gates, and completes browser/API/DB
readback against a disposable clone of the real Picshare acceptance data.

This report does not authorize or perform the merge to `master`, and nothing
was pushed.

## Check Context

- Checked: 2026-07-29 CST.
- Agent: Codex (GPT-5; no more specific model identifier was exposed to the
  task).
- Integration branch: `codex/devpilot-f383-f384-integration`.
- Isolated worktree:
  `/tmp/codex-tool-runs/svton/f383-f384-integration/worktree`.
- Initial local `master`: `68aabfa7f99aa0a478eefdbcf09197ada700aafd`.
- F384 source ref:
  `codex/f384-repository-analysis@1524df449c2a3c72844ad9421921b62c959eb9bf`.
- Merge base: `8c4e3b6b7dad29828a9e1a0e9adc72eab5edecf4`.
- Initial divergence: 8 commits on local master, 54 commits on F384.
- Picshare proof source:
  `master@8e7c465d56e68dafcef0dfbc480fe721044b0fb3`; the Picshare worktree was
  clean before and after acceptance.
- Original svton checkout remained owned by another active task. Its unrelated
  untracked `check2.mjs` was not read, edited, staged, or committed.

## Integrated History

| Commit | Purpose |
| --- | --- |
| `e8fd95ee` | Register the bounded F383/F384 integration TODO. |
| `0887483e` | Merge F383/F384 history onto local master with two parents. |
| `bb8c46ca` | Activate the previously inert Devpilot Web test suite and repair the exposed label regression. |
| `f675a9ea` | Redact repository-analysis secrets at response, storage, command, review, and legacy-row boundaries. |
| `d85d85b5` | Preserve Date objects through response redaction after the browser exposed `Invalid Date`. |

The final ancestry check confirms that local master, F384 head, and the key
F383/F384 commits `dbce7a7f`, `cc87c2d8`, `5bffc4a6`, and `1524df44` are all
ancestors of this branch. The source feature ref still points to `1524df44`.

## Conflict Resolution

The merge reported 17 conflicts.

- Sixteen Pi migration code/document conflicts were resolved to the local
  master side because the later master changes were the semantic superset of
  the patch-equivalent F384-side Pi migration.
- `pnpm-lock.yaml` was not chosen from either side. It was regenerated from the
  merged manifests with frozen workspace semantics, retaining both the master
  Playwright/Pi dependencies and the F383 `packages/nestjs-http` Jest
  dependencies.
- One non-conflict merge-hygiene issue in
  `ssh-live-script.utils.spec.ts` was normalized before the merge commit.
- No Devpilot Prisma model, migration, repository-analysis, release, or runtime
  production file had a master-only overlap.

Conflict paths:

1. `ai/agent-client/src/service/chat-message-store.ts`
2. `ai/agent-client/src/service/chat-runtime-bridge.ts`
3. `ai/agent-client/src/service/chat-runtime-lifecycle.ts`
4. `ai/agent-client/src/service/chat.service.ts`
5. `ai/agent-core/src/agent/runtime-compose.ts`
6. `ai/agent-core/src/agent/runtime-run.ts`
7. `ai/agent-core/src/agent/svton-agent-runtime.ts`
8. `ai/agent-core/src/agent/types.ts`
9. `ai/agent-core/src/index.ts`
10. `ai/agent-core/src/pi/foundation.ts`
11. `ai/agent-core/src/pi/index.ts`
12. `apps/agent-desktop/src/lib/agent-setup.ts`
13. `apps/agent-web/package.json`
14. `apps/agent-web/src/lib/agent-setup.ts`
15. `docs-internal/design/pi-agent-migration-architecture.md`
16. `docs-internal/todos/2026-07-28-pi-agent-migration.md`
17. `pnpm-lock.yaml`

Detailed pre-merge impact audit:
`/tmp/codex-tool-runs/svton/f383-f384-integration/w001-git-impact-audit.md`.

## Regressions Found And Closed

### Devpilot Web tests were not executing

The repository contained F384 Web specs but no active test runtime and the
Web TypeScript configuration excluded specs. The branch now has a Vitest
configuration and package script. The activated tests exposed and fixed a
missing space in the release dependency label.

Result: 6 files / 25 tests passed, plus Web type-check and production build.

### Repository-analysis details exposed stored command secrets

Security review proved that four authenticated API paths in historical
`currentValue` / `reviewedValue` data contained two unique literal
secret-bearing commands. The integration branch now:

- redacts response strings and secret fields;
- sanitizes repository-analysis JSON before storage;
- omits unsafe literal-secret commands while preserving `$VAR` / `${VAR}`
  references;
- rejects edited or accepted review values that still contain literals;
- cleans historical command paths and stale result blobs in migration
  `20260729204000_repository_analysis_redaction`.

Focused security verification: 3 suites / 37 tests after the Date regression
test was added. Full F384 backend verification before that final focused
addition: 7 suites / 45 tests. Permission, forged-ID, and redaction selection:
14 suites / 164 tests.

### Response redaction erased timestamps

The real repository history initially rendered `Invalid Date` because recursive
redaction converted Prisma `Date` objects into empty objects. The redactor now
preserves Date instances, with a dedicated regression test. API type-check and
build passed, and the browser rerun rendered all three real history timestamps.

## Database Acceptance

| Gate | Result |
| --- | --- |
| Prisma validate / generate | passed |
| Fresh MySQL 8 database | 55 / 55 migrations |
| Local-master baseline | 50 / 50 migrations |
| Baseline to integration upgrade | 55 / 55 migrations |
| Fresh / upgraded schema hash | identical: `3fbdd88a1d464f56c29ace301773bb0bb506437c531ece9d903d2e1b9404afc4` |
| Legacy secret sentinel | 18 seeded command paths before; 0 command groups and 0 sentinel matches after |
| Safe legacy markers | 3 preserved |
| Legacy run result | cleared to `NULL` |
| Release coordinator DB suite | 28 / 28 |
| Release dependency resolver DB suite | 4 / 4 |

The runtime acceptance used a separate clone of the existing Picshare
acceptance database:

- source database remained at 54 migrations;
- clone reached 55 migrations;
- no source container or source database was restarted or written by this
  task;
- all clone containers, network, volume, database dump, and runtime
  authentication file were deleted after readback.

Primary database evidence:

- `/tmp/codex-tool-runs/svton/long-goals/f383-f384-integration/workers/w005-result.json`
- `/tmp/codex-tool-runs/svton/f383-f384-integration/w005-redaction-81310e566818483f898e957aed18a50d/logs/svton/w005-redaction-db-verification-20260729-204349.log`
- `/tmp/codex-tool-runs/svton/f383-f384-integration/w005-redaction-81310e566818483f898e957aed18a50d/logs/svton/w005-legacy-redaction-proof-rerun2-20260729-204837.log`
- `/tmp/codex-tool-runs/svton/f383-f384-integration/runtime-db-readback.tsv`

## Static And Affected Regression Gates

| Surface | Result |
| --- | --- |
| F383 API high-signal selection | 7 suites / 38 tests |
| F384 backend | 7 suites / 45 tests |
| Permission + forged ID + redaction | 14 suites / 164 tests |
| Devpilot Web | 6 files / 25 tests |
| Devpilot API type-check / build | passed |
| Devpilot Web type-check / build | passed |
| Pi Core | 330 files / 1841 tests |
| Pi Client | 12 files / 267 tests, strict type-check passed |
| Pi Web | 4 files / 25 tests |
| `packages/nestjs-http` | 1 file / 3 tests |
| Diff whitespace | passed |
| Integration-authored production TS / TSX | 10 files; all at or below 200 lines |

Verifier result:
`/tmp/codex-tool-runs/svton/long-goals/f383-f384-integration/workers/w004-result.json`.

The 13 production TS/TSX paths involved in Pi conflict resolution are
byte-identical to local master after resolution, so the integration does not
introduce a content change to those files. Some are legacy files above 200
lines; splitting them would be an unrelated master refactor explicitly outside
this integration task. The production files actually changed by the
integration repairs (Web label, response/storage/command/apply redaction, and
Date preservation) all satisfy the 200-line ceiling; the largest is 195 lines.

## Picshare Runtime Acceptance

The exact integrated API `dist` and Web `.next` outputs were mounted read-only
over the already verified Devpilot runtime dependency images. They ran on
isolated ports 3221 / 3220 with a private clone database and Redis. Live server
execution, queue workers, resource provisioning, resource schedulers, and
recovery workers were explicitly disabled.

A fresh Docker dependency-layer build was also started, but stopped after the
dependency install produced no terminal result for about eight minutes. This
was not used as proof. The exact branch production builds and the exact mounted
runtime artifacts are the acceptance proof.

Browser proof:

- Picshare overview is healthy and complete at 6/6.
- Repository connection is `connected`, branch `master`, exact commit
  `8e7c465d56e68dafcef0dfbc480fe721044b0fb3`.
- Three repository-analysis history entries render valid timestamps.
- Run `cms5xb3o2000aazxpaut9boes` is succeeded with 6 stages, 5 suggestions,
  and all 5 review decisions persisted.
- Historical command fields are absent and the UI explains that security
  policy removed them.
- Application view contains 2 applications and 3 services, all bound to the
  real Picshare development environment.
- The development environment detail shows its real server, resource
  instances, masked keys, deployment count, and service profile.
- The backend service monitoring deep link selects
  `Picshare App / backend`.
- Repository-analysis audit filtering shows 13 scoped events.
- F383 plan `cms5m7z2001ow14kkg3jg0l87` is succeeded with 6/6 succeeded stages,
  6 attempts, 2 linked deployment runs, 4 linked execution jobs, and 4 linked
  approvals.
- Deployment deep link `cms5m9uwe01sy14kk7u4uig00` opens the exact run with
  approved approval, completed execution, `master@8e7c465d`, and masked
  command/environment evidence.
- Forged project, repository run, deployment run, cross-project repository
  run, and release plan IDs return exact 404 responses. Browser forged project,
  repository-run, and deployment-run paths show explicit not-found states and
  do not fall back to list data.
- The only browser console errors were the intentionally exercised forged-ID
  404s.

Screenshots:

- `/tmp/codex-tool-runs/svton/f383-f384-integration/screenshots/picshare-overview-6-of-6.png`
- `/tmp/codex-tool-runs/svton/f383-f384-integration/screenshots/picshare-repository-analysis.png`
- `/tmp/codex-tool-runs/svton/f383-f384-integration/screenshots/picshare-repository-audit-events.png`
- `/tmp/codex-tool-runs/svton/f383-f384-integration/screenshots/picshare-environment-detail.png`
- `/tmp/codex-tool-runs/svton/f383-f384-integration/screenshots/picshare-f383-release-stage.png`
- `/tmp/codex-tool-runs/svton/f383-f384-integration/screenshots/picshare-deployment-run-detail.png`

API and database readback:

- `/tmp/codex-tool-runs/svton/f383-f384-integration/runtime-api-readback.json`
- `/tmp/codex-tool-runs/svton/f383-f384-integration/runtime-db-readback.tsv`
- `/tmp/codex-tool-runs/svton/f383-f384-integration/runtime-log-scan.json`

## Secret And Scope Readback

- Repository-analysis authenticated API detail: 0 sensitive findings.
- Stored suggestion command groups: 0.
- Stored suggestion URI-userinfo rows: 0.
- Repository-analysis audit rows with URI userinfo or literal secret
  assignment shape: 0.
- Integrated API/Web runtime logs: 0 sensitive findings.
- No raw secret values were copied into reports, screenshots, worker results,
  or readback summaries.

The original credential-bearing database dump and runtime token file were
deleted non-recoverably after the safe summaries were produced.

## Honest External Boundary

The proof uses the clean local Picshare checkout mounted read-only at its exact
public commit. No reusable private-provider credential was available inside the
disposable runtime. Remote private repository authentication and a real
production-provider rollout therefore remain external environment signoff,
not product claims made by this integration.

That boundary does not block merging F383/F384: public exact-commit analysis,
permissions, persistence, review/apply, release/deployment associations,
browser behavior, migrations, redaction, and failure semantics are all proven
on the integrated branch.

## Merge Instructions

The branch is ready for a human-authorized merge into `master` after normal
review. Do not cherry-pick only the final fixes: merge the branch so that the
two-parent integration commit and the full F383/F384 ancestry are preserved.

No push and no actual `master` merge were performed by this task.
