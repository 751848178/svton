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
- [x] `docs-internal/todos/2026-08-04-devpilot-v13-demo-parity.md`
- [x] `docs-internal/devpilot/project-delivery-v13-demo-parity-acceptance.md`
- [x] `docs-internal/devpilot/progress/project-delivery-v13.md`
- [x] `docs-internal/devpilot/project-delivery-v13-user-guide.md`
- [x] `docs-internal/devpilot/project-delivery-v13-migration.md`
- [x] `/tmp/codex-tool-runs/svton/f460/f460-final-verdict.md`
- [x] F434-F460 production code, tests, migrations, scripts, evidence manifests, and referenced artifacts

Checked boxes above mean independently re-read in this acceptance run, not accepted as true.

## Three Independent Review Tracks

| Track | Worker | Status | Scope | Result |
| --- | --- | --- | --- | --- |
| Code and architecture | `code-architecture-audit` | completed / rejected | 278/278 paths; 5 P1 + 2 P2 source findings | `/tmp/codex-tool-runs/svton/long-goals/devpilot-v13-opencode-acceptance/workers/code-architecture-audit-details.json` |
| Product UI and browser | `product-ui-browser-audit` | completed / rejected | 11 current-run screenshots; signed-in matrix blocked by stale-session deadlock | `/tmp/codex-tool-runs/svton/long-goals/devpilot-v13-opencode-acceptance/workers/product-ui-browser-audit-details.json` |
| Runtime, E2E, and security | `runtime-e2e-security-audit` | completed / rejected | Current tests/migrations plus adversarial probe repro; 8 P1 + 2 P2 + 1 P3 | `/tmp/codex-tool-runs/svton/long-goals/devpilot-v13-opencode-acceptance/workers/runtime-e2e-security-audit-details.json` |

All first-phase workers are project-read-only, may write only their `/tmp` evidence/result artifacts, may not create successor workers, and must stop after their bounded report.

## Static And Runtime Verification Matrix

| Area | Required proof | Status | Evidence |
| --- | --- | --- | --- |
| Git/baseline | status, branch/HEAD, worktrees, merge-base/divergence, commits, full changed-path coverage | verified | 278/278 architecture manifest + baseline logs |
| Structure | responsibility/line count, dependency direction/cycles, controller/page ownership, fixture/hard-code scan | failed | F465-F470 and F483-F492 |
| Prisma/migration | validate/generate, order/duplicates, fresh MySQL, pre-F434 upgrade | verified | fresh 66/66; baseline 63 -> current 66 |
| Static | diff check, conflict markers, lint baseline, zh/en and ICU parity | verified with limitation | diff/conflicts clean; i18n 3486; final lint baseline still pending |
| API | type-check/build, F434-F460 focused, release-delivery, repository-analysis, complete suite | failed | 278 suites pass, 46 skip, one suite/7 tests fail; clean image build not reproducible |
| Repository analysis regression | independently diagnose `repository-analysis-run.service.spec.ts` | failed / root-caused | F471: stale constructor mocks, not production-path failure |
| Web | type-check/build, focused/project-route/full tests, axe, hydration/console/network | verified with limitation | type-check + 405/405; clean image/complete browser/a11y matrix pending |
| Positive E2E | intake through exact Manifest, Staging, approval, Production, current version, site load, cross-layer IDs | failed/stale | F465-F469 and F472/F475/F476 |
| Version history | repeat Staging without BuildRun growth, upgrades and Staging/Production recoveries | verified with limitation | current real-MySQL tests pass; clean current-image E2E not rerun; F473 |
| Negative E2E | connection/gates/provider/ownership/digest/drift/approval/concurrency/health/network/auth/secret/reset/files/evidence | verified with limitation | current focused suites pass; historical runner not assertion-safe; F474 |

## UI Page Coverage Matrix

Every row requires correct data plus applicable empty/loading/blocked/running/success/failure/approval/unavailable states, unique primary action, URL/refresh/back, 1484x1324 comparison, 1280x800, 390x844 containment, zh/en, keyboard/focus/ARIA, and console/network evidence.

| Surface | Status | Current-run evidence |
| --- | --- | --- |
| `/projects`, create, and three-step intake | failed/blocked | `/projects` current-run redirected to `/teams` loading loop; Demo 3 viewports captured |
| Project delivery home and release list | blocked/not audited | Demo captured; implementation blocked by F464 |
| Release preflight and gate drill-down | blocked/not audited | F464/F493 |
| Build step and logs | blocked/not audited | F464/F493 |
| Staging step and logs | blocked/not audited | Demo success/failure/log Drawer captured; implementation F464/F493 |
| Production confirm/approval/execute | blocked/not audited | Demo confirm/approval captured; implementation F464/F493 |
| Environment versions, upgrade, and recovery | blocked/not audited | F464/F493 |
| Project identification | blocked/not audited | F464/F493 |
| Environment settings: target/resources/variables-secrets/domains-protection | blocked/not audited | F464/F493 |
| Release policy | blocked/not audited | F464/F493 |
| Deployment/evidence and global approval deep links | blocked/not audited | F464/F493 |
| Dialogs, drawers, keyboard/focus, responsive/a11y state matrix | blocked/not audited | F464/F493; no current implementation axe claim accepted |

## Historical AC Reclassification

- Historical rows to reclassify: 351; unique IDs: 350 because `AC-PROD-025` is duplicated verbatim.
- Allowed independent statuses: `independently verified`, `verified with limitation`, `failed`, `not reproducible`, `stale evidence`, `out of current environment`.
- Machine inventory: `/tmp/codex-tool-runs/svton/long-goals/devpilot-v13-opencode-acceptance/issue-evidence/historical-ac-reclassification.json`.
- Current state: row-level final mapping pending repairs/re-runs; all historical `[x]` markers remain preserved. Confirmed failures include AC-PROD-025..030, AC-E2E-007/009/013/015 and the 351/351 integrity claim; current source/tests provide partial independent verification for other rows.

## Confirmed Issues

The F464+ ledger below is source/current-run verified. Duplicate findings from the three workers are merged under one ID.

## Pending Confirmation

- Full signed-in UI/Demo parity re-audit remains pending F493; no F458 MINOR delta is accepted yet.
- Clean current-image positive/history/negative E2E remains pending F472-F476/F494 and a reproducible image build.
- Public DNS/trusted TLS/real ingress is outside the current environment and remains a production-rollout blocker.

## Accepted Limitations

- Canonical-approved limitation: canary, blue-green and automatic traffic ramp remain unavailable until real traffic/metrics/pause/abort/rollback providers exist. Fail-closed is not capability completion.
- Environment limitation: this checkout has no authorized public DNS, trusted certificate or production ingress. Loopback target health cannot satisfy public final-site readiness.
- Tooling limitation at first audit: IAB stale auth blocked protected routes and Chrome control was unavailable; this is not an accepted parity difference and is tracked as F464/F493.

## Inherited Post-Parity Work

| ID | Status in this goal | Risk to evaluate | Implementation |
| --- | --- | --- | --- |
| F461 | retained/P1 | in-process worker map has no durable multi-replica lease/heartbeat/takeover | prohibited unless user expands scope; master/production blocker |
| F462 | retained/P1 | Git accepts special-network URLs; site-probe SSRF is separately fixed by F468 | prohibited unless user expands scope; master/production blocker |
| F463 | retained/P2 | legacy identity inventory/remediation absent | prohibited unless user expands scope; migration rollout blocker |

## F464+ Issue Ledger

Each row records source, affected scope, reproduction/expected/actual/root cause, allowed/forbidden scope, verification/evidence, and disposition. Exact absolute file:line locations and logs are in the three `*-details.json` reports.

| ID | Sev/status | Source + affected | Reproduction / expected / actual / root cause | Allowed paths / forbidden scope | Verification + evidence / disposition |
| --- | --- | --- | --- | --- | --- |
| F464 | P1 confirmed/out-of-frozen-scope | browser+source; F455/F458-F460, all protected UI AC | Stale cookie/client auth makes `/projects` and `/login` bounce to `/teams` loading; expected invalid auth clears to login; auth pages skip validation and redirect on optimistic hydration | `apps/devpilot-web` auth only / no unrelated UI | current IAB screenshot+DOM and source trace / document out of scope; use isolated clean origin for acceptance, do not silently fix |
| F465 | P1 confirmed/queued | code+runtime; F438/F455/F460, AC-PROD-025/030/031 | Production records `switched` after DB lookup/write only; expected provider apply+receipt; no DNS/proxy/ingress side effect exists | API site/release delivery / no external production mutation | CA-001/RUNTIME-003 / fix truthful provider boundary or fail closed; real provider remains external blocker |
| F466 | P1 confirmed/queued | code+runtime; F438/F455/F460, AC-PROD-028..030, AC-E2E-015 | unreachable final URL + unrelated proxy 200 => `passed`; expected target health separate from final-site proof | API site/release delivery / no public endpoint mutation | live fallback repro / fix and add adversarial tests |
| F467 | P1 confirmed/queued | code+runtime+security; F438, AC-PROD-027/030 | self-signed wrong-host non-expired cert => `valid`; expected CA+hostname authorization | API site/release delivery / local cert fixtures only | live TLS repro / fix and test trusted/self-signed/wrong-host/expired |
| F468 | P1 confirmed/queued | code+security; F438/F448, AC-PROD-028/REVIEW-005 | route URL reaches raw HTTP client with no IP/DNS/redirect policy; expected pinned deny-by-default egress | project-environment/site/release delivery / no real SSRF request | static sink trace / implement site-probe egress policy; F462 Git remains separate |
| F469 | P1 confirmed/queued | code; F455, AC-PROD-017/020, AC-E2E-012/013 | empty Production services silently borrow Staging definitions; expected Production fail closed or explicit environment-independent template | release delivery + parity fixture / no cross-module redesign | source + parity-switch note / remove fallback and seed valid Production bindings |
| F470 | P2 confirmed/queued | code; F436, AC-PROD-011/014..016 | concurrent approve/reject both read pending then update by id; expected one CAS winner | operation-approval only / no unrelated approval redesign | source race trace / CAS + real-MySQL concurrency test |
| F471 | P1 confirmed/queued | current test; F460/F461, full API gate | full API 7/7 failure; expected current constructor contract; spec injects stale repositories/mocks | repository-analysis spec only / do not implement F461 | exact rerun logs / repair harness then rerun full API |
| F472 | P1 confirmed/queued | evidence script; F455, AC-E2E-007..015 | positive steps mark any non-throwing false object OK and AC map true; expected asserted step-to-AC derivation | positive runner/test helpers / no product behavior | source audit+self-test / harden positive runner |
| F473 | P1 confirmed/queued | evidence script; F456, AC-E2E-016..022 | version runner has same non-asserting helper/unconditional AC risk | version-history runner only / no product behavior | source audit+self-test / harden version runner |
| F474 | P1 confirmed/queued | evidence script; F457, AC-E2E-023..035 | negative runner can accept false result fields; expected every negative asserted | negative runner only / no product behavior | source audit+self-test / harden negative runner |
| F475 | P1 confirmed/queued | evidence/fixture; F455, AC-E2E-007/009 | positive flow reuses finalized seed and counts review/finalize 409 as intake; expected fresh project/analysis/finalize | seed+positive runner / no fixture special case in production | source proof / create clean intake chain |
| F476 | P1 confirmed/queued | provenance; F454-F460, AC-E2E-001..035 | running images lack source labels and predate F459; expected immutable source/image/compose binding | Dockerfiles/compose/evidence scripts / no push or registry mutation | image inspection+build logs / stamp, uniquely tag, assert running IDs, regenerate |
| F477 | P2 confirmed/queued | docs/evidence; F460, 351/351 | `AC-PROD-025` appears twice: 351 rows but 350 unique IDs; expected unique criteria | new acceptance TODO/report + independent appendix / preserve historical text | line 263/266 inventory / document correction; do not erase history |
| F478 | P2 confirmed/queued | evidence; F434-F460 | many manifests lack full HEAD/image digest/path+SHA pairs; expected schema-bound provenance | new evidence tooling/manifests / do not rewrite old artifacts | 13-manifest audit, F458 104/104 strong exception / define schema for regenerated evidence |
| F479 | P2 confirmed/queued | docs; F434-F460 | TODO INDEX still says F434 next/F435-F460 pending; expected current historical+independent status | TODO INDEX only / preserve old detailed ledger | source line proof / fix index |
| F480 | P2 confirmed/queued | docs/evidence; F459 | report says `P3: documented notes only` but lists none; expected concrete notes or unrecoverable statement | new acceptance report/TODO + append-only F459 note / do not invent notes | F459 report line 25 / record unrecoverable evidence defect |
| F481 | P2 confirmed/queued | docs+verification; F460 | final gate lists Web/tests/type/i18n/diff but no complete API suite; expected current complete suite | new acceptance report + F471 verification / preserve F460 verdict | F460 file list/current rerun / close only after green API suite |
| F482 | P3 confirmed/queued | local security config; F454-F457 | compose credentials are fixed; expected refusal outside loopback/local test | parity compose/scripts / no production secret system | compose source / add local-only guard and warning |
| F483 | P2 confirmed/deferred | structure; `settings-env-routes.model.ts` 361 lines | expected <=200 and one responsibility; derived route/probe state is overloaded | that model/tests / no behavior change | deterministic count / defer atomic split after blockers |
| F484 | P2 confirmed/deferred | structure; `release-site-probe-evidence.tsx` 298 | expected <=200 presentation owner | component/tests / no visual redesign | deterministic count / defer atomic split |
| F485 | P2 confirmed/deferred | structure; `environment-resource-binding.model.ts` 274 | expected <=200 model owner | model/tests / no behavior change | deterministic count / defer atomic split |
| F486 | P2 confirmed/deferred | structure; `settings-env-routes-tab.tsx` 274 | expected <=200 component owner | component/tests / no visual redesign | deterministic count / defer atomic split |
| F487 | P2 confirmed/deferred | structure; `settings-env-variables-tab.tsx` 273 | expected <=200 component owner | component/tests / no visual redesign | deterministic count / defer atomic split |
| F488 | P2 confirmed/deferred | structure; `settings-env-targets-tab.tsx` 239 | expected <=200 component owner | component/tests / no visual redesign | deterministic count / defer atomic split |
| F489 | P2 confirmed/deferred | structure; `environment-resource-binding-row-controls.tsx` 226 | expected <=200 presentation owner | component/tests / no behavior change | deterministic count / defer atomic split |
| F490 | P2 confirmed/deferred | structure; `environment-settings-detail.tsx` 226 | expected <=200 orchestration/presentation split | component/tests / no visual redesign | deterministic count / defer atomic split |
| F491 | P2 confirmed/deferred | structure; `release-production-approval-card.tsx` 207 | expected <=200 presentation owner | component/tests / no approval behavior change | deterministic count / defer atomic split |
| F492 | P2 confirmed/deferred | structure; `release-production-log-drawer.tsx` 202 | expected <=200 presentation owner | component/tests / no visual redesign | deterministic count / defer atomic split |
| F493 | P1 confirmed/queued verification | browser/evidence; F458-F460, AC-VIS-001..012 | signed-in implementation matrix not reproducible; expected fresh current-run route/state/view/locale/a11y evidence | `/tmp` browser evidence and runtime-only acceptance setup / no auth source fix | UI details JSON / create clean acceptance origin, rerun full matrix |
| F494 | P2 confirmed/queued | test infrastructure; F454-F457 | fixed container names/ports prevent isolated destructive rerun while another audit owns stack; expected parameterized compose namespace | parity compose/scripts / no shared-stack destruction | runtime audit limitation / parameterize acceptance runtime |

## Final Verdict Status

- Demo parity: not independently decided; current signed-in implementation audit blocked
- Functional/runtime: **REJECTED** at first audit
- Security: **REJECTED** at first audit
- UI/UX/a11y: **REJECTED / not reproducible** at first audit
- Evidence confidence: **LOW TO MEDIUM**
- Production readiness: **REJECTED**
- Master integration readiness: **REJECTED**
- Overall allowed value (`ACCEPTED`, `ACCEPTED WITH LIMITATIONS`, `REJECTED`): **REJECTED at audit checkpoint; final pending repairs/re-runs**

The historical OpenCode verdict remains preserved. This document records the independent Codex verdict and must not silently rewrite historical evidence.
