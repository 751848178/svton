# Devpilot V13 Project Delivery Control Plane

## Goal

将 Devpilot 收敛为以项目为中心、以发布单和环境版本为高频交付入口的真实发布管控产品，并从项目接入、不可变构建制品、同制品预发/生产门禁、环境恢复、51/15 门禁到浏览器 E2E 形成可审计闭环。

## Scope

- In scope: 项目目录、三步接入、项目 IA、发布单、BuildRun/Manifest、Staging/Production、环境版本、项目治理、51/15 门禁、兼容迁移、Docker/浏览器 E2E、文档与最终验收。
- Out of scope: push、PR、合并主线、外部生产部署、伪造 Provider 成功、删除或导入原主工作区未提交修改。
- Protected checkout: `/Users/zhaoxingbo/Workspace/ai-driven/svton` 始终只读；本任务只写 `/Users/zhaoxingbo/Workspace/ai-driven/svton-devpilot-project-delivery-v13`。

## Clarifications And Assumptions

- Confirmed: 基线为 `b6c3488743be13eacf4320f685da927488490113`。
- Confirmed: 依次集成 `17652567`（保留分析应用前的发布配置）和 `ef1a47cb`（发布命令 workingDirectory）。
- Confirmed: 不导入原主工作区 61 个 V13 重叠未提交文件；它们只作只读参考。
- Confirmed: V13 canonical spec 是产品语义事实源；旧 V10/V12 和 HTML 原型只作迁移与交互证据。
- Confirmed: 一个 checkout 同时只允许一个写入者；普通失败、修复和切片切换不等待用户确认。

## Workflow Routing

`routing: long-goal + codegraph-manual-fallback + single-writer + noisy-tools; F386-F410 逐切片登记、实现、测试、文档同步和原子提交，完整日志保存在 /tmp/codex-tool-runs/svton/long-goals/devpilot-project-delivery-v13/。`

## Functional TODO Breakdown

| ID   | Status  | Atomic TODO                                                                                             | Context Boundary                                           | Evidence                                                                                   |
| ---- | ------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| F386 | done    | 建立独立 worktree/分支、集成两个授权提交、登记 V13 事实源/迁移/任务板并运行基线验证。                   | Git、V13 文档、现有 API/Web 基线；不改产品行为。           | `7d9d580c` → `724abfef`；Prisma/build/type-check/35 tests 通过；主工作区 checkpoint 未变。 |
| F387 | done    | 增加项目生命周期、仓库规范身份、finalize、环境 baseline role/config revision 的增量 schema 与冲突报告。 | Prisma 与项目/环境迁移工具。                               | 空库/升级 fixture 迁移、Prisma/type-check、14 tests 通过；历史状态/歧义环境保持 NULL。     |
| F388 | done    | 实现 draft→analysis→review→幂等 finalize 后端事务与恢复。                                               | project-intake、repository-analysis、project-environment。 | 39 unit + 7 real-MySQL integration tests、API build/type-check 通过。                      |
| F389 | done    | 提供 ACL 过滤的项目目录服务端读模型。                                                                   | Project query/read-model 与 DTO。                          | 12 unit/regression + 2 real-MySQL tests；API type-check/build 通过。                         |
| F390 | done    | 实现 `/projects` 目录和三步 `/projects/create`，兼容 `/projects/import`。                               | Projects Web routes/components/hooks。                     | 11 个 API/Web 回归、双端 type-check/build、真实 MySQL 和浏览器接入闭环通过。               |
| F391 | done    | 建立 delivery/settings 路由宿主和旧 tab/query 深链适配。                                                | Project detail routes/navigation。                         | 12 个路由回归、Web type-check/build 和浏览器深链验收通过；focused ID 保留。                |
| F392 | done    | 增加 ReleaseOrder、BuildRun、ArtifactManifest、ReleaseRun、EnvironmentVersion 与 legacy nullable 关系。 | Prisma/release domain migration。                          | 新库/升级库真实迁移、legacy/unverified 报告、API 门禁通过。                                |
| F393 | in_progress | 实现发布单列表/创建读写模型；创建只含版本号与说明且不自动构建。                                         | ReleaseOrder API/Web。                                     | 唯一性、ACL、幂等、零 BuildRun 证据。                                                      |
| F394 | pending | 实现服务端主分支最新 Commit 构建与独立 BuildRun/Manifest/日志/测试安全证据。                            | Build domain 与 executor port。                            | 多构建、失败无 Manifest、精确 Commit、日志脱敏。                                           |
| F395 | pending | 实现四步详情、步骤恢复、可访问 tab 与独立日志抽屉。                                                     | Release detail Web。                                       | 深链、键盘/ARIA、刷新恢复、按钮位置浏览器证据。                                            |
| F396 | pending | 按精确 Manifest 重复部署 Staging，禁止隐式构建。                                                        | Deployment manifest command。                              | 两次 DeploymentRun、同 Manifest、BuildRun 数不变。                                         |
| F397 | pending | 实现 Production 同 Manifest 证明、快照冻结、审批和并发门禁。                                            | ReleaseRun/approval/deployment transaction。               | 漂移、跨项目、未知 Digest、并发和幂等负向测试。                                            |
| F398 | pending | 实现环境版本 current/history、受控升级和 recovery 回退。                                                | EnvironmentVersion API/Web。                               | 只选可追溯制品；新运行不覆盖历史。                                                         |
| F399 | pending | 将仓库、环境配置、资源、Webhook 和设置收敛到 Manage Project。                                           | Settings routes/compat adapters。                          | 普通/专业路径浏览器回归。                                                                  |
| F400 | pending | 实现环境 key 锁定、配置修订、共享资源/Secret 引用/域名路由/策略治理。                                   | Project environment governance。                           | 服务端权限、审计、无 Secret 明文、漂移测试。                                               |
| F401 | pending | 建立版本化 51 项目录、统一状态和默认不可用 capability registry。                                        | Release gates schema/service/Web。                         | 10/11/20/10 目录计数；未接 Provider 不通过。                                               |
| F402 | pending | 接通 M01-M05 Commit/Build 真实能力组。                                                                  | Commit/build provider adapters。                           | 正/负/新鲜度证据；缺失 Provider 不可用。                                                   |
| F403 | pending | 接通 M06-M09 Deploy 真实能力组。                                                                        | Config/Secret/resource/connectivity/migration adapters。   | 环境归属、脱敏、过期证据测试。                                                             |
| F404 | pending | 接通 M10-M15 Promote 真实能力组。                                                                       | Approval/DNS/TLS/HTTP/observability/recovery adapters。    | 业务验证只作证据；技术门禁真实。                                                           |
| F405 | pending | 完成标准发布策略；金丝雀/蓝绿/自动放量 fail closed。                                                    | Release policy/capability。                                | 标准闭环；高级策略显示具体不可执行原因。                                                   |
| F406 | pending | 收敛兼容 backfill/archive 和新链路，移除新路径 branch-pull/build-on-deploy。                            | Migration/compat/read adapters。                           | 历史项目/环境/运行/日志保留；任意输入被拒绝。                                              |
| F407 | pending | 完成中英文文案、术语和用户/迁移文档。                                                                   | messages 与 docs。                                         | zh/en parity；发布单/发布版本号术语审查。                                                  |
| F408 | pending | 用隔离 Docker 数据完成真实主链浏览器 E2E。                                                              | Disposable compose/runtime/browser evidence。              | 接入→设置→发布→多构建→重复预发→生产→回退。                                                 |
| F409 | pending | 完成 ACL、并发、失败恢复、兼容、Provider 不可用和脱敏负向 E2E。                                         | Cross-layer tests。                                        | API/DB/browser 负向证据。                                                                  |
| F410 | pending | 独立代码/领域/UX/无障碍/安全审查、修复、全量验证和最终交付审计。                                        | 全目标与证据包。                                           | 测试/构建/Prisma/Docker/E2E/commit/主工作区保护全部证明。                                  |

## Verification Plan

- 每个切片：聚焦测试、相关 type-check/build、Prisma 或浏览器证据、`git diff --check`、文件职责/行数检查。
- 产品收尾：API/Web 单元与集成、并发/权限/幂等、Docker 真实数据、浏览器主链和负向链、51/15、日志/Secret 脱敏、旧 deep link。
- 高噪声命令统一通过 `isolate-tool-output` 保存完整日志；构建/type-check 不代替 E2E。

## Change Log

- 2026-08-03: F386 开始；独立 worktree 建立并按顺序集成两个授权提交，未导入原工作区脏改动。
- 2026-08-03: F386 完成；依赖安装、Prisma generate/validate、`init:build`、API/Web type-check、3 suites/35 tests 和 CodeGraph 索引均通过，原主工作区 checkpoint 保持不变。
- 2026-08-03: F387 开始；按 nullable-first 约束增加 intake/environment schema，并先产出仓库别名和 `prod`/`production` 歧义报告，不删除或猜测历史数据。
- 2026-08-03: F387 完成；新增三张增量表、nullable lifecycle/baseline/config revision 关系和只读迁移预检。真实 MySQL 空库全迁移及含 `prod`/`production` 历史 fixture 的升级迁移均通过，历史项目未被默认为 DRAFT/READY。
- 2026-08-03: F388 开始；新增 intake API 编排层，复用真实 repository-analysis 能力，并把 finalize、幂等记录与失败恢复放入独立事务职责。
- 2026-08-03: F388 完成；新 draft 无隐式环境，intake API 复用真实 connect/run/retry/review，finalize 以 Serializable/CAS 事务锁定仓库身份和 Staging/Production。重复、并发、部分回滚恢复、跨团队、重复仓库及历史环境保留均在真实 MySQL 验证通过。
- 2026-08-03: F389 开始；目录查询先固定 team scope，再执行逐项目 ACL，运行、配置、Production、域名和活动均只从项目关系读取。
- 2026-08-03: F389 完成；新增 ACL 过滤目录读模型，支持名称/仓库/域名搜索、运行/配置筛选、精确 Staging/Production 基线、线上/待配置摘要、最近活动排序，真实 MySQL 证明团队/归档/嵌套运行隔离。
- 2026-08-03: F390 开始；Web 项目目录改用新读模型，创建与接入入口收敛为生成新项目和三步接入已有项目，同时保留旧 `/projects/import` 深链兼容。
- 2026-08-03: F390 完成；浏览器真实完成失败保留、重试、分析审核、双环境 finalize 和目录筛选，数据库证明固定 commit、唯一 Staging/Production 及幂等 finalization；目录运行态只读取最新运行，应用建议依赖的环境建议在 UI 中 fail closed。
- 2026-08-03: F391 开始；收敛项目详情一级 IA，并建立 delivery/settings 宿主与旧 tab/query 深链适配。
- 2026-08-03: F391 完成；项目默认发布单，一级只保留发布单/环境版本，低频配置进入独立 settings；旧 repository/environment/deployment 深链分别保留 analysisRunId/environmentId/runId，未具备的环境版本明确保持空状态。
- 2026-08-03: F392 开始；按 nullable-first 增加发布单、构建、不可变 Manifest、生产发布运行和环境版本领域关系，并为 legacy/unverified 数据提供只读报告。
- 2026-08-03: F392 完成；新库与含 legacy ReleasePlan/DeploymentRun 的升级库迁移均通过，旧 digest 外观数据保持 unverified 且不合成 Manifest；同 digest 的两个独立 BuildRun/Manifest 合法，重复项目发布版本号被拒绝。
- 2026-08-03: F393 开始；建立 ReleaseOrder ACL 列表/创建合同和 Web 默认发布单列表，创建只接受发布版本号与说明且不触发构建。
