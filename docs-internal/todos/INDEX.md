# Internal TODO Index

> This index exists so long-running work can start from a stable document
> handle instead of scanning every TODO file. Keep detailed status in the
> linked TODO documents.

## Active AI Agent TODOs

| Area | Document | Notes |
| --- | --- | --- |
| Pi-backed AI Agent runtime migration | `2026-07-28-pi-agent-migration.md` | PI000-PI010 ledger for replacing the generic Provider, Agent loop, base event and tool scheduling layers with `pi-ai` and `pi-agent-core` while retaining svton product capabilities. |

## Active Devpilot TODOs

| Area                                                              | Document                                     | Notes                                                                                                                             |
| ----------------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Existing project onboarding and project/environment control plane | `2026-06-25-existing-project-onboarding.md`  | Primary active ledger for F53+ environment workspace, resource/site/deployment governance, and current frontend structure slices. |
| Guided project delivery experience                                | `2026-07-26-guided-project-delivery.md`       | F381 and F382 completed: guided delivery plus explicit migration, one-time initialization, fail-fast startup, and stage evidence; authenticated runtime modal regression remains a follow-up. |
| Project-level release orchestration                               | `2026-07-27-release-orchestration.md`         | F383 design and GLM handoff: separate migration/bootstrap/backfill/application stages coordinated by a persistent DAG with complete evidence. |
| Infrastructure control plane                                      | `2026-06-24-infrastructure-control-plane.md` | Infrastructure/provider inventory, cloud sync, CDN, and real-staging verification backlog.                                        |
| Resource management closure                                       | `2026-06-24-resource-management-closure.md`  | Earlier resource-management closure notes.                                                                                        |
| CLI domestic install sources                                      | `2026-06-26-cli-domestic-install-sources.md` | CLI install-source hardening, separate from Devpilot control-plane slices.                                                        |

## Current Reading Rule

- For AI Agent Pi migration work, start with
  `../design/pi-agent-migration-architecture.md`, then read
  `2026-07-28-pi-agent-migration.md` and the runtime board referenced there.
- For project/environment Devpilot work, start with this index, then read the
  active slice in `2026-06-25-existing-project-onboarding.md`, and finally read
  the relevant `docs-internal/devpilot/progress/P*.md` file.
- If a referenced progress file has not been restored yet, record that gap in
  the current slice before changing code.
