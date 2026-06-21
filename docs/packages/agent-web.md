# AI Agent Web — 能力文档

> `apps/agent-web` — 基于 Next.js 的纯客户端 AI Agent Web 应用，所有 AI 能力在浏览器中运行。

## 架构概览

```
┌───────────────────────────────────────────────────────────────┐
│  Next.js App (Static Export)                                   │
│                                                                │
│  Pages:                                                        │
│  ├── / (首页 → AgentChat)                                     │
│  ├── /settings (Provider 配置)                                 │
│  └── /agent-settings (Agent 能力管理)                          │
│                                                                │
│  AgentChat                                                     │
│  ├── AgentProvider (Context)                                   │
│  │   ├── ChatService (消息/流式/计划/工具审批)                  │
│  │   └── SessionService (会话持久化/自动保存)                   │
│  │                                                             │
│  ├── AgentLayout                                              │
│  │   ├── Sidebar (会话列表/新建/导航)                           │
│  │   ├── TopBar (能力统计/中止按钮)                             │
│  │   ├── CapabilitiesPanel (工具/技能详情)                      │
│  │   └── ChatContent                                          │
│  │       └── ChatPanel (消息列表 + 输入 + PlanPanel)           │
│  │                                                             │
│  └── initAgentConfig()                                        │
│      ├── BrowserPlatform (IndexedDB)                          │
│      ├── Provider (OpenAI / Anthropic / DeepSeek)             │
│      ├── ToolRegistry (11 工具)                                │
│      ├── SkillManager (7 内置技能)                              │
│      ├── MemoryManager (Auto Memory)                          │
│      ├── PromptManager (系统提示词组装)                         │
│      ├── PermissionManager (5 权限模式)                        │
│      ├── HookManager (生命周期钩子)                             │
│      └── PlanningManager (任务规划)                             │
│                                                                │
│  Data: localStorage + IndexedDB                                │
│  No backend required                                           │
└───────────────────────────────────────────────────────────────┘
```

---

## 1. 页面路由

### 1.1 首页 `/`

**文件**: `apps/agent-web/src/app/page.tsx`

动态加载 AgentChat 组件（SSR 禁用）。首次访问时如果未配置 API Key，显示引导卡片跳转到设置页面。

### 1.2 设置页 `/settings`

**文件**: `apps/agent-web/src/app/settings/page.tsx`

Provider 配置界面：

| 功能 | 说明 |
|------|------|
| API 地址 | 编辑 Base URL |
| API Key | 密码输入框 |
| 模型管理 | 添加/删除/编辑模型 ID 和显示名称 |
| 添加 Provider | 动态添加新的 LLM 提供者 |
| 保存 | 持久化到 localStorage |

### 1.3 Agent 能力管理 `/agent-settings`

**文件**: `apps/agent-web/src/app/agent-settings/page.tsx`

完整的 Agent 能力配置面板，包含以下管理区域：

#### 工具管理 (Tools)
- 列出所有已注册工具
- 每个工具显示：名称、描述、参数列表（必填标记）
- 只读/破坏性 标签
- 启用/禁用开关

#### 技能管理 (Skills)
- 列出所有已加载技能
- 每个技能显示：名称、描述、范围、触发类型
- 依赖工具列表
- 启用/禁用开关

#### 权限模式 (Permission)
- 5 种模式选择：只读 / 计划 / 默认 / 接受编辑 / 全自动
- 每种模式的说明文字

#### 记忆管理 (Memory)
- 查看当前记忆内容
- 添加新记忆（保存到 IndexedDB）
- 清除所有记忆

#### 网页搜索 (Web Search)
- 配置搜索 API 端点
- 支持 SearXNG 等 JSON 格式搜索 API
- 端点保存后下次新对话生效

#### 系统提示词 (System Prompt)
- 查看 PromptManager 状态（是否启用）
- 查看 Skills 摘要、Memory 上下文、Tools 描述的注入状态
- 自定义指令编辑器（追加到系统提示词末尾）
- 查看完整系统提示词（折叠展开）

#### 其他
- MCP（浏览器暂不可用说明）
- Subagent（配置信息展示）
- Planning（工具说明）
- Hooks（事件列表）
- 重置所有配置

---

## 2. Agent 配置初始化

**文件**: `apps/agent-web/src/lib/agent-setup.ts`

### `initAgentConfig(model?)` 函数

异步函数，初始化平台和所有能力管理器，返回完整的 `AgentConfig`。

#### 初始化流程

```
1. BrowserPlatform 创建 + setPlatform
2. 从 localStorage 加载 Provider 设置
3. 根据 ProviderSetting.type 创建 OpenAIProvider 或 AnthropicProvider
4. 创建 ToolRegistry 并注册浏览器可用工具
5. 创建并初始化所有 Capability Managers
6. 过滤已禁用的工具和技能
7. 加载自定义指令
8. 返回 AgentConfig
```

### 支持的 Provider

| Provider | 类型 | 默认 Base URL | 默认模型 |
|----------|------|---------------|----------|
| OpenAI | `openai` | `https://api.openai.com` | gpt-4o, gpt-4o-mini |
| Anthropic | `anthropic` | `https://api.anthropic.com` | claude-sonnet-4-20250514, claude-haiku-4-20250506 |
| DeepSeek | `openai` | `https://api.deepseek.com` | deepseek-chat, deepseek-reasoner |

用户可在 `/settings` 页面添加任意 OpenAI 兼容的 Provider。

### 注册的工具

| 工具 | 条件 | 说明 |
|------|------|------|
| `web_fetch` | 始终注册 | HTTP 请求获取 URL 内容 |
| `web_search` | 配置搜索端点后注册 | 网页搜索 |
| `memory_save` | 始终注册 | 保存长期记忆 |
| `memory_recall` | 始终注册 | 召回已保存记忆 |
| `plan_create` | 始终注册 | 创建多步骤计划 |
| `plan_get_status` | 始终注册 | 查看计划状态 |
| `plan_update_step` | 始终注册 | 更新步骤状态 |
| `subagent_spawn` | 始终注册 | 启动子代理 |

### 能力管理器

| 管理器 | 初始化 | 持久化 |
|--------|--------|--------|
| SkillManager | 从 `/public/skills/*/SKILL.md` 加载 7 个技能 | 无 |
| MemoryManager | `init(platform.storage)` 加载 auto memory | IndexedDB |
| PromptManager | 默认实例 | 无 |
| PermissionManager | 恢复 localStorage 保存的模式 | localStorage |
| HookManager | 空实例 | 无 |
| PlanningManager | `init(platform.storage)` | IndexedDB |

### 内置技能

7 个技能从 `apps/agent-web/public/skills/` 目录加载：

| 技能 | 路径 |
|------|------|
| svton | `/skills/svton/SKILL.md` |
| svton-api-client | `/skills/svton-api-client/SKILL.md` |
| svton-service | `/skills/svton-service/SKILL.md` |
| engineering-craft-principles | `/skills/engineering-craft-principles/SKILL.md` |
| universal-craft-principles | `/skills/universal-craft-principles/SKILL.md` |
| verify-before-done | `/skills/verify-before-done/SKILL.md` |
| plan-before-code | `/skills/plan-before-code/SKILL.md` |

---

## 3. AgentChat 组件

**文件**: `apps/agent-web/src/components/AgentChat.tsx`

### 三层组件结构

#### 3.1 AgentChat（外层 — 状态管理）

- 模型选择状态、Provider 列表、模型下拉菜单
- 配置初始化（异步，取消保护）
- Capabilities 统计（工具数、技能数）

#### 3.2 AgentLayout（中间层 — 布局）

**侧边栏**:
- 新对话按钮
- 会话列表（点击切换）
- 导航链接：Agent 能力、设置

**顶部栏**:
- 工具/技能数量统计
- Agent 能力详情面板（折叠展开）
- Agent 能力管理链接
- 中止按钮（运行中时显示）

**能力详情面板**:
- 工具列表（名称 + 描述）
- 技能列表（名称 + 描述）

**Slash 命令**:

| 命令 | 说明 |
|------|------|
| `/new` | 创建新对话 |
| `/clear` | 清空当前对话 |
| `/settings` | 跳转 Agent 能力管理 |
| `/help` | 让 Agent 介绍自己的能力 |
| `/status` | 查看当前 Agent 状态 |

**技能匹配**:
- 当消息变化时，检测最后一个用户消息
- 基于技能描述关键词匹配（简单匹配，运行时使用 SkillManager.findRelevant 进行精确匹配）

#### 3.3 ChatContent（内层 — 聊天）

- 使用 `useChat()` hook 绑定 ChatService
- 使用 `useToolApproval()` hook 处理工具审批
- 将消息转换为 `ChatPanelMessage` 格式
- 预设提示词（4 个中文预设）

---

## 4. 数据持久化

### localStorage

| Key | 内容 |
|-----|------|
| `agent-web:settings` | Provider 配置（URL、API Key、模型列表） |
| `agent-web:defaultModel` | 默认模型 ID |
| `agent-web:disabledTools` | 已禁用的工具名称列表 |
| `agent-web:disabledSkills` | 已禁用的技能名称列表 |
| `agent-web:permissionMode` | 权限模式 |
| `agent-web:customInstructions` | 自定义指令 |
| `agent-web:searchEndpoint` | 搜索 API 端点 |

### IndexedDB (via BrowserStorage)

| Key | 内容 |
|-----|------|
| `memory:auto:index` | 自动记忆条目列表 |
| `planning:*` | 规划数据 |
| `session:list` | 会话列表 |
| `session:msg:{id}` | 会话消息 |

---

## 5. 纯客户端架构特点

### 无后端依赖

- 所有 AI 能力在浏览器中运行
- LLM API 调用直接从浏览器发起（需配置 API Key）
- 数据存储在 localStorage + IndexedDB
- Next.js `output: 'export'` 静态导出

### 浏览器限制

以下能力在浏览器中不可用（需要 Electron/Node.js 平台）：

| 能力 | 原因 |
|------|------|
| 文件系统 (file_read/write/edit) | 无 IFileSystem |
| Shell 执行 (bash) | 无 IProcess |
| 文件搜索 (grep/glob) | 无 ISearch |
| MCP stdio 传输 | 需要 Node.js 进程 |
| AGENT.md 加载 | 无文件系统遍历 |

### 可用的浏览器能力

| 能力 | 说明 |
|------|------|
| 多 LLM Provider | OpenAI / Anthropic / DeepSeek / 自定义 |
| 网页抓取 | web_fetch (CORS 允许的 URL) |
| 网页搜索 | 需配置搜索端点 |
| 长期记忆 | IndexedDB 持久化 |
| 工具调用 | 注册的工具均可使用 |
| 任务规划 | 创建/更新/查询计划 |
| 子代理 | 隔离的子任务处理 |
| 图片上传 | 粘贴/选择图片，视觉模型分析 |
| 会话持久化 | IndexedDB 保存/恢复对话 |
| 技能系统 | 7 个内置技能，匹配时自动注入 |
| 权限控制 | 5 种权限模式 |
| 上下文压缩 | LLM 摘要或截断 |
| 流式输出 | SSE 流式文本 + 思维链 |
