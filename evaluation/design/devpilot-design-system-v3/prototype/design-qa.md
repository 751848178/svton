# Devpilot Guided Control Plane · Design QA

## Comparison target

- Source visual truth:
  - `source-reference.png` — the selected Guided Control Plane direction board.
  - `../../../../../project-skills/devpilot-project-workbench-design/assets/approved-project-config.png` — approved project-configuration hierarchy.
- Rendered implementation:
  - `implementation-desktop.png` — blocked project overview.
  - `implementation-config.png` — production version configuration.
  - `implementation-release.png` — standalone release detail with a two-level stage model.
  - `implementation-operation-drawer.png` — production-entry operation drawer.
  - `implementation-ai-drawer.png` — contextual AI explanation drawer.
  - `implementation-mobile.png` — blocked project overview at the mobile breakpoint.
  - `implementation-mobile-release.png` — mobile two-level release flow.
  - `audit-2026-08-27-step-details/03-project-warning-top.png` — project-owned warning as the first project-content item.
  - `audit-2026-08-27-step-details/06-production-desktop.png` — selected production stage and production-owned warning.
  - `audit-2026-08-27-step-details/07-build-desktop.png` — selected staging/build step with generated resources.
  - `audit-2026-08-27-step-details/04-production-mobile.png` — production stage at the 390px breakpoint.
  - `audit-2026-08-27-step-details/05-build-mobile.png` — build resources at the 390px breakpoint.
  - `audit-2026-08-27-four-stage-consistency/01-light-shell-desktop.png` — unified light global navigation and Header.
  - `audit-2026-08-27-four-stage-consistency/02-four-stage-release-desktop.png` — four major stages with validation/completion gates.
  - `audit-2026-08-27-four-stage-consistency/03-config-select-table-desktop.png` — direct environment selector and shared table system.
  - `audit-2026-08-27-four-stage-consistency/04-four-stage-release-mobile.png` — four-stage disabled semantics at 390px.
  - `audit-2026-08-27-project-information/02-after-project-information-desktop.jpg` — project information separated from release execution, with environment runtime versions and project components.
  - `audit-2026-08-27-project-information/03-environment-version-drawer.jpg` — audited version selection from the project detail surface.
  - `audit-2026-08-27-project-information/04-after-project-information-mobile.png` — project identity and blocker ownership at 390px.
  - `audit-2026-08-27-project-information/05-environment-versions-mobile.png` — horizontally preserved environment and component tables at 390px.
- Combined evidence:
  - `qa-direction-comparison.png`
  - `qa-config-comparison.png`

The direction board is a visual-system source, not a pixel-identical app comp. The configuration screenshot is the closest same-state structural source. Differences caused by the new persistent global shell are judged as intentional product composition, not fidelity defects.

## Viewports and normalization

| Artifact | Pixels | CSS viewport | DPR | State |
| --- | ---: | ---: | ---: | --- |
| Direction board | 1440 × 1024 | 1440 × 1024 | 1 | first viewport |
| Desktop overview | 1430 × 1017 | 1440 × 1024 target | 1 | production blocked |
| Desktop configuration | 1430 × 1017 | 1440 × 1024 target | 1 | production / versions |
| Desktop release | 1440 × 1024 | 1440 × 1024 | 1 | production preflight blocked |
| Desktop operation drawer | 1440 × 1024 | 1440 × 1024 | 1 | production entry draft |
| Mobile overview | 390 × 844 | 390 × 844 | 1 | production blocked |
| Mobile release | 390 × 844 | 390 × 844 | 1 | production stage selected |
| Corrected release detail | 1440 × 1024 | 1440 × 1024 | 1 | independent production detail |
| Corrected release detail mobile | 390 × 844 | 390 × 844 | 1 | independent production detail |
| Corrected staging substeps | 1440 × 1024 | 1440 × 1024 | 1 | four completed staging child steps |
| Production step details | 1428 × 1212 | 1440 × 1024 target | normalized full-page | production selected / blocked |
| Build step details | 1428 × 1316 | 1440 × 1024 target | normalized full-page | staging selected / build evidence |
| Production step details mobile | 380 × 1804 | 390 × 844 target | normalized full-page | production selected / blocked |
| Build step details mobile | 380 × 2148 | 390 × 844 target | normalized full-page | staging selected / build evidence |
| Project information | 1430 × 804 | 1440px desktop target | 1 | project identity and both environment versions |
| Project information mobile | 390 × 844 | 390 × 844 | 1 | project identity / blocker visible |
| Environment versions mobile | 390 × 844 | 390 × 844 | 1 | environment table operation region |
| Approved configuration | 1487 × 1058 | reference capture | 1 | production / versions |

Desktop pairs were each fitted without cropping into equal 715 × 508 regions before side-by-side comparison. The mobile capture used a 390 × 844 device-metrics override and CDP surface capture, then the override was cleared after verification.

## Findings

No actionable P0, P1, or P2 mismatch remains for PMD018. `项目信息` now owns project identity, environment runtime versions, and confirmed components instead of repeating release execution. The project warning remains an independent first content row; delivery stages and activity stay in the release workbench. Production correctly shows stable `1.3.2` while staging shows verified candidate `1.4.0`, and both environments expose an audited version-switch path plus the full version-configuration destination.

## Required fidelity surfaces

- Fonts and typography: Avenir Next/PingFang SC provides a calm operational voice, with clear 34/25/15/12px hierarchy and tabular monospace reserved for versions and identifiers. No clipped or collapsed text was observed at 1440 or 390.
- Spacing and layout rhythm: global navigation and Header now use the same white navigation surface with light dividers; the warm-light workspace remains a subtle content boundary instead of colliding with a dark frame. Mobile preserves all four top-level arrows and stacks the selected stage's child steps without horizontal overflow or connector overlap.
- Colors and tokens: warm paper, white surface, graphite shell, cobalt action, and narrow red/amber/green semantics match the selected direction. The release major-step rail uses Ant Design primary blue (`#1677ff`) only for the selected stage, light blue for completed-but-unselected, and light gray for every other selectable stage. Status always includes an icon and label.
- Image quality and assets: the global brand uses the confirmed `devpilot-cube-mark.png` source created in the project on 2026-08-26. Project-page titles remain text-only. All functional icons use the Phosphor icon family; no handcrafted SVG, emoji, CSS illustration, or placeholder image is present.
- Copy and content: all primary copy names the object, problem, impact, and next action. AI language explicitly states that it explains and proposes but does not mutate production truth.
- Interactions and accessibility: project tabs, configuration rail, release-list navigation, standalone release detail, blocker repair path, AI drawer, domain form, production start, evidence drawer, focus states, reduced motion, and responsive navigation were exercised. Every business operation opens a modal or drawer. Major stages and child steps each use labelled `tablist`/`tabpanel` relationships with arrow-key focus movement. Selecting `构建` replaces the detail region with three existing component resources plus Manifest and digest evidence. Operation layers close on Escape and restore focus to the opener. Mobile controls remain readable and reachable.

## Browser verification

- Verified in the Codex in-app browser at desktop and 390px mobile widths.
- Tested the complete path: overview → domain configuration → saved draft (deployment remains locked) → explicit release recheck → production deployment → deployment evidence.
- Tested repository analysis, every project-configuration section, create-release drawer, release-list row navigation, independent historical release details, selectable top-level stages, contextual AI explanation drawer, and close/cancel paths.
- Verified the eight requested revisions: real cube mark; matched navbar/content backgrounds; modal/drawer operations; standalone release detail; text-only project title; child-step grouping; connected primary-blue top-level arrows; and child steps within the selected stage.
- Runtime exceptions and error-level console messages: none; only expected development debug/info events were observed.
- Corrected release-list navigation was exercised again: the list keeps one page-level `创建发布` action, clicking the first release mounts the independent `h1` detail, and the global `发布` destination remains active.
- The manual Impeccable detector returned 44 advisory-only design-system drift notices (29 font-size, 10 color, 5 radius), with no structural anti-pattern finding. These remain scoped to PMD013 because the prototype `DESIGN.md` and `.impeccable` sidecar have not yet been regenerated from the accepted world.
- PMD016 exercised all eight child steps: each click changed both `aria-selected` and the labelled detail panel. Major-stage and child-step ArrowRight behavior, production configuration modal, AI explanation drawer, focus restoration, project-warning ownership, stage-warning ownership, and zero-overflow 390px layouts were verified.
- A fresh reload produced no new error-level runtime log. `npm run build` and `npm run test:sites` passed. The single PMD016 full-`src` Impeccable scan reported 131 prototype-wide token/style findings; this broad result is retained for PMD013 instead of being represented as a PMD016 interaction failure.
- PMD017 split `验证 / 完成` into two major stages. Pure state-model checks verified `预发 current → 生产/验证/完成 disabled`, `生产 done → 验证 current/完成 disabled`, and `验证 done → 完成 current`. Disabled stages use native button disabling, `aria-disabled`, and a lighter neutral fill; keyboard navigation skips them.
- `发布输入` remains a shared release-level scope. The former global `检查与治理证据` block was removed and its artifact, preflight, approval, concurrency, health, route, and result evidence now appears inside the step that produces or enforces it.
- Every project/configuration collection now uses the same table primitive, 58px rows, shared header treatment, stable operation column, explicit row actions, and horizontal fallback. The environment selector is a direct native select and opens no dialog. The project workbench keeps the five approved destinations; domains and deployment history are not collapsed into configuration.
- PMD017 desktop and 390px browser passes found no horizontal page overflow or new runtime error. `npm run build` and `npm run test:sites` passed. The single changed-file Impeccable scan reported 114 design-system drift findings only (62 type-ramp, 41 palette, 11 radius), retained for PMD013 because the accepted visual world and stale sidecar are not yet documented together.
- PMD018 removed the current-release task surface, delivery path, readiness matrix, and release activity from `项目信息`. Browser evidence confirmed project identity, both current environment versions, component facts, and the project warning as separate regions; the removed release sections are absent from the accessibility snapshot.
- From each environment row, `切换版本` opens a labelled drawer listing existing versions only. The production flow was exercised with `1.3.1`: selection changed, confirmation closed the drawer, and the toast stated that the audited deployment operation was created while `1.3.2` remains current until success. `版本配置` opened the matching production scope and displayed stable `1.3.2` as current.
- PMD018 desktop and 390px passes found no page-level horizontal overflow; data tables preserve their readable minimum width inside horizontal wrappers. `npm run build` and `npm run test:sites` passed. The single changed-markup Impeccable scan returned zero findings.

## Comparison history

1. Mechanical inspection found an overused Inter/Geist font stack and a width transition. The font stack changed to Avenir Next/PingFang SC and the layout-property animation was removed.
2. The first mobile screenshot was affected by the browser panel capture size. It was discarded and replaced with a verified 390 × 844, DPR 1 CDP surface capture.
3. Post-fix desktop overview, configuration, release, and mobile screenshots were recaptured. The combined direction and configuration comparisons show the corrected visual system and no remaining P0/P1/P2 differences.
4. Independent finish review required seven corrections: canonical direction metadata, draft-versus-preflight truth, mobile header stacking, selected-version evidence, dialog focus management, kicker removal, and stronger semantic contrast. All seven were implemented before the final browser pass.
5. The same independent reviewer rechecked the corrected source and exact evidence paths; final disposition: `ship`, with no remaining item.
6. The 2026-08-27 revision replaced the text-only global brand with the confirmed cube mark, moved release records into standalone details, and rebuilt execution status as a selectable two-level hierarchy. The desktop and mobile release captures were reviewed after the change.
7. Independent review requested five corrections: a dedicated AntD primary-blue rail token, tab/tabpanel semantics, one focus target per release record, truthful environment confirmation state, and exact 1440/DPR1 desktop evidence. All five were implemented before re-review.
8. The same independent reviewer rechecked the corrected source and refreshed 1440×1024 / 390×844 evidence; final disposition: `ship`, with no remaining item.
9. A new visual audit found that the release detail was still wrapped by `ProjectFrame`, the selected arrow used a clipped inset border, and child-step connectors shared the text row. The detail now has a dedicated second-level frame, arrows use borderless state fills, and child rails are physically separated from label rows. Before/after and desktop/mobile evidence lives in `audit-2026-08-27-detail-polish/`.
10. PMD016 separated selection from progress, converted every child step into a detail selector, moved warnings to their owning content, and restored the intended dark application frame/light workspace contrast. Production and build states were recaptured at desktop and mobile widths after the interaction pass.
11. PMD017 removed that dark frame after user review, separated validation from completion, added prerequisite locking, moved governance evidence into its owning steps, replaced the environment Drawer with a direct selector, and unified all project tables through one shared component.
12. PMD018 restored `项目信息` as a project-detail surface. Release execution and readiness summaries were removed; basic project facts, production/staging runtime versions, and confirmed components now form the page hierarchy. Environment version changes can start here without duplicating the complete configuration workspace.

## Implementation checklist

- [x] Shared global and project shell.
- [x] Six connected product scenarios with deterministic Picshare state.
- [x] Contextual blocker, AI explanation, and human-confirmed repair path.
- [x] Desktop and mobile responsive behavior.
- [x] Real icon family and no fabricated product imagery.
- [x] Confirmed Devpilot cube mark and text-only project title.
- [x] Connected top-level release rail with stage-owned child steps.
- [x] Clickable child steps with step-owned facts, resources, and warnings.
- [x] Four gated major stages with native disabled semantics.
- [x] Shared table primitive and direct environment scope selector.
- [x] Project information separated from release execution, with per-environment runtime versions and audited switch entrypoints.
- [x] Business operations contained in accessible modals or drawers.
- [x] Core interactions and browser console verification.

## Follow-up polish

- Validate the configuration table with five or more rows when the prototype is used for high-volume operator testing.

final result: passed
