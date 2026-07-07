# P3. Site Governance Progress

## Goal

`Site` is the project/environment-scoped governance surface for Nginx/OpenResty
sync, diagnostics, smoke checks, config diffs, approvals, rollback, and TLS
certificate lifecycle.

## Current Status

- Roadmap status: main Site control-plane loops are in place; module management,
  certificate library/upload/binding, real-environment smoke automation,
  log-archive automation, and queue/concurrency governance remain follow-ups.
- Recent verified structure slices: F143 split TLS/date formatting utilities;
  F144 split live/approval action flows out of `use-site-actions.ts`.
- F145-F147 source result: `use-sites.ts` owns data loading, delete,
  queue/modal state, and Site action composition; focused takeover moved into
  `use-site-takeover.hooks.ts`; card actions moved into
  `site-card-actions.component.tsx`; Add Site basic fields moved into
  `add-site-basic-fields.component.tsx` with shared `AddSiteFormData`.
- Current source-backed Sites structure result: all `sites` source files are now
  under 200 lines; largest files are `site-plan-run-panel.tsx` at 192 lines and
  `takeover-binding-form.tsx` at 186 lines.

## F145. Sites Data Hook Structure Slice

Purpose: continue P3 Site governance structure work from the smallest current
source-backed over-limit surface. This slice must first map `use-sites.ts`,
its callers, and its state/data flow, then only make the smallest confirmed
split that preserves existing Sites API calls, UI behavior, alerts, and return
contract.

| Task   | Status | Description                                                                                                        | Evidence                                                                                                                                                                                                        |
| ------ | ------ | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F145.1 | done   | Build a source-backed map of `sites/hooks/use-sites.ts`, route callers, state ownership, and verification targets. | CodeGraph CLI exists but is not initialized; manual graph confirmed `page.tsx -> useSites() -> SiteListSection/SiteCard/FocusedSitePanel`, with focused takeover fields consumed only by `FocusedSitePanel`.    |
| F145.2 | done   | Implement the smallest confirmed hook split while preserving public hook return fields and Sites page behavior.    | `use-sites.ts` is 140 lines after Prettier; new `use-site-takeover.hooks.ts` is 124 lines; `useSites()` still returns the same focused/takeover/action fields.                                                  |
| F145.3 | done   | Sync TODO/progress docs and run targeted Web verification plus hygiene checks.                                     | Prettier check, touched ESLint, Web build, Web type-check, diff check, conflict marker scan, trailing-whitespace scan, and touched source line-count scan passed; logs are under `/tmp/codex-tool-runs/svton/`. |

## F146. Site Card Action View Slice

Purpose: continue P3 Site governance structure work by splitting the next
smallest source-confirmed over-limit Sites view. `site-card.tsx` is 231 lines
and combines Site identity/metadata rendering, the full action-button cluster,
and plan/run panel composition.

| Task   | Status | Description                                                                                                        | Evidence                                                                                                                                                                                                 |
| ------ | ------ | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F146.1 | done   | Confirm the SiteCard action-button view boundary, caller graph, and behavior-preservation contract.                | Manual graph confirmed `SiteListSection -> SiteCard -> SiteCardActions/SitePlanRunPanel`; the extracted boundary consumes only `site`, `sites`, and `canRenewTls`.                                       |
| F146.2 | done   | Extract the action-button cluster to a focused component while preserving labels, disabled states, and hook calls. | `site-card.tsx` is 93 lines after Prettier; new `site-card-actions.component.tsx` is 162 lines; button labels, disabled checks, TLS renewal condition, and handler calls remain unchanged.               |
| F146.3 | done   | Sync docs/board and run targeted Web verification plus hygiene checks.                                             | Touched Prettier/ESLint, Web build, Web type-check, diff check, conflict marker scan, trailing-whitespace scan, and touched source line-count scan passed; logs are under `/tmp/codex-tool-runs/svton/`. |

## F147. Add Site Modal Form View Slice

Purpose: continue P3 Site governance structure work by splitting the next
smallest source-confirmed over-limit Sites view. `add-site-modal.tsx` is 237
lines and is the smaller remaining over-limit Site component after F146.

| Task   | Status | Description                                                                                            | Evidence                                                                                                                                                                                                                                               |
| ------ | ------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F147.1 | done   | Map AddSiteModal responsibilities, caller contract, form state, payload creation, and field rendering. | Manual graph confirmed `page.tsx -> AddSiteModal`; the modal owned shell/submission/payload plus basic fields, project-environment filtering, runtime config, and footer buttons.                                                                      |
| F147.2 | done   | Extract only the smallest confirmed form view/state boundary while preserving create payload behavior. | Basic identity/project/server/environment fields moved to `add-site-basic-fields.component.tsx`; shared `AddSiteFormData` replaced duplicate runtime field typing; create endpoint, payload, defaults, labels, and callbacks remain in the modal path. |
| F147.3 | done   | Sync docs/board and run targeted Web verification plus hygiene checks.                                 | Touched Prettier/ESLint, Web build, sequential Web type-check, diff check, conflict marker scan, trailing-whitespace scan, and touched source line-count scan passed; logs are under `/tmp/codex-tool-runs/svton/`.                                    |

## F148. Focused Site Panel View Slice

Purpose: finish the current P3/Sites source-backed line-ceiling pass by
splitting the only remaining over-limit Site source file. `focused-site-panel.tsx`
is 240 lines and combines focused identity/actions, takeover form composition,
focused plan preview, and recent run summary.

| Task   | Status | Description                                                                                                     | Evidence                                                                                                                                                                                                    |
| ------ | ------ | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F148.1 | done   | Map FocusedSitePanel responsibilities, caller contract, action handlers, takeover form, plan, and run sections. | Manual graph confirmed `page.tsx -> FocusedSitePanel`; the panel combines identity/action controls, takeover form composition, focused plan preview, and recent run summary.                                |
| F148.2 | done   | Extract the smallest confirmed view section while preserving focused panel behavior and hook calls.             | Focused plan preview and recent run summary moved to `focused-site-plan-run-summary.component.tsx`; focused action buttons, takeover form props, labels, and hook calls remain in `FocusedSitePanel`.       |
| F148.3 | done   | Sync docs/board and run targeted Web verification plus hygiene checks.                                          | Touched Prettier/ESLint, Web build, Web type-check, diff check, conflict marker scan, trailing-whitespace scan, and full Sites source line-count scan passed; logs are under `/tmp/codex-tool-runs/svton/`. |

## F275. Site Service Config-Generator Extraction (backend split started)

Purpose: begin the **backend** Site god-service split. Prior P3 slices (F143–F148)
addressed the Web `sites/` source; the backend `site.service.ts` was untouched at
2177 lines. This slice extracts the largest cohesive pure boundary — the
Nginx/OpenResty config + certificate-command generators and their safety checks
(~180 lines) — into focused pure-utils files, and moves the shared plan/config
types + small readers into a shared types file. This is the first of several
backend slices needed to bring `site.service.ts` under the ceiling.

| Task   | Status | Description                                                                                              | Evidence                                                                                                                                                                                                                                                                                                                                                                                   |
| ------ | ------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F275.1 | done   | Map the config-generator boundary.                                                                       | Manual graph confirmed `generateNginxConfig`/`generateAccessPolicy`/`resolveUpstream`/`buildCertificateCommand`/`buildCertificateRenewCommand`/`resolveCertificateName`/`isPreviewSitePlaceholder` + 5 safety checks (`isSafeDomain`/`isSafeProbeHostname`/`isSafeNginxPath`/`isSafeNginxSiteConfigPath`/`isSafeUpstream`) + `filenameForDomain` are pure (no `this` state, no I/O) and used by the plan builders + create/update/takeover paths. |
| F275.2 | done   | Extract generators/safety into pure utils + shared types.                                                | New `site-plan.types.ts` (58 lines: `JsonRecord`/`SiteRecordLike`/`SiteSyncExecutionPlan` + `isRecord`/`readString`/`readBoolean`/`readStringArray` readers, preserving the original non-empty-trim filter) and `site-config-gen.utils.ts` (184 lines: all generators + safety checks + `filenameForDomain`). `site.service.ts` imports them, drops the inline type/readers + 14 private config methods, and calls the pure functions directly. `cleanAliases` stays (used by create/update). Host dropped from 2177 to 1996 lines. |
| F275.3 | done   | Run focused API verification and hygiene checks, then sync final evidence + add full site-module maps.  | Focused site Jest passed (27 tests, 4 suites): `/tmp/codex-tool-runs/svton/f275-jest-20260707.log`; API type-check passed (0 errors): `/tmp/codex-tool-runs/svton/f275-tc2-20260707.log`; both new files ≤200 lines (58/184); `git diff --check` clean; conflict-marker scan clean; single-quote API convention preserved. Full site-module map set (below) added for the backend. |

## Site Module Backend Maps (current, post-F275)

Business logic map: project/environment-scoped Site record → CRUD (list/create/
update/delete) → sync/probe/diagnostics action plan build → server-executor
execution → approval gate (live writes) → sync-run record + audit + config-diff →
post-sync site/TLS status update → TLS probe/renew scheduling → rollback.

Organization map (backend files → responsibility):
- `site.controller.ts` (384, over-ceiling) — HTTP routes.
- `site.service.ts` (1996, over-ceiling) — Site CRUD + sync/diagnostics/
  openresty/smoke/tls action orchestration + plan builders + execution +
  approval + audit + post-sync updates + rollback.
- `site-config-gen.utils.ts` (184) — pure Nginx/access-policy/upstream/certificate
  generators + safety checks (extracted in F275).
- `site-plan.types.ts` (58) — shared plan/config types + readers (F275).
- `site-tls-probe.ts` (282, over-ceiling) + `site-tls-renew.ts` (255, over-ceiling)
  — TLS probe/renew metadata + command builders.
- `site-tls-probe-scheduler.service.ts` (254) + `site-tls-renew-scheduler.service.ts`
  (280) — scheduled TLS probe/renew ticks (both over-ceiling).

Function map: Site list/get/create/update/delete; takeover preview; sync plan;
diagnostics; OpenResty status/modules/module-baseline; smoke check; TLS probe;
TLS renew; rollback; scheduled TLS probe/renew.

Data-flow map: Site DTO + record → plan builder (config-gen utils + command steps)
→ server-executor submit → approval (live) → sync-run write + audit + config-diff
→ site/TLS status update → scheduler follow-up (probe after renewal).

Page-structure map (backend routes): `GET/POST/PUT/DELETE /sites` + `/sites/:id/
sync-runs` + `/sites/:id/{sync-plan,diagnostics,openresty-status,openresty-modules,
openresty-module-baseline,smoke-check,tls-probe,tls-renew,rollback,takeover-preview}`.

## Gaps Identified From The Site Backend Maps (post-F275)

- **`site.service.ts` still 1996 lines** (over ceiling). Next largest extractable
  boundary: the 8 plan builders (`buildSyncPlan`/`buildRollbackPlan`/
  `buildDiagnosticsPlan`/`buildOpenRestyStatusPlan`/`buildOpenRestyModulesPlan`/
  `buildOpenRestyModuleBaselinePlan`/`buildSmokeCheckPlan`/`buildTlsProbePlan`/
  `buildTlsRenewPlan`) + the `collect*Warnings` cluster (~600 lines pure) — split
  across 2–3 plan-builder utils files.
- **`executeSiteSyncOperation` (293 lines)** is the largest orchestration method;
  a later slice should split it into submit/wait/post-update phases.
- **Over-ceiling TLS files:** `site-tls-probe.ts` (282), `site-tls-renew.ts` (255),
  `site-tls-probe-scheduler.service.ts` (254), `site-tls-renew-scheduler.service.ts`
  (280) — each needs its own config/metadata extraction.
- **`site.controller.ts` (384)** — thin route layer, over ceiling (split candidate
  like the resource-control controller).

## Next Candidates

- Continue the site backend split: extract the plan builders + warnings cluster
  into focused pure-utils files (F276).
- Then split `executeSiteSyncOperation` orchestration, then the TLS files, then
  the controller.
- After site, move to monitoring / log-center / ops-governance backend splits.

## Maps To Maintain

- Business logic map: `/sites` reads URL `projectId/environmentId/siteId/new`,
  loads Site/Server/Project/Environment/ProxyConfig data plus per-site sync
  runs, then composes delete, sync-plan, diagnostics, live/approval, TLS,
  rollback, and takeover actions through hook fields.
- Organization map: `page.tsx` is the route shell; `use-sites.ts` is the data
  composition hook; `use-site-actions.ts` and `use-site-live-actions.hooks.ts`
  own plan/live/TLS/rollback actions; `use-site-takeover.hooks.ts` owns focused
  takeover form state and preview activation; `SiteCard` owns identity/metadata
  composition; `SiteCardActions` owns the action-button cluster; components
  render list, cards, focused panel, focused plan/run summary, takeover form,
  add-site modal fields, runtime config fields, and plan/run panels.
- Functional map: list/create/focus, queue toggle, sync plan, live sync
  approval, diagnostics, OpenResty status/modules/baseline, smoke, TLS probe
  and renewal, rollback, takeover binding, preview activation, and delete.
- Data-flow map: URL filters -> `useSites()` -> API lists/sync runs -> hook
  state -> `SiteListSection`/`FocusedSitePanel` -> user actions -> API
  mutation/plan creation -> `setSites`/`setPlans`/`refreshSyncRuns`/`reload`.
- Page-structure map: `/sites` page -> header actions/filter note/focus warning
  -> focused panel -> loading/empty/list section/cards/actions/plan-runs -> add
  modal/basic fields/runtime fields.
