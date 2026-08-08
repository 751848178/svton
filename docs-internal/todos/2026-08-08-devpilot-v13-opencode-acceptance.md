# Devpilot V13 OpenCode Independent Acceptance And Convergence

## Acceptance Goal

Independently audit the F434-F460 implementation and evidence produced on the V13 delivery branch. Existing `done`, `351/351`, reviewer, and `ACCEPTED` statements are historical claims to re-verify, not acceptance inputs. The final result must separately decide Demo parity, functional/runtime correctness, security, UI/UX/accessibility, evidence confidence, production readiness, and master-integration readiness.

## Frozen Baseline

- Protected checkout (read-only): `/Users/zhaoxingbo/Workspace/ai-driven/svton`; initial status contains only user-owned `?? check2.mjs`.
- Writable acceptance checkout: `/Users/zhaoxingbo/Workspace/ai-driven/svton-devpilot-project-delivery-v13`.
- Branch: `codex/devpilot-project-delivery-v13`.
- Audit HEAD: `5f4685169a6e1995c32612303b3b20f859e87bb6`.
- F434 baseline: `bf3e6fabb0f637ebe2ce7eb381f5cbd5918d8ef3`.
- Required range: `bf3e6fabb0f637ebe2ce7eb381f5cbd5918d8ef3..5f4685169a6e1995c32612303b3b20f859e87bb6`.
- Range summary: 278 files, 30,160 insertions, 2,015 deletions.
- Merge-base with current local `master`: `b6c3488743be13eacf4320f685da927488490113`; divergence `master...HEAD` is 3 left / 87 right.
- Demo SHA-256: `523080f43d935dba737fdfc0013f5133dc140c6d19936077692dfa556b549b0a`.
- Canonical spec SHA-256: `a491e9f5e9f583bf92fc56ef804a0884f5ab65bd93156a318b809f2b5b605393`.
- Task board: `/tmp/codex-tool-runs/svton/long-goals/devpilot-v13-opencode-acceptance/board.json`.

The canonical spec owns product/domain semantics. The frozen Demo owns layout, information hierarchy, interaction, visible state, and visual expectations. Every implementation delta must be classified as `canonical-approved difference`, `real data difference`, `intentional capability limitation`, `UI parity defect`, `functional defect`, `evidence defect`, or `documentation defect`.

## Scope

In scope: every changed path in the frozen range; Prisma schema/migrations; project/repository/environment/release/build/Manifest/Staging/Production/version/recovery/policy/approval/config/resource/secret/route behavior; API/Web tests and builds; isolated Docker parity stack; positive/version-history/negative E2E; Demo comparison; responsive, keyboard, focus, ARIA, axe, i18n, console/network; evidence provenance; documentation consistency; and necessary fixes for confirmed P0/P1 plus clearly bounded in-scope P2 findings.

Out of scope without later user authorization: implementing F461-F463, advanced traffic strategies deferred by canonical spec, public DNS/certificate provisioning, external production mutation, `master` merge/rebase/reset/cherry-pick, push, PR creation, worktree deletion, or modification of the protected checkout.

## Frozen Inputs To Re-read

- [x] `AGENTS.md`
- [ ] `docs-internal/todos/2026-08-04-devpilot-v13-demo-parity.md`
- [ ] `docs-internal/devpilot/project-delivery-v13-demo-parity-acceptance.md`
- [ ] `docs-internal/devpilot/progress/project-delivery-v13.md`
- [ ] `docs-internal/devpilot/project-delivery-v13-user-guide.md`
- [ ] `docs-internal/devpilot/project-delivery-v13-migration.md`
- [ ] `/tmp/codex-tool-runs/svton/f460/f460-final-verdict.md`
- [ ] F434-F460 production code, tests, migrations, scripts, evidence manifests, and referenced artifacts

Checked boxes above mean independently re-read in this acceptance run, not accepted as true.

## Three Independent Review Tracks

| Track | Worker | Status | Scope | Result |
| --- | --- | --- | --- | --- |
| Code and architecture | `code-architecture-audit` | queued | Full frozen diff, data model, calls/dependencies, invariants, concurrency, permissions, structure, and production-path test reach | `/tmp/codex-tool-runs/svton/long-goals/devpilot-v13-opencode-acceptance/workers/code-architecture-audit-result.json` |
| Product UI and browser | `product-ui-browser-audit` | queued | Current-run screenshots, Demo/spec comparison, all routes/states/viewports, interaction, a11y, i18n, deep links, console/network | `/tmp/codex-tool-runs/svton/long-goals/devpilot-v13-opencode-acceptance/workers/product-ui-browser-audit-result.json` |
| Runtime, E2E, and security | `runtime-e2e-security-audit` | queued | Clean stack provenance, migration/build/runtime chains, positive/history/negative behavior, secrets, network/provider boundaries, evidence validity | `/tmp/codex-tool-runs/svton/long-goals/devpilot-v13-opencode-acceptance/workers/runtime-e2e-security-audit-result.json` |

All first-phase workers are project-read-only, may write only their `/tmp` evidence/result artifacts, may not create successor workers, and must stop after their bounded report.

## Static And Runtime Verification Matrix

| Area | Required proof | Status | Evidence |
| --- | --- | --- | --- |
| Git/baseline | status, branch/HEAD, worktrees, merge-base/divergence, commits, full changed-path coverage | in progress | task board audit logs |
| Structure | responsibility/line count, dependency direction/cycles, controller/page ownership, fixture/hard-code scan | pending | architecture result |
| Prisma/migration | validate/generate, order/duplicates, fresh MySQL, pre-F434 upgrade | pending | runtime logs |
| Static | diff check, conflict markers, lint baseline, zh/en and ICU parity | pending | verification logs |
| API | type-check/build, F434-F460 focused, release-delivery, repository-analysis, complete suite | pending | API logs |
| Repository analysis regression | independently diagnose `repository-analysis-run.service.spec.ts` | pending | dedicated log/finding |
| Web | type-check/build, focused/project-route/full tests, axe, hydration/console/network | pending | Web/browser logs |
| Positive E2E | intake through exact Manifest, Staging, approval, Production, current version, site load, cross-layer IDs | pending | E2E evidence |
| Version history | repeat Staging without BuildRun growth, upgrades and Staging/Production recoveries | pending | E2E evidence |
| Negative E2E | connection/gates/provider/ownership/digest/drift/approval/concurrency/health/network/auth/secret/reset/files/evidence | pending | E2E/security evidence |

## UI Page Coverage Matrix

Every row requires correct data plus applicable empty/loading/blocked/running/success/failure/approval/unavailable states, unique primary action, URL/refresh/back, 1484x1324 comparison, 1280x800, 390x844 containment, zh/en, keyboard/focus/ARIA, and console/network evidence.

| Surface | Status | Current-run evidence |
| --- | --- | --- |
| `/projects`, create, and three-step intake | pending | |
| Project delivery home and release list | pending | |
| Release preflight and gate drill-down | pending | |
| Build step and logs | pending | |
| Staging step and logs | pending | |
| Production confirm/approval/execute | pending | |
| Environment versions, upgrade, and recovery | pending | |
| Project identification | pending | |
| Environment settings: target/resources/variables-secrets/domains-protection | pending | |
| Release policy | pending | |
| Deployment/evidence and global approval deep links | pending | |
| Dialogs, drawers, keyboard/focus, responsive/a11y state matrix | pending | |

## Historical AC Reclassification

- Total historical items to reclassify: 351.
- Allowed independent statuses: `independently verified`, `verified with limitation`, `failed`, `not reproducible`, `stale evidence`, `out of current environment`.
- Initial state: 0 independently reclassified; historical `[x]` markers remain untouched until source/current-run evidence is mapped.

## Confirmed Issues

No F464+ issue is confirmed at initialization. Known contradictions and risks remain under `Pending Confirmation` until independently reproduced.

## Pending Confirmation

- `docs-internal/todos/INDEX.md` still names F434 as next and F435-F460 pending.
- F459 says P3 notes were documented but does not enumerate them in its final acceptance note.
- F460 final gate does not state that the complete API suite ran on the current HEAD.
- Public-entry proof is loopback `127.0.0.1:43992`; public DNS/TLS was not proven.
- AC-POLICY-010 advanced strategies are deferred, not implemented.
- F458 MINOR deltas require page-by-page reclassification.
- `repository-analysis-run.service.spec.ts` historical failure must be rerun and diagnosed.
- F461-F463 remain real post-parity risks.
- New large/duplicated/cross-layer/fixture-specific production code may exist in the 278-file range.
- `/tmp` evidence may be stale, missing, hash-mismatched, or generated from old images/builds.

## Accepted Limitations

None accepted yet. Canonical deferrals, local-environment constraints, parity differences, and production rollout blockers will remain separate until evidence supports classification.

## Inherited Post-Parity Work

| ID | Status in this goal | Risk to evaluate | Implementation |
| --- | --- | --- | --- |
| F461 | retained/pending | repository-analysis multi-replica lease, heartbeat, stale takeover, CAS terminalization | prohibited unless user expands scope |
| F462 | retained/pending | Git egress/SSRF allowlist, resolution/pinning, redirect/rebinding/private-metadata blocking | prohibited unless user expands scope |
| F463 | retained/pending | legacy repository identity inventory, collision-safe audited remediation | prohibited unless user expands scope |

## F464+ Issue Ledger

F464 is the first free ID at initialization. Add one atomic row per confirmed issue only after checking for ID collisions.

| ID | Severity | Status | Source | Affected F/AC | Reproduction / expected / actual | Root cause | Allowed paths / forbidden scope | Verification / evidence | Disposition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

## Final Verdict Status

- Demo parity: pending
- Functional/runtime: pending
- Security: pending
- UI/UX/a11y: pending
- Evidence confidence: pending
- Production readiness: pending
- Master integration readiness: pending
- Overall allowed value (`ACCEPTED`, `ACCEPTED WITH LIMITATIONS`, `REJECTED`): pending

The historical OpenCode verdict remains preserved. This document records the independent Codex verdict and must not silently rewrite historical evidence.
