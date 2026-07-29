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
| Project-level release orchestration                               | `2026-07-27-release-orchestration.md`         | F383 design + GLM handoff + five rounds of fixes. **Fifth round (2026-07-28, password live closure)**: removed the ssh-live adapter's key-only gate + unconditional privateKey mapping; key/password unified via `ssh-credential-mapping.utils` (fail-closed on unknown authType); real password SSH live path **run end-to-end** (new Picshare plan `cms4n68sw000bbdxirzcpgv1n`: schema_migration + bootstrap succeeded over real `ssh-live` + password auth, commandPolicy=passed). Also fixed: `create()` redacting configSnapshot → DB password frozen `[REDACTED]` → P1000; `Ssh2Transport.execCommand` stdout-not-drained backpressure timeout; connection test upgraded from TCP-only to network/auth/executor three-way; CLI inline-password redaction hardened. Standard Compose runtime restored (Redis ECONNREFUSED loop gone). Full API suite **1082 pass / 42 skip (integration-gated)**; web+API typecheck 0. **Still open (independent of password SSH)**: application_deploy uses deployment_run executor and hits a release_stage↔deployment approval-category mismatch — six-stage all-green + browser pixel-level capture pending that fix. F383.9.3/9.4/F383 not marked done. Earlier rounds: server-owned cross-service deps, planHash bound to dependency graph, fail-closed dependency parsing, deterministic CAS-race tests. |
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
