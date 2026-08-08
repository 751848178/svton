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
| F465 | P1 fixed/code; external provider blocker retained | code+runtime; F438/F455/F460, AC-PROD-025/030/031 | Production recorded `switched` after DB metadata only; now requires a provider receipt and fails closed when unconfigured | API site/release delivery / no external production mutation | `cdfd612e`, full API 1717; a real route provider/readback remains required for production |
| F466 | P1 fixed | code+runtime; F438/F455/F460, AC-PROD-028..030, AC-E2E-015 | removed proxyTarget fallback; HTTP evidence must match the normalized final URL and 2xx exactly | API site/release delivery / no public endpoint mutation | `fc761a85`, full API 1737; F499 tracks the missing historical live regression shape |
| F467 | P1 fixed | code+runtime+security; F438, AC-PROD-027/030 | strict system CA, hostname and SNI verification replaces `rejectUnauthorized:false` | API site/release delivery / local cert fixtures only | `3de4fd00`, trusted/self-signed/wrong-host/expired tests, full API 1748 |
| F468 | P1 core fixed; P1/P2 follow-ups tracked | code+security; F438/F448, AC-PROD-028/REVIEW-005 | resolve once, public-only address policy and pinned HTTP/TLS transport now block rebinding/private egress | project-environment/site/release delivery / no real SSRF request | `a1298c75`; F500 fixed socket reuse, F501/F502 remain; F462 Git remains separate |
| F469 | P1 fixed | code; F455, AC-PROD-017/020, AC-E2E-012/013 | removed Production-to-Staging service fallback and seeded explicit isolated services | release delivery + parity fixture / no cross-module redesign | `4f093848`, focused 21 tests + typecheck |
| F470 | P2 confirmed/queued | code; F436, AC-PROD-011/014..016 | concurrent approve/reject both read pending then update by id; expected one CAS winner | operation-approval only / no unrelated approval redesign | source race trace / CAS + real-MySQL concurrency test |
| F471 | P1 fixed | current test; F460/F461, full API gate | stale constructor mocks repaired without implementing F461 | repository-analysis spec only / do not implement F461 | `b5a800e4`; exact 7/7 and full API 1706 green |
| F472 | P1 core fixed | evidence script; F455, AC-E2E-007..015 | positive steps now require named passing checks and ACs derive from exact source steps | positive runner/test helpers / no product behavior | `cfd5165e` plus F503-F505; seeded flow now fails honestly at intake draft |
| F473 | P1 reopened by post-review | evidence script; F456, AC-E2E-016..023 | base checked-step migration landed, but undefined self-consistency and browser capture gaps can still false-pass | version-history runner/helpers only / no product behavior | `92b7e462`; F506-F512 track review findings |
| F474 | P1 reopened by post-review | evidence script; F457, AC-E2E-024..035 | 46 negative steps now require named checks, but stale context, wrong-target mutations and fabricated gate freshness can still misattribute passes | negative runner/helpers only / no product behavior | `04c7ff91`; F513-F521 track 7 P1 + 3 P2 review findings |
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
| F495 | P1 confirmed/queued | code+fixture+evidence; F435/F455, D10/D11, AC-E2E-007..009 | real repository analysis never produces migration evidence while seed JSON fabricates it; expected provider-bound current-DB proof or an honest blocked gate | repository analysis, migration gate and parity fixtures / no invented DB proof | worker design JSON / remove fake evidence and make fresh flow fail closed until a real provider exists |
| F496 | P2 fixed | code; F465, route receipt evidence | receipt did not bind provider identity/version; expected exact configured provider contract | site route receipt only / no real provider implementation | `9c5a8647`, full API 1741 |
| F497 | P2 confirmed/queued | code; F465, Staging finalization | split execution path can persist Staging `targetRef=unconfigured` instead of the executor target | release-delivery execution context only / no provider redesign | design JSON / carry one selected deployment target through execution and finalization |
| F498 | P2 confirmed/accepted evidence limitation | tests; F465, route receipt gates | integration tests use an echo route double; expected classification as consumer-contract proof, not real provider/readback proof | test descriptions/report only / do not claim production provider | post-review JSON / retain as explicit external provider blocker |
| F499 | P2 confirmed/queued | tests; F466, final URL fallback | tests do not recreate unreachable final URL plus unrelated live 200 historical shape | site final probe tests only / no production behavior change | post-review JSON / add live adversarial regression |
| F500 | P1 fixed | code+runtime; F468, HTTP pinning | Node globalAgent could reuse a stale socket for a newly approved IP and accept the wrong endpoint 2xx | HTTP/HTTPS probe transport only / no DNS policy expansion | `4749c515`, real IPv4-to-IPv6 same-host socket regression + full API 1794 |
| F501 | P2 confirmed/queued | code+security; F468, address policy | `2001:100::1` is classified public although IANA `2001::/23` defaults non-global | address policy/tests only / no broad network stack rewrite | F468 post-review repro / use explicit special-purpose IPv6 ranges |
| F502 | P2 confirmed/queued | code+security; F468, egress policy | arbitrary public ports 1024-65535 remain probeable; expected approved HTTP(S) port policy | target resolver/address policy only / no production firewall mutation | F468 post-review / restrict or explicitly configure allowed ports |
| F503 | P1 fixed | evidence script; F472, AC-E2E-012 | log substrings could miss Git/build commands; exact command plan and provider evidence now bind no checkout/pull/build/git | positive runner helper only / no deploy behavior | `8000dfde`, adversarial npm/pnpm/git command tests |
| F504 | P1 fixed | evidence script; F472, production gate | latest-by-stage query could select another attempt; expected exact final request/action/input/result identity | positive gate evidence helper only / no gate behavior | `26dfc1b0`, exact compound request key and mismatch tests |
| F505 | P1 fixed/runtime blocker retained | evidence script; F472, AC-E2E-013 | route proof was payload-self-consistent; now independently recomputes URL/hash/operation and binds current route receipt/readback/provider | positive route evidence helper only / no provider implementation | `86919960`; default `unconfigured` provider fails honestly |
| F506 | P1 fixed | evidence script; F473, AC-E2E-018..021 | six history validators accepted missing identities/digests via `undefined === undefined`; all critical pairs now require both sides and valid formats | history evidence helper/self-test only / no runtime behavior | `156f96cb`; per-field missing-actual/expected/both tests and all-step empty guard |
| F507 | P1 core fixed; post-review follow-ups tracked | evidence/browser; F473, AC-E2E-023 | repo-owned CDP now captures Runtime/Log errors, Document/Fetch/XHR responses and loading failures | history browser driver/evidence tests only / no UI source fix | `7b480015`; F522-F525 track exception/missing-field/empty-artifact gaps |
| F508 | P2 fixed | evidence script; F473 | login now uses checkedStep as a shared source for AC-E2E-016..023; token stays in closure memory | history runner/helper only / no auth product fix | `b2141042`, false/empty/static-bypass tests |
| F509 | P2 core fixed; P1 follow-ups reopened | evidence script; F473, F455 context | exact AC set and referenced step/check validity are enforced, but canonical per-AC mapping and uniqueness are not | history context helper only / no positive runner behavior | `03ef541e`; F526-F528 track coherent-substitution/duplicate gaps |
| F510 | P2 confirmed/queued | evidence/browser; F473, AC-E2E-023 | UI may explicitly display production evidence mismatch while browser step still passes | history browser markers only / no visual redesign | post-review source trace / assert no mismatch marker and exact displayed identities |
| F511 | P2 confirmed/queued | evidence/browser; F473 | `cdp-evidence.json` is read without hash binding and can be stale/replaced | history browser evidence helper only / no browser profile mutation | post-review source trace / bind bytes SHA and current-run metadata |
| F512 | P3 confirmed/queued | evidence script; F473 | `process.exit(1)` can bypass Prisma disconnect on failure | history runner failure path only / no behavior expansion | post-review source trace / use exitCode and finally disconnect |
| F513 | P1 fixed/source-level; runtime rerun pending | evidence script; F474, AC-E2E-024..035 | negative context now requires explicit current F456 path/SHA/time window, exact context/AC/step/check/M1/M2 and read-only DB ownership | negative context/check/DB-binding helpers only / no E2E mutation | `7418e106`; legacy fixedIds/default artifact and wrong ownership tests |
| F514 | P1 confirmed/queued | evidence script; F474, AC-E2E-029 | script rejects approval before config drift and accepts generic “not approved”, so wrong gate can prove drift | AC29 scenario/check helper only / no approval product change | pure validator repro / approve R2, drift to R3, require exact drift code and frozen/current IDs |
| F515 | P1 confirmed/queued | evidence script; F474, AC-E2E-032 | health failure mutates Staging `parity-svc-web`, not F469 Production `parity-svc-web-production` | AC32 fixture/cleanup/check helper only / no production service logic | seed/source trace / resolve exact Production service dynamically and prove consumed config |
| F516 | P1 confirmed/queued | evidence script; F474, AC-E2E-031..033 | gate freshness is created by directly updating timestamps rather than rerunning producers | negative gate producer/check helpers only / no gate production change | source trace / invoke real producers and bind run/status/provider/timestamps or report blocked |
| F517 | P1 confirmed/queued | evidence/security; F474, AC-E2E-035 | command/read failures and empty inventories can still self-report a passing secret scan | secret inventory/check helper only / no production secret system | adversarial review / require command status, nonempty file/hash inventory, F455+F456 and runtime.env mode/content |
| F518 | P1 confirmed/queued | evidence/runtime safety; F474 | mutations lack unconditional restoration and cleanup cancels unrelated shared-environment runs | negative scenario fixture/cleanup only / no shared reset | source trace / cleanup journal+finally scoped to run-owned IDs; fail on unrelated active runs |
| F519 | P2 confirmed/queued | evidence script; F474, AC-E2E-031 | response, DB deployment, release, approval, Manifest and current version are not all bound to one run | AC31 check helper only / no runtime behavior | post-review / require exact cross-record identity chain |
| F520 | P2 confirmed/queued | evidence/security; F474, AC-E2E-034 | unauthorized mutation checks only compare Build and Staging counts | AC34 snapshots/check helper only / no authorization product change | post-review / also compare ReleaseRun, Production deployment, approval, environment version and pointer |
| F521 | P2 confirmed/queued | structure/config; F474 | 2060-line negative driver owns scenarios, fixtures, cleanup, provenance and secret scan with hardcoded credentials/IDs | negative runner peer modules/runtime config only / no scenario behavior expansion | deterministic count / split each owner <=200 and load explicit runtime config |
| F522 | P1 fixed | evidence/browser; F507, AC-E2E-023 | `Runtime.exceptionThrown` now propagates through capture/summary/driver/checks with sensitive fields redacted | CDP capture/check/self-test only / no browser product fix | `5b691dc4`, exception/clean/redaction self-tests |
| F523 | P1 fixed | evidence/browser; F507, AC-E2E-023 | CDP evidence now requires fixed schema/version and explicit console/httpResponses/failedRequests/runtimeExceptions arrays | browser evidence schema/checks only / no hash binding overlap with F511 | `1092f06b`, missing/type/version/schema adversarial tests |
| F524 | P1 core fixed; F529 readback pending | evidence/browser; F507, AC-E2E-023 | driver now rejects empty/tiny/wrong-kind artifacts and validates PNG signature; consumer checks kind/bytes/hash metadata | browser artifact manifest/checks only / no visual parity redesign | `023ad9fb`; F529 binds reported metadata to actual current file bytes |
| F525 | P2 partially fixed/queued | tests; F507 | exception/schema/artifact cases landed; committed tests still lack explicit Document >=400 and exact loadingFailed URL/host assertions | CDP/browser evidence self-tests only / no runtime behavior | F522-F529 review / add remaining two cases plus F530-F535 adversarial fixtures |
| F526 | P1 fixed | evidence script; F509, F455 context | producer and consumer now share one frozen canonical AC-E2E-007..015 mapping | history context/check helper only / no positive runner behavior | `cf1c07d5`, coherent substitution/order/missing/extra tests |
| F527 | P1 fixed | evidence script; F509 | source steps, per-step checks, AC checkNames and expanded names must be nonempty and unique | history context/check helper only / no positive runner behavior | `b60a7e3e`, duplicate-name adversarial tests |
| F528 | P2 fixed | tests; F509 | canonical substitution and duplicate-name attacks are now explicit self-test fixtures | history context self-test only / no runtime behavior | `cf1c07d5` + `b60a7e3e` |
| F529 | P1 fixed | evidence/browser; F524, AC-E2E-023 | history runner now reads controlled current files and recomputes SHA/bytes/kind/signature before accepting driver metadata | browser artifact readback/helper only / no cdp-evidence hash overlap with F511 | `2b5ace7e`, mismatch/path/duplicate/content tests |
| F530 | P1 core fixed/follow-up F539 | evidence/security; F522, AC-E2E-023 | Runtime exception text/URLs redact authorization tails, credentials, token/password/secret query and fragments, but the post-fix review found uncovered Cookie/session/API-key vocabulary | CDP redaction helper/self-test only / no browser product fix | `7c4d12a1`; follow-up pure Node repro registered as F539; not claimed as generic DLP |
| F531 | P1 fixed | evidence/browser; F523, AC-E2E-023 | browser evidence now requires nonempty typed Document/Fetch/XHR response rows with parseable HTTP(S) URLs, exact hosts and integer status codes | CDP element schema/summary tests only / no runtime network change | `d63109d9`, adversarial schema fixtures; browser rerun still pending isolated current-HEAD stack |
| F532 | P1 fixed | evidence/browser; F507, AC-E2E-023 | browser summary now requires all six canonical UI evidence groups and all 26 required boolean markers | history summary check/self-test only / no visual redesign | `b35f85a8`, missing-group/key/type fixtures; browser rerun still pending isolated current-HEAD stack |
| F533 | P1 leaf fixed/follow-up F540 | evidence/browser; F529, AC-E2E-023 | artifact evidence pins each leaf with a no-follow handle and derives hashes plus markers from one byte snapshot, but the post-fix review found an ancestor `browserOut` directory symlink bypass | artifact readback/marker parser only / no browser runtime mutation | `c6d718ff`; ancestor-directory provenance follow-up registered as F540; browser rerun still pending isolated current-HEAD stack |
| F534 | P2 confirmed/queued | evidence/browser; F524 | PNG validation accepts signature+padding; DOM/text validation proves only size | artifact content helper/self-test only / no screenshot visual judgment | adversarial fixtures / parse PNG structure and require minimally valid DOM/text encoding/content |
| F535 | P2 confirmed/queued | evidence/browser; F507 | malformed JSON evidence lines on driver stdout are silently discarded | history driver stdout parser/self-test only / no CDP behavior | post-review source trace / fail on any candidate evidence line that is malformed or unexpected |
| F536 | P1 confirmed/queued | evidence script; F513, AC-E2E-024..035 | F513 binds canonical sourceSteps but not each step's canonical checks; arbitrary unique `claim/pass=true` checks can self-consistently pass | negative history contract/shared history-check contract only / no F456 behavior | pure Node repro / replay exact canonical check names and trusted expected values |
| F537 | P1 confirmed/queued | evidence/provenance; F513 | repo has no launcher that produces and passes F456 path/SHA/window; caller can choose a stale file, self-hash and broad window, including symlink alias | repo-owned isolated E2E launcher/context input only / no image provenance overlap with F476 | post-review 2020 stale repro / launch F455/F456 and F474 in one invocation, bind regular-file identity and narrow observed window |
| F538 | P2 confirmed/queued | evidence/DB binding; F513 | M1/M2 manifest IDs are distinct but mocked DB binding accepts the same buildRunId for both | negative history DB binding/self-test only / no schema change | post-review mock repro / require distinct successful BuildRun IDs owned by exact order/project/team |
| F539 | P1 confirmed/queued | evidence/security; F530, AC-E2E-023 | Runtime exception redaction still preserves complete Cookie/session and `api_key` credentials | CDP redaction vocabulary/self-test only / no generic DLP expansion | pure Node credential repro / centralize credential-key vocabulary and assert injected values are absent |
| F540 | P1 confirmed/queued | evidence/provenance; F533, AC-E2E-023 | leaf `O_NOFOLLOW` does not stop a symlinked `browserOut` ancestor from redirecting artifact and marker reads outside the controlled directory | browser output directory identity + artifact readback only / no browser runtime mutation | pure filesystem repro / pin non-symlink directory dev+ino before producer and revalidate around child snapshots |

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
