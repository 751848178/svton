---
name: devpilot-product-design-lessons
description: Apply evidence-backed product and UX lessons from the Devpilot project/release redesign when simplifying information-dense operational pages. Use for Devpilot project, release, environment, configuration, Site, repository-analysis, and deployment experiences. It prevents backend terminology, duplicated summaries, vague actions, oversized cards, and policy-only displays from replacing the user's actual task.
---

# Devpilot Product Design Lessons

Design from the user's operational decision, then map real domain evidence into
that decision. Do not mirror service/model boundaries directly into navigation.

Read [the problem-solution ledger](references/problem-solution-ledger.md) when
planning or reviewing a project/release/configuration module.

## Decision order

1. Confirm the real user task, domain state, write path, and blocker from source.
2. Separate overview, execution, configuration, and evidence responsibilities.
3. Choose the smallest surface that supports the decision.
4. Translate technical objects into business language, retaining exact evidence
   behind progressive disclosure.
5. Put policies and gates in the flow where they actually decide or block work.
6. Verify every link/action reaches a real supported destination and state.

## Durable lessons

- Large area does not create importance. Match visual weight to information and
  decision weight.
- Environment is a scope selector unless comparing environments is itself the
  user's task.
- A scope selector belongs beside the navigation or content it scopes. Short
  selectors must not consume a standalone full-width row with unused space.
- Current state, configuration, and execution history are different concepts;
  placing them on one page does not merge their domain semantics.
- A same-page requirement does not require equal visual weight: preserve the
  primary collection and progressively disclose secondary operational detail.
- A fact grid needs semantic row order before column math. Lead with the facts
  that explain the project and its release scope, then place creator and time
  metadata in a quieter second row; responsive spans must preserve that order.
- Backend identifiers are evidence, not primary product copy.
- A collection is a table/list by default. Use a card only for a standalone
  object that benefits from independent grouping.
- Actions name their object/outcome, live beside their cause, and follow one
  hierarchy. Generic `立即处理` is not an information architecture.
- Evidence inspection that explains one section belongs directly after that
  section as progressive disclosure. If the folded state would be only a short
  status line, let the object title toggle it and reveal the real summary inside;
  do not create a duplicate details action or a mostly empty row.
- Name a progressive section for the scope it actually contains. A disclosure
  that now contains only repository identity facts is `仓库详情`, not `高级信息`
  or the vaguer `更多信息`. Use a familiar chevron disclosure instead of an
  oversized clickable card row.
- Separate evidence work from identity maintenance: repository runs, stages,
  recovery, and suggestion review stay in a branch/commit analysis workbench;
  connection, credentials, and default-branch revision belong to project-level
  settings. A read-only latest summary may live on overview, but run history and
  detected-change review deserve an independent project secondary page.
- Collection controls lead from the reading-start edge; a related cross-page
  exit can anchor the opposite edge without reversing DOM or focus order.
- Adjacent regions need one spacing owner. Parent rhythm and child edge padding
  must not both create the same vertical interval.
- An overflow menu is for genuine overflow, not the default hiding place for all
  row operations.
- A policy that does not affect the visible execution path is documentation, not
  product behavior.
- Automatic recognition suggestions require review before they mutate current
  project facts. Audit evidence stays available without dominating the page.
- Separate runtime environments from code components when they have different
  tables and actions. Component-related recognition context may lead the
  component collection, but full run evidence and non-component suggestions
  remain in the repository-analysis workbench.
- When a tab rail already owns the content boundary, do not wrap its table in a
  second card. Keep structural row dividers and local scrolling, and reserve a
  framed table surface for an independent route or standalone object.
- A single inspection link for a short evidence summary belongs beside that
  summary's heading. Do not use full-width `justify-between` to manufacture a
  toolbar when the space between the fact and action has no content.
- Global control-plane modules and project-scoped workflows may share domain
  services while retaining different navigation and interaction surfaces.

## Review gate

Reject a design or implementation when any primary statement or control cannot
be connected to real source data, a real supported action, and a clear resulting
state.
