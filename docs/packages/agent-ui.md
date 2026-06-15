# @svton/agent-ui

Svton Agent 的 React 组件库 — 提供完整的聊天 UI、15 种消息块类型、设置面板和插件管理界面。

## 安装

```bash
pnpm add @svton/agent-ui @svton/agent-client @svton/ui
```

## 核心组件

### ChatPanel — 完整聊天面板

集成消息列表、输入框、工具审批、计划进度于一体的顶层组件。

```tsx
import { ChatPanel, type ChatPanelMessage } from '@svton/agent-ui';

function App() {
  const messages: ChatPanelMessage[] = [
    { id: '1', role: 'user', content: '帮我查看项目结构' },
    { id: '2', role: 'assistant', content: '好的，让我来查看...', blocks: [
      { type: 'text', text: '项目使用了 monorepo 架构。' }
    ]},
  ];

  return (
    <ChatPanel
      messages={messages}
      onSend={(text, images) => console.log('send:', text)}
      onAbort={() => console.log('abort')}
      onApproveTool={(callId) => console.log('approve:', callId)}
      onRejectTool={(callId) => console.log('reject:', callId)}
      isStreaming={false}
      placeholder="描述你想做的事情..."
    />
  );
}
```

#### Props

| Prop | 类型 | 说明 |
|------|------|------|
| `messages` | `ChatPanelMessage[]` | 消息列表 |
| `onSend` | `(text: string, images?) => void` | 发送消息回调 |
| `onAbort` | `() => void` | 中止流式输出 |
| `onApproveTool` | `(callId: string) => void` | 批准工具调用 |
| `onRejectTool` | `(callId: string) => void` | 拒绝工具调用 |
| `onRetry` | `(messageId?) => void` | 重试消息 |
| `onEditMessage` | `(messageId, newContent) => void` | 编辑消息 |
| `onOpenReference` | `(path: string, line?: number) => void` | 打开文件引用 |
| `onCommand` | `(action: string) => void` | 执行命令块操作 |
| `isStreaming` | `boolean` | 是否正在流式输出 |
| `slashCommands` | `SlashCommand[]` | 斜杠命令列表 |
| `mentionItems` | `MentionItem[]` | @提及候选项 |
| `activePlan` | `PlanInfo \| null` | 活跃计划（显示进度条） |

### ChatMessage — 单条消息渲染

支持 19 种 ContentBlock 类型的结构化渲染。

```tsx
import { ChatMessage, type ContentBlock } from '@svton/agent-ui';

const blocks: ContentBlock[] = [
  { type: 'thinking', text: '让我分析一下...' },
  { type: 'tool_call', call: { id: '1', name: 'file_read', arguments: { path: 'src/index.ts' }, status: 'completed' } },
  { type: 'plan', plan: { planId: 'p1', title: '实施计划', steps: [
    { id: 's1', title: '分析代码', status: 'completed' },
    { id: 's2', title: '编写测试', status: 'in_progress' },
  ]}},
  { type: 'text', text: '这是最终结论。' },
];

<ChatMessage
  id="msg1"
  role="assistant"
  content=""
  blocks={blocks}
  isStreaming={false}
/>
```

## 19 种 ContentBlock 类型

所有非 `text` 类型自动折叠到「已处理」中，只保留最终文本结论可见。

### 基础类型（4 种）

| 类型 | 组件 | 说明 |
|------|------|------|
| `thinking` | ThinkingBlock | AI 思考过程（可折叠） |
| `tool_call` | ToolCallCard | 工具调用卡片（支持 shell/file-edit/computer-use 分类） |
| `text` | MarkdownRenderer | 文本/Markdown 渲染（最后一条为结论） |
| `error` | inline | 红色错误提示 |

### 高级类型（11 种）

| 类型 | 组件 | Props | 说明 |
|------|------|-------|------|
| `plan` | PlanBlockView | `plan: PlanInfo` | 计划进度（步骤列表 + 进度条） |
| `file_change` | FileChangeView | `changes: FileChangeEntry[]` | 文件变更（diff 展开） |
| `subagent` | SubagentBlockView | `agentId, task, status, summary?` | 子代理委派 |
| `warning` | WarningBlockView | `text, source?` | 非致命警告（黄色） |
| `reference` | ReferenceBlockView | `refs: ReferenceEntry[]` | 文件/符号引用卡 |
| `web_search` | WebSearchBlockView | `query, results: SearchResultEntry[]` | 搜索结果 |
| `progress` | ProgressBlockView | `text, status` | 瞬时进度指示器 |
| `turn_diff` | TurnDiffView | `changes: FileChange[]` | 一轮对话聚合 diff |
| `command` | CommandBlockView | `label, action, icon?` | 可操作按钮 |
| `file_tree` | FileTreeBlockView | `tree: FileTreeNode[]` | 目录树 |
| `redacted_thinking` | RedactedThinkingView | `reason?` | 隐藏的思考内容 |

### 扩展类型（4 种）

| 类型 | 组件 | 说明 |
|------|------|------|
| `image_generated` | ImageResultBlock | AI 生成图片展示 |
| `code_review` | CodeReviewBlock | 代码审查发现 |
| `csv_fanout` | CsvFanoutBlock | CSV 批量执行结果 |
| `auto_review` | inline | 自动审核判定（approve/deny/ask_user） |

## 块组件单独使用

每个块组件都是独立的，可以单独导入使用：

```tsx
import {
  PlanBlockView,
  FileChangeView,
  WebSearchBlockView,
  ProgressBlockView,
} from '@svton/agent-ui';

// 计划进度
<PlanBlockView plan={{
  planId: 'p1',
  title: '用户认证实施',
  steps: [
    { id: 's1', title: '分析需求', status: 'completed' },
    { id: 's2', title: '编写代码', status: 'in_progress' },
    { id: 's3', title: '测试验证', status: 'pending' },
  ],
}} />

// 文件变更
<FileChangeView changes={[
  { path: 'src/auth.ts', changeType: 'create', diff: '+++ src/auth.ts\n+export function login() {}' },
  { path: 'src/config.ts', changeType: 'modify' },
]} />

// 搜索结果
<WebSearchBlockView
  query="Tauri 2 tutorial"
  results={[
    { title: 'Tauri Docs', url: 'https://tauri.app', snippet: 'Official docs' },
  ]}
/>

// 进度指示
<ProgressBlockView text="正在搜索代码库..." status="running" />
<ProgressBlockView text="搜索完成" status="done" />
```

## 设置面板

### SettingsView — 完整设置界面

```tsx
import { SettingsView, type ISettingsAdapter } from '@svton/agent-ui';

// 实现 ISettingsAdapter 接口
const adapter: ISettingsAdapter = {
  getProviders() { return [...]; },
  getDefaultModel() { return 'gpt-4o'; },
  getAgentData() { return { tools: [...], skills: [...], hasMemory: true, ... }; },
  getPermissionMode() { return 'default'; },
  // ... 其他方法
};

<SettingsView adapter={adapter} onBack={() => navigate('/chat')} />
```

#### 设置 Section（15 个）

| Section | 说明 |
|---------|------|
| `general` | 常规设置（工作目录、模型选择） |
| `providers` | AI 提供商配置（API Key、模型列表） |
| `personalization` | 个性化指令 |
| `tools` | 工具开关 |
| `skills` | 技能 CRUD |
| `marketplace` | 技能市场（skills.sh） |
| `mcp` | MCP 服务器管理 + Smithery 市场 |
| `integrations` | 第三方集成（Slack/Linear） |
| `permissions` | 权限模式选择 |
| `preview` | 文档预览模式 |
| `memory` | 记忆管理 |
| `automation` | 自动化（规划/子代理/Hooks/检查点） |
| `sandbox` | 沙箱配置 |
| `auto_reviewer` | 自动审核规则 |

### ISettingsAdapter 接口

```typescript
interface ISettingsAdapter {
  // 核心
  getProviders(): ProviderInfo[];
  saveProviders(providers: ProviderInfo[]): void;
  getDefaultModel(): string;
  getAgentData(): AgentData | null;

  // 工具和技能
  getDisabledTools(): string[];
  saveDisabledTools(names: string[]): void;
  getDisabledSkills(): string[];
  saveDisabledSkills(names: string[]): void;

  // 记忆
  addMemory(text: string): void;
  clearMemory(): void;

  // 沙箱和审核
  getSandboxConfig?(): { enabled: boolean; mode: string };
  getAutoReviewerConfig?(): { mode: string; rules: ReviewRule[] };

  // 集成
  getIntegrations?(): IntegrationCardData[];
  toggleIntegration?(id: string, enabled: boolean): void;

  // Hooks 和检查点
  getHooks?(): Array<{ event: string; id: string; priority: number }>;
  listCheckpoints?(): Promise<CheckpointMeta[]>;

  // MCP
  getMcpServerConfigs?(): McpServerConfig[];
  addMcpServer?(config: McpServerConfig): void;

  // 技能市场
  browseMarketplace?(options?): Promise<{ skills: MarketplaceSkill[]; total: number }>;
  installFromMarketplace?(skillId: string): Promise<{ success: boolean }>;
}
```

## ChatInput — 消息输入框

```tsx
import { ChatInput, type SlashCommand, type MentionItem } from '@svton/agent-ui';

const slashCommands: SlashCommand[] = [
  { name: 'help', description: '显示帮助', action: () => console.log('help') },
  { name: 'agent', description: '切换 Agent', action: () => console.log('switch') },
];

const mentions: MentionItem[] = [
  { label: 'file_read', description: '读取文件', category: 'tool', icon: '⚙' },
  { label: 'src/index.ts', description: '文件', category: 'file', icon: '📄' },
];

<ChatInput
  onSend={(text) => console.log(text)}
  slashCommands={slashCommands}
  mentionItems={mentions}
  onMentionSelect={(item) => `@${item.label}`}
  placeholder="描述你想做的事情..."
/>
```

## ToolCallCard — 工具调用卡片

```tsx
import { ToolCallCard, type ToolCallInfo } from '@svton/agent-ui';

const toolCall: ToolCallInfo = {
  id: 'tc1',
  name: 'bash',
  arguments: { command: 'ls -la src/' },
  result: { output: 'total 24\ndrwxr-xr-x  5 user  staff  160 Jan  1 12:00 .\n-rw-r--r--  1 user  staff  200 Jan  1 12:00 index.ts' },
  status: 'completed',
};

<ToolCallCard toolCall={toolCall} defaultCollapsed={true} />
```

### 工具分类（自动识别）

| 分类 | 工具名 | 渲染样式 |
|------|--------|----------|
| Shell | bash, shell, exec | `$ command` 行内显示 |
| File Edit | file_edit, write_file | 文件路径 + DiffView |
| Computer Use | screenshot, mouse_*, keyboard_* | 蓝色高亮 |
| Screenshot | screenshot, chrome_screenshot | 图片缩略图 |
| 其他 | — | 通用卡片 |

## i18n 国际化

组件库内置中英文翻译，通过 `t()` 函数访问：

```typescript
import { t } from '@svton/ui';

t('chat.send')        // 发送 / Send
t('tool.allow')       // 允许 / Allow
t('tool.deny')        // 拒绝 / Deny
t('block.plan.title') // 执行计划 / Execution Plan
```

### 添加自定义翻译

```typescript
// packages/ui/src/i18n/index.ts
const zh = {
  'myapp.title': '我的应用',
  // ...
};
```

## 完整集成示例

```tsx
import { AgentProvider, useChat, useSession } from '@svton/agent-client';
import { ChatPanel, SettingsView, type ChatPanelMessage } from '@svton/agent-ui';

function ChatApp() {
  const { messages, isStreaming, send, abort } = useChat();
  const { sessions, create, switchTo } = useSession();

  const panelMessages: ChatPanelMessage[] = messages.map(m => ({
    ...m,
    usage: m.usage,
  }));

  return (
    <div className="flex h-screen">
      <aside>
        {sessions.map(s => (
          <button key={s.id} onClick={() => switchTo(s.id)}>{s.title}</button>
        ))}
        <button onClick={() => create()}>新对话</button>
      </aside>
      <main className="flex-1">
        <ChatPanel
          messages={panelMessages}
          onSend={send}
          onAbort={abort}
          isStreaming={isStreaming}
        />
      </main>
    </div>
  );
}

// 使用 AgentProvider 包裹
function App({ agentConfig }) {
  return (
    <AgentProvider config={agentConfig} platform={platform}>
      <ChatApp />
    </AgentProvider>
  );
}
```

## 导出列表

```typescript
// 聊天组件
export { ChatPanel, ChatMessage, ChatInput, ToolCallCard, ToolApprovalModal };
export { StreamingText, MarkdownRenderer, CodeBlock, DiffView, DocumentCard };
export { PlanPanel, TurnSeparator, ExportManager };

// 块组件（19 种）
export { PlanBlockView, FileChangeView, SubagentBlockView, WarningBlockView };
export { ReferenceBlockView, WebSearchBlockView, ProgressBlockView, TurnDiffView };
export { CommandBlockView, FileTreeBlockView, RedactedThinkingView };
export { CodeReviewBlock, ImageResultBlock, CsvFanoutBlock };
export { AgentPicker, ReasoningEffortSelector, ScreenshotView };

// 设置组件
export { SettingsView, AgentEditorPanel, AutoReviewerSettings };
export { IntegrationsPanel, SandboxSettings };

// 类型
export type { ChatPanelProps, ChatPanelMessage, ChatMessageProps, ContentBlock };
export type { ISettingsAdapter, ToolCallInfo, MentionItem, SlashCommand };
export type { PlanInfo, FileChangeEntry, ReferenceEntry, SearchResultEntry, FileTreeNode };
```
