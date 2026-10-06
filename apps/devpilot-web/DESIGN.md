---
name: 'Devpilot Web Guided Control Plane'
description: 'An Operate-mode delivery workspace built around real state, attached actions, and auditable evidence.'
colors:
  background: 'hsl(0 0% 100%)'
  foreground: 'hsl(222.2 84% 4.9%)'
  primary: 'hsl(221.2 83.2% 53.3%)'
  primary-foreground: 'hsl(210 40% 98%)'
  secondary: 'hsl(210 40% 96.1%)'
  secondary-foreground: 'hsl(222.2 47.4% 11.2%)'
  muted: 'hsl(210 40% 96.1%)'
  muted-foreground: 'hsl(215.4 16.3% 46.9%)'
  border: 'hsl(214.3 31.8% 91.4%)'
  destructive: 'hsl(0 84.2% 60.2%)'
  success: 'hsl(142.1 76.2% 36.3%)'
  warning: 'hsl(32.1 94.6% 43.7%)'
  release-primary: '#1677ff'
  release-done: '#096dd9'
  release-done-surface: '#e6f4ff'
  release-available-text: '#5f636d'
  release-available-surface: '#f1f1ef'
  release-blocked: '#c53b37'
  release-blocked-surface: '#fff1f0'
  release-disabled: '#b7bbc2'
  release-disabled-surface: '#f7f7f6'
  substep-line: '#e5e7eb'
  substep-icon: '#8b919a'
  substep-border: '#d6d9de'
  substep-done-border: '#91caff'
  table-hover: '#f8f8ff'
typography:
  display:
    fontSize: 'clamp(24px, 2.4vw, 34px)'
    lineHeight: 1.1
    letterSpacing: '-0.045em'
  headline:
    fontSize: '25px'
    lineHeight: 1
    letterSpacing: '-0.035em'
  title:
    fontSize: '15px'
    letterSpacing: '-0.015em'
  body:
    fontSize: '14px'
    lineHeight: '24px'
  label:
    fontSize: '14px'
    fontWeight: 650
    lineHeight: '20px'
  metadata:
    fontSize: '11px'
    lineHeight: '16px'
rounded:
  lg: '0.5rem'
  md: 'calc(0.5rem - 2px)'
  sm: 'calc(0.5rem - 4px)'
  surface: '12px'
  lifecycle: '10px'
  substep-focus: '6px'
  circle: '999px'
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.primary-foreground}'
    rounded: '{rounded.md}'
    padding: '8px 16px'
    height: '44px'
  button-secondary:
    backgroundColor: '{colors.secondary}'
    textColor: '{colors.secondary-foreground}'
    rounded: '{rounded.md}'
    padding: '8px 16px'
    height: '44px'
  input:
    backgroundColor: '{colors.background}'
    textColor: '{colors.foreground}'
    rounded: '{rounded.md}'
    padding: '8px 12px'
    height: '44px'
  project-tab:
    backgroundColor: 'transparent'
    textColor: '{colors.muted-foreground}'
    height: '44px'
  project-tab-active:
    backgroundColor: 'transparent'
    textColor: '{colors.primary}'
    height: '44px'
  surface:
    backgroundColor: '{colors.background}'
    textColor: '{colors.foreground}'
    rounded: '{rounded.surface}'
  lifecycle-selected:
    backgroundColor: '{colors.release-primary}'
    textColor: '#ffffff'
    height: '64px'
  lifecycle-done:
    backgroundColor: '{colors.release-done-surface}'
    textColor: '{colors.release-done}'
    height: '64px'
  lifecycle-available:
    backgroundColor: '{colors.release-available-surface}'
    textColor: '{colors.release-available-text}'
    height: '64px'
  lifecycle-blocked:
    backgroundColor: '{colors.release-blocked-surface}'
    textColor: '{colors.release-blocked}'
    height: '64px'
  lifecycle-disabled:
    backgroundColor: '{colors.release-disabled-surface}'
    textColor: '{colors.release-disabled}'
    height: '64px'
---

# Design System: Devpilot Web Guided Control Plane

## Overview

**Creative North Star: "Guided Control Plane"**

**Mode: Operate.** Devpilot Web is an operational delivery console. Scanability, truthful state, keyboard reachability, and the next valid action take precedence over decorative expression. The existing global Devpilot navbar, its role filtering, grouping, desktop sidebar, and mobile expansion remain the application shell.

The project workbench uses an all-white canvas, compact shadowed surfaces, restrained global primary blue, and a dedicated `#1677ff` release lifecycle rail. Project, environment, release, build, deployment, and evidence values come from current APIs or deterministic field-contract transformations; missing facts remain missing.

**Key Characteristics:**

- Existing global navbar plus one default project overview; configuration is a secondary Header route action.
- All-white workspace with small shadowed operational surfaces.
- Real fields before decoration, with technical evidence disclosed on demand.
- Four connected release stages with clickable child steps and explicit disabled semantics.
- Warnings attached to their owning project or lifecycle stage.
- Dense tables on desktop and contained horizontal scrolling on mobile.

**The Server Truth Rule.** The interface presents persisted or deterministically derived facts; it never manufactures lifecycle success or operational certainty.

## Colors

The global application uses its existing HSL semantic tokens. Release lifecycle navigation adds a narrow, literal blue/red/gray vocabulary defined in its CSS modules.

### Primary

- **Application Primary** (`primary`): general links, actions, focus rings, and active project tabs.
- **Release Primary** (`release-primary`): the selected major stage and current child-step icon/text.
- **Completed Release Blue** (`release-done`, `release-done-surface`): completed but unselected lifecycle stages.

### Neutral

- **White Workspace** (`background`): page ground, header, project content, static cards, table surfaces, modal panels, and drawers.
- **Operational Ink** (`foreground`): headings and primary facts.
- **Muted Surface and Ink** (`muted`, `muted-foreground`): secondary information, disabled-adjacent explanations, and quiet controls.
- **Divider** (`border`): table rows, section boundaries, tabs, and shell separation.
- **Available Lifecycle Gray** (`release-available-text`, `release-available-surface`): enabled but unselected stages.
- **Disabled Lifecycle Gray** (`release-disabled`, `release-disabled-surface`): unavailable stages; it is intentionally lighter than the available state.

### Semantic

- **Blocked** (`destructive`, `release-blocked`, `release-blocked-surface`): real blockers and failed execution evidence.
- **Warning** (`warning`): pending, manual, or review-needed conditions.
- **Success** (`success`): confirmed completion.

**The Non-Color State Rule.** Status always has text, an icon, native disabled behavior, or an explicit explanation in addition to color.

## Typography

The app does not define a custom brand font token; it uses the existing Tailwind/system sans stack and `font-mono` utility. Monospace is reserved for commit SHAs, manifests, run IDs, durations, ports, and other technical evidence.

### Hierarchy

- **Screen display** (`clamp(24px, 2.4vw, 34px)`, `1.1`, `-0.045em`): page purpose.
- **Project headline** (`26px`, `1`, `-0.035em`; `24px` on narrow screens): project identity.
- **Section title** (`15px`, `-0.015em`): compact surface headings.
- **Table body** (`12.5px`): dense operational rows.
- **Body** (`14px`, `24px`): explanations and operational copy.
- **Lifecycle label** (`14px`, `650`, `20px`): major stage names.
- **Lifecycle metadata** (`11px`, `16px`): stage descriptions and dense supporting facts.

**The Evidence Type Rule.** Use monospace only when the value benefits from character-by-character comparison; human-readable names and statuses stay in the system sans stack.

## Layout

The existing desktop shell remains a `56px` header above a `256px` sidebar and a scrollable main area with `24px` padding. Mobile retains the production header and replaces the sidebar with the expandable full navigation menu; it does not copy the prototype's demonstration shell.

Project pages place a deterministic back action, compact shared identity header, secondary context route action, and one project-level issue surface before content. The header has no fixed minimum height, wraps on narrow widths, keeps the single page-level `创建发布` action visible, and owns only its top inset; the route sibling gap exclusively owns the transition to content. Tables use their own overflow container and never force page-level horizontal scrolling.

The overview gives real project basics a borderless compact scan band with real environment/component counts. At desktop it is a semantic two-row, three-column grid: description / release policy / environment and components, then creator / created time / updated time. At two columns, description and creator span the row while policy/environment and created/updated remain paired in the same DOM order. One default-collapsed `仓库详情` section follows the facts and precedes the content tabs. It uses the same borderless section-title level as `基本信息`; the title and chevron directly toggle the disclosure, and the folded state does not spend a second row on a summary or duplicate expand action. Expanded content shows only flat read-only repository identity facts from the real connection/canonical identity. A URL-backed in-page tab rail switches between release records (default), environments, and components without repeating the selected tab as a panel title. The component panel begins with a borderless latest-recognition block bound to the latest real repository-analysis branch/commit and filtered `application_service` results; its single low-emphasis full-analysis link sits immediately after the recognition heading rather than at the far edge of the panel. The component table follows below. Run history, selected-run stage/log evidence, recovery, and all detected-change review live on the independent `仓库分析` page; repository connection, credential reconnect, and default-branch revision remain in `项目配置 / 仓库设置` without an overview shortcut or environment selector. In environment configuration, scope sits at the top of the desktop rail; on narrow screens it shares one compact two-part toolbar with the configuration-type selector instead of occupying its own row.

The release detail is a standalone nested route without the project header, project tabs, or project-level warning. Under `basic_v1`, its major rail is a two-column connected arrow for `预发 → 生产（线上）` on desktop and remains connected on mobile. Child steps change from a horizontal connector to a vertical connector at `720px`. The dormant governed profile may retain deeper lifecycle evidence without exposing it as MVP navigation. Verified layouts are `1440 × 1024`, `1280 × 800`, and `390 × 844`.

**The Ownership Rule.** A project warning sits below project identity metadata in a pale semantic warning surface; a lifecycle warning sits at the top of the selected stage panel.

## Elevation & Depth

Depth is restrained. The page, navbar, content workspace, and resting surfaces are white; dividers, spacing, and the shared small shadow create hierarchy.

### Shadow Vocabulary

- **Project Surface** (`0 1px 2px rgba(20,24,36,.05), 0 6px 18px rgba(20,24,36,.045)`): tables and bounded project/release work areas.
- **Primary Action** (`0 4px 10px rgba(79,94,232,.18)`): the project-level create-release action.
- **Overlay Utilities** (`shadow-lg`, `shadow-xl`): existing production modal and drawer primitives; do not replace them with project-surface shadows.

**The White Surface Rule.** Static hierarchy comes from spacing, borders, and the shared shadow, not gray page panels or decorative surface colors.

## Shapes

Global controls follow the existing radius token (`0.5rem`) and its `md`/`sm` derived forms. Project table and lifecycle panels use `12px` corners. The connected lifecycle rail uses a `10px` outer radius and clipped arrow geometry; child-step icons are `24px` circles with `999px` rounding. Focus geometry is explicit: stage focus stays inside the clipped rail, while child-step focus uses a `6px` rounded outline box.

## Components

### Global and Project Navigation

Preserve `navigation-items.ts` as the source for global names, grouping, role filtering, desktop sidebar, and mobile navigation. The project Header uses a `44px` back action plus secondary context route action. Overview content tabs are `44px` minimum-height buttons with roving focus; the active mode uses primary text and a `2px` underline.

### Buttons and Fields

Primary, secondary, outline, ghost, and destructive buttons reuse the local token-driven `Button`; default touch height is `44px`. Inputs and selects reuse the shared production primitives with `44px` default height, `36px` compact height, primary focus rings, destructive invalid treatment, and real disabled semantics. A page-level environment change remains a select, not a drawer.

### Tables and Surfaces

Standalone project table surfaces are white, `12px` rounded, overflow-contained, and use `PROJECT_SURFACE_SHADOW`. Tables inside the overview's release, environment, and component Tab panels use the embedded surface variant without an outer radius, border, or shadow because the Tab rail already owns the content boundary. Headers are `40px`; data rows are `58px`; table text is `12.5px`, headers `11px`, with `14px` horizontal cell padding and `#f8f8ff` row hover. Collection search and filters align to the reading-start edge while a related cross-route exit may align opposite; stacked controls preserve that DOM/focus order. Wide component, version, release, domain, and deployment tables scroll only inside their surface.

### Lifecycle Rail and Child Steps

The `basic_v1` major stages are `预发 → 生产（线上）`. Staging contains only `构建 → 部署`; Production contains only `生产部署` and reuses the same immutable Manifest that completed staging. Checks and evidence may explain a blocked action but are not separate MVP steps. `done`, `current`, `available`, `blocked`, and `disabled` are view states derived from real lifecycle evidence, not a second persisted lifecycle.

Disabled stages and steps use native `disabled`, `aria-disabled`, and `tabIndex=-1`. Both navigation levels use roving focus: Arrow keys wrap across enabled items, Home/End jump to the first/last enabled item, and disabled items are skipped. Each `role=tab` owns an explicit `aria-controls` relationship to a `role=tabpanel`; the selected child panel is programmatically focusable.

### Warnings and Actions

Project warnings use `对象 + 问题 + 影响。具体动作 →` inside `border-warning/40 bg-warning/10` and remain below identity metadata. Stage warnings are compact reason-impact-action strips at the top of their stage panel. A production preflight blocker disables `生产部署` with its reason; an execution failure blocks that same step.

### Status Tags

Status tags map real states to neutral, blue, cyan, green, orange, or red semantic tones. Running status may use the existing animated cyan dot; the written label remains authoritative.

### Modals and Drawers

Use modals for bounded review or confirmation, including version detail/switching. Use drawers for logs, build/deployment evidence, and longer technical inspection that must preserve page context. Existing primitives provide modal semantics, initial focus, Tab containment, Escape close, mask close where enabled, and focus restoration. Technical IDs and raw evidence remain progressively disclosed.

## Do's and Don'ts

### Do:

- **Do** preserve the existing global navbar, deterministic project back action, and Header configuration entry.
- **Do** show direct API fields or documented deterministic derivations, using `—` or an explicit empty state when absent.
- **Do** keep warnings and their repair action inside the owning project or lifecycle stage.
- **Do** preserve dense tables and contain their horizontal scrolling.
- **Do** keep the `basic_v1` two-stage rail, child-step connectors, roving focus, and tab/tabpanel relationships at desktop and `390px`.
- **Do** use modals for bounded confirmation and drawers for logs or technical evidence.

### Don't:

- **Don't** invent progress percentages, ETA, owner, change counts, recovery paths, or project-wide current versions.
- **Don't** infer success from partial frontend data or turn presentation states into persisted lifecycle truth.
- **Don't** move project warnings into release detail or attribute a production-check blocker to production deployment.
- **Don't** make disabled stages focusable or rely on color alone to explain them.
- **Don't** replace production navigation, tables, selects, modals, or drawers with prototype-only substitutes.
- **Don't** add gray resting surfaces, new shadows, colors, radii, or breakpoints without an implemented source.
