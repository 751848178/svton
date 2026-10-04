# Shipkit 多服务与选择性发布实现提示词

以下内容可直接作为新实现任务的提示词。规划中的参数尚未实现。

```text
请继续实现 Shipkit 多服务及按服务选择发布。仓库为 /Users/zhaoxingbo/Workspace/ai-driven/svton，源码在 shipkit/；TWGG参考项目为 /Users/zhaoxingbo/Workspace/ai-driven/twgg。

先读仓库AGENTS.md、shipkit/docs/plans/multi-service-release.md、shipkit/docs/todos/2026-10-04-multi-service-release.md、shipkit/docs/audits/2026-10-04/multi-service-planning-baseline.md，核对最近提交和工作区。不要把svton里其他Devpilot/UI改动纳入本任务，不回滚或覆盖它们。按适用技能执行规划、调用链分析、结构标准和完成前验证。

当前Shipkit为0.5.0，原生入口仍单镜像/单服务；已有动态构建机创建和释放逻辑。TWGG已有backend/admin/mobile三个应用镜像及现有MySQL/Redis。专用脚本完成r1首次部署，H5 React解析修复尚未上线验收；tmp里的r2连续发布草稿不是已落地协议。本机native动态模板尚有占位项。两台构建机和专属安全组均已删除，当前生产部署暂停。

从MS-01开始，沿规划按小阶段实现MS-01至MS-05及MS-07的本地可验证部分；每阶段只有一个active TODO，完成后记命令、退出码和证据，不只报告测试数量。先本地/模拟验证，再用隔离Docker验证真实切换。不要创建云实例、重置凭据、修改生产容器/网络/卷或执行数据库迁移。MS-05真实云门槛与MS-06生产TWGG验收保留待用户明确恢复，不能假报闭环。

必须实现的行为：
1. 保持原有单服务ship.yaml兼容；新增明确版本的services规格，支持每服务Dockerfile/context/target/buildArgs、运行环境、端口、健康检查及显式外部网络/受控挂载。
2. ship release默认全应用；--services admin或backend,mobile只构建、推送、更新选中服务，未选服务沿用当前镜像与快照且不重启；--plan --json只读输出计划，不产生费用或修改状态。空、未知、重复及首次缺必需服务选择应在创建构建机前拒绝。
3. 构建manifest固定各服务digest并记录各自源码出处；运行release快照保存完整线上组合、parent、changedServices及私有环境快照。继承服务不能伪装成新提交构建的产物。
4. 同一项目/环境的发布与回滚在锁内读取最新状态并串行合并，支持两个部分发布不丢更新；不能绕过当前身份、快照和归属检查。旧Agent不支持新协议时提前拒绝。
5. 全部选中镜像拉取成功后才切换；健康或状态提交失败恢复本次变更服务。未选服务、MySQL/Redis、非目标容器和卷保持原状；不得down、全局prune、删卷或自动认领同名既有资源。回滚留下新的完整记录，并拒绝过期/身份冲突的计划。
6. 第一阶段沿用现有基础资源，数据库迁移和恢复单独处理；根据声明及联动测试检查兼容性，不自动扩大服务选择，也不宣称镜像回退等于数据库恢复。
7. 复用同一动态构建机完成选中服务构建；成功、失败、超时和取消后的主动释放，以及云定时销毁兜底都有明确结果。部署成功但释放失败时分别报告，不能假报资源已消失。

实现应保留TCP脚本锁的安全范围，源文件不超过200行，避免在pipeline、Docker模块和ReleaseStore堆成巨型文件；将选择/计划、构建、快照、激活及生命周期分清职责。不要为TWGG、deyi等各复制一套发布执行脚本。

验收必须覆盖：v1兼容、非法选择前置拒绝、target正确、单服务只构建所选镜像、未选镜像/环境/容器ID及StartedAt不变、并发部分发布不丢版本、共享Docker归属隔离、坏快照拒绝、拉取/切换/健康/状态提交失败恢复、生命周期异常，以及CLI到真实隔离Agent/Docker的多轮发布。全部通过后报告本地已完成范围、尚待授权的真实云/生产门槛和准确使用命令；检查通过后只提交本任务文件。
```
