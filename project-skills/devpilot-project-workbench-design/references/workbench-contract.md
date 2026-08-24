# Project Workbench Contract

## Visual language

- Use the repository's white background, primary blue, near-black headings,
  blue-gray secondary text, light dividers, and existing radius tokens.
- Prefer spacing, alignment, typography, and row separators before tinted
  surfaces, borders, or elevation.
- Keep body text at the existing readable product scale. Do not shrink text to
  compensate for an overloaded layout.
- Cards represent standalone objects only. Do not nest cards or turn table rows,
  environments, steps, or configuration types into cards.

## Project shell

- Header: project name, repository URL, default branch, optional production
  entry, and one primary `创建发布` action.
- Primary tabs: `项目信息 / 发布 / 项目配置 / 域名与入口 / 部署记录`.
- Blocking or warning state sits below the tabs as a compact row:
  `对象 + 问题 + 影响。具体动作 →`.
- Do not display staging and production as two large summary cards. Their
  purpose is release-stage scope and environment selection, not homepage
  comparison.

## Project information

- Label the area `项目信息`, not `项目识别`.
- Show repository address, default branch, and current release policy as plain
  fields. Release policy is read-only here and has an explanatory tooltip.
- Show project components as a compact list/table with component name, path,
  type/runtime, ports/status where real data exists, and the latest reviewed
  branch/commit delta.
- When an analysis run detects component or configuration changes, mark the
  affected component and expose a readable diff. Keep raw JSON and parser
  evidence secondary.

## Release

- Release orders use a conventional table with 56–72px rows.
- Version and release-order ID are links to detail.
- Recommended columns: release/version name, status, source, current stage,
  recent update, and operations. Add only columns backed by real data.
- The detail flow must execute and expose preflight, build, staging, production,
  approval, concurrency, protection, artifact-integrity, and route-verification
  outcomes in their actual stage.
- Failures state reason, impact, and one precise repair action.

## Project configuration

- Desktop uses a left configuration rail and a main content surface. A narrow
  inspection pane may show the selected row's details without duplicating its
  actions.
- The environment selector contains existing environments only and changes the
  scope for every configuration type.
- Configuration types:
  - `版本`: current version, existing versions, reviewed changes, switch action,
    and collapsed technical evidence.
  - `部署目标`: server, method/provider, deployment directory/target reference,
    connection state, credential readiness, and operations.
  - `资源绑定`: component/resource requirement, bound instance, environment,
    readiness, and operations.
  - `变量与密钥`: variable name, scope/source, secret reference metadata, state,
    and operations; never expose secret values.
  - `访问权限`: who can modify, deploy, or approve the selected environment.
  - `验证与监控`: health checks, post-deploy verification, observability, and
    evidence destinations.
- Archive, copy, sync, and identity maintenance belong to a secondary advanced
  area only when supported; do not mix them into protection rules.

## Version contract

- Display `name` and semantic version together, for example `图库重构 1.4.0`.
- Accept canonical `major.minor.patch` only. Do not substitute timestamps or
  internal IDs as the visible version.
- The version picker lists existing eligible versions only. It never creates a
  version or accepts free text.
- Switching shows source branch/commit and reviewed component/config deltas,
  then creates an audited release/deployment operation. Recovery creates a new
  run/version record; it does not erase history.

## Table and action contract

- Use a dedicated `操作` column with stable width.
- Zero actions: render `—` only if the row genuinely has no action.
- One to three actions: show all as concise text links or small secondary
  controls.
- More than three: show the first three by frequency/importance, then an
  ellipsis trigger for the rest.
- Ellipsis menus open on hover where appropriate and also on focus/click. The
  trigger has an accessible name; focus can enter the menu; Escape closes it;
  pointer travel between trigger and menu does not collapse it prematurely.
- Row selection may populate an inspection pane, but it cannot replace explicit
  row actions or duplicate them in the pane.

## Domains and entries

- Project-level navigation owns direct configuration for the selected project's
  environments and components.
- List domain/aliases, environment, target component/path/port, TLS, DNS/probe,
  state, and operations when those facts exist.
- Create/edit should begin with the minimum route contract, then disclose TLS,
  DNS, access, and advanced proxy rules progressively.
- Reuse Site domain services and audit behavior; do not create a second routing
  persistence model.

## Responsive and accessibility

- Desktop preserves the left rail and optional inspection pane.
- At narrower widths, collapse the rail into a labeled configuration menu and
  move inspection content into a drawer or inline detail; do not horizontally
  crush tables below readable widths.
- All state has a text/icon cue in addition to color.
- Tabs, environment selection, row actions, disclosures, and overflow menus are
  fully keyboard reachable with visible focus.
