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
| Project-level release orchestration                               | `2026-07-27-release-orchestration.md`         | **F383 done（2026-07-29）**。最终可复现证据是计划 `cms5m7z2001ow14kkg3jg0l87` 与 Picshare `master@8e7c465d56e68dafcef0dfbc480fe721044b0fb3`：真实 password SSH 六阶段 succeeded、2 条 DeploymentRun completed。第二批补齐 ServerExecutionJob/DeploymentRun 精确深链接（真实与伪造 ID 浏览器闭环）及计划级可审计零泄漏验证 API；真实容器秘密探针结果为 4 probes / 8 records / 44 fields / 0 findings，审计 `cms5o57vz000akza17koems85`。旧计划 `cms5kc2rp009z14kkn2ch9lqb` 不作为最终可复现证据。 |
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
