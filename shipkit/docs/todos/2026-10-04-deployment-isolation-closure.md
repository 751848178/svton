# Shipkit 部署归属隔离收口

路由：todo-plan。用户授权直接修复，并持续复核至本次隔离问题闭环。

范围：项目/环境身份、构建缓存归属、旧部署绑定、Compose 资源归属以及相关回归与安装包。
保留现有无关改动；不发布、不创建云资源、不操作真实 Docker 容器或卷。
兼容策略：同一 Agent 的同一应用名只属于一个项目和环境；冲突明确拒绝，不新增多租户平台能力。

## 执行项

- [done] 追加复核：修复 `--keep-env` 未传递保留语义、环境快照读取失败被吞，以及状态结构损坏未提前拒绝；补失败复现、HTTP 回归并更新安装包。

本轮仍采用 todo-plan。调用关系：CLI keepEnv → deploy 请求 → Agent 在应用锁内选择环境快照 → ReleaseStore 保存/读取 → activate；回滚和自动恢复共用快照读取。传输层验证参数类型，部署层决定保留规则，存储层拒绝读取错误和非法状态。保持现有归属保护、TCP 锁和云资源行为，使用模拟 Docker；不操作真实服务器。

- [done] 第一轮：核对最新调用链，修复身份与首次认领的遗漏，补充失败用例。
- [done] 第二轮：真实本机 HTTP + 模拟 Docker 验证部署、回滚、缓存、旧状态和异常读取；复查新增代码。
- [done] 第三轮：全套回归、安装检查、重新打包、包内关键路径复验，记录最终证据。

## 调用关系快照

- `cmd-build/cmd-release` → `pipeline.runBuildPipeline` → 实际源码选择 → `project-id` → `local-state`。
- `cmd-deploy/cmd-release` → `pipeline.runDeployPipeline` → deploy API (`project/env`) → `runDeploy`。
- `cmd-rollback` → rollback API (`project/env`) → `runRollback`。
- `runDeploy/runRollback` → Compose 归属 → `project-binding` → 发布状态 → activate → 再次核验 → compose up。
- 部署状态只允许已有身份继续操作；首次绑定必须证明磁盘和 Docker 均没有既有部署。
- 相关测试：`deploy-isolation.e2e`、`deploy-ownership`、`deploy-transaction`、`local-state`、`pipeline`、GC 隔离回归。
- TCP 锁协议、云创建流程及无关 UI 不属于本次修改范围。

## 验收矩阵

- 同一 Agent / 同一目录：同仓库 prod 与 staging 冲突拒绝；原 prod 可继续部署和回滚。
- 不同仓库、显式 source.repo、实际本地上传源：缓存不串用、发布身份一致。
- 无 Git、空格/长路径、常见 Git URL 形式：身份稳定且满足协议约束。
- 旧 state/releases/Compose 文件/运行容器而无绑定：拒绝自动认领。
- 绑定和部署证据读取失败、损坏或非法：拒绝并保留现场。
- 外部同名、拉取期间归属变化、恢复路径：不操作非目标容器。
- web 与 web-api 正常共存；无全局清理或删卷操作。

## 证据

- CodeGraph 索引早于 Shipkit，采用限定目录搜索建立上方调用图，未全仓重建索引。
- 第一轮：构建及 13 项单元回归通过；随后扩展至 31 项针对性单元回归全部通过。
- 第二轮：真实 localhost HTTP + 模拟 Docker 的身份/归属用例通过。首次扩大测试的 3 项上传检查因依赖宿主 Docker 探测失败，已在测试入口隔离探测并重跑。
- 第三轮：`pnpm --filter shipkit test` 退出 0；298/298 测试，17/17 安装器检查通过。
- 最终代码再次全套回归通过：298/298，安装器 17/17；仓库外独立安装后，包内隔离回归 29/29，19 项冒烟检查通过。
- 两包各 156 个实际 JavaScript 文件与 dist 一致，SHA-256 已重新生成并核对；维护源码最多 195 行，相关路径 diff 检查通过。
- 日志目录：`/tmp/codex-tool-runs/svton/ownership-closure/`。复核记录与机器可读证据见 `docs/audits/2026-10-04/deployment-isolation-closure*`。
- 本轮代码问题已闭环；没有操作真实 Docker/云资源，没有提交或发布，目标环境验收另行执行。

## 追加复核证据

- 环境/状态缺口先复现失败后修复；旧格式无标记且无环境文件同样拒绝猜测。
- 最终 308/308 全套测试、17/17 安装器检查、39/39 包内回归、20 项冒烟检查通过；新包各 157 个 JavaScript 文件与 dist 一致。
- 当前包与结果以 `docs/audits/2026-10-04/deployment-env-rereview.md` 及同名 evidence JSON 为准。
