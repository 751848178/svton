# Devpilot TODO Index

> This index exists so long-running Devpilot work can start from a stable
> document handle instead of scanning every TODO file. Keep detailed status in
> the linked TODO documents.

## Active Devpilot TODOs

| Area                                                              | Document                                     | Notes                                                                                                                             |
| ----------------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Existing project onboarding and project/environment control plane | `2026-06-25-existing-project-onboarding.md`  | Primary active ledger for F53+ environment workspace, resource/site/deployment governance, and current frontend structure slices. |
| Guided project delivery experience                                | `2026-07-26-guided-project-delivery.md`       | F381 and F382 completed: guided delivery plus explicit migration, one-time initialization, fail-fast startup, and stage evidence; authenticated runtime modal regression remains a follow-up. |
| Project-level release orchestration                               | `2026-07-27-release-orchestration.md`         | F383 design + GLM handoff + four rounds of fixes. Third round (2026-07-28, P0-1/2/3): server-owned cross-service deps (deployConfig.releaseDependencies), planHash bound to dependency graph (canonical snapshot), cancel CAS ownership. Fourth round (2026-07-28, Item 1/2/3 + two CR rounds): release-dependency parsing now **fail-closed** (9 structured error codes; required→400, optional→warn; preview/create share one path); deterministic stale-read cancel/finalize CAS-race tests via Proxy-gated `$transaction`; controller refactored 274→183 LOC with all prod files ≤200. Real test count **287 pass** (one-shot MySQL :3399, serial); local staging fully up (3120/3121 + 13 infra containers, no Nest DI errors); real API fail-closed verified (negative preview → 400 RELEASE_PLAN_INVALID); real SSH/Server-Executor path wired (command-policy template match blocks actual exec — config, not code). Browser pixel-level flow **blocked** on IAB click-delivery instability (environment). Docker storage corruption **resolved**. |
| Infrastructure control plane                                      | `2026-06-24-infrastructure-control-plane.md` | Infrastructure/provider inventory, cloud sync, CDN, and real-staging verification backlog.                                        |
| Resource management closure                                       | `2026-06-24-resource-management-closure.md`  | Earlier resource-management closure notes.                                                                                        |
| CLI domestic install sources                                      | `2026-06-26-cli-domestic-install-sources.md` | CLI install-source hardening, separate from Devpilot control-plane slices.                                                        |

## Current Reading Rule

- For project/environment Devpilot work, start with this index, then read the
  active slice in `2026-06-25-existing-project-onboarding.md`, and finally read
  the relevant `docs-internal/devpilot/progress/P*.md` file.
- If a referenced progress file has not been restored yet, record that gap in
  the current slice before changing code.
