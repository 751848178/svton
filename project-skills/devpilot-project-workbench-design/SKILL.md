---
name: devpilot-project-workbench-design
description: Design, implement, or review Devpilot project-detail surfaces covering project information, release execution, environment-scoped project configuration, domains/entries, and deployments. Use for this project workbench module and preserve the approved information hierarchy, table/action rules, existing-environment scope, and audited version switching. Skip unrelated global infrastructure or admin pages.
---

# Devpilot Project Workbench Design

Build the project workbench as a focused operational surface, not a dashboard
that advertises every backend object.

## Source of truth

- Inspect [the approved configuration screen](assets/approved-project-config.png)
  before visual or layout work.
- Read [the workbench contract](references/workbench-contract.md) before editing
  navigation, layout, versions, tables, environment configuration, or project
  domains/entries.
- Reuse the live Devpilot tokens and UI primitives. The image fixes hierarchy
  and composition; repository source remains authoritative for behavior and
  supported states.

## Product structure

Use one project overview workspace with contextual route entries:

1. The default project route shows compact facts, a default-collapsed read-only
   `仓库详情` disclosure, then switches between `发布记录 / 环境 / 组件` as
   same-page content modes.
2. `项目配置` is a secondary Header action into the existing-environment
   configuration route, not a persistent peer navigation tab.

Do not restore an independent environment-version page or make technical
delivery objects primary navigation. Deployment history keeps its independent
deep-linkable route and is entered from release/runtime context rather than a
primary project tab.

## Non-negotiable interaction rules

- One page-level primary action; issue repair actions stay contextual.
- A project issue uses a compact semantic warning surface with pale warning
  fill, border, icon, and a concrete inline action; never use a hero card or
  detached `立即处理` button.
- Put a deterministic, labelled back action immediately before the title. The
  project overview returns to `/projects`; every project child route returns to
  its project overview. Do not depend on browser history for this hierarchy or
  add a duplicate overview action on the opposite side of a child-page Header.
- Project configuration selects exactly one existing environment. Project
  intake owns environment creation; this surface has no create-environment UI.
- On the overview, use a borderless compact fact cluster and include a real
  environment/component count. Below it, use one accessible content tab rail
  for release records and environment/component details. Do not repeat a tab
  label as another panel title or add a divider between the fact cluster and
  the tab rail.
- Order desktop facts as two coherent three-column rows: project description,
  release policy, and environment/components first; creator and created/updated
  timestamps second. On narrow screens, description and creator span the row
  while the paired operational facts and timestamps stay in reading order.
- Put one borderless `仓库详情` section immediately below the basic-information
  facts and before the content tabs. Give it the same section-title treatment as
  `基本信息`; the title and chevron are the disclosure control, so the collapsed
  state does not spend another row on a short summary or a duplicate expand
  button. Expanded content shows only real read-only repository identity facts.
  It has no repository-analysis or repository-settings action.
- Split runtime environments and project components into separate content tabs.
  The component tab may show one compact latest-recognition summary from the
  latest real repository-analysis run, filtered to `application_service`
  suggestions, followed by the component table and a precise link to the full
  repository-analysis workbench. Keep that link adjacent to the recognition
  heading instead of pushing it to the far edge of the tab panel. Never infer
  component counts from the total suggestion count.
- Treat the overview tab panel as the table's containing surface. Release,
  environment, and component tables inside it have no second rounded border or
  shadow; keep row separators and table-local overflow. Independent route-level
  tables may continue to use the shared card surface.
- Put repository run history, stages/log evidence, recovery, and suggestion
  review on the independent project-level `仓库分析` secondary page. These are
  branch/commit run operations and review work, not overview facts and not
  repository identity settings.
- Keep project-level repository connection, credential reconnect, and default
  branch revision in `项目配置 / 仓库设置`. Do not mix those identity-maintenance
  writes into the overview evidence panel or scope them to an environment.
- In collection toolbars, put search and filters on the reading-start side and
  a related cross-route exit on the reading-end side. Preserve that DOM order
  when the controls stack on narrow screens.
- Give Header-to-content spacing one owner. The shared Header may own its top
  inset, while the route's sibling gap owns the space below it; do not stack a
  Header bottom inset with the content gap.
- Place the environment selector at the top of the desktop configuration rail.
  On narrow screens, pair it with the configuration-type selector in one scope
  toolbar. Never give a short scope selector a standalone full-width row.
- The configuration rail owns `版本 / 部署目标 / 资源绑定 / 变量与密钥 /
访问权限 / 验证与监控 / 域名与入口`.
- Collections are normal tables or lists, not repeated large cards.
- Tables have a dedicated operation column. Show up to three actions directly;
  if more exist, show the first three plus an accessible ellipsis menu.
- Technical identifiers, Manifest, digest, Run IDs, and raw evidence stay in a
  details disclosure or inspection pane unless required for a decision.
- Versions use a required name plus an `x.y.z` number. Switching selects only an
  existing version and still enters the audited release/deployment path.
- Release policy is read-only in the current frontend, while release ordering,
  artifact integrity, protection, concurrency, approval, and gates must affect
  and explain the real release flow.

## Domain boundaries

- `EnvironmentVersion` is deployment state and audit evidence even when its UI
  entry sits in project configuration. Never turn version switching into a
  direct pointer update.
- Project-scoped `域名与入口` reuses Site APIs and models for onboarded project
  services. The global Site module remains the management surface for external
  services not onboarded as Devpilot projects.
- Repository analysis is an explicit run bound to a branch/commit, not an
  automatic audit of every commit. Reviewed deltas enrich project components;
  unreviewed suggestions do not silently mutate project configuration.
- Repository identity maintenance is project-scoped configuration; analysis
  runs and suggestion decisions remain run-scoped evidence work on the dedicated
  repository-analysis workbench.

## Completion gate

Before handoff, compare the rendered route with the approved image at the same
viewport and interaction state. Verify environment switching, config
navigation, row/detail selection, direct and overflow actions, contextual repair
links, keyboard focus, and responsive fallback.
