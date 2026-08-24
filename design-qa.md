# Release Workbench Design QA

## Scope and evidence

- Reference: `/var/folders/n8/1wb9jjpn1q97txnkq8v00rj00000gn/T/codex-clipboard-50ac51f4-1767-4284-9435-09ee8ebc25da.png`
- Runtime route: `http://localhost:3120/projects/cmrwxl1ks000k6enjiclutd5a?releaseOrderId=cmsmzs63q00ek1700clhiytmj&step=preflight`
- Final desktop focus: `docs-internal/devpilot/audits/2026-08-20-release-workbench-reaudit/14-subtractive-desktop-main-final.jpg`
- Reference comparison: `docs-internal/devpilot/audits/2026-08-20-release-workbench-reaudit/15-reference-vs-final-focused.jpg`
- Mobile evidence: `07-subtractive-mobile-390-final.png`, `08-subtractive-mobile-390-lower.png`, `09-subtractive-mobile-390-end.png`

## Design comparison

- Typography: release identity, blocker conclusion, stage status, and supporting facts now have four distinct levels. Technical identifiers and advanced checks no longer compete with the decision headline.
- Spacing and layout: the approved reference hierarchy is preserved as compact identity, one decision area, horizontal pipeline, current-stage content, and a persistent context rail. The card wall and repeated first-screen summaries are removed.
- Color and semantics: one blue primary action remains. Execution, viewed stage, success, pending, and blocked states all use labels or icons in addition to color.
- Assets: existing Phosphor icons and product tokens are reused; no fabricated avatar, owner, change count, or decorative asset was introduced.
- Copy and data: blocker, gate counts, environment versions, run states, and evidence links come from existing contracts. The gate CTA is accurately named “查看门禁详情”; it does not claim to repair a configuration it cannot repair.

## Interaction and state QA

- The server lifecycle owns the single execution stage; the URL `step` only expresses the viewed stage. Runtime verified that changing the viewed step leaves Staging as the current execution state.
- Exactly one decision card and one primary release action render for the current blocker.
- Gate catalog state has one runtime owner and is shared with the preflight view, so refresh cannot produce two conflicting gate truths.
- Activity is grouped as recent run snapshots, repeated attempts are collapsed, and evidence entries remain linked to their real Run IDs.
- Runtime verified gate disclosure, keyboard stage navigation, evidence deep-link drawer, Escape close with focus restoration, and canonical query updates.
- At 390px the document has no horizontal overflow and relevant interactive targets are at least 44px high.
- Final browser console errors: 0. Final axe WCAG 2.0/2.1 A/AA violations: 0.

## Verification

- Focused tests: 10 files, 41 tests passed.
- TypeScript type-check: passed.
- i18n parity: passed, 3,854 leaf messages.
- Production build: passed.
- Docker web image rebuild and service restart: passed; web root 200, API health 200, MySQL and API healthy.

No P0, P1, or P2 issue remains against the approved subtractive workbench target. Remaining density inside expanded historical tables is a non-blocking P3 follow-up.

final result: passed

---

# Project Workbench Design QA

## Target and state

- Approved source:
  `/Users/zhaoxingbo/.codex/generated_images/01a01ff0-b46b-7c02-967f-1d890287b373/exec-87319ad5-db85-41af-8dcc-41dbb7c072bb.png`
- Implementation route:
  `/projects/cmrwxl1ks000k6enjiclutd5a/settings`
- Desktop implementation evidence:
  `/tmp/codex-tool-runs/svton/project-workbench/browser/project-config-final-portal-hover.png`
- Desktop viewport and source pixels: 1487×1058.
- Browser CSS viewport: 1487×1058; device pixel ratio: 2; visual scale: 1.
- State: Production selected, one real version candidate selected, overflow
  action open.

## Full-view comparison

The approved image and implementation screenshot were inspected together in a
single comparison input at the same dimensions and state.

Matched hierarchy:

- project facts and one `创建发布` primary action;
- `项目信息 / 发布 / 项目配置 / 域名与入口 / 部署记录` navigation;
- compact contextual issue and inline repair link;
- configuration rail with an existing-environment selector;
- current version, compact version table, and evidence detail rail;
- three direct operations plus an ellipsis overflow menu.

Intentional differences:

- Devpilot's real global application sidebar remains visible because it is part
  of the existing platform shell.
- Actual project/version data replaces the illustrative data in the approved
  image. Empty current-version fields remain empty instead of being fabricated.

## Focused interaction evidence

- Overflow menu parent: `BODY`.
- Menu bounds: left 1006, right 1166, top 735, bottom 777.
- Table bottom: 752; viewport right/bottom: 1487/1058.
- Result: the menu opens below the table without being clipped by its horizontal
  overflow container.
- Component tests cover both click and hover/focus entry paths and the
  no-overflow case for three or fewer actions.

## Iteration history

1. P1: the default environment opened an empty Development state. Fixed by
   preferring the real Production baseline when present.
2. P1: the version surface lacked a decision-oriented evidence rail and exposed
   insufficient source facts. Fixed with actual branch, commit, release,
   creation, approval, and change evidence.
3. P2: a long backend approval sentence consumed the status column. Fixed with
   the concise `待生产审批` status and detailed evidence in the rail.
4. P2: the operation column background was transparent and the overflow menu
   was clipped. Fixed with an opaque sticky cell and a portal-backed menu.
5. P2: at 390px the Grid's implicit minimum width was expanded by the 780px
   table, preventing the sticky action column from reaching the visible edge.
   Source is fixed with `minmax(0, 1fr)` so the table owns horizontal scrolling.

## Verification result

**BLOCKED — not passed yet.**

There are no open desktop P0/P1/P2 findings. Docker Desktop was recovered
without deleting images or volumes; fresh Web/API images and containers are
healthy, their HTTP checks return 200, and no migration is pending. The
remaining gate is a final runtime rerun of item 5 at 390×844. Automated
navigation to the local project URL is currently blocked by browser security
policy, so a user-opened local tab is required. Do not mark this report `passed`
until that narrow state confirms the operation column remains visible with no
document-level overflow.
