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

## Final review questions

1. What single decision should the user make on this screen?
2. Which data and action prove that decision is real?
3. Is any technical object presented before its business meaning?
4. Is the same fact or action repeated in multiple visual containers?
5. Does every policy visibly affect the execution stage it governs?
6. Is every create/edit control supported by the current lifecycle contract?
7. Can a user scan lists and operations without opening each record?
8. Are raw evidence and identifiers available without dominating the surface?
