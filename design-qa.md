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
