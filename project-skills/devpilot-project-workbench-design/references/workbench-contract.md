# Project Workbench Contract

## Visual language

- Use the repository's white background, primary blue, near-black headings,
  blue-gray secondary text, light dividers, and existing radius tokens.
- Prefer spacing, alignment, typography, and row separators before tinted
  surfaces, borders, or elevation. Semantic warning/error surfaces are the
  narrow exception and use token-based pale fill plus border.
- Keep body text at the existing readable product scale. Do not shrink text to
  compensate for an overloaded layout.
- Cards represent standalone objects only. Do not nest cards or turn table rows,
  environments, steps, or configuration types into cards.

## Project shell

- Header: a deterministic parent back action, project name, repository URL,
  default branch, optional production entry, and one primary `创建发布` action.
  The overview returns to `/projects` and may expose `项目配置` as a secondary
  action; child routes return to the project overview from the left title
  action and must not repeat `项目概览` on the right.
- Do not render a persistent `概览 / 配置` route tab rail. Configuration remains
  an independent route reached from the Header action.
- Blocking or warning state sits below project identity metadata as a compact,
  pale semantic warning surface:
  `对象 + 问题 + 影响。具体动作 →`.
- The Header owns its top inset but not a second bottom inset. The route sibling
  gap is the single owner of space between the Header/issue and the first
  content section.
- Do not display staging and production as two large summary cards. Their
  purpose is release-stage scope and environment selection, not homepage
  comparison.

## Project information

- The overview merges compact project facts with the release-order list; do not
  repeat a page title that restates the active `概览` tab.
- Give real basic facts their own borderless compact scan band before content:
  project description, creator, created/updated time, current release policy,
  and one environment/component overview derived from real collection counts.
  Do not repeat repository/branch/commit already shown in the project identity
  header. Release policy is read-only. Do not add internal top/bottom lines.
- The desktop scan band uses two semantic three-column rows: description /
  release policy / environment and components, then creator / created time /
  updated time. At two columns, description and creator span the row while the
  paired policy/environment and created/updated facts remain adjacent. Do not
  use arbitrary four-column spans that split related facts into left/right
  islands.
- Below the facts, use one keyboard-reachable, URL-backed `发布记录 / 环境 / 组件`
  tab rail. Release records are the default mode; environment and component
  collections have separate panels. The tab rail supplies the only divider, and
  panel content must not repeat the selected tab as a title. Tables inside these
  panels are embedded directly: no outer rounded border, shadow, or card frame;
  preserve the toolbar, table header, row separators, states, and local overflow.
- Show project components as a compact list/table with component name, path,
  type/runtime, ports/status where real data exists, and the latest reviewed
  branch/commit delta.
- When an analysis run detects component or configuration changes, mark the
  affected component and expose a readable diff. Keep raw JSON and parser
  evidence secondary.
- Place one default-collapsed `仓库详情` section immediately after the basic facts
  and before the content tabs. Use the same borderless section-title level as
  `基本信息`; the title and chevron directly toggle the disclosure. The folded
  state contains no separate latest-run row or duplicate details button.
- Expanded repository details use real connection/canonical-identity fields:
  URL, provider and visibility, default branch, current commit, and last
  verification time. It contains neither analysis summaries nor write actions.
- The component tab starts with one flat latest-component-recognition summary.
  Bind status, branch/commit and time to the latest real analysis run; derive
  component and pending counts only from its `application_service` suggestion
  details. When those details are unavailable, say so instead of projecting the
  run's total suggestion count. Keep only the precise full `仓库分析` link here,
  immediately after the recognition heading; do not detach it to the opposite
  side of the full-width panel.
- Put run history, the selected run, stages/logs/evidence, recovery, and suggestion
  review on the independent repository-analysis page. Preserve `analysis=true`
  for the overview disclosure and migrate focused `analysisRunId` deep links to
  that page. Do not use Card-inside-Card stacks or infer analysis success/results.

## Release

- Release orders use a conventional table with 56–72px rows.
- Version and release-order ID are links to detail.
- Recommended columns: release/version name, status, source, current stage,
  recent update, and operations. Add only columns backed by real data.
- The `basic_v1` detail flow exposes exactly two major stages: `预发 → 生产（线上）`.
  Staging exposes only `构建 → 部署`; Production exposes only `生产部署` and
  must reuse the immutable Manifest proven by staging. Preflight, approval,
  concurrency, protection, artifact-integrity, and route verification remain
  enforced by the server and may explain a blocked action, but they are not
  separate MVP steps or evidence walls. The dormant governed profile may
  progressively expose those outcomes again without changing the release data
  model.
- Failures state reason, impact, and one precise repair action.
- In the release collection toolbar, search and status filters align to the
  reading-start edge; the deployment-history route exit aligns to the opposite
  edge. On narrow screens they may stack, but controls precede the route exit
  in DOM, focus, and visual order.

## Project configuration

- Desktop uses a left configuration rail and a main content surface. A narrow
  inspection pane may show the selected row's details without duplicating its
  actions.
- The environment selector contains existing environments only and changes the
  scope for every configuration type.
- `仓库设置` is a separate project-level deep-linked configuration section for
  repository connection, read-only credentials, and default-branch revision.
  It does not render an environment selector. Plain `/settings` still opens
  environment configuration; the overview analysis panel links precisely to
  `section=repository`, which offers a route back to environment configuration.
- Put that selector at the top of the desktop rail. At narrow widths, show the
  environment and configuration-type selectors together in one two-part scope
  toolbar; do not reserve an otherwise empty full-width row for either short
  selector.
- The active `basic_v1` profile exposes only `部署目标`, `资源绑定`, and
  `变量与密钥`, defaulting to the Staging deployment target. The other types
  below remain the governed expansion contract and are not deleted.
- Configuration types:
  - `版本`: current version, existing versions, reviewed changes, switch action,
    and collapsed technical evidence.
  - `部署目标`: the basic table shows server, deployment directory/target
    reference, combined readiness, and edit; provider details remain in the
    create/edit dialog.
  - `资源绑定`: component/resource requirement, bound instance, environment,
    readiness, and operations.
  - `变量与密钥`: variable name, scope/source, secret reference metadata, state,
    and operations; never expose secret values.
  - `访问权限`: who can modify, deploy, or approve the selected environment.
  - `验证与监控`: health checks, post-deploy verification, observability, and
    evidence destinations.
  - `域名与入口`: project/environment scoped component, path, port, domain,
    TLS, DNS, probe evidence, and the existing progressive write flow.
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

- The project configuration rail owns direct configuration for the selected
  project's environments and components.
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
