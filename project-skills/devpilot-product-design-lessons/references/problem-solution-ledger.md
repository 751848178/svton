# Problem-Solution Ledger

## 1. Oversized next-action banner

**Problem:** a small readiness fact becomes the visual hero, while the actual
release or configuration work falls below the fold.

**Resolution:** use a compact contextual issue row containing affected object,
reason, impact, and a precise adjacent action. Preserve one page-level primary
action.

## 2. Side-by-side environment cards without a comparison decision

**Problem:** staging and production repeat the same blockers and consume the
page even though the user is not comparing them.

**Resolution:** keep environments as stages in release execution and as a
single selected scope in project configuration. Do not show large parallel
cards merely because two baseline environments exist.

## 3. Release orders rendered as oversized records

**Problem:** every order occupies excessive height; version/ID is not a link;
actions are hidden inside content.

**Resolution:** use a normal compact table, clickable version and ID, and a
dedicated operation column. Show up to three actions; overflow only after three.

## 4. Environment version exposes Manifest as the task

**Problem:** users must interpret Manifest IDs, digests, BuildRuns, and target
artifacts before understanding which product version is running.

**Resolution:** display version name, `x.y.z`, source branch/commit, status, and
reviewed changes. Keep Manifest/digest as technical evidence. Version switching
remains an audited deployment operation.

## 5. Fragmented configuration navigation

**Problem:** versions, targets, resources, variables/secrets, and protection are
scattered across delivery and settings pages.

**Resolution:** one project-configuration destination selects an existing
environment and manages each configuration type through a stable side rail.

## 6. Unsupported custom environment creation

**Problem:** a configuration page suggests it can add environments even though
the release baseline and lifecycle are established during project intake.

**Resolution:** project intake owns environment creation for this product
version. Project configuration switches existing environments only.

## 7. Deployment-target columns do not match their values

**Problem:** labels such as component, region, namespace, or scale display
server name, host, or `N/A`, so the table cannot answer where deployment runs.

**Resolution:** show server, provider/method, deployment directory or target
reference, connection state, credential readiness, and operations using actual
data.

## 8. Resource, variable, and secret ownership is unclear

**Problem:** these facts appear as unrelated capabilities instead of the
selected environment's deployable configuration.

**Resolution:** manage them as environment-scoped configuration types and save
or freeze their existing revision/reference contracts. Secret values remain
hidden.

## 9. Project domains duplicate or defer to a poor global Site UI

**Problem:** the project cannot configure its own entry coherently, while the
global Site screen also serves external services with a different task.

**Resolution:** add project-level `域名与入口` backed by the existing Site
domain. Keep global Site for external/non-onboarded services. Share APIs and
audit semantics, not navigation structure.

## 10. Protection rules mix unrelated concepts

**Problem:** access policy, observability, identity, archive, copy, sync, release
approval, and freeze controls are presented as one abstract protection area.

**Resolution:** separate access permissions, verification/monitoring, advanced
environment operations, and release-stage production protection.

## 11. Release policy editing is premature

**Problem:** the current experience emphasizes creating policy revisions before
the end-to-end flow makes those policies understandable.

**Resolution:** show current policy read-only in project information for now.
Retain backend revision capability so editing can be opened after the complete
workflow is mature.

## 12. Policy facts are displayed but not applied

**Problem:** ordering, artifact policy, production protection, concurrency,
approval, and gates live in a large card detached from release execution.

**Resolution:** evaluate, block, and explain each rule in the actual preflight,
build, staging, production, or verification stage.

## 13. Project identity is named as recognition

**Problem:** repository address, branch, release policy, and components are
framed as an internal parser capability.

**Resolution:** call the user-facing destination `项目信息`. Recognition history
is supporting evidence for how current component facts were derived.

## 14. Parse history is mistaken for automatic per-commit audit

**Problem:** users cannot tell whether every commit is continuously audited or
what an analysis run changed.

**Resolution:** state that each analysis run binds an explicit branch/commit.
After review, update component/config facts and mark their latest delta source.
Expose historical run/evidence details from those component changes.

## 15. Vague problem actions

**Problem:** generic buttons such as `立即处理` are detached from the issue and
compete with the page's primary action.

**Resolution:** use `对象 + 问题 + 影响。具体动作 →`; keep repair links adjacent
and reserve primary emphasis for the page's main task.

## 16. Version numbers are internal timestamps

**Problem:** a timestamp-like version cannot communicate compatibility, release
intent, or human meaning.

**Resolution:** require a version name and canonical `major.minor.patch`; lists
and selectors expose existing eligible versions only.

## 17. Same-page project information becomes three competing collections

**Problem:** basic facts, release orders, environment versions, and components
all remain visible at equal weight, so the release task is hard to find even
though every object technically fits on the overview.

**Resolution:** show real project basics as a compact scan band, keep release
orders as the primary collection, and place environment/component tables in a
default-collapsed disclosure on the same page.

## 18. A short environment selector consumes an entire row

**Problem:** the selected environment is right-aligned in a standalone row,
leaving most of the row empty and visually disconnecting scope from the
configuration navigation it controls.

**Resolution:** place environment scope above the desktop configuration rail;
on narrow screens, pair it with the configuration-type selector in one compact
toolbar.

## 19. Route tabs compete with project content modes

**Problem:** a persistent `概览 / 配置` rail consumes vertical space and makes a
low-frequency configuration route look equivalent to the daily release task,
while environment/component evidence still needs its own in-page hierarchy.

**Resolution:** keep the project overview as the default workspace, move
configuration to a secondary Header action, and use one accessible in-page
`发布记录 / 环境与组件详情` tab rail below borderless basic facts. Do not repeat the
selected tab label as a panel title.

## 20. A project warning looks like loose metadata

**Problem:** orange text without a containing surface is easy to miss and does
not visually bind the problem, impact, and repair action.

**Resolution:** use a compact token-based warning surface with pale fill,
border, icon, specific message, and adjacent repair link. Keep it below project
identity and never promote field or lifecycle warnings into this project scope.

## 21. Collection controls and route exits form one right-heavy cluster

**Problem:** search, status filtering, and a deployment-history link all sit on
the right, so the list starts without controls while unrelated control types
compete in one cluster.

**Resolution:** align search and filters to the reading-start edge and the
related cross-route exit to the opposite edge. When stacked, keep filters first
in DOM, keyboard, and visual order.

## 22. Header and content both own the same vertical gap

**Problem:** Header bottom padding and the page's sibling gap accumulate between
the project warning and basic information, creating an unintentional blank band.

**Resolution:** let the shared Header own only its top inset and let the route
sibling gap own the transition to content. Never repair this with a negative
margin or route-specific offset.

## 23. Section evidence is promoted into a detached action

**Problem:** `查看仓库分析` floats at the right edge of basic information and
looks like a peer of project configuration or a candidate navigation tab.

**Resolution:** keep it as a low-emphasis link-like action immediately after
`基本信息`. Repository analysis is bounded inspection for that section, not a
global route or persistent content mode.

## 24. A fact grid is balanced by column spans instead of meaning

**Problem:** a four-column basic-information grid gives description and
environment facts arbitrary double spans, leaving time metadata isolated on the
left and policy, environment, and creator facts scattered across the right.

**Resolution:** use a stable semantic order. On desktop, show description /
release policy / environment and components, then creator / created time /
updated time. On narrow screens, let description and creator span both columns
while preserving the same DOM and reading order. Do not add cards or dividers to
compensate for weak grouping.

## 25. Repository evidence and identity maintenance share one Modal

**Problem:** a link beside basic information opens a large Modal that combines
canonical identity facts, credential reconnect, default-branch revision,
analysis runs, stage evidence, retry/cancel, and suggestion review. Read-only
evidence and project configuration compete, while Card-inside-Card layers make
the run history harder to scan.

**Resolution:** put one default-collapsed repository-analysis panel directly
below basic facts. Its real-state summary expands into explicit run history,
flat stage/evidence sections, recovery, and suggestion review. Move repository
connection, read-only credential maintenance, and default-branch revision to a
project-level `项目配置 / 仓库设置` deep link without an environment selector.
Keep analysis runs bound to explicit branch/commit snapshots and preserve their
deep links; never describe them as continuous automatic scanning.

## 26. Progressive evidence still looks like a standalone card

**Problem:** even after nested cards are removed, a full rounded border and a
whole-row disclosure button make repository evidence visually heavier than the
borderless basic facts above it. Calling the section `更多信息` would further hide
what object and evidence users will find inside. The expanded view also repeats
repository URL, branch, and commit before showing the run evidence.

**Resolution:** use a peer `仓库与分析` section title, followed by one compact
real-state summary and an explicit `展开详情 / 收起详情` action. Expanded content
starts with run history, the selected run, stages/evidence, and detected changes.
Repository identity maintenance and repeated connection facts stay in
project-level repository settings; mobile uses a run selector instead of making
users scroll through the full history before the selected run.

## 27. A disclosure summary becomes a second navigation surface

**Problem:** the overview keeps a separate `展开详情` action and a latest-run line
even when folded, so a small amount of information consumes a full row. Expanding
then brings operational run history and detected-change review into the overview,
mixing project facts with branch/commit work.

**Resolution:** make the `仓库与分析` title and chevron the disclosure control and
show the latest real result only after expansion. Keep the expanded overview
read-only and provide exact destinations. Move analysis runs, stages/log evidence,
recovery, and detected-change review to an independent project-level `仓库分析`
page; keep connection, credentials, and default branch under repository settings.
This supersedes the overview-local run workbench placement in lessons 23 and 26.

## 28. A mixed advanced disclosure is named after only one child object

**Problem:** the disclosure is called `仓库与分析` but exposes only one analysis
status line, while useful read-only repository facts are hidden in settings. The
title promises two objects without presenting either coherently, and an overview
shortcut to repository settings mixes facts with identity maintenance.

**Resolution:** name the low-frequency disclosure `高级信息`. On expansion, show
explicit `仓库概览` and `最近仓库分析` subsections in a flat linear layout. The
repository overview uses real connection and canonical-identity facts. The latest
analysis keeps status/time together with real stage and detected-result counts and
offers only the dedicated analysis-workbench link. Connection, credentials, and
default-branch writes remain discoverable through project configuration, without
another shortcut from the overview. This supersedes the title and overview-link
parts of lesson 27 while preserving its run-workbench boundary.

## 29. Generic advanced facts hide object ownership and merge unlike collections

**Problem:** `高级信息` no longer predicts that its content is only repository
identity, while a shared `环境与组件详情` tab stacks runtime deployment state and
code-structure facts. The latest analysis summary is detached from the component
facts it explains, and project repair links open the disclosure instead of the
relevant content mode.

**Resolution:** rename the default-collapsed disclosure `仓库详情` and keep only
read-only repository identity facts inside it. Split the content rail into
`发布记录 / 环境 / 组件`, persist its state in the URL, and put one compact latest
component-recognition summary before the component table. Filter counts from real
`application_service` suggestion details and link to the dedicated analysis
workbench for complete runs, stages, evidence, recovery, and all suggestion kinds.
This supersedes lesson 28's mixed-disclosure composition while preserving its
settings and run-workbench boundaries.

## 30. A tab panel wraps its table in another card

**Problem:** the tab rail already establishes the current content region, but
each release, environment, or component table adds another rounded border and
shadow. The duplicate boundary reads as a card inside the project content and
makes a normal collection look heavier than its surrounding hierarchy.

**Resolution:** render overview-tab tables as embedded surfaces without outer
radius, border, or shadow. Preserve the toolbar, header, row separators,
empty/error/loading states, operation column, and table-local overflow. Keep the
framed table variant for independent route-level collections that need their own
surface boundary.

## 31. A short evidence summary is stretched into a full-width toolbar

**Problem:** the latest component-recognition facts sit at the reading-start
edge while their only inspection link is pushed to the far end with
`justify-between`. Wide screens turn the relationship into a large empty gap and
make the link look like an unrelated page action.

**Resolution:** place the low-emphasis full-analysis link immediately after the
recognition heading, then keep status, branch/commit, time, and result count in a
compact left-aligned evidence block below it. Allow the heading group to wrap at
narrow widths while preserving the link's touch target; do not add a card,
divider, or tinted background to compensate for proximity.

## 32. A mature release workbench overwhelms an MVP delivery loop

**Problem:** the governed release surface exposes every checkpoint, validation,
production transition, history, and evidence object before the team has first
proved the smallest repeatable delivery loop. Hiding labels alone is not enough
when evidence fetch failures can still block the page or dormant actions remain
reachable through a second wizard.

**Resolution:** activate an explicit, reversible basic profile. Ask only for a
canonical version, show the source branch and Staging target, and present one
two-step `构建 → 部署` rail with direct logs. Do not mount production, validation,
history, or evidence surfaces in this profile, while retaining their services,
models, and full governed policy for later reactivation. Apply the same rule to
configuration: expose targets, resources, and variables; keep authentication,
tenant isolation, immutable artifact identity, and runtime readiness as backend
truth even when their advanced editors are not visible.

## Final review questions

1. What single decision should the user make on this screen?
2. Which data and action prove that decision is real?
3. Is any technical object presented before its business meaning?
4. Is the same fact or action repeated in multiple visual containers?
5. Does every policy visibly affect the execution stage it governs?
6. Is every create/edit control supported by the current lifecycle contract?
7. Can a user scan lists and operations without opening each record?
8. Are raw evidence and identifiers available without dominating the surface?
