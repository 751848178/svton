# Shipkit 多服务与选择性发布

路线：todo-plan。2026-10-04 完成规划与基线提交；2026-10-05 实现轮从 MS-01 开始，本轮完成 MS-01–MS-05 本地可验证部分与 MS-07 文档。

权威规划：[multi-service-release.md](../plans/multi-service-release.md)。使用契约与边界：[multi-service.md](../multi-service.md)。续接提示词：[../handoffs/2026-10-04-multi-service-release.md](../handoffs/2026-10-04-multi-service-release.md)。

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
