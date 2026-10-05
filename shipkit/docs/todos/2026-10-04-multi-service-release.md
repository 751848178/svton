# Shipkit 多服务与选择性发布

路线：todo-plan。2026-10-04 完成规划与基线提交；2026-10-05–06 已完成 MS-01–MS-07 当前发布链路及真实 TWGG 生产验收。联动业务探针与同机多环境仍属后续独立规划。

权威规划：[multi-service-release.md](../plans/multi-service-release.md)。使用契约与边界：[multi-service.md](../multi-service.md)。续接提示词：[../handoffs/2026-10-04-multi-service-release.md](../handoffs/2026-10-04-multi-service-release.md)。

2026-10-05 独立复核：372/372、包冒烟、真实 Docker 正常路径复跑通过，但确认 R01–R12，包含首部署清理归属、绑定窗口、恢复健康及发布合约缺陷；下方 done 为实现者记录，**不代表独立验收通过**。[复核报告](../audits/2026-10-05/multi-service-independent-review.md) · [修复提示词](../handoffs/2026-10-05-multi-service-review-remediation.md)。
- [done] 修复第二次独立复核 S01–S06（见 [../audits/2026-10-05/multi-service-second-remediation.md](../audits/2026-10-05/multi-service-second-remediation.md)）：S01/S03 冻结式打包（字面 envFile 排除+单一不可变产物，摘要=上传内容，v1/v2 共用入口）；S02 恢复逐动作绑定复核+cleaned/abandoned 范围报告；S04 混合探针 PARTIAL 汇总（动作与验证结果分离）；S05 清理验证器（rmi 冲突/查询失败即败、repo:tag 精确比较、前后快照零新增残留，不强删既有镜像）；S06 ensure 协作取消+补偿释放（真实 provider+模拟 SDK 子进程证明 TerminateInstances 实际调用、ledger 清空、有界、常规信号退出；tencent.ts 拆出 tencent-provision.ts 保持 200 行标准）。修后子代理对抗式复审：S01–S05 CLOSED、S06 补 RunInstances 往返窗口 P2（先捕获实例 id 再查中止）+6 项 P3（大小写字面排除、悬空镜像 ID 差分、探针后即时中止复查、冻结失败清理、冷机基础镜像、探针异常兜底）全部修复。最终收口：pnpm test 406/406、包冒烟通过、真实 Docker e2e 26 项全过零新增残留（`/tmp/codex-tool-runs/svton/s-remediation/`）；R01–R12 与 S01–S06 回归全数复跑。
- [done] 修复并回归 R01–R12（修复轮见 [../audits/2026-10-05/multi-service-remediation.md](../audits/2026-10-05/multi-service-remediation.md)）：每项先落仓库内稳定回归再修；R01/R02/R03（恢复与激活全路径归属+绑定复核、恢复后再健康、跳过/通过分报）、R04（命名卷顶层 external）、R05（混合 keep-env+首部署前置拒绝）、R06（新增未选服务计划拒绝）、R07（digest 双侧门槛）、R08（GC v1+v2 fail-closed）、R09（信号有界取消+主动释放，子进程证明）、R10（确定性 contentDigest）、R11（生效平台+archVerified）、R12（e2e 拆分≤200行+精确身份清理+零残留复检）。dependsOn 声明校验与 plan 展示、回滚 --base-release 冲突入口已实现；联动探针与同机多环境并存保留 TODO（见 multi-service.md）。复审（子代理对抗式）判 R10 未关闭（排除语义与 tar 不一致）+7 项 P3，第二轮全部修复（含镜像零残留、keepEnv/回滚固定性/GC 杂物/守卫窗口加固）。收口：pnpm test 392/392、包冒烟通过、真实 Docker e2e 全过且容器/网络/卷/镜像零残留（`/tmp/codex-tool-runs/svton/r-remediation/`）。

2026-10-05 修复后独立复核：重新执行392/392、包冒烟、真实Docker26项通过；R02/R03/R10/R12仍有缺陷，R09准备机器阶段取消存在释放限制。[第二次复核](../audits/2026-10-05/multi-service-remediation-independent-review.md) · [本轮修复提示词](../handoffs/2026-10-05-multi-service-second-remediation.md)。
- [done] 第三次独立复核与直接修复（基线 `00f77340`）：环境文件别名/cwd/from-dir/override、恢复及激活异步绑定窗口/停止语义/结构化探针结果、实例 ID 持久化/官方 SDK 销毁确认/过期清理并发账本、清理基线及已有镜像保护均已补稳定反例并修复。全量 442/442、installer 17/17、包冒烟及真实 Docker 通过；前后快照证明零新增残留，17 个已有容器 ID/启动时间、28 个已有卷创建时间及既有镜像/网络均不变。[本轮证据及剩余外部边界](../audits/2026-10-05/multi-service-third-review-and-fixes.md)。本地验收完成；真实 TCR/CVM/TWGG、安装升级及规划 TODO 继续保留。
- [done] 第四次完整独立复核（基线 `33a0d44d`，路线 specialized）：14 类确认缺陷已直接修复；最新全量 498+4、installer 17/17，当前包外 215 文件身份一致+50 项回归，真实 Docker 发布/恢复/回滚/卷保留及全资源零差分通过。证据见 `docs/audits/2026-10-05/multi-service-fourth-full-review.md`；TCP 协议未改，其他 569 项改动状态保留。真实 TCR/CVM/TWGG、已安装 CLI 升级、联动探针与同机多环境边界保留。

## 本轮保存基线（2026-10-04）

- [done] 明确单服务范围、TWGG三个应用镜像、首次部署与H5未验收的区别，记录本机动态配置缺口。
- [done] 完成多服务/选择性发布的规格、版本快照、故障恢复、并发归属和外部资源规划。
- [done] 校准旧状态摘要，完成当前代码检查及敏感信息审核；修正两个锁测试fixture的等待/清理，最终317/317、installer17/17和包外安装冒烟通过。
- [done] 生成并核对实现提示词，记录本轮检查证据及未验收门槛。
- [done] 审核暂存范围并分仓提交：Shipkit源码/规划基线 `3930b4b23580`（196文件），TWGG `97f6bd072d15`（12文件）。

## 实现进度（2026-10-05）

2026-10-05 用户明确恢复整套生产链路，授权真实 TCR/CVM/TWGG 验收与端点升级。路线 specialized：控制端统一真实资源操作，独立检查 TWGG 配置与 builder 引导；保留数据库、卷及非目标资源，先备份和核对迁移。
- [done] MS-06 基线/备份/接管、私有配置、SSH 专用通道与控制/运行端程序升级；保留 MySQL/Redis、归档、非目标项目和用户账号。
- [done] 原生动态三镜像 TCR 构建/推拉/部署；H5 真实手机页面及缓存/rem 修复、定时销毁真实执行、主动销毁查询确认。
- [done] 再次全量、仅 admin、admin 回滚均真实通过；四轮各 15 项只读探针、48 表行数、9 表 checksum 与非目标容器/卷保持；最终云实例/ledger/活动任务均为 0。证据与一键命令见 [生产验收](../audits/2026-10-05/production-chain-acceptance.md)。
- [done] AI Agent 最终入口：连接提示转 stderr，stdout 整体 JSON 解析回归先失败后通过；真实 admin 只读计划核对选择/继承/当前 base-release，TWGG shell/Git/archive 与启动回归 14/14。

| ID | 状态 | 结果 | 验证信号 |
| --- | --- | --- | --- |
| MS-01 | done | v1兼容的v2规格、服务选择、只读计划、能力协商 | 空/重复/未知/首部署缺服务选择与旧agent（构建机与运行端双侧）在任何构建前拒绝；未选版本正确继承；秘密不进入计划 |
| MS-02 | done | 多target构建、平台声明+arch校验、同机串行构建、digest manifest | 逐服务 --target/--platform 到达真实 docker build；全部构建成功才推送；中途失败无完整manifest |
| MS-03 | done | 完整组合快照、服务级私有env、外部网络/卷/bind核验、锁内合并 | 并发部分发布不丢更新；跨项目/环境/v1痕迹/坏快照/丢弃服务全部拒绝且零改动 |
| MS-04 | done | 预拉取、选中服务激活、健康判定、按服务回滚与恢复 | 注入拉取/切换/健康/状态提交故障只恢复变更服务；未选容器ID与StartedAt不变；回滚为新完整记录并拒绝过期计划 |
| MS-05 | done | 多服务×动态构建机租借/释放/预算/释放失败分报 | 真实定时销毁执行、两轮全自动 CVM 引导/主动释放/云端消失/ledger 清空；生产异步删除确认预算已修复 |
| MS-06 | done | 真实 TWGG 四轮生产验收 | 首次/再次全量/只发 admin/回滚、H5 手机渲染、15 项业务只读探针、数据/非目标资源保持、CVM 零遗留 |
| MS-07 | done | 示例项目、multi-service文档、USAGE/README、agent状态含组 | demo-multi 规格通过校验；单镜像v1入口回归保留；未复制任何项目专用发布脚本 |

本轮实现证据见 [../audits/2026-10-05/multi-service-implementation.md](../audits/2026-10-05/multi-service-implementation.md)；完整日志在 `/tmp/codex-tool-runs/svton/multiservice/`。

## 当前限制

- 本机隔离 Docker e2e 仍使用本地 daemon digest 验证切换；真实 TCR 推拉现已由 TWGG 两轮全自动云构建机和运行端验收覆盖，不再是生产链路未完成门槛。
- 联动业务探针与同机多环境并存保持后续 TODO；本次验收仅覆盖已配置的 TWGG prod，当前 H5/接管/多轮/数据保留全部通过。
- 数据库迁移与恢复不在本能力内；应用镜像回退不等于数据库回退。
- 本次创建的所有临时 CVM 已确认消失；仅保留后续动态发布所需的专用安全组与 SSH bridge 配置。原三应用停止容器和备份保留为恢复依据，MySQL/Redis及其他项目容器未重启。
- svton 中其他 Devpilot/UI 任务改动保持未提交。
