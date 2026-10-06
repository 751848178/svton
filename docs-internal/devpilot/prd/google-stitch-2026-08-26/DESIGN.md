---
version: "alpha"
name: "Devpilot Operational Console"
description: "A dense, evidence-led enterprise console for projects, releases, environments, deployments, approvals, and operational governance."
colors:
  background: "#FFFFFF"
  shell: "#F8FAFC"
  surface: "#F9FBFF"
  primary: "#0F62FE"
  primary-strong: "#1D4ED8"
  primary-soft: "#EFF6FF"
  primary-soft-strong: "#DBEAFE"
  text: "#101828"
  text-secondary: "#344054"
  text-muted: "#667085"
  border: "#E4E7EC"
  border-strong: "#D0D5DD"
  success: "#067647"
  success-soft: "#ECFDF3"
  warning: "#B54708"
  warning-soft: "#FFF7ED"
  danger: "#B42318"
  danger-soft: "#FFF1F2"
  on-primary: "#FFFFFF"
typography:
  page-title:
    fontFamily: "Noto Sans SC"
    fontSize: 26px
    fontWeight: 700
    lineHeight: 1.35
  section-title:
    fontFamily: "Noto Sans SC"
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.45
  body:
    fontFamily: "Noto Sans SC"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.55
  body-strong:
    fontFamily: "Noto Sans SC"
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.55
  label:
    fontFamily: "Noto Sans SC"
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.45
  metadata:
    fontFamily: "Noto Sans SC"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.45
  code:
    fontFamily: "SFMono-Regular, Consolas, Liberation Mono, monospace"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.5
rounded:
  xs: 4px
  sm: 6px
  md: 8px
  lg: 12px
spacing:
  1: 4px
  2: 8px
  3: 12px
  4: 16px
  5: 20px
  6: 24px
  8: 32px
  10: 40px
components:
  topbar:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text}"
    height: 64px
    padding: 16px
  sidebar:
    backgroundColor: "{colors.shell}"
    textColor: "{colors.text-secondary}"
    width: 236px
    padding: 12px
  navigation-selected:
    backgroundColor: "{colors.primary-soft-strong}"
    textColor: "{colors.primary-strong}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.sm}"
    height: 36px
    padding: 10px
  content-surface:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: 24px
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    height: 36px
    padding: 12px
  button-primary-hover:
    backgroundColor: "{colors.primary-strong}"
    textColor: "{colors.on-primary}"
  button-secondary:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text-secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    height: 36px
    padding: 12px
  input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    height: 36px
    padding: 10px
  table-header:
    backgroundColor: "{colors.shell}"
    textColor: "{colors.text-muted}"
    typography: "{typography.label}"
    height: 42px
    padding: 12px
  table-row:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text-secondary}"
    typography: "{typography.body}"
    height: 58px
    padding: 12px
  divider:
    backgroundColor: "{colors.border}"
    textColor: "{colors.text}"
    height: 1px
  focus-outline:
    backgroundColor: "{colors.border-strong}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: 2px
  status-info:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary-strong}"
    typography: "{typography.metadata}"
    rounded: "{rounded.xs}"
    padding: 6px
  status-success:
    backgroundColor: "{colors.success-soft}"
    textColor: "{colors.success}"
    typography: "{typography.metadata}"
    rounded: "{rounded.xs}"
    padding: 6px
  status-warning:
    backgroundColor: "{colors.warning-soft}"
    textColor: "{colors.warning}"
    typography: "{typography.metadata}"
    rounded: "{rounded.xs}"
    padding: 6px
  status-danger:
    backgroundColor: "{colors.danger-soft}"
    textColor: "{colors.danger}"
    typography: "{typography.metadata}"
    rounded: "{rounded.xs}"
    padding: 6px
  drawer:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text}"
    width: 560px
    padding: 24px
  dialog:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text}"
    width: 520px
    rounded: "{rounded.lg}"
    padding: 24px
---

## Overview

Devpilot is an operational workbench, not a marketing dashboard. Its visual identity is calm, compact, precise, and evidence-led. Every screen keeps the active object, current state, problem, impact, and next action close together so engineers and operators can make high-confidence decisions without scanning decorative cards.

The system uses the approved project-module V2 direction: a 64px global header, a compact left navigation, white working surfaces, dense tables, blue primary actions, quiet borders, and semantic status colors. Pages should feel like one coherent console even when they cover different domains such as projects, releases, environments, approvals, and infrastructure.

## Colors

- **Background (#FFFFFF):** Main working surfaces, tables, drawers, and dialogs.
- **Shell (#F8FAFC):** Application frame, navigation, table headers, and quiet grouping regions.
- **Surface (#F9FBFF):** Subtle contextual panels that need separation without looking like large cards.
- **Primary (#0F62FE):** The single primary action, selected navigation, active tabs, and meaningful links.
- **Text (#101828):** Page titles, primary object names, and critical values.
- **Text Secondary (#344054):** Default body copy and table values.
- **Text Muted (#667085):** Labels, metadata, secondary descriptions, and inactive navigation.
- **Border (#E4E7EC):** Default separators; use Border Strong only for focused or structurally important boundaries.
- **Success, Warning, Danger:** Use only for state semantics. Pair every color with an icon and explicit text; never make color the only signal.
- **Soft status colors:** Use as compact badge or inline issue backgrounds, not as full-page fills.

## Typography

Use Noto Sans SC for all Chinese and Latin interface copy. Titles are confident but compact: 26px for page identity and 18px for section identity. Body content remains 14px so dense operational tables stay readable. Metadata is 12px and must never carry the only explanation for a critical problem.

Use the monospace token only for commit hashes, Manifest IDs, request IDs, configuration keys, commands, and log content. Do not render ordinary labels or buttons in monospace. Prefer tabular numerals when a generated implementation supports them.

## Layout

- Desktop baseline is 1440×1024. The top bar is 64px high and the left navigation is 236px wide.
- Main content uses 24px outer padding, 24–32px between major sections, and 12–16px within controls or compact groups.
- Page headers place breadcrumbs above or beside the page identity, with the one primary action aligned to the upper right.
- Tables are the default for repeated operational objects. Header height is about 42px and row height stays within 56–59px unless a row contains an explicit second line of evidence.
- Drawers preserve the list context for evidence, configuration details, build history, and deployment runs. Use full pages for multi-step intake and release workflows.
- Forms use a readable 640–760px content column. Put validation next to the field and preserve valid input after failures.
- On 390px mobile screens, navigation becomes a drawer, forms become one column, and tables become prioritized rows or cards that retain object, status, problem, and next action.

## Elevation & Depth

The default interface is flat. Use borders and spacing before shadows. A focused drawer, dropdown, or dialog may use `0 4px 16px -4px rgba(16, 24, 40, 0.10)`. Avoid stacked shadows, floating dashboard cards, glass effects, gradients, or depth used only for decoration.

Overlays must leave enough underlying context visible for users to understand what object they are editing. Logs and evidence drawers may be wider than ordinary forms but should not obscure the global page identity.

## Shapes

Corners are restrained: 4px for badges and small controls, 6px for buttons and inputs, 8px for surfaces, and 12px only for dialogs or large overlays. Do not use pill shapes for ordinary buttons or navigation. Circular shapes are reserved for avatars, progress indicators, and icon-only controls with accessible labels.

Icons should come from the existing product icon library. Do not replace them with emoji, text symbols, bespoke illustrations, or decorative SVG substitutes.

## Components

- **Global shell:** Brand, team switcher, locale, and user menu live in the top bar. Navigation is grouped by task domain and clearly marks the current route.
- **Page header:** Contains breadcrumbs, object/page identity, a short operational summary, and at most one primary action.
- **Buttons:** One blue primary action per view. Secondary and tertiary actions use neutral surfaces or text. Destructive actions are red only inside the relevant confirmation context.
- **Tables:** Put stable identity first, status and operational facts next, and row actions last. Keep row actions contextual; do not repeat the page primary action in every row.
- **Status badges:** Always include readable status text. `blocked`, `failed`, `warning`, `manual`, and `unavailable` must have distinct icon/text semantics.
- **Problem rows:** Keep problem, affected object, impact, evidence, and exact repair destination together. The repair action is next to the issue, not detached in a large banner.
- **Tabs:** Use tabs only for peer views of the same object, such as the six environment configuration areas. Do not use tabs to hide unrelated project tasks.
- **Drawers:** Use for evidence, immutable version details, build history, deployment runs, and configuration previews. Include object ID and close action in a stable header.
- **Dialogs:** Use for concise creation, confirmation, or review. Multi-step repository intake and release execution belong on full pages.
- **Forms:** Labels remain visible, required state is explicit, secrets are masked, and error text states the cause and correction.
- **Logs and evidence:** Use monospace for machine output, line wrapping or horizontal scrolling intentionally, copyable IDs, timestamps, source links, and explicit unavailable states.

## Do's and Don'ts

### Do

- Reuse the approved Shell and component language across every Devpilot module.
- Keep Project, Environment, ReleaseOrder, Manifest, DeploymentRun, Approval, and EnvironmentVersion identities visible and consistent across screens.
- Show what is blocked, why it matters, which evidence proves it, and the exact place to fix it.
- Preserve immutable history: recovery creates a new run/version instead of rewriting a previous success or failure.
- Keep the production Manifest identical to the Manifest verified in staging and show that relationship in the UI.
- Use realistic Chinese data, explicit empty/error/permission states, visible focus, keyboard navigation, and WCAG AA contrast.

### Don't

- Do not invent KPIs, charts, traffic data, real-time metrics, or automated policies without a real data source.
- Do not generate gray/canary or blue-green controls, automatic rollback, metric-driven termination, or change-window gates as if they are live.
- Do not use oversized cards, hero banners, excessive whitespace, gradients, glassmorphism, or decorative illustrations in operational pages.
- Do not place multiple competing blue actions in one view or use vague labels such as “立即处理” without naming the destination and object.
- Do not reveal secret values in tables, logs, evidence, previews, or generated sample data.
- Do not make the legacy `/publish` wizard the new project navigation model.
