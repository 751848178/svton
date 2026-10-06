---
name: "Devpilot Guided Control Plane"
description: "A white operational control plane that keeps one delivery decision and its evidence in view."
colors:
  paper: "#ffffff"
  paper-deep: "#f5f6f8"
  surface: "#ffffff"
  surface-soft: "#f7f8fa"
  shell: "#202126"
  shell-soft: "#2a2b31"
  ink: "#1b1c20"
  muted: "#666a73"
  muted-2: "#686b72"
  line: "#e5e7eb"
  line-strong: "#d1d5db"
  accent: "#4f5ee8"
  accent-dark: "#3d49c7"
  accent-soft: "#eef0ff"
  danger: "#bd443d"
  danger-soft: "#fff1ef"
  warning: "#7d4b0b"
  warning-soft: "#fff7e8"
  success: "#147a55"
  success-soft: "#eaf7f1"
typography:
  display:
    fontFamily: '"Avenir Next", "PingFang SC", "Noto Sans CJK SC", sans-serif'
    fontSize: "clamp(25px, 3vw, 40px)"
    lineHeight: 1.08
    letterSpacing: "-.045em"
  headline:
    fontFamily: '"Avenir Next", "PingFang SC", "Noto Sans CJK SC", sans-serif'
    fontSize: "clamp(24px, 2.4vw, 34px)"
    lineHeight: 1.1
    letterSpacing: "-.045em"
  title:
    fontFamily: '"Avenir Next", "PingFang SC", "Noto Sans CJK SC", sans-serif'
    fontSize: "25px"
    lineHeight: 1
    letterSpacing: "-.035em"
  body:
    fontFamily: '"Avenir Next", "PingFang SC", "Noto Sans CJK SC", sans-serif'
    fontSize: "14px"
    lineHeight: 1.6
  label:
    fontFamily: '"Avenir Next", "PingFang SC", "Noto Sans CJK SC", sans-serif'
    fontSize: "13px"
    fontWeight: 680
  mono:
    fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace'
    letterSpacing: "-.02em"
rounded:
  control: "8px"
  surface: "12px"
  task: "14px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 15px"
    height: "38px"
  button-primary-hover:
    backgroundColor: "{colors.accent-dark}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 15px"
    height: "38px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 15px"
    height: "38px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "7px"
    padding: "0 10px"
    height: "38px"
  navigation-tab:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    padding: "0 1px"
    height: "44px"
  navigation-tab-active:
    backgroundColor: "transparent"
    textColor: "{colors.accent-dark}"
    padding: "0 1px"
    height: "44px"
  rail-item:
    backgroundColor: "transparent"
    textColor: "#aeb0b8"
    rounded: "{rounded.control}"
    padding: "0 11px"
    height: "40px"
  rail-item-active:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-dark}"
    rounded: "{rounded.control}"
    padding: "0 11px"
    height: "40px"
  surface-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    boxShadow: "0 1px 2px rgba(20, 24, 36, .05), 0 6px 18px rgba(20, 24, 36, .045)"
  task-surface:
    backgroundColor: "{colors.shell}"
    textColor: "{colors.surface}"
    rounded: "{rounded.task}"
    padding: "clamp(24px, 3vw, 38px)"
---

# Design System: Devpilot Guided Control Plane

## Overview

**Creative North Star: "Guided Control Plane"**

Devpilot is an operational workspace with a white navigation frame and a continuous white work surface. It is precise and dense without feeling compressed: one current delivery decision leads, while tables, rails, and drawers disclose deeper evidence only where it helps an operator act.

The visual system treats AI as contextual explanation, not as the application's navigation model or source of production truth. Cobalt marks deliberate action, semantic colors stay narrow, and the most important blocker or next step remains attached to the object it affects.

### Direction Contract

- **THESIS:** One current delivery decision dominates; reject KPI-card dashboards and chat-first navigation.
- **OWN-WORLD:** Continuous white ground, precise cobalt action, compact dividers, small natural elevation, and restrained semantic color remain recognizable without content.
- **STORY:** Understand Picshare state, repair the production entry, rerun server checks, deploy, and inspect evidence.
- **FIRST VIEWPORT:** A 256px grouped rail and compact project identity sit above the current task; the repair action stays beside its blocker.
- **FORM:** Guided Control Plane, the user-pinned reference-first form and rank 1 of the validated shortlist; seed `c23468f7`.
- **FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

**Key Characteristics:**

- White workspace and navigation frame separated by precise dividers.
- One clearly titled current task before supporting evidence.
- Dense information expressed through alignment, dividers, and narrow inspection panes.
- Cobalt actions with icon-and-label semantic states.
- Contextual AI and evidence drawers that never imply a production mutation.

**The Current Decision Rule.** Every screen identifies one decision or task before it expands into records, evidence, or history.

## Colors

The palette combines continuous white working surfaces, quiet neutral interaction states, and a precise cobalt action family; red, amber, and green appear only for operational state.

### Primary

- **Precise Cobalt** (`accent`): the page-level action, progress, and selected emphasis.
- **Deep Cobalt** (`accent-dark`): active navigation, links, and primary hover.
- **Cobalt Wash** (`accent-soft`): selected configuration rows and bounded proposal surfaces.

### Neutral

- **White Ground** (`paper`) and **Quiet Neutral** (`paper-deep`): the application ground and quiet navigation hover.
- **White Surface** (`surface`) and **Soft Surface** (`surface-soft`): cards, fields, secondary controls, and restrained hover feedback.
- **Graphite Utility** (`shell`) and **Soft Graphite** (`shell-soft`): reserved for logs, toast, backdrops, and other bounded technical utility surfaces.
- **Operational Ink** (`ink`), **Muted Ink** (`muted`, `muted-2`): primary content, explanations, metadata, and inactive labels.
- **Divider** (`line`) and **Strong Divider** (`line-strong`): structure tables, rails, tabs, and compact collections.

### Semantic

- **Blocked Red** (`danger`, `danger-soft`): a concrete production blocker and its bounded repair surface.
- **Pending Amber** (`warning`, `warning-soft`): saved-but-unverified or waiting state.
- **Verified Green** (`success`, `success-soft`): server-confirmed success and completed stages.

**The Narrow Semantics Rule.** A semantic color must be paired with an icon and a written state; color never carries the outcome alone.

## Typography

**Display Font:** Avenir Next with PingFang SC and Noto Sans CJK SC fallbacks\
**Body Font:** Avenir Next with PingFang SC and Noto Sans CJK SC fallbacks\
**Label/Mono Font:** SFMono-Regular with Consolas and Liberation Mono fallbacks for evidence values

**Character:** The sans-serif stack is calm, compact, and operational. Tight negative tracking gives large headings authority; monospace isolates values that must be compared or audited.

### Hierarchy

- **Display** (`clamp(25px, 3vw, 40px)`, `1.08`, `-.045em`): the page's current decision or task.
- **Headline** (`clamp(24px, 2.4vw, 34px)`, `1.1`, `-.045em`): screen purpose and release identity.
- **Title** (`25px`, `1`, `-.035em`): project identity; it becomes `21px` at the narrow breakpoint.
- **Body** (`14px`, `1.6`): explanatory copy and screen descriptions; dense task copy may use `1.72`.
- **Label** (`13px`, `680`): buttons and compact actions. Metadata and table headers step down to `10–12px` where the code does so explicitly.
- **Mono** (`-.02em`, tabular numerals): versions, durations, commits, manifests, ports, and run IDs only.

**The Evidence Mono Rule.** Use monospace for machine-verifiable identifiers and comparable numerals, never as a decorative developer aesthetic.

## Layout

Desktop uses a two-part shell: a persistent `256px` grouped global rail and a fluid application stage. The utility bar is `58px` high; project content is capped at `1500px` and uses fluid horizontal padding from `22px` to `48px`. The project identity and one page-level action precede a stable horizontal destination row.

The first viewport follows the contract: project identity, destination tabs, a compact blocker row, and one clearly titled current task. Supporting information uses explicit task-specific grids—such as overview `1.2fr / 0.8fr`, configuration `190px / fluid`, and release `1.5fr / 0.5fr`—rather than a decorative card grid. Collections become divided lists or horizontally scrollable tables.

At `1120px`, secondary grids collapse or rebalance. At `900px`, the global rail becomes a sticky top product bar and task facts move below the task copy. At `680px`, project identity and actions stack, tabs and steppers scroll, tables preserve readable minimum widths, and the drawer becomes full-width. At `420px`, remaining multi-column facts collapse again. The application never hides a blocker, its cause, or its primary action on mobile.

**The Attached Action Rule.** Place repair and evidence actions beside the state they change or explain; do not separate the warning from its destination.

## Elevation & Depth

The system is nearly flat by default. The page ground and resting surfaces share the same white; dividers and a small natural surface shadow establish object boundaries without alternating background colors. The stronger ambient shadow (`0 18px 52px rgba(24, 25, 29, .16), 0 2px 8px rgba(24, 25, 29, .07)`) is reserved for the evidence drawer and toast. Primary actions use a smaller cobalt lift (`0 4px 10px rgba(79, 94, 232, .18)`).

**The White-Ground Hierarchy Rule.** Keep page ground and resting surfaces white; use dividers and the small shared surface shadow for hierarchy. Reserve the stronger ambient shadow for floating objects, and a restrained cobalt lift for the primary action.

## Shapes

Controls are gently squared: primary controls use an `8px` radius and form fields use `7px`. Standard surfaces use `12px`; the dominant current-task surface reaches `14px`, while drawer details and proposal boxes sit at `10px`. The confirmed Devpilot cube mark stays square and the project page title remains text-only; avatars are circular, and `99px` rounding is limited to scrollbar thumbs and progress tracks.

**The Bounded Radius Rule.** Keep operational containers between `10px` and `14px`, controls between `7px` and `8px`, and reserve full circles or pills for avatars and continuous progress geometry.

## Components

### Buttons

- **Primary:** cobalt fill, white label, `38px` minimum height, `0 15px` padding, `8px` radius, and a small cobalt shadow. Hover shifts to deep cobalt and lifts `1px`.
- **Secondary:** white fill with a strong divider border and no shadow. Hover moves to the soft surface and strengthens the border.
- **Focus:** the global visible-focus treatment is a `3px` translucent cobalt outline with `2px` offset.

### Navigation

- **Global rail:** grouped `36px` rows on white, muted at rest and cobalt on the quiet selected surface.
- **Project tabs:** `44px` rows with no fill; active state uses deep-cobalt text, heavier weight, and a `2px` cobalt underline.
- **Configuration rail:** compact `39px` rows; active state uses cobalt wash rather than a second underline.

### Inputs / Fields

Form fields are `38px` high with `7px` corners, a strong-divider border, white fill, and `0 10px` padding. Focus changes the border to cobalt and adds a `3px` translucent cobalt ring. The global search is a quieter `34px` variant and collapses to an icon at `900px`.

### Status

Statuses are inline icon-and-label pairs, not decorative pills. Success, blocked, warning, and running variants use `12px` labels with `640` weight; running adds the only continuous spin animation, and reduced-motion preferences reduce it to an effectively static state.

### Release Stage Navigation

The release lifecycle is a two-level hierarchy. `预发`, `生产`, `验证`, and `完成` form one connected four-step arrow rail using cobalt primary states. Selecting a major stage reveals only that stage's ordered child steps below it: preflight and build belong to staging, production check and production deployment belong to production, post-deployment checks belong to verification, and the final confirmation belongs to completion. Do not flatten child work into the major rail.

### Cards / Containers

Standard surfaces use the same white fill as the page, `12px` corners, internal dividers, and one shared small natural shadow. Semantic repair surfaces may use restrained red, amber, or green state treatment only when the color communicates a real operational state rather than section hierarchy.

### Tables / Divided Lists

Tables use `40px` headers, `58px` data rows, `11px` muted headers, and one-pixel row dividers. Hover and selection use an extremely light cobalt surface; mobile preserves the table's minimum width and scrolls the container. Small collections remain divided lists rather than becoming independent cards.

### Evidence Drawer

The evidence drawer is a right-edge modal surface up to `440px` wide with the ambient shadow, a dimmed graphite backdrop, and a `320ms` decelerating entrance. It receives initial focus, traps keyboard focus, closes on Escape or backdrop interaction, and restores focus to its opener. AI explanation, proposal, provenance, and the human-confirmed next action remain visibly distinct.

### Operation Layers

Business operations stay in context through accessible drawers or confirmation dialogs. Drawers hold forms, filters, and evidence-rich inspection; compact dialogs confirm bounded mutations such as rerunning a server-owned check or starting production deployment. Page navigation is reserved for destinations and durable objects such as the standalone release detail.

## Do's and Don'ts

### Do:

- **Do** lead with one current delivery decision and keep its action beside the cause.
- **Do** use tables, divided lists, narrow rails, and inspection panes for dense operational evidence.
- **Do** pair every semantic color with an icon and explicit state label.
- **Do** reserve monospace for versions, durations, commits, manifests, ports, and run IDs.
- **Do** keep mobile status, cause, evidence access, and primary action equivalent to desktop.
- **Do** treat finish review, verdict, canonical documentation, and raster provenance as part of shipping.

### Don't:

- **Don't** turn the product into a KPI-card dashboard or a chat-first navigation surface.
- **Don't** imply that an AI explanation or proposal changed production state.
- **Don't** replace collections with a wall of standalone cards.
- **Don't** use semantic color without a written state and icon.
- **Don't** add photographic or decorative product imagery where the operational UI has no verified asset need.
- **Don't** introduce additional shadows, radii, colors, or breakpoints without first finding an implemented source.
