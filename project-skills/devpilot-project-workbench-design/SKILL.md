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

Use these project-level destinations:

1. `项目信息`
2. `发布`
3. `项目配置`
4. `域名与入口`
5. `部署记录`

Do not restore an independent environment-version page or make technical
delivery objects primary navigation.

## Non-negotiable interaction rules

- One page-level primary action; issue repair actions stay contextual.
- A one-line issue uses a compact row with a concrete inline action, never a
  hero card or detached `立即处理` button.
- Project configuration selects exactly one existing environment. Project
  intake owns environment creation; this surface has no create-environment UI.
- The configuration rail owns `版本 / 部署目标 / 资源绑定 / 变量与密钥 /
访问权限 / 验证与监控`.
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

## Completion gate

Before handoff, compare the rendered route with the approved image at the same
viewport and interaction state. Verify environment switching, config
navigation, row/detail selection, direct and overflow actions, contextual repair
links, keyboard focus, and responsive fallback.
