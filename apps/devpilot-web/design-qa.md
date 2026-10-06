# Devpilot project workbench v3 — design QA

## Frozen reference

- Field contract: `evaluation/design/devpilot-design-system-v3/prototype/FIELD_CONTRACT.md`
- Desktop project overview: `evaluation/design/devpilot-design-system-v3/prototype/audit-2026-08-27-field-contract/overview-desktop.png` (1440 × 1024, 1×)
- Desktop release detail: `evaluation/design/devpilot-design-system-v3/prototype/audit-2026-08-27-field-contract/release-detail-desktop.png` (1440 × 1024, 1×)
- Mobile project overview: `evaluation/design/devpilot-design-system-v3/prototype/audit-2026-08-27-field-contract/overview-mobile.png` (780 × 1688, 2× source rendered at 390 × 844 CSS px)
- Mobile navigation: `evaluation/design/devpilot-design-system-v3/prototype/audit-2026-08-27-field-contract/mobile-navigation.png` (390 × 844, 1×)
- Mobile release flow: `evaluation/design/devpilot-design-system-v3/prototype/implementation-mobile-release.png` (390 × 844, 1×)

## Implementation evidence

- Project overview, desktop: `.impeccable/review/project-overview-desktop.png` (1440 × 1024, 1×)
- Release detail, desktop: `.impeccable/review/release-detail-desktop.png` (1440 × 1024, 1×)
- Project settings, desktop: `.impeccable/review/project-settings-desktop.png` (1440 × 1024, 1×)
- Project overview, mobile: `.impeccable/review/project-overview-mobile.png` (390 × 844, 1×)
- Release detail, mobile: `.impeccable/review/release-detail-mobile.png` (390 × 844, 1×)
- Release child steps, mobile: `.impeccable/review/release-detail-mobile-steps.png` (390 × 844, 1×)
- Expanded production navigation, mobile: `.impeccable/review/mobile-navigation-open.png` (390 × 844, 1×)
- Release detail, compact desktop: `.impeccable/review/release-detail-1280.png` (1280 × 800, 1×)

## Same-input comparisons

- `.impeccable/review/compare-overview-desktop.png` (reference and implementation, 2880 × 1024)
- `.impeccable/review/compare-release-detail-desktop.png` (reference and implementation, 2880 × 1024)
- `.impeccable/review/compare-overview-mobile.png` (reference normalized to 390 × 844 and implementation, 780 × 844)
- `.impeccable/review/compare-overview-focus.png`
- `.impeccable/review/compare-release-detail-focus.png`
- `.impeccable/review/compare-release-detail-mobile.png` (mobile release reference and implementation, 780 × 844)
- `.impeccable/review/compare-mobile-navigation.png` (navigation reference and retained production navbar, 780 × 844)

## Fidelity assessment

| Surface | Result | Evidence |
| --- | --- | --- |
| Information architecture | Passed | Five project destinations are preserved; release detail is a standalone nested route. |
| Visual hierarchy | Passed | White page canvas, compact shadowed surfaces, restrained blue primary state, and warning placement match the frozen direction. |
| Lifecycle steps | Passed | Four connected major stages and clickable child steps render without broken arrow borders, text collisions, or connector overlap. |
| Component consistency | Passed | Touched tables, status treatments, select controls, modals, and drawers reuse the production component system. |
| Responsive layout | Passed | Desktop and 390 px mobile captures have no clipped controls, overlapping copy, or broken horizontal flow. |
| Data truth | Passed | Project identity, repository, branch, commit, releases, environment versions, deployment evidence, and blockers come from existing hooks and API contracts; unavailable evidence is stated rather than invented. |

## Interaction verification

- Opened `/projects/cmrwxl1ks000k6enjiclutd5a/releases/cmsmzs63q00ek1700clhiytmj` directly as an independent release detail page.
- Switched the release child step to `构建`; the URL changed to `?step=build` and the panel showed the real BuildRun revision and truthful empty-manifest message.
- Confirmed `验证` and `完成` expose disabled semantics before their persisted prerequisites are met.
- Confirmed production preflight blockers mark `生产检查` blocked while leaving `生产部署` disabled; execution failures mark only `生产部署` blocked.
- Confirmed both lifecycle levels use roving tab focus, arrow/Home/End navigation that skips disabled steps, and explicit tab-to-tabpanel relationships.
- Confirmed project-level and selected-stage warnings are placed at the top of their owning content area with reason, impact counts, and a contextual action.
- Changed the project configuration environment through the page-level select from Production to Staging without opening a drawer.
- Opened and closed version detail as a modal; release run history/log operations remain drawers or modals.
- Rechecked the final project overview after a clean reload; no missing-message, runtime exception, or internal-server-error surface was present.

## Comparison history

1. Pass one found a dense release decision alert and a `next-intl` dotted-key runtime issue. The alert was rebuilt as a compact reason-impact-action strip and the message keys were converted to nested locale objects.
2. Pass two compared desktop and mobile reference/implementation pairs in the same visual input. No P0, P1, or P2 visual defect remained.
3. Independent finish review found that the mobile chevrons/connectors had been removed, production preflight blockers were attributed to deployment, keyboard tab relationships were incomplete, and release rows exposed duplicate detail entries. The mobile rail now retains four connected chevrons, child steps retain a vertical connector, preflight/deployment failures are separated and tested, tab semantics are complete, and the release version is the single detail entry. Updated 1280 × 800, mobile release, child-step, and expanded-navigation evidence was captured.

## Intentional differences

- The global Devpilot navbar remains the existing production navbar because the user explicitly required it.
- Copy, release state, blockers, timestamps, versions, and evidence reflect the real Picshare project instead of the prototype's sample state.
- These are data/system constraints, not visual substitutions; the frozen structure, hierarchy, states, spacing, and interaction model are preserved.

final result: passed
