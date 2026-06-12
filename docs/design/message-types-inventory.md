# Svton 消息类型清单与渲染状态

> 整理时间：2026-05-31
> 基于 agent-core、agent-client、UI 三层代码的完整梳理

---

## 1. 数据流概览

```
Provider (LLM API)
  yields StreamEvent ──────────────────────────── Layer 1: Provider
    │
    ▼
AgentRuntime.run()
  translates → AgentEvent ────────────────────── Layer 2: Agent
  adds: tool execution, permissions, compaction
    │
    ▼
ChatService.handleEvent()
  translates → DisplayMessage / DisplayToolCall ─ Layer 3: Client
  stores in @observable() messages[]
    │
    ▼
useChat() → ChatPanelMessage[] ──────────────── Layer 4: UI
  renders: ChatMessage, ToolCallCard, etc.
```

---

## 2. Layer 1 — StreamEvent（Provider 层）

> 文件：`ai/agent-core/src/provider/types.ts`

| 事件类型 | 字段 | 说明 | UI 渲染 |
|----------|------|------|---------|
| `text_delta` | `text: string` | LLM 增量文本 | ✅ 累加到 assistant.content |
| `thinking_delta` | `thinking: string` | 思维链内容（o3/DeepSeek） | ⚠️ 累加为 `[Thinking]` 内联文本，无独立样式 |
| `tool_call_start` | `id, name` | 开始调用工具 | ✅ 创建 DisplayToolCall |
| `tool_call_delta` | `id, argumentsDelta` | 工具参数增量 | ❌ 内部缓冲，不暴露到 UI |
| `tool_call_end` | `id, name, arguments` | 工具调用完成（参数就绪） | ✅ 内部使用 |
| `usage` | `usage: TokenUsage` | Token 用量 | ✅ 存入 lastUsage，不显示 |
| `done` | `stopReason: string` | 回合结束 | ✅ 结束流式，不显示原因 |

---

## 3. Layer 2 — AgentEvent（Agent 层）

> 文件：`ai/agent-core/src/agent/types.ts`

| 事件类型 | 字段 | 是否产出 | UI 状态 |
|----------|------|---------|---------|
| `text_delta` | `text` | ✅ | ✅ 正常渲染 |
| `thinking_delta` | `thinking` | ✅ | ⚠️ 内联文本，无独立组件 |
| `tool_call_start` | `call: ToolCall` | ✅ | ✅ ToolCallCard(running) |
| `tool_call_progress` | `callId, message` | ❌ 死代码 | — |
| `tool_call_end` | `result: ToolResult` | ✅ | ✅ ToolCallCard(completed/error) |
| `tool_approval_needed` | `call: ToolCall` | ✅ | ✅ ToolCallCard(pending_approval) + 按钮 |
| `context_compacted` | `summary` | ✅ | ❌ ChatService no-op |
| `subagent_start` | `agentId, task` | ❌ 死代码 | — |
| `subagent_end` | `agentId, summary` | ❌ 死代码 | — |
| `error` | `error: Error` | ✅ | ⚠️ 追加到 content 文本 |
| `done` | `stopReason, usage` | ✅ | ✅ 结束流式 |

---

## 4. Layer 3 — DisplayMessage / DisplayToolCall（Client 层）

> 文件：`ai/agent-client/src/service/chat.service.ts`

### DisplayMessage

```ts
interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;              // 扁平文本（Markdown）
  toolCalls?: DisplayToolCall[];
  isStreaming?: boolean;
  timestamp: number;
}
```

### DisplayToolCall

```ts
interface DisplayToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: ToolResult;          // { callId, output, isError, metadata }
  status: 'running' | 'completed' | 'error' | 'pending_approval';
}
```

### ChatStatus

```ts
type ChatStatus = 'idle' | 'running' | 'waiting_approval' | 'error';
```

---

## 5. Layer 4 — UI 组件类型

> 文件：`packages/ui/src/components/chat/`

### 当前支持的渲染类型

| 消息类型 | 组件 | 渲染方式 | 状态 |
|----------|------|---------|------|
| 用户消息 | `ChatMessage(role='user')` | 全宽 + bg-gray-50 + `›` 前缀 | ✅ 基本完成 |
| 助手消息 | `ChatMessage(role='assistant')` | 无背景 + `•` 前缀 + StreamingText | ✅ 基本完成 |
| 系统消息 | `ChatMessage(role='system')` | 居中灰色小字 | ✅ 完成 |
| 工具调用 | `ToolCallCard` | 树状前缀 + 状态图标 + 折叠 | ✅ 基本完成 |
| 流式指示 | `ChatPanel` 内置 | `● 思考中...` | ✅ 完成 |
| 回合分隔 | `TurnSeparator` | 水平线 | ✅ 完成 |

### 未支持 / 待改进的渲染类型

| 消息类型 | 优先级 | 说明 |
|----------|--------|------|
| **Markdown 渲染** | P0 | 助手消息当前为纯文本，需支持标题、粗体、列表、表格等 |
| **代码块渲染** | P0 | 三反引号代码块当前为纯文本，需暗色背景 + 语法高亮 + 复制按钮 |
| **行内代码** | P0 | 反引号行内代码当前无区分，需灰色背景等宽字体 |
| **思维链/Thinking** | P1 | 当前内联为 `[Thinking]` 文本，需折叠块 + dim italic 样式 |
| **错误消息** | P1 | 当前追加到 content 文本，需红色边框/图标独立样式 |
| **Token 用量** | P2 | lastUsage 已暴露但无 UI，可在回合分隔线或底部显示 |
| **工具调用分组** | P2 | 连续同类工具调用（如多个 Read）应合并为 Exploring 模式 |
| **图片消息** | P3 | ContentBlock 支持 ImageContent 但未传递到 UI |
| **Diff 渲染** | P3 | 工具调用结果可能包含 diff，需专门渲染 |

---

## 6. 渲染改进详细规格

### 6.1 Markdown 渲染（P0）

**当前问题**：助手消息的 `content` 是 Markdown 字符串，但直接用 `whitespace-pre-wrap` 渲染为纯文本。

**目标**：使用 `react-markdown` + `rehype-highlight` 渲染完整 Markdown。

**需要处理的元素**：
- 标题（h1-h6）：`font-semibold`，各级字号
- 段落：`text-sm leading-relaxed`
- 粗体：`font-semibold`
- 斜体：`italic`
- 行内代码：`bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono`
- 代码块：见 6.2
- 有序/无序列表：`list-disc pl-4` / `list-decimal pl-4`
- 链接：`text-blue-500 underline`
- 表格：标准 HTML table
- 分隔线：`border-t border-gray-200`

### 6.2 代码块渲染（P0）

**当前问题**：代码块显示为等宽纯文本，无背景色、无高亮、无复制按钮。

**目标 Codex 风格**：
```
┌────────────────────────────────────┐
│ typescript              [Copy]     │  ← 语言标签 + 复制按钮
│                                    │
│ interface Props {                  │  ← 语法高亮
│   name: string;                    │
│   age?: number;                    │
│ }                                  │
│                                    │
│ export const MyComponent...        │
└────────────────────────────────────┘
```

**样式**：
- 容器：`bg-gray-900 rounded-lg overflow-hidden my-3`
- 头部：`flex justify-between px-4 py-2 bg-gray-800 text-gray-400 text-xs`
- 代码区：`px-4 py-3 overflow-x-auto font-mono text-xs text-gray-100`
- 复制按钮：hover 时显示，`text-gray-400 hover:text-white`

### 6.3 思维链/Thinking（P1）

**当前问题**：`thinking_delta` 被处理为 `\n[Thinking] text\n` 内联到 content。

**目标 Codex 风格**：
```
  • [Thinking]                           ← 折叠头部
    这个需求需要先分析组件结构...        ← dim italic 展开内容
```

**实现方案**：
- 在 `ChatService.handleEvent` 中将 `thinking_delta` 存储到独立的 `thinking` 字段
- UI 中用折叠块渲染，默认折叠，dim italic 样式
- 或：保持当前内联方式，但在 Markdown 渲染中识别 `[Thinking]` 并应用特殊样式

### 6.4 错误消息（P1）

**当前问题**：`error` 事件追加 `Error: message` 到 content 末尾。

**目标 Codex 风格**：
```
  ✗ Error: Connection timeout             ← 红色 ✗ 前缀 + 红色文本
```

**实现方案**：
- 在 `ChatService` 中将 error 存储到独立的 `error` 字段
- UI 中在消息末尾用红色独立行渲染

### 6.5 Token 用量（P2）

**当前状态**：`lastUsage` 在 `useChat()` 中暴露但未渲染。

**目标**：在回合分隔线中显示 token 用量。
```
── prompt: 1.2k · completion: 800 · total: 2.0k ──
```

### 6.6 工具调用分组/Exploring（P2）

**目标**：连续的 Read/ListFiles/Search 调用合并为一行。
```
• Exploring
  └ Read file1.ts, file2.ts
    Search "query" in src/
```

---

## 7. 实施计划

按优先级顺序：

### Phase 1：P0 — Markdown + 代码块（核心渲染能力）
1. 安装 `react-markdown` + `rehype-highlight` + `remark-gfm`
2. 创建 `MarkdownRenderer` 组件
3. 创建 `CodeBlock` 组件（暗色背景 + 复制按钮）
4. 在 `ChatMessage` 助手消息中使用 `MarkdownRenderer` 替代 `StreamingText`
5. 更新 `StreamingText` 以支持流式 Markdown

### Phase 2：P1 — 思维链 + 错误
6. 修改 `DisplayMessage` 添加 `thinking?: string` 和 `error?: string` 字段
7. 修改 `ChatService.handleEvent` 分离 thinking 和 error 到独立字段
8. 创建 `ThinkingBlock` 折叠组件
9. 创建 `ErrorBlock` 错误展示组件
10. 更新 `ChatMessageProps` 和渲染逻辑

### Phase 3：P2 — 高级特性
11. 创建 `TokenUsageDisplay` 组件
12. 在 `TurnSeparator` 中集成 token 用量
13. 实现 Exploring 模式（工具调用分组合并）
