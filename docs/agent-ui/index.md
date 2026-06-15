# @svton/agent-ui

> Svton Agent 的 React 组件库 — 聊天界面、19 种消息块、设置面板和工具管理

## 安装

## 安装

```bash
pnpm add @svton/agent-ui @svton/ui
```

## 组件分类

### 聊天核心（6 个）

| 组件 | 说明 |
|------|------|
| [ChatPanel](./chat-panel) | 完整聊天面板（消息+输入+审批+计划） |
| [ChatMessage](./chat-message) | 单条消息渲染（19 种 ContentBlock） |
| [ChatInput](./chat-input) | 消息输入框（斜杠命令+@提及） |
| [ToolCallCard](./tool-call-card) | 工具调用卡片 |
| [ToolApprovalModal](./blocks/tool-call) | 工具审批弹窗 |
| [PlanPanel](./blocks/plan) | 计划进度浮动面板 |

### 消息块组件（19 种）

每个块类型有独立文档页面和可交互 Demo。

#### 基础块（4 种）
- `thinking` — 思考过程
- `tool_call` — 工具调用
- `text` — 文本/Markdown
- `error` — 错误信息

#### 高级块（11 种）

| 组件 | Demo | 说明 |
|------|------|------|
| [PlanBlockView](./blocks/plan) | ✅ | 计划进度（步骤+进度条） |
| [FileChangeView](./blocks/file-change) | ✅ | 文件变更（diff 展开） |
| [SubagentBlockView](./blocks/subagent) | ✅ | 子代理委派 |
| [WarningBlockView](./blocks/warning) | ✅ | 非致命警告 |
| [ReferenceBlockView](./blocks/reference) | ✅ | 文件/符号引用 |
| [WebSearchBlockView](./blocks/web-search) | ✅ | 搜索结果 |
| [ProgressBlockView](./blocks/progress) | ✅ | 瞬时进度指示 |
| [TurnDiffView](./blocks/turn-diff) | ✅ | 一轮对话聚合 diff |
| [CommandBlockView](./blocks/command) | ✅ | 可操作按钮 |
| [FileTreeBlockView](./blocks/file-tree) | ✅ | 目录树 |
| [RedactedThinkingView](./blocks/redacted-thinking) | ✅ | 隐藏的思考内容 |

#### 辅助组件（4 种）
- [DiffView](./blocks/diff-view) | ✅ | Diff 渲染
- [CodeBlock](./blocks/code-block) | ✅ | 代码块
- `TurnSeparator` — 对话轮次分隔符
- `MarkdownRenderer` — Markdown 渲染

### 设置面板

| 组件 | 说明 |
|------|------|
| [SettingsView](./settings) | 完整设置界面（15 个 Section） |
| `AgentEditorPanel` | Agent 定义编辑器 |
| `AutoReviewerSettings` | 自动审核设置 |
| `IntegrationsPanel` | 第三方集成面板 |
| `SandboxSettings` | 沙箱设置 |

### 新功能组件

| 组件 | 说明 |
|------|------|
| `AgentPicker` | Agent 选择器 |
| `ReasoningEffortSelector` | 推理强度选择器 |
| `CodeReviewBlock` | 代码审查结果 |
| `ImageResultBlock` | AI 生成图片 |
| `CsvFanoutBlock` | CSV 批量执行结果 |

## 快速开始

```tsx
import { ChatPanel } from '@svton/agent-ui';

function App() {
  return (
    <ChatPanel
      messages={messages}
      onSend={(text) => console.log(text)}
      isStreaming={false}
    />
  );
}
```

## i18n

组件库内置中英文翻译：

```typescript
import { t } from '@svton/ui';

t('chat.send')        // 发送 / Send
t('block.plan.title') // 执行计划 / Execution Plan
```
