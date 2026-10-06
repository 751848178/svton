# Devpilot prototype field contract

The 2026-09-20 planned delivery scenarios extend this contract in
[`PIPEWRIGHT_PLAN.md`](./PIPEWRIGHT_PLAN.md). Their action/target aggregates are
explicit prototype proposals; they must not be mistaken for existing API fields.

This prototype uses deterministic fixtures, but their shapes and every visible
field follow the current Devpilot frontend contracts. `src/data.js` represents
API-shaped data; `src/view-models.js` owns the stable transformations below.
Replacing the fixture imports with real requests must not require a second UI
information model.

## Conversion rules

1. **Direct** — display an API/model field without changing its meaning.
2. **Derived** — combine existing fields with one deterministic rule documented
   here. Derived labels never create a new persisted state.
3. **Optional** — show `—` or an empty state when the source field is absent.
4. **Removed** — do not display facts without a stable source.

## 2026-09-20 当前布局对齐

以真实 ProjectsContent、ProjectDirectoryPanel、ProjectWorkbenchHeader、ProjectOverviewContent 为布局依据。
目录显示项目状态、组件数、生产运行版本、最近发布及可选环境列；项目状态与最近发布状态独立。
项目首页基本信息优先，仓库详情默认折叠，发布记录/环境/组件为同页 Tab。
配置为页头次级入口；部署记录从发布上下文进入。Hash 路由仅用于本地原型。
Fixture 缺少描述、创建人、创建/更新时间时显示 `—`，不杜撰数据。
下表发布策略和生产审批保留领域映射，但当前首页不展示；commit 仅在仓库详情展示。

## Project header and information

| Prototype field            | Real source                                                                                                   | Rule                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Project name               | `Project.name`                                                                                                | Direct                                                   |
| Repository                 | `Project.gitRepo`                                                                                             | Direct; optional                                         |
| Default branch             | `RepositoryAnalysisState.canonicalIdentity.effectiveRevision.defaultBranch`, then selected/application branch | Deterministic fallback                                   |
| Latest commit              | `RepositoryAnalysisRun.commitSha`                                                                             | Latest selected analysis run; short form is display-only |
| Current release policy     | `ReleasePolicyResponse.current.strategy`                                                                      | Strategy enum translated to product copy                 |
| Production approval        | `ReleasePolicyResponse.current.requireProductionApproval`                                                     | `true` → `生产部署需要审批`                              |
| Latest repository analysis | `RepositoryAnalysisRun.branch / commitSha / createdAt`                                                        | Direct fields grouped on one line                        |
| Create release             | `POST /projects/:id/delivery/releases`                                                                        | Real write path; one page-level primary action           |

There is no project-wide “current version”. Current versions belong to a
specific environment. The directory labels its version as production; the environment tab shows each environment separately.

## Environment versions

| Prototype field   | Real source                                                                          | Rule                                                                     |
| ----------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Environment       | `EnvironmentVersionEnvironment.name / baselineRole`                                  | Direct                                                                   |
| Current version   | `currentEnvironmentVersionId` → `EnvironmentVersionItem.releaseOrder.releaseVersion` | Foreign-key resolution                                                   |
| Version name      | `EnvironmentVersionItem.releaseOrder.releaseName`                                    | Direct; fall back to version                                             |
| Source            | Candidate `buildRun.sourceBranch / sourceCommitSha`                                  | Join by `artifactManifestId`                                             |
| Latest deployment | `EnvironmentVersionItem.effectiveAt`                                                 | This is the version-effective time, not an invented project timestamp    |
| Current state     | Current pointer + `deploymentRun.status`                                             | Successful current item → `当前运行`; otherwise translate the run status |
| Switch version    | `POST /delivery/environment-versions/:environmentId/actions`                         | Existing candidate only; creates an audited deployment operation         |

## Project components and repository analysis

| Prototype field       | Real source                                                | Rule                                                        |
| --------------------- | ---------------------------------------------------------- | ----------------------------------------------------------- |
| Component             | `ApplicationService.name`                                  | Direct                                                      |
| Path                  | `ApplicationService.deployConfig.workingDirectory`         | Optional; `—` when missing                                  |
| Runtime               | `ApplicationService.runtime`, then `kind`                  | Deterministic fallback                                      |
| Ports                 | `ApplicationService.ports`                                 | Normalize array to comma-separated text; optional           |
| Service state         | `ApplicationService.status`                                | Translate status; do not reuse repository-review state      |
| Last applied analysis | `ApplicationService.metadata.repositoryAnalysis.commitSha` | Evidence label only                                         |
| Pending change        | `RepositoryAnalysisSuggestion.impact`                      | Shown only in repository analysis while status is `pending` |
| Change facts          | `proposedValue/reviewedValue`                              | Pending uses proposed value; reviewed uses reviewed value   |

Project information never marks a running service as “pending review”. Current
service state and a proposed repository change remain separate facts.

## Releases and deployments

| Prototype field                  | Real source                                           | Rule                                                  |
| -------------------------------- | ----------------------------------------------------- | ----------------------------------------------------- |
| Release name/version             | `ReleaseOrderListItem.releaseName / releaseVersion`   | Direct                                                |
| Release source                   | `source.branch / commitSha`                           | Grouped display                                       |
| Current stage                    | `lifecycle.phase`                                     | Translate `preflight/build/staging/production`        |
| Release status                   | `lifecycle.status / failureKind`                      | Blocked is failure evidence, not a visual-only status |
| Recent update                    | `lastExecutedAt`                                      | Direct timestamp formatting                           |
| Deployment ID/environment/status | `DeploymentRun.id / projectEnvironment.name / status` | Direct; legacy `environment` is fallback              |
| Deployment version               | `artifactManifest.releaseOrderId` → release order     | Stable relation join                                  |
| Duration                         | `startedAt / finishedAt`                              | Difference; unfinished run displays `进行中`          |
| Actor                            | `DeploymentRun.actor.name`, then email, then system   | Deterministic fallback                                |

Release major stages and child steps are presentation of real build, staging,
production, approval and verification evidence. They do not introduce a second
persisted lifecycle.

## Navigation and surfaces

- Global navigation mirrors `apps/devpilot-web/src/components/layout/navigation-items.ts`.
- Project destinations remain `项目信息 / 发布 / 项目配置 / 域名与入口 / 部署记录`.
- Global pages outside this clickable slice retain their real names and appear
  as unavailable in the prototype; no fake destination is created.
- Page ground and resting surfaces are white. Dividers and the shared small
  surface shadow create hierarchy; semantic colors are reserved for actual
  status, warnings and selected/interactive states.
