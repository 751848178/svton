# ChatPanel

> 核心聊天面板 — 消息列表 + 输入框 + 工具审批 + 计划进度，整合为完整对话界面

## 效果展示

以下是 ChatPanel 的完整渲染效果，包含思考、工具调用、计划、文件变更等多种块类型：

<Demo name="chat-panel" />

## 快速开始

ChatPanel 内部完成以下工作：

1. 渲染有序消息列表，并在 `user → assistant` 或 `assistant → user` 角色切换时插入 `TurnSeparator`。
2. 当用户消息携带 `usage`（token 用量）时，在分隔线中显示输入/输出 token 数量（如 `1.2k in → 350 out`）。
3. 自动滚动到底部（仅在用户处于底部 120px 阈值内时触发，避免打断用户回看历史）。
4. 消息列表为空时展示 `emptyMessage` 或 `presets`（预设建议卡片）。
5. 内置 `ToolApprovalModal`，当存在 `pending_approval` 状态的工具调用时弹出审批窗。
6. 通过 `activePlan` 显示实时执行计划进度面板。
7. 将所有用户交互（发送、中止、批准/拒绝工具、重试、编辑消息、打开引用文件等）透传给宿主应用。

---

## 类型定义

### ChatPanelMessage

```ts
export interface ChatPanelMessage
  extends Omit<ChatMessageProps, 'onApproveTool' | 'onRejectTool' | 'className'> {
  /** 消息唯一 ID */
  id: string;
  /** 当前轮次的 token 使用情况（仅助手消息） */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
```

### PresetItem

```ts
export interface PresetItem {
  label: string;   // 卡片标题
  prompt: string;  // 点击后填入输入框的提示词
}
```

---

## Props 一览表

| 属性 | 类型 | 必填 | 默认值 | 说明 |
|------|------|:----:|--------|------|
| `messages` | `ChatPanelMessage[]` | 是 | — | 有序消息列表 |
| `onSend` | `(content: string, images?: ImageAttachment[]) => void` | 是 | — | 用户发送消息回调 |
| `onAbort` | `() => void` | 否 | — | 中止当前流式响应 |
| `onApproveTool` | `(callId: string) => void` | 否 | — | 批准工具执行 |
| `onRejectTool` | `(callId: string) => void` | 否 | — | 拒绝工具执行 |
| `onRetry` | `(messageId?: string) => void` | 否 | — | 重试指定消息（或最后一条） |
| `onEditMessage` | `(messageId: string, newContent: string) => void` | 否 | — | 编辑已发送的用户消息 |
| `onOpenEditor` | `(content: string) => void` | 否 | — | 在外部编辑器中打开内容 |
| `onOpenDocument` | `(doc: SplitScreenContent) => void` | 否 | — | 在分屏面板中打开文档 |
| `onOpenReference` | `(path: string, line?: number) => void` | 否 | — | 跳转到文件引用 |
| `onCommand` | `(action: string) => void` | 否 | — | 执行命令块中的操作 |
| `isStreaming` | `boolean` | 否 | `false` | 是否正在流式输出 |
| `disabled` | `boolean` | 否 | `false` | 禁用输入框 |
| `placeholder` | `string` | 否 | — | 输入框占位文字 |
| `emptyMessage` | `React.ReactNode` | 否 | — | 消息列表为空时的自定义提示 |
| `presets` | `PresetItem[]` | 否 | — | 空列表时显示的预设建议卡片 |
| `inputLeadingSlot` | `React.ReactNode` | 否 | — | 输入栏前置插槽（如模型选择器） |
| `inputTrailingSlot` | `React.ReactNode` | 否 | — | 输入栏后置插槽（如附加按钮） |
| `slashCommands` | `SlashCommand[]` | 否 | — | 可用的斜杠命令列表 |
| `mentionItems` | `MentionItem[]` | 否 | — | `@` 提及候选项 |
| `onMentionSelect` | `(item: MentionItem) => string` | 否 | — | 选择提及项时回调，返回要插入的文本 |
| `onFileReference` | `() => void` | 否 | — | 点击"引用文件"时回调 |
| `matchedSkills` | `string[]` | 否 | — | 当前匹配到的技能名称（在状态栏显示） |
| `activePlan` | `PlanInfo \| null` | 否 | — | 当前活动计划，用于显示进度面板 |
| `className` | `string` | 否 | — | 容器额外类名 |

---

## 完整集成示例

以下示例展示如何将 `ChatPanel` 与 `AgentProvider` 配合使用，构建完整的聊天交互流程：

```tsx
import React, { useState, useCallback } from 'react';
import { ChatPanel, type ChatPanelMessage } from '@svton/agent-ui';
import type { SlashCommand, MentionItem } from '@svton/agent-ui';

export default function AgentChatPage() {
  const [messages, setMessages] = useState<ChatPanelMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  // 发送消息
  const handleSend = useCallback(async (content: string) => {
    const userMsg: ChatPanelMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content,
    };
    setMessages(prev => [...prev, userMsg]);
    setIsStreaming(true);

    // 创建助手消息占位（实际应用中由 AgentClient 驱动）
    const assistantId = `a-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
      isStreaming: true,
    }]);

    // ... 调用 agent-client 流式写入 ...
  }, []);

  // 中止流式
  const handleAbort = useCallback(() => {
    setIsStreaming(false);
  }, []);

  // 斜杠命令
  const slashCommands: SlashCommand[] = [
    {
      name: '/clear',
      description: '清空对话历史',
      action: () => setMessages([]),
    },
    {
      name: '/export',
      description: '导出当前会话',
      action: () => console.log('导出会话'),
    },
  ];

  // @ 提及项（文件列表）
  const mentionItems: MentionItem[] = [
    { label: 'src/index.ts', category: 'file', description: '入口文件' },
    { label: 'package.json', category: 'file', description: '项目配置' },
  ];

  return (
    <div className="h-screen flex flex-col">
      <ChatPanel
        messages={messages}
        onSend={handleSend}
        onAbort={handleAbort}
        isStreaming={isStreaming}
        placeholder="输入消息，/ 查看命令，@ 引用文件…"
        slashCommands={slashCommands}
        mentionItems={mentionItems}
        onMentionSelect={(item) => `@${item.label}`}
        onFileReference={() => {
          // 打开文件选择器
          console.log('打开文件选择器');
        }}
        onApproveTool={(callId) => {
          console.log('批准工具调用', callId);
        }}
        onRejectTool={(callId) => {
          console.log('拒绝工具调用', callId);
        }}
        onRetry={(messageId) => {
          console.log('重试消息', messageId);
        }}
        onEditMessage={(messageId, newContent) => {
          setMessages(prev => prev.map(m =>
            m.id === messageId ? { ...m, content: newContent } : m
          ));
        }}
        presets={[
          { label: '解释这段代码', prompt: '请解释以下代码的功能：' },
          { label: '修复 Bug', prompt: '帮我排查以下错误：' },
          { label: '编写测试', prompt: '为以下函数编写单元测试：' },
        ]}
        inputLeadingSlot={
          <span className="text-xs text-gray-500">GPT-4o</span>
        }
      />
    </div>
  );
}
```

---

## 回合分隔线与 Token 显示

ChatPanel 在角色切换时自动插入 `TurnSeparator` 组件。当消息携带 `usage` 字段时，分隔线会显示 token 统计：

```ts
// 内部逻辑
function isTurnBoundary(prev: ChatPanelMessage, curr: ChatPanelMessage): boolean {
  if (curr.role === 'system') return false;
  if (prev.role === 'system') return false;
  return prev.role !== curr.role;
}

// 格式化 token 用量
function formatUsage(usage) {
  if (!usage || usage.totalTokens === 0) return undefined;
  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
  return `${fmt(usage.promptTokens)} in → ${fmt(usage.completionTokens)} out`;
}
```

---

## 自动滚动行为

组件内置智能滚动控制：

- **阈值**：`SCROLL_THRESHOLD = 120px`
- 当用户滚动位置距底部小于 120px 时，新消息到达会自动滚动到底部。
- 当用户正在查看历史消息（距底部超过 120px）时，不会自动滚动，避免打断阅读。
- 流式输出期间持续跟随滚动。

---

## 与 AgentProvider 配合

在生产环境中，推荐使用 `AgentProvider` 包裹 `ChatPanel`，由 Provider 负责管理消息状态、流式输出和工具调用生命周期：

```tsx
import { AgentProvider, useAgent, ChatPanel } from '@svton/agent-ui';

function ChatInner() {
  const { messages, sendMessage, abort, isStreaming } = useAgent();
  return (
    <ChatPanel
      messages={messages}
      onSend={sendMessage}
      onAbort={abort}
      isStreaming={isStreaming}
    />
  );
}

export default function App() {
  return (
    <AgentProvider config={{ apiKey: '...', model: 'gpt-4o' }}>
      <ChatInner />
    </AgentProvider>
  );
}
```

---

## 相关组件

- [ChatMessage](./chat-message.md) — 单条消息渲染
- [ChatInput](./chat-input.md) — 输入框组件
- [ToolCallCard](./tool-call-card.md) — 工具调用卡片
- [SettingsView](./settings.md) — 设置面板
