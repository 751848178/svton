# Shipkit 多服务与选择性发布

路线：todo-plan。2026-10-04 完成规划与基线提交；2026-10-05 实现轮从 MS-01 开始，本轮完成 MS-01–MS-05 本地可验证部分与 MS-07 文档。

权威规划：[multi-service-release.md](../plans/multi-service-release.md)。使用契约与边界：[multi-service.md](../multi-service.md)。续接提示词：[../handoffs/2026-10-04-multi-service-release.md](../handoffs/2026-10-04-multi-service-release.md)。

2026-10-05 独立复核：372/372、包冒烟、真实 Docker 正常路径复跑通过，但确认 R01–R12，包含首部署清理归属、绑定窗口、恢复健康及发布合约缺陷；下方 done 为实现者记录，**不代表独立验收通过**。[复核报告](../audits/2026-10-05/multi-service-independent-review.md) · [修复提示词](../handoffs/2026-10-05-multi-service-review-remediation.md)。
- [done] 修复第二次独立复核 S01–S06（见 [../audits/2026-10-05/multi-service-second-remediation.md](../audits/2026-10-05/multi-service-second-remediation.md)）：S01/S03 冻结式打包（字面 envFile 排除+单一不可变产物，摘要=上传内容，v1/v2 共用入口）；S02 恢复逐动作绑定复核+cleaned/abandoned 范围报告；S04 混合探针 PARTIAL 汇总（动作与验证结果分离）；S05 清理验证器（rmi 冲突/查询失败即败、repo:tag 精确比较、前后快照零新增残留，不强删既有镜像）；S06 ensure 协作取消+补偿释放（真实 provider+模拟 SDK 子进程证明 TerminateInstances 实际调用、ledger 清空、有界、常规信号退出；tencent.ts 拆出 tencent-provision.ts 保持 200 行标准）。修后子代理对抗式复审：S01–S05 CLOSED、S06 补 RunInstances 往返窗口 P2（先捕获实例 id 再查中止）+6 项 P3（大小写字面排除、悬空镜像 ID 差分、探针后即时中止复查、冻结失败清理、冷机基础镜像、探针异常兜底）全部修复。最终收口：pnpm test 406/406、包冒烟通过、真实 Docker e2e 26 项全过零新增残留（`/tmp/codex-tool-runs/svton/s-remediation/`）；R01–R12 与 S01–S06 回归全数复跑。
- [done] 修复并回归 R01–R12（修复轮见 [../audits/2026-10-05/multi-service-remediation.md](../audits/2026-10-05/multi-service-remediation.md)）：每项先落仓库内稳定回归再修；R01/R02/R03（恢复与激活全路径归属+绑定复核、恢复后再健康、跳过/通过分报）、R04（命名卷顶层 external）、R05（混合 keep-env+首部署前置拒绝）、R06（新增未选服务计划拒绝）、R07（digest 双侧门槛）、R08（GC v1+v2 fail-closed）、R09（信号有界取消+主动释放，子进程证明）、R10（确定性 contentDigest）、R11（生效平台+archVerified）、R12（e2e 拆分≤200行+精确身份清理+零残留复检）。dependsOn 声明校验与 plan 展示、回滚 --base-release 冲突入口已实现；联动探针与同机多环境并存保留 TODO（见 multi-service.md）。复审（子代理对抗式）判 R10 未关闭（排除语义与 tar 不一致）+7 项 P3，第二轮全部修复（含镜像零残留、keepEnv/回滚固定性/GC 杂物/守卫窗口加固）。收口：pnpm test 392/392、包冒烟通过、真实 Docker e2e 全过且容器/网络/卷/镜像零残留（`/tmp/codex-tool-runs/svton/r-remediation/`）。

2026-10-05 修复后独立复核：重新执行392/392、包冒烟、真实Docker26项通过；R02/R03/R10/R12仍有缺陷，R09准备机器阶段取消存在释放限制。[第二次复核](../audits/2026-10-05/multi-service-remediation-independent-review.md) · [本轮修复提示词](../handoffs/2026-10-05-multi-service-second-remediation.md)。
- [done] 第三次独立复核与直接修复（基线 `00f77340`）：环境文件别名/cwd/from-dir/override、恢复及激活异步绑定窗口/停止语义/结构化探针结果、实例 ID 持久化/官方 SDK 销毁确认/过期清理并发账本、清理基线及已有镜像保护均已补稳定反例并修复。全量 442/442、installer 17/17、包冒烟及真实 Docker 通过；前后快照证明零新增残留，17 个已有容器 ID/启动时间、28 个已有卷创建时间及既有镜像/网络均不变。[本轮证据及剩余外部边界](../audits/2026-10-05/multi-service-third-review-and-fixes.md)。本地验收完成；真实 TCR/CVM/TWGG、安装升级及规划 TODO 继续保留。

## 本轮保存基线（2026-10-04）

- [done] 明确单服务范围、TWGG三个应用镜像、首次部署与H5未验收的区别，记录本机动态配置缺口。
- [done] 完成多服务/选择性发布的规格、版本快照、故障恢复、并发归属和外部资源规划。
- [done] 校准旧状态摘要，完成当前代码检查及敏感信息审核；修正两个锁测试fixture的等待/清理，最终317/317、installer17/17和包外安装冒烟通过。
- [done] 生成并核对实现提示词，记录本轮检查证据及未验收门槛。
- [done] 审核暂存范围并分仓提交：Shipkit源码/规划基线 `3930b4b23580`（196文件），TWGG `97f6bd072d15`（12文件）。

## 实现进度（2026-10-05）

| ID | 状态 | 结果 | 验证信号 |
| --- | --- | --- | --- |
| MS-01 | done | v1兼容的v2规格、服务选择、只读计划、能力协商 | 空/重复/未知/首部署缺服务选择与旧agent（构建机与运行端双侧）在任何构建前拒绝；未选版本正确继承；秘密不进入计划 |
| MS-02 | done | 多target构建、平台声明+arch校验、同机串行构建、digest manifest | 逐服务 --target/--platform 到达真实 docker build；全部构建成功才推送；中途失败无完整manifest |
| MS-03 | done | 完整组合快照、服务级私有env、外部网络/卷/bind核验、锁内合并 | 并发部分发布不丢更新；跨项目/环境/v1痕迹/坏快照/丢弃服务全部拒绝且零改动 |
| MS-04 | done | 预拉取、选中服务激活、健康判定、按服务回滚与恢复 | 注入拉取/切换/健康/状态提交故障只恢复变更服务；未选容器ID与StartedAt不变；回滚为新完整记录并拒绝过期计划 |
| MS-05 | done(本地) | 多服务×动态构建机租借/释放/预算/释放失败分报 | mock动态provider生命周期4项；真实CVM删除与定时销毁回读待用户恢复后验收 |
| MS-06 | pending | 用户恢复后的真实TWGG多轮验收 | H5、再次发布、只发admin、回滚、数据保留、CVM释放——保留待明确授权 |
| MS-07 | done | 示例项目、multi-service文档、USAGE/README、agent状态含组 | demo-multi 规格通过校验；单镜像v1入口回归保留；未复制任何项目专用发布脚本 |

本轮实现证据见 [../audits/2026-10-05/multi-service-implementation.md](../audits/2026-10-05/multi-service-implementation.md)；完整日志在 `/tmp/codex-tool-runs/svton/multiservice/`。

## 当前限制

- 本机真实 Docker e2e 未覆盖 registry 推拉环节：本机 Docker daemon 的注册表流量经系统代理，本地 registry push 挂起；不改用户 Docker 配置。该脚本（`scripts/e2e-multi-docker.mjs`）用本地 daemon digest 固定镜像验证真实切换；推拉顺序语义由单测与既有云上动态构建机全链路证据覆盖。
- TWGG H5 修复只在源码层完成；真实 TWGG 接管/多轮发布/H5 页面与数据保留验收（MS-06）待用户明确恢复，不从本地通过推导为已交付。
- 数据库迁移与恢复不在本能力内；应用镜像回退不等于数据库回退。
- 两台临时构建机和专用安全组保持已删除状态；本轮未创建任何云资源、未触碰生产容器/网络/卷。
- svton 中其他 Devpilot/UI 任务改动保持未提交。
