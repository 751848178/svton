# Devpilot Project Workbench Redesign

## Goal

Rebuild the project detail module around the approved project-configuration
design so project information, release execution, environment-scoped
configuration, domains/entries, deployments, and repository-derived component
changes are understandable without exposing internal delivery objects as the
primary product language.

## Confirmed Product Decisions

- The approved visual target is
  `exec-87319ad5-db85-41af-8dcc-41dbb7c072bb.png`.
- Project pages use the top-level tabs `项目信息 / 发布 / 项目配置 / 域名与入口 / 部署记录`.
- Project configuration switches only between environments created during
  project intake. It never creates custom environments.
- One selected environment owns version, deployment target, resource binding,
  variables/secrets, access, and verification configuration.
- Environment versions have a name and an `x.y.z` version; switching can select
  only an existing version and still executes through the audited release path.
- Release orders are a normal compact table. IDs/versions open detail; actions
  have a dedicated column; up to three actions are visible and overflow uses an
  accessible ellipsis menu.
- Release policy is read-only in this frontend iteration; backend revision
  capability remains available for future policy editing.
- Policy gates must affect and explain release execution, not exist only as a
  separate descriptive card.
- Repository analysis is tied to an explicit branch/commit. Reviewed component
  and configuration deltas appear with the project component list; raw evidence
  stays secondary.
- Project-scoped domain/entry management reuses the Site domain, while the
  global Site module continues to manage external services not onboarded as
  Devpilot projects.

## Untouched Scope

- Do not reset or overwrite the existing untracked `projects/[id]/200---` file.
- Do not add post-intake environment creation.
- Do not remove backend release-policy revision support.
- Do not bypass approval, target readiness, artifact integrity, or production
  protection when switching versions.
- Do not redesign unrelated infrastructure/admin modules.

## Routing

`routing: todo-plan + CodeGraph navigation + Product Design image-to-code + isolated verification; one active writer in the current master checkout.`

## Atomic Work Items

| ID    | Status | Expected result                                                                                                                                                                                                       | Verification                                                                                                                                                                                           |
| ----- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PW001 | done   | Add and validate the project workbench design skill and the product-design lessons skill, including the approved visual reference and repository routing.                                                             | Both project skills pass `quick_validate.py`; `AGENTS.md` routes future project-workbench changes through them.                                                                                        |
| PW002 | done   | Record the current Web/API route, state, policy, persistence, and affected-test graph for project delivery, environment versions, Site, and repository analysis.                                                      | Fresh CodeGraph index plus bounded source reads confirmed the route host, release list/detail, configuration-revision, environment-version, Site filter, and repository-analysis contracts.            |
| PW003 | done   | Replace the mixed project-delivery home with the agreed top-level project navigation, compact contextual issue row, and one page-level primary action.                                                                | Focused component tests and the desktop browser route passed.                                                                                                                                          |
| PW004 | done   | Render release orders as a compact table with clickable version/ID and a dedicated accessible action column.                                                                                                          | Direct actions plus the portal-backed overflow menu passed component and browser interaction checks.                                                                                                   |
| PW005 | done   | Build the environment-scoped project configuration workbench with existing-environment switching and left configuration navigation.                                                                                   | The route exposes only existing environments and configuration types; no environment-create UI remains.                                                                                                |
| PW006 | done   | Integrate existing-version switching, deployment targets, resources, variables/secrets, access, and verification into project configuration without weakening audited execution.                                      | Existing environment-version execution, readiness, approval, and release-run contracts remain the write path.                                                                                          |
| PW007 | done   | Add version name plus validated `x.y.z` semantics to relevant contracts and persistence while preserving historical data compatibility.                                                                               | Nullable migration, strict public DTO validation, compatible internal fallback, API tests, and Prisma validation passed.                                                                               |
| PW008 | done   | Build `项目信息` with repository/default branch/read-only release policy and a component list carrying reviewed branch/commit/config deltas.                                                                          | Project information uses actual project/application and applied repository-analysis facts.                                                                                                             |
| PW009 | done   | Make release order detail visibly execute and explain ordering, artifact integrity, production protection, concurrency, approvals, and gates.                                                                         | Existing gate and release-run surfaces remain connected to the compact release table/detail path.                                                                                                      |
| PW010 | done   | Add project-scoped `域名与入口` management backed by Site APIs without coupling it to global external-service navigation.                                                                                             | The project route filters real Site APIs by project/environment; the global Site route remains unchanged.                                                                                              |
| PW011 | done   | Run file-ceiling, focused tests, type-check, builds, browser workflow, accessibility interaction, and visual comparison gates.                                                                                        | The 1487x1058 and 390x844 browser reruns completed on 2026-08-21; the rerun found the correction backlog recorded in PW014-PW025 rather than leaving verification blocked.                             |
| PW012 | done   | Synchronize this ledger and the TODO index with final scope and evidence.                                                                                                                                             | This ledger, `design-qa.md`, architecture diagrams, and the TODO index record the implemented scope and verified runtime evidence.                                                                     |
| PW013 | done   | Correct the deployment-target, project-domain environment, and deployment-record regressions found in container review.                                                                                               | Deployment targets have one real-field table and a complete bind dialog; empty legacy environment candidates are excluded by one shared selector; deployment actions use the focused deployment route. |
| PW014 | done   | Reconcile the second-round requirements with the currently rendered project pages and replace inaccurate closure claims with a source- and screenshot-backed correction ledger.                                       | Fresh browser evidence under `/tmp/codex-tool-runs/svton/project-workbench-correction-pass/`; requirement closure table below.                                                                         |
| PW015 | done   | Replace every vague project-workbench repair action with object + problem + impact + precise adjacent action copy.                                                                                                    | The release issue row identifies the component mismatch, release impact, and exact component-difference destination; browser and component checks passed.                                              |
| PW016 | done   | Make incomplete deployment-target rows explain the missing provider/path/connection facts, their release impact, and one precise repair action without inventing target data.                                         | Production target runtime showed missing deployment mode/path and offline state, plus `检查服务器` and `完善部署配置`; focused target tests passed.                                                    |
| PW017 | done   | Replace the reused global Add Site form in project `域名与入口` with a project-scoped entry flow that locks project/environment and progressively discloses advanced Site fields.                                     | The runtime modal fixes Picshare and the selected existing environment, has no unscoped option, and places target/TLS fields in an advanced disclosure; global `/sites` remains unchanged.             |
| PW018 | done   | Explain access/protection empty and configured states in terms of who may modify, deploy, or approve the selected environment.                                                                                        | Access configuration now explains member/role/action allow-deny policy, deny precedence, default team roles, and the separate production-approval boundary.                                            |
| PW019 | done   | Surface the current concurrency-control outcome in the real release execution flow alongside ordering, artifact, protection, approval, and gate outcomes.                                                             | Production preview reads active Production ReleaseRuns from the server, renders available/occupied facts, and confirmation still rechecks under the transactional lock.                                |
| PW020 | done   | Turn repository-analysis output into readable component/configuration deltas and keep raw suggestion JSON behind a secondary technical-evidence disclosure.                                                           | Component rows show branch/commit and readable configuration change facts; raw suggestion JSON is collapsed under `技术证据：查看原始建议`.                                                            |
| PW021 | done   | Complete version semantics across current and historical records: accurate creation help, required human name, canonical `x.y.z`, and explicit legacy labeling instead of presenting timestamp IDs as valid versions. | Creation explains required name and `x.y.z`; canonical and legacy rendering tests pass; timestamp records render as `历史发布 / 历史版本号`.                                                           |
| PW022 | done   | Remove the oversized deployment compatibility banner and contradictory `不占用项目一级导航` copy while preserving truthful legacy evidence behind disclosure.                                                         | Deployment records are a compact project-level tab; primary `查看记录` deep links retain `view=deployments&runId=...`; compatibility evidence is collapsed.                                            |
| PW023 | done   | Replace narrow-screen horizontal configuration rails and clipped project tabs with labeled responsive menus while keeping tables readable in local scroll containers.                                                 | At 390x844, project and configuration destinations use labeled selects and document scroll width equals client width (390px).                                                                          |
| PW024 | done   | Complete the release-row overflow interaction contract so keyboard focus enters the menu and Escape restores focus to the trigger.                                                                                    | The first three actions remain direct, overflow receives focus, Arrow/Tab behavior is covered by tests, and browser Escape restored focus to the ellipsis trigger.                                     |
| PW025 | done   | Run the full completion gate: source-file ceiling, focused/full tests, type-check, i18n, production builds, container rebuild/recreate, desktop/mobile browser flows, and approved-image comparison.                  | Web 569/569 and API 2345/2345 passed; type-check, i18n, builds, source ceiling, container recreate, desktop/mobile flows, and same-size image comparison are green.                                    |

## Acceptance Summary

- The project overview has one clear purpose and no oversized one-line cards.
- Environment is a selected configuration scope, never two competing cards.
- Lists use tables; technical evidence is progressively disclosed.
- All visible actions name their object/outcome and sit beside their cause.
- Configuration placement never bypasses release-domain safety semantics.
- Every touched maintained source file is at most 200 lines or an explicit
  pre-existing exception is not worsened.

## Verification Snapshot

- Web full suite: 143 files / 569 tests passed. API full suite: 419 files /
  2345 tests passed, with 50 suites / 215 tests intentionally skipped.
- API and Web TypeScript checks, zh/en parity for 3980 messages, API/Web
  production builds, `git diff --check`, and the maintained-source 200-line
  ceiling all passed.
- Fresh API and Web images were built and both containers were force-recreated.
  `devpilot-app-api` is healthy, `devpilot-app-web` is running, Web `/` and API
  `/api/health` both return 200.
- Desktop browser checks covered releases, creation semantics, target/access
  configuration, project-scoped domains, focused deployments, project
  information, production concurrency, and overflow focus restoration.
- The 1487x1058 project-configuration screenshot was compared side by side with
  the same-size approved design. Browser evidence is under
  `/tmp/codex-tool-runs/svton/project-workbench-correction-pass/after/`.
- At 390x844, project/configuration navigation is reachable through labeled
  selects and the document has no page-level horizontal overflow.

## Requirement Closure

| #   | Status | Resolution                                                                                                                                                              |
| --- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | done   | The oversized prompt is gone; the compact issue row states the concrete mismatch, blocked release impact, and adjacent repair destination.                              |
| 2   | done   | Staging and Production remain release stages and selectable configuration scopes; the duplicated homepage cards are removed.                                            |
| 3   | done   | Release orders use a compact table; version/ID open detail and operations have a dedicated column.                                                                      |
| 4   | done   | Version, target, resource, variable/secret, access, and verification management live in project configuration; Manifest is secondary evidence.                          |
| 5   | done   | One existing environment is selected through the project-configuration selector and scopes every configuration type.                                                    |
| 6   | done   | No post-intake or custom environment creation control is exposed.                                                                                                       |
| 7   | done   | Deployment targets render readable provider/path/connectivity facts, release impact, and precise server/configuration repair actions.                                   |
| 8   | done   | Resource binding and variable/secret management are environment-scoped configuration types; secret values remain hidden.                                                |
| 9   | done   | `域名与入口` is project-scoped, switches only existing project environments, and locks project/environment in add/edit flows; global Site still owns external services. |
| 10  | done   | `访问权限` explains who and which actions are governed, deny precedence, default team roles, and why production approval remains in release execution.                  |
| 11  | done   | Current release policy is read-only project information; backend policy revision support is preserved for later editing.                                                |
| 12  | done   | Ordering, artifact, production protection, approval, gates, and the server-backed production concurrency outcome are applied in release execution.                      |
| 13  | done   | The user-facing destination is `项目信息`, with repository, default branch, policy, and components.                                                                     |
| 14  | done   | Reviewed repository changes are attached to component rows with branch/commit and readable deltas; raw JSON remains optional technical evidence.                        |
| 15  | done   | The contextual-action skill is both installed and applied to the real release issue and deployment-target repair surfaces.                                              |
| 16  | done   | Creation uses required version name plus canonical `x.y.z`; switching selects only existing versions; historical timestamp records are explicitly labeled legacy.       |

## Correction Pass Change Log

- 2026-08-21: Fresh 1487x1058 and 390x844 browser audit reopened requirements
  1, 7, 9, 10, 12, 14, 15, and 16 and registered PW014-PW025. The audit also
  confirmed deployment-record copy/banner and overflow-keyboard gaps.
- 2026-08-21: PW015-PW025 were implemented and accepted against rebuilt
  containers. All 16 requested corrections are now closed by code, tests, and
  browser evidence.

## Current Contract Graph

- `projects/[id]/page.tsx -> ProjectRouteHost` owns project information,
  release, and deployment routes; settings currently enters the same host
  through `projects/[id]/settings/page.tsx`.
- `ProjectDeliveryRoute -> useProjectDeliverySummary + useReleaseOrders` owns
  the compact contextual issue, release creation, and release-order table. It
  no longer renders duplicated environment cards.
- `ReleaseOrdersPanel -> ReleaseOrderDetailPanel` is the canonical release
  detail path for release/build/evidence actions. Deployment actions instead
  use `view=deployments&runId=...`, which loads the deployment run from its own
  project-scoped API and focused deployment-record view.
- `EnvironmentSettingsArea -> EnvironmentSettingsDetail` selects one existing
  environment and owns versions, targets, resources, variables/secrets,
  access, verification, and configuration revisions. Version switching calls
  the existing audited environment-version actions.
- `EnvironmentVersionService` resolves real active staging/production
  environments, candidate manifests, target readiness, policy gates, approvals,
  and route activation. The redesign changes selection language and placement,
  not those execution boundaries.
- `GET /sites?projectId&environmentId` backs the project domain page. Add/edit
  flows lock the current project/environment while global `/sites` keeps its
  external-service scope.
- `ReleaseProductionConcurrencyReadService` reads active production ReleaseRuns
  for preview/refresh; confirmation retains the repository transaction lock and
  rechecks admission before creating a run.
- Repository analysis runs are explicit branch/commit snapshots. Applying
  reviewed suggestions updates project applications/services/resources; the
  project information page can therefore show applied components and identify
  the selected run without treating every commit as an automatic audit.
