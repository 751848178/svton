# Devpilot TODO Index

> This index exists so long-running Devpilot work can start from a stable
> document handle instead of scanning every TODO file. Keep detailed status in
> the linked TODO documents.

## Active Devpilot TODOs

| Area                                                              | Document                                     | Notes                                                                                                                             |
| ----------------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Existing project onboarding and project/environment control plane | `2026-06-25-existing-project-onboarding.md`  | Primary active ledger for F53+ environment workspace, resource/site/deployment governance, and current frontend structure slices. |
| Guided project delivery experience                                | `2026-07-26-guided-project-delivery.md`       | F381 and F382 completed: guided delivery plus explicit migration, one-time initialization, fail-fast startup, and stage evidence; authenticated runtime modal regression remains a follow-up. |
| Project-level release orchestration                               | `2026-07-27-release-orchestration.md`         | F383 design + GLM handoff + three rounds of fixes. Third round (2026-07-28, P0-1/2/3): server-owned cross-service deps (deployConfig.releaseDependencies), planHash bound to dependency graph (canonical snapshot), cancel CAS ownership (reverse race fixed); 268 unit+integration tests pass (integration no longer skipped); browser flow still in-progress. |
| Infrastructure control plane                                      | `2026-06-24-infrastructure-control-plane.md` | Infrastructure/provider inventory, cloud sync, CDN, and real-staging verification backlog.                                        |
| Resource management closure                                       | `2026-06-24-resource-management-closure.md`  | Earlier resource-management closure notes.                                                                                        |
| CLI domestic install sources                                      | `2026-06-26-cli-domestic-install-sources.md` | CLI install-source hardening, separate from Devpilot control-plane slices.                                                        |

## Current Reading Rule

- For project/environment Devpilot work, start with this index, then read the
  active slice in `2026-06-25-existing-project-onboarding.md`, and finally read
  the relevant `docs-internal/devpilot/progress/P*.md` file.
- If a referenced progress file has not been restored yet, record that gap in
  the current slice before changing code.
