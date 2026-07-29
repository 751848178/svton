# Pi Agent Migration Long Goal

Use the following as the first message in a fresh Codex task. For another
long-running coding agent, omit the `/goal` command but preserve the body.

```text
/goal

长期目标：
在 /Users/zhaoxingbo/Workspace/ai-driven/svton 中完整实施已接受的 Pi Agent
迁移架构。使用 @earendil-works/pi-ai 作为唯一模型、Provider、认证和 LLM
流式层；使用 @earendil-works/pi-agent-core 作为唯一 Agent 状态、ReAct
循环、基础事件和工具调度层；保留并重新接入 svton 的权限、审批、
Auto-review、Sandbox、MCP、Skills、Memory、Planning、Subagent、
Checkpoint、Session、Client、SDK、Web 和 Desktop 产品能力。不把
@earendil-works/pi-coding-agent 作为共享 Runtime 依赖。

权威资料：
1. AGENTS.md
2. docs-internal/design/pi-agent-migration-architecture.md
3. docs-internal/todos/2026-07-28-pi-agent-migration.md
4. /tmp/codex-tool-runs/svton/long-goals/pi-agent-migration/board.json

当前状态：
- 架构决策和 PI000-PI010 实施台账已经落盘。
- 长任务看板已初始化，`pi000` 是首个 queued Worker，对应台账 PI000。
- 尚未修改 AI Agent 生产代码。
- 启动时工作区已有与本目标无关的
  docker-compose.devpilot-app.yml 修改，必须保留且不得提交到本目标改动中。

执行模型：
1. 当前任务是唯一用户可见的主控任务。使用内部 subagent/worker 完成有界
   切片，不要创建需要用户管理的其他可见任务。
2. 主控 Agent 持有长期目标、看板、Worker 调度、验收和最终结论。
3. 同一个 checkout 同时只允许一个 active write Worker；只读调研和独立
   复核可以并行。需要并行写入时必须使用明确隔离的 worktree 和不重叠范围。
4. Worker 只完成一个切片，写回结果并停止；Worker 不得创建后继 Worker。
5. 按 PI000 → PI010 顺序推进。完成当前切片的实现、定向测试、独立复核和
   状态更新后，主控 Agent 自动进入下一项，不等待用户回复“继续”。
6. 普通测试失败、构建失败、代码审查问题和上下文切分都进入自动修复或
   handoff 流程，不视为外部阻塞。
7. 只有缺少不可替代的外部凭据、权限，或存在会实质改变产品目标且无法从
   源码和文档恢复的决策时才暂停询问用户。

实现约束：
1. 不考虑旧接口兼容、旧事件兼容、历史会话格式迁移或 Node 版本升级成本；
   应删除重复抽象，而不是为了少改调用方保留永久 adapter。
2. Web、Desktop、权限、安全、MCP、Subagent 和产品 Session 是目标能力，
   不能以“不兼容 Pi”为理由删除。
3. Pi Agent 负责消息状态、Agent/turn/message/tool 生命周期和继续执行；
   SvtonAgentRuntime 只做组合，不得重写另一套 ReAct 循环。
4. Pi 负责工具验证和调度；svton 必须继续负责 permission、approval、
   auto-review、sandbox、hook、redaction、audit 和 platform execution。
5. 使用 provider-specific Pi imports，禁止为了方便引入 all-provider
   重入口。
6. 遵守仓库代码结构规范：单文件职责清晰、原则上不超过 200 行、按
   service/types/utils/adapter 等职责分层，禁止机械切碎和循环依赖。
7. 先用 CodeGraph CLI 建立每个跨模块切片的调用与影响图，再读真实源码。
8. 大搜索、测试、type-check、lint、build、Docker 和 E2E 输出写入
   /tmp/codex-tool-runs/svton/pi-agent-migration/，主上下文只保留摘要。
9. 不修改或覆盖无关 dirty 文件；不执行 npm publish、远程 push、外部部署
   或生产凭据操作，除非用户另行明确要求。
10. 如果 `/tmp` 看板因系统清理而不存在，根据权威架构和实施台账重新初始化
    `pi-agent-migration` 看板并添加 `pi000` Worker；这不属于外部阻塞。

验收要求：
- PI000-PI010 全部完成并记录源码和验证证据。
- 自研 OpenAI/Anthropic wire parsing、旧 IProvider、旧 ReAct 循环和重复
  基础事件协议已经删除。
- Permission、approval、Auto-review、Sandbox、MCP、Skills、Memory、
  Planning、Subagent、Checkpoint 和 Session 全部接入新 Runtime。
- Agent Client、SDK、App、Web 和 Desktop 的流式、thinking、工具进度、
  审批、abort、后台会话、错误和恢复路径通过验证。
- 相关单测、type-check、build、lint 和真实产品路径 E2E 通过。
- docs/agent 公共文档与最终实现一致。
- 最终报告列出完成内容、架构、删除代码、验证命令和日志、剩余外部限制；
  不得把未验证能力描述为已完成。

立即开始 PI000。不要重读旧会话；只从上述权威资料、当前源码、Git 状态和
实时验证恢复事实。持续执行直到完整验收或出现真实外部阻塞。
```
