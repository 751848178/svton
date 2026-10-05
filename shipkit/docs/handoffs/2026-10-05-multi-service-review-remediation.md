# ZCode 多服务审计修复提示词

可直接复制以下任务。当前实现 `b627d47e`；独立复跑 372/372、包冒烟、19 项真实 Docker 正常路径通过，但故障审计尚未通过。不要重新实现整个功能，也不要用这些绿灯数量覆盖审计结论。

```text
请修复 Shipkit 多服务实现的独立审计问题，仓库 /Users/zhaoxingbo/Workspace/ai-driven/svton，代码 shipkit/。

先读 AGENTS.md、shipkit/docs/audits/2026-10-05/multi-service-independent-review.md、docs/plans/multi-service-release.md、docs/todos/2026-10-04-multi-service-release.md。核对 HEAD 和工作区；保留其他 Devpilot/UI 改动。按适用技能执行调用链分析、结构标准和完成前验证，维护一个有边界的 TODO。不要改 TCP 锁协议，不回滚现有多服务实现。

按依赖顺序完成 R01–R12，不只修正常路径：
1. 将项目/环境身份贯穿 v2 激活、恢复、首部署清理。pull/up 窗口之后的绑定变化、丢失、损坏以及外来容器必须在修改前拒绝；首次失败不能对未核验项目直接 down，更不能停止/删除非目标资源或卷。使用精确身份和资源范围，覆盖首部署与已有组合两条恢复路径。
2. 恢复旧组合后重新检查实际变更服务健康；任一恢复失败/仍不健康不能返回 recovery.succeeded=true。跳过验证须与验证通过分开报告。未选服务的 image/env/spec/container ID/StartedAt 保持不变。
3. 外部命名卷渲染顶层 external:true 与明确 name，先存在/归属检查，不自动创建或删除；用真实 docker compose config 和隔离卷挂载验证，数据前后相同。
4. --keep-env 正确继承已有环境和明确的无环境快照；已有 env 丢失仍拒绝。新增但未选且无历史版本的服务必须在创建 builder 前拒绝。--plan 与 runtime 合并判定保持一致，不能漏掉服务。
5. 所有成功 manifest 都必须具有校验过的 digest-pinned ref。拒绝缺失/非法/不一致 digest，以及无法确认或不匹配的实际架构；manifest 记录每个 slice 的有效平台。from-dir 记录可验证的源码/内容/补丁摘要，不伪造 Git 出处；未选服务保留各自来源。
6. GC 同时理解 v1 与 v2，保护 current/previous/所有保留组合内镜像，坏快照仍关闭删除。覆盖混合状态、继承镜像和旧组合回滚镜像，不做全局 prune。
7. 给活跃动态 builder 增加有界 SIGINT/SIGTERM 取消和主动释放；释放结果与构建/部署结果分开，不误报销毁，也不因为清理失败回滚健康应用。模拟子进程应证明取消确实调用 release；并发租约安全继续保留。无需创建云实例。
8. e2e 跟踪并核验本次容器、默认/外部网络等精确资源身份，结束时检查零本次残留；禁止宽泛 prefix 删除。修复脚本超过 200 行的结构问题，拆分明确职责。

先保存失败用例或等价的稳定回归，再修复。审计中的 /tmp 脚本只是复现材料，不直接依赖其存在作为长期测试。避免靠固定 sleep 或一次快照制造假绿。

同时明确规划中未实现的声明式依赖/关键联动探针、CLI 显式回滚版本冲突与 v2 多环境并存契约：在现有任务范围内落实需要的合约和有界回归，或者将未交付项明确保留 TODO 并如实报告，不能宣称整体完成。安装版本、已生成新包、已升级端点和真实验收分别记录。

禁止创建云资源、重置密钥/密码、连接并修改生产服务器、改生产容器/网络/卷、执行数据库迁移或升级用户本机脚本。MS-05 真实云与 MS-06 TWGG 生产门槛仍待用户明确恢复；不能从本任务推导授权。

收口验证：逐项重放 R01–R12；pnpm --filter shipkit test；shipkit 下 pnpm run smoke:package；真实隔离 Docker 全量→部分→回滚，并加入故障恢复、named volume、混合 env/新增服务拒绝等必要用例。报告每项命令、退出码、证据和限制，日志放 /tmp/codex-tool-runs/svton/；不能只报测试数量。修复完自行独立审计一次。只选择性提交本任务文件，不使用 git add .。最后给出已修/未修条目、提交和下一轮复核入口，不声称云/生产已经跑通。
```
