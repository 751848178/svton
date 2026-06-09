# Svton vs Codex Desktop vs Claude Code — 深度对比分析

> 调研日期: 2026-06-05
> 对比版本: Svton (当前开发版) / Codex Desktop v0.137 (GPT-5.3-Codex) / Claude Code (Claude Opus 4.6)

## 一、架构差异

### 1.1 核心运行时

| 维度 | Svton | Codex Desktop | Claude Code |
|------|-------|---------------|-------------|
| **语言** | TypeScript | Rust (96%) + TypeScript (Electron 壳) | TypeScript (闭源) |
| **运行时** | Node.js / 浏览器 | Rust tokio 异步运行时 | Node.js CLI |
| **Agent 循环** | ReAct while 循环 + AsyncGenerator 流式 | 事件驱动双异步通道 (nO/h2A) | 单线程 while 循环 + async 队列 |
| **消息模型** | 平坦消息列表 | 线程/轮次/条目 三层模型 | 平坦消息列表 |
| **部署形态** | 纯浏览器 SPA | Electron 桌面应用 | CLI 终端 |
| **开源** | 完全开源 | CLI+核心开源 (Apache 2.0)，桌面壳闭源 | 完全闭源 |

**分析**: Codex 的 Rust 实现在性能和安全性上有天然优势（内存安全、内核级沙箱）。Svton 选择 TypeScript + 浏览器运行时是独特定位——零安装、跨平台、但不具备文件系统/Shell 能力。Claude Code 的 while 循环设计与 Svton 的 ReAct 循环相似。

### 1.2 数据存储

| 维度 | Svton | Codex Desktop | Claude Code |
|------|-------|---------------|-------------|
| **会话存储** | IndexedDB | 双 SQLite（Node 同步 + Rust 异步） | 本地文件 |
| **配置存储** | localStorage | config.toml + SQLite | ~/.claude/ 文件 |
| **记忆存储** | IndexedDB (auto) | SQLite thread_memory + ~/.codex/memories | ~/.claude/ memory 文件 |

---

## 二、核心能力对比

### 2.1 工具系统

| 工具类别 | Svton | Codex Desktop | Claude Code |
|----------|-------|---------------|-------------|
| **文件读取** | ✅ file_read (offset/limit) | ✅ gitignore 感知 | ✅ Read (行号/偏移) |
| **文件写入** | ✅ file_write | ✅ apply-patch | ✅ Write |
| **文件编辑** | ✅ file_edit (字符串替换) | ✅ apply-patch (原子补丁) | ✅ Edit (字符串替换) |
| **Shell 执行** | ✅ bash (可配超时) | ✅ node-pty / portable-pty | ✅ Bash |
| **文件搜索** | ✅ grep (正则) + glob | ✅ ignore crate | ✅ Grep + Glob |
| **网页抓取** | ✅ web_fetch | ❌ (无内置) | ✅ WebFetch |
| **网页搜索** | ✅ web_search (需配端点) | ❌ (无内置) | ✅ WebSearch (内置) |
| **记忆工具** | ✅ memory_save + memory_recall | ❌ (无专用工具) | ❌ (无专用工具) |
| **子代理** | ✅ subagent_spawn | ✅ 内置 default/worker/explorer | ✅ Task tool |
| **代码搜索** | ❌ | ❌ | ✅ semantic search (未公开) |
| **Diff 查看** | ✅ DiffView (UI组件) | ✅ 原生 diff 展示 | ✅ diff 输出 |
| **内置工具总数** | **11** | **~6** | **~20** |

**分析**:

- **Codex 工具最精简**（~6个），但每个都深度集成（如 apply-patch 原子操作、gitignore 感知文件读取、git worktree 快照恢复）。质量 > 数量。
- **Claude Code 工具最丰富**（~20个），包含 notebook edit、computer use 等高级工具。工具定义精细，JSON Schema 完整。
- **Svton 居中**（11个），独特地提供了 `memory_save`/`memory_recall` 作为工具暴露给 LLM，这是一个差异点。但在浏览器环境下，6 个工具不可用（file/bash/grep/glob），实际可用仅 5 个。

### 2.2 工具执行器实现质量

| 维度 | Svton | Codex Desktop | Claude Code |
|------|-------|---------------|-------------|
| **编辑策略** | 字符串替换 (replace_all) | 原子补丁 (apply-patch) | 字符串替换 + 多文件编辑 |
| **回滚能力** | ❌ 无回滚 | ✅ 补丁可逆 (revert) | ❌ 无回滚 |
| **Git 集成** | ❌ 无 | ✅ worktree 快照/恢复 | ⚠️ 通过 Bash 间接使用 |
| **输入校验** | ✅ 全部 9 个执行器有校验 | ✅ Rust 类型系统保证 | ✅ 完整 JSON Schema 校验 |
| **元数据传递** | ✅ ToolResult.metadata | ✅ 结构化结果 | ✅ 结构化结果 |

**分析**: Codex 的 apply-patch 是最佳实现——原子操作、可回滚。Svton 和 Claude Code 都用字符串替换，不具备原子性和回滚能力。

---

### 2.3 记忆系统

| 维度 | Svton | Codex Desktop | Claude Code |
|------|-------|---------------|-------------|
| **上下文文件** | AGENT.md（文件系统加载，浏览器不可用） | AGENTS.md（跨工具标准，32KiB 上限） | CLAUDE.md（Anthropic 专有） |
| **目录遍历** | ✅ 从工作目录向上遍历 | ✅ 从 git root 向上遍历 | ✅ 从工作目录向上遍历 |
| **自动记忆** | ✅ Auto Memory (IndexedDB, max 50) | ✅ thread_memory + ~/.codex/memories | ✅ Auto Memory (200 行上限) |
| **LLM 主动保存** | ✅ memory_save 工具 | ❌ 无专用工具 | ❌ 无专用工具 |
| **手动注入** | ✅ addProjectMemory() | ✅ AGENTS.override.md | ✅ 用户手动编辑 |
| **记忆删除** | ✅ deleteEntry() | ✅ 删除文件 | ✅ 删除文件 |
| **分层加载** | ✅ Project + Auto 两层 | ✅ AGENTS.md + thread + skills 三层 | ✅ CLAUDE.md + Auto + Dream 三层 |

**分析**:

- **Codex 采用行业标准 AGENTS.md**，这是跨工具可移植的优势。Claude Code 的 CLAUDE.md 是专有格式。
- **Claude Code 有 Auto Dream**——后台整理记忆的 daemon 进程，这是最先进的自动记忆管理。
- **Svton 的 memory_save 工具是独特优势**——让 LLM 主动决定保存什么。但浏览器环境无法加载 AGENT.md 文件，只能依赖手动添加和 memory_save 工具。
- **Svton 在浏览器中记忆功能最受限**——无文件系统遍历，只有 IndexedDB 持久化。

### 2.4 技能系统

| 维度 | Svton | Codex Desktop | Claude Code |
|------|-------|---------------|-------------|
| **技能定义** | YAML 前言 + Markdown 正文 | SKILL.md + scripts/ + agents/openai.yaml | 无专用技能系统 |
| **触发方式** | 显式 (/name) + 隐式 (关键词) | LLM 自主选择 | 无 |
| **渐进披露** | ✅ 摘要注入 (~2% 上下文) + 按需加载 | ✅ 摘要 (~2%) + 按需加载 | 无 |
| **技能发现** | 硬编码路径列表 | 4 级目录 (repo/user/admin/system) | 无 |
| **技能包** | ❌ | ✅ Plugins (可分发) | 无 |
| **附随资源** | ❌ | ✅ scripts/ + references/ + assets/ | 无 |
| **自定义代理** | ❌ | ✅ agents/openai.yaml (TOML 定义) | 无 |

**分析**:

- **Codex 的技能系统最成熟**——支持脚本、参考资料、资产、自定义代理配置，且支持打包分发。
- **Svton 的技能系统与 Codex 概念最接近**（Markdown 技能定义 + 渐进披露），但缺少脚本、资源、包分发能力。
- **Claude Code 没有专用技能系统**——依赖 CLAUDE.md 和 hooks 实现类似功能。

### 2.5 权限与安全

| 维度 | Svton | Codex Desktop | Claude Code |
|------|-------|---------------|-------------|
| **沙箱实现** | ❌ 无沙箱 | ✅ 内核级 (Seatbelt/Landlock/seccomp) | ❌ 无沙箱 |
| **权限模式** | 5 种 (read_only → auto) | 3 种 (read-only/workspace-write/full) | 5 种 (read → bypassPermissions) |
| **审批机制** | ✅ tool_approval_needed 事件 | ✅ JSON-RPC 审批协议 | ✅ PreToolUse hooks |
| **可编程性** | ❌ 规则固定 | ❌ 预设模式 | ✅ 26 个生命周期事件 + 自定义脚本 |
| **MCP 安全** | 无 MCP | ⚠️ MCP 进程在沙箱外 | 无 MCP |

**分析**:

- **Codex 的内核级沙箱是业界最强**——使用 macOS Seatbelt / Linux Landlock+seccomp，与应用层沙箱有本质区别。但预设模式不可编程。
- **Claude Code 的 hooks 系统最灵活**——26 个生命周期事件，可编写任意 bash/Python 脚本。应用层安全足够应对大多数场景。
- **Svton 无沙箱**——浏览器环境天然隔离（无文件系统/Shell），但这不是安全设计而是平台限制。

### 2.6 上下文管理

| 维度 | Svton | Codex Desktop | Claude Code |
|------|-------|---------------|-------------|
| **压缩触发** | ~80% 上下文窗口 | ~92% 上下文窗口 | ~92% 上下文窗口 |
| **压缩策略** | LLM 摘要 → 截断回退 | OpenAI 专用 API 压缩 | 内部压缩算法 |
| **摘要注入** | ✅ system 消息 | ✅ 加密内容项 | ✅ 压缩消息 |
| **Provider 依赖** | ⚠️ LLM 摘要需 Provider | ⚠️ 依赖 OpenAI 专用端点 | ✅ 内置处理 |
| **Token 估算** | 启发式 (CJK 感知) | tiktoken 精确计数 | tiktoken 精确计数 |
| **缓存预热** | ❌ | ❌ | ✅ dummy 请求预热 cache |

**分析**:

- **Claude Code 的缓存预热是独特优化**——在发送实际请求前先发一个 dummy 请求来预热 prompt cache，节省 Token 费用。
- **Codex 的压缩依赖 OpenAI 专用端点**——使用 `--oss` 模式接入 Ollama 时压缩会失效。
- **Svton 的 LLM 摘要压缩是好的设计**——但启发式 Token 估算与真实 Token 数差距大，可能导致压缩触发过早或过晚。

### 2.7 子代理系统

| 维度 | Svton | Codex Desktop | Claude Code |
|------|-------|---------------|-------------|
| **子代理类型** | 通用 (task+roleDescription) | default / worker / explorer | Task tool (只读, Haiku 驱动) |
| **自定义代理** | ❌ | ✅ TOML 文件定义 | ❌ |
| **并发数** | 无限制 | max_threads=6, max_depth=1 | depth=1 |
| **工具继承** | ✅ allowlist/denylist | ✅ 继承沙箱策略 | ✅ 只读工具 |
| **能力继承** | ✅ (排除 subagentManager) | ✅ (排除递归) | ⚠️ 有限 |
| **并行执行** | ✅ spawnParallel() | ✅ 多线程 | ❌ 串行 |
| **CSV 扇出** | ❌ | ✅ spawn_agents_on_csv | ❌ |
| **模型选择** | ✅ 可覆盖 | ✅ 可指定 | ⚠️ 固定 Haiku |

**分析**:

- **Codex 的子代理系统最强大**——自定义代理配置、CSV 批量扇出、并发线程控制。
- **Svton 的并行执行是优势**——spawnParallel() 支持同时启动多个子代理。
- **Claude Code 的子代理最保守**——只读、固定 Haiku 模型、不支持并行。但这是有意设计——降低成本和风险。

### 2.8 MCP 支持

| 维度 | Svton | Codex Desktop | Claude Code |
|------|-------|---------------|-------------|
| **MCP 客户端** | ✅ HTTP/SSE 传输 | ✅ rmcp Rust 原生 | ✅ 支持 |
| **MCP 服务器** | ⚠️ 部分实现 | ✅ 实验性 codex mcp-server | ❌ |
| **工具桥接** | ✅ toToolDefinitions() 命名空间 | ✅ 统一到 prompt | ✅ 支持 |
| **stdio 传输** | ❌ | ✅ | ✅ |
| **HTTP 传输** | ✅ | ✅ | ✅ |
| **浏览器可用** | ❌ (需 HTTP 端点) | ❌ (需本地进程) | ❌ (需本地进程) |

**分析**:

- **Codex 的 MCP 实现最深**——Rust 原生客户端、支持作为服务器暴露、支持 stdio。但 Codex 团队认为 MCP 不够用于 IDE 集成（流式 diff、审批流等），设计了 App Server 协议作为替代。
- **Svton 的 MCP 实现完整但在浏览器中不可用**——HTTPTransport 可用，但 stdio 需要本地进程。

### 2.9 规划系统

| 维度 | Svton | Codex Desktop | Claude Code |
|------|-------|---------------|-------------|
| **计划创建** | ✅ plan_create 工具 | ❌ 无专用工具 (依赖 LLM 自然规划) | ❌ 无专用工具 |
| **步骤依赖** | ✅ 依赖追踪 + 并行就绪 | ❌ | ❌ |
| **进度追踪** | ✅ PlanPanel UI 实时展示 | ❌ | ❌ |
| **步骤状态** | ✅ 5 种状态 | ❌ | ❌ |
| **自动化** | ❌ | ✅ cron + RRule 调度 | ✅ 远程触发 |

**分析**:

- **Svton 的规划系统是独特优势**——专门设计了 plan_create/plan_update_step/plan_get_status 三个工具，加上 PlanPanel UI 实时展示进度。Codex 和 Claude Code 都依赖 LLM 自然规划，没有显式的规划工具。
- **Codex 的自动化引擎是另一维度**——cron 定时任务、RRule 复杂调度、inbox 模型，这是运维层面的规划。
- **Claude Code 有 /compact 和任务管理模式**——但不是真正的规划系统。

### 2.10 提示词管理

| 维度 | Svton | Codex Desktop | Claude Code |
|------|-------|---------------|-------------|
| **组装方式** | PromptManager 5 段拼接 | 系统提示 + AGENTS.md + skills | 系统提示 + CLAUDE.md |
| **模板系统** | ✅ 命名模板 + 变量插值 | ❌ | ❌ |
| **自定义指令** | ✅ 用户追加指令 | ✅ AGENTS.override.md | ✅ CLAUDE.md |
| **工具描述注入** | ✅ 自动 | ✅ 自动 | ✅ 自动 |
| **技能注入** | ✅ 摘要 + 按需 | ✅ 摘要 + 按需 | ❌ |
| **记忆注入** | ✅ 自动 | ✅ 自动 | ✅ 自动 |

---

### 2.11 Provider 支持

| 维度 | Svton | Codex Desktop | Claude Code |
|------|-------|---------------|-------------|
| **主要 Provider** | 多个 (OpenAI/Anthropic/DeepSeek) | OpenAI 专用 | Anthropic 专用 |
| **第三方接入** | ✅ 任意 OpenAI 兼容 | ⚠️ --oss 模式有限支持 | ❌ |
| **模型切换** | ✅ 运行时切换 | ⚠️ 配置切换 | ❌ 固定 |
| **思维链** | ✅ DeepSeek/Claude | ✅ GPT-5.x reasoning | ✅ Extended Thinking |
| **视觉** | ✅ 图片上传 | ✅ GPT-5.3 多模态 | ✅ Claude Vision |

**分析**:

- **Svton 的多 Provider 支持是独特优势**——可以在运行时切换不同 Provider 和模型。Codex 和 Claude Code 都锁定自家模型。
- **Codex 的模型集成最深**——专门训练的 GPT-5.x-Codex，工具调用优化，系统提示词精确调优。
- **Claude Code 的模型-工具协同最优**——Anthropic 自己的模型 + 自己的工具定义，兼容性最好。

---

## 三、UI/UX 对比

| 维度 | Svton | Codex Desktop | Claude Code |
|------|-------|---------------|-------------|
| **界面形态** | Web 浏览器 | Electron 桌面应用 | CLI 终端 |
| **代码编辑器** | 无（仅显示代码块） | ProseMirror 富文本编辑器 | 无（终端输出） |
| **终端集成** | 无 | xterm.js 嵌入式终端 | 原生终端 |
| **Diff 查看** | ✅ DiffView 组件 | ✅ 原生 diff 视图 | ✅ 终端 diff |
| **工具调用卡片** | ✅ ToolCallCard | ✅ 结构化展示 | ✅ 终端输出 |
| **思维链展示** | ✅ ThinkingBlock (可折叠) | ✅ 折叠展示 | ✅ 终端展示 |
| **计划面板** | ✅ PlanPanel (进度条+步骤) | ❌ | ❌ |
| **图片上传** | ✅ 拖拽/粘贴/预览 | ✅ ProseMirror 集成 | ❌ CLI |
| **斜杠命令** | ✅ 自动补全 | ❌ | ✅ /compact /clear 等 |
| **会话管理** | ✅ 侧边栏 | ✅ Thread 列表 | ✅ /sessions |
| **Git/PR 集成** | ❌ | ✅ 14 个 IPC 方法 | ⚠️ 通过 Bash |
| **自动滚动** | ✅ | ✅ | N/A |

---

## 四、Svton 的独特优势

| 特性 | 说明 |
|------|------|
| **多 Provider 支持** | 唯一支持运行时切换 OpenAI/Anthropic/DeepSeek 的方案 |
| **纯浏览器运行** | 零安装、跨平台、无需本地进程 |
| **规划系统** | 唯一有专用 plan_create/update/get 工具 + UI 面板的方案 |
| **记忆工具** | 唯一暴露 memory_save/recall 工具给 LLM 主动使用 |
| **技能系统** | 渐进披露 + 显式/隐式触发，与 Codex 概念最接近 |
| **Reactive 架构** | @svton/service observable + React hooks，状态管理清晰 |
| **完全开源** | 全栈开源，包含 UI 组件库 |

## 五、Svton 的关键差距

| 差距 | 严重度 | 说明 |
|------|--------|------|
| **浏览器无文件系统/Shell** | 🔴 致命 | 核心编码能力缺失，只能做信息类任务 |
| **无沙箱** | 🟡 中等 | 浏览器天然隔离但不等于安全设计 |
| **Token 估算不准** | 🟡 中等 | 启发式 vs tiktoken，影响压缩时机 |
| **无 Git 集成** | 🟡 中等 | Codex 有 14 个 Git/PR IPC 方法 |
| **无代码编辑器** | 🟡 中等 | Codex 有 ProseMirror，可以内联编辑 |
| **无缓存预热** | 🟡 中等 | Claude Code 有 cache warmup |
| **无自动化调度** | 🟢 低 | Codex 有 cron/RRule |
| **无 apply-patch** | 🟡 中等 | 文件编辑不可逆 |
| **技能不可分发** | 🟢 低 | Codex 有 Plugin 打包机制 |

## 六、总结评价

### 谁的实现更好？

**不同维度有不同的赢家**:

| 维度 | 最优方案 | 原因 |
|------|---------|------|
| **安全性** | Codex Desktop | 内核级沙箱，业界独有 |
| **可扩展性** | Codex Desktop | Skills + Plugins + MCP + App Server |
| **多 Provider** | **Svton** | 唯一支持运行时切换 |
| **规划能力** | **Svton** | 唯一有专用规划工具 + UI |
| **记忆 LLM 交互** | **Svton** | memory_save/recall 工具 |
| **纯客户端架构** | **Svton** | 唯一零安装方案 |
| **模型深度集成** | Codex Desktop | 专用 Codex 模型，性能最优 |
| **灵活安全** | Claude Code | 26 个 hooks，可编程安全 |
| **工具丰富度** | Claude Code | 20 个内置工具 |
| **Subagent 能力** | Codex Desktop | 自定义代理 + CSV 扇出 + 并发控制 |
| **上下文管理** | Claude Code | 精确 Token 计数 + 缓存预热 |
| **Git 集成** | Codex Desktop | Worktree + PR-native + 快照恢复 |
| **UI/UX** | Codex Desktop | ProseMirror + xterm.js + Diff |
| **开源程度** | Svton = Codex CLI > Claude Code | Svton 和 Codex CLI 完全开源 |

### 战略定位

三个产品的定位完全不同：

- **Codex Desktop**: 专业开发者工具，追求最大能力（内核沙箱、专用模型、Git 深度集成）。适合需要高可靠代码编辑的专业团队。
- **Claude Code**: 轻量 CLI agent，追求灵活和可编程性。适合喜欢终端工作流的高级用户。
- **Svton**: 浏览器端 AI Agent 平台，追求零门槛和多模型支持。适合快速原型、对话式辅助、非开发者用户。

Svton 的浏览器定位是差异化优势也是核心限制——无需安装降低了门槛，但也放弃了文件系统/Shell/Git 等开发者核心能力。
