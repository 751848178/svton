# ChatMessage 消息组件

`ChatMessage` 负责渲染单条聊天消息，支持用户、助手和系统三种角色。组件采用 Codex 风格的结构化布局（无气泡框），核心特性是 **有序内容块（ContentBlock）** 渲染机制 —— 将思考过程、工具调用、文本回复、文件变更等内容按执行顺序交错展示。


---

## 概述

ChatMessage 的渲染逻辑围绕 `blocks`（有序内容块）展开。当 `blocks` 存在时，组件按数组顺序逐个渲染每种类型的块；当 `blocks` 不存在时，回退到 `content` + `thinking` + `toolCalls` 的传统字段渲染模式。

系统消息（`role === 'system'`）有独立的渲染分支：`context_compacted` 类型显示为居中分隔线，普通系统消息以小号灰字居中显示。

---

## ContentBlock 类型

`ContentBlock` 定义了 19 种有序内容块类型，每种对应一个专用的渲染子组件：

```ts
export interface ContentBlock {
  type:
    | 'thinking'            // 思考过程（推理文本）
    | 'tool_call'           // 工具调用卡片
    | 'text'                // 文本/Markdown 输出
    | 'error'               // 错误信息
    | 'plan'                // 执行计划
    | 'file_change'         // 文件变更（Diff）
    | 'subagent'            // 子 Agent 调用
    | 'warning'             // 警告提示
    | 'reference'           // 文件/代码引用
    | 'web_search'          // 网页搜索结果
    | 'progress'            // 进度条
    | 'turn_diff'           // 本轮 Diff 汇总
    | 'command'             // 可执行命令块
    | 'file_tree'           // 文件树展示
    | 'redacted_thinking'   // 被隐藏的思考（安全原因）
    | 'image_generated'     // 生成的图片
    | 'code_review'         // 代码审查结果
    | 'csv_fanout'          // CSV 批量处理
    | 'auto_review';        // 自动审核

  // 通用字段
  text?: string;            // thinking/text/error 的内容
  call?: ToolCallInfo;      // tool_call 块的工具调用信息
  plan?: PlanInfo;          // plan 块的计划信息
  changes?: FileChangeEntry[]; // file_change 块的变更条目
  agentId?: string;         // subagent 块的子 Agent ID
  task?: string;            // subagent 块的任务描述
  status?: string;          // subagent/progress 块的状态
  summary?: string;         // 进度摘要文本
  source?: string;          // 数据来源标识

  // 引用与搜索
  refs?: ReferenceEntry[];  // reference 块的引用条目
  query?: string;           // web_search 块的搜索关键词
  results?: SearchResultEntry[]; // web_search 块的搜索结果

  // 命令与文件树
  label?: string;           // 命令块标签
  action?: string;          // 命令块操作标识
  icon?: string;            // 图标名称
  tree?: FileTreeNode[];    // file_tree 块的节点
  reason?: string;          // redacted_thinking 块的原因

  // 特性专用字段
  images?: GeneratedImage[];     // image_generated 块
  model?: string;                // 模型名称
  findings?: ReviewFinding[];    // code_review 块
  totalRows?: number;            // csv_fanout 块：总行数
  succeeded?: number;            // csv_fanout 块：成功数
  failed?: number;               // csv_fanout 块：失败数
  rows?: Array<{                 // csv_fanout 块：行级结果
    rowIndex: number;
    status: string;
    rowData: Record<string, string>;
    summary?: string;
  }>;
  verdict?: string;              // auto_review 块：审核结论
  ruleId?: string;               // auto_review 块：规则 ID
  toolName?: string;             // auto_review 块：关联工具
}
```

---

## ChatMessageProps

```ts
export interface ChatMessageProps {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinking?: string;
  error?: string;
  images?: Array<{ data: string; mimeType?: string }>;
  toolCalls?: ToolCallInfo[];
  /** 有序内容块（交错渲染模式） */
  blocks?: ContentBlock[];
  isStreaming?: boolean;
  /** 是否为列表中的最后一条消息 */
  isLast?: boolean;
  /** 系统通知子类型 */
  systemType?: 'default' | 'context_compacted';
  /** 已完成的助手轮次耗时（毫秒） */
  duration?: number;
  onApproveTool?: (callId: string) => void;
  onRejectTool?: (callId: string) => void;
  onRetry?: (messageId?: string) => void;
  onEdit?: (messageId: string, newContent: string) => void;
  onOpenEditor?: (content: string) => void;
  onOpenDocument?: (doc: SplitScreenContent) => void;
  onOpenReference?: (path: string, line?: number) => void;
  onCommand?: (action: string) => void;
  className?: string;
}
```

---

## isProcessBlock 逻辑

"过程块"（Process Block）是指助手在执行任务过程中产生的中间内容，包括 `thinking`、`tool_call`、`progress`、`subagent`、`command`、`file_tree`、`redacted_thinking` 等类型。这些块在流式输出期间默认展开，流式结束后自动折叠为"已处理"区域。

判断逻辑：

```ts
function isProcessBlock(block: ContentBlock): boolean {
  return [
    'thinking',
    'tool_call',
    'progress',
    'subagent',
    'command',
    'file_tree',
    'redacted_thinking',
  ].includes(block.type);
}
```

---

## "已处理"折叠行为

当一条助手消息包含多个过程块时，组件将它们包裹在一个可折叠的容器中：

| 状态 | 行为 |
|------|------|
| **流式中** (`isStreaming === true`) | 过程块默认展开，实时展示执行进度 |
| **流式结束** | 自动折叠为"已处理 N 个步骤"，点击可重新展开 |
| **非流式历史消息** | 默认折叠，用户可手动展开查看 |

折叠区域显示摘要文字（如"已处理 3 个步骤"），并附带展开/折叠箭头图标。

折叠状态通过内部 `processExpanded` state 管理：

```ts
// 初始化：流式状态下默认展开
const [processExpanded, setProcessExpanded] = useState(() => isStreaming === true);

// 流式结束时自动折叠
const prevStreamingRef = useRef(isStreaming);
useEffect(() => {
  if (prevStreamingRef.current && !isStreaming) {
    setProcessExpanded(false); // 从流中 → 流式结束：自动折叠
  }
  prevStreamingRef.current = isStreaming;
}, [isStreaming]);
```

---

## 块渲染顺序

当 `blocks` 存在时，ChatMessage 按数组顺序渲染每个块。以下是一个典型的助手回复渲染流程：

```
1. [thinking]    "我需要先读取文件内容..."
2. [tool_call]   Read('src/index.ts')
3. [tool_call]   Read('package.json')
4. [text]        "根据分析，建议进行以下修改..."
5. [file_change] src/index.ts (+12 -3)
6. [text]        "以上修改已经应用到文件中。"
```

渲染时，过程块（1-3）被折叠到"已处理"区域，文本块（4、6）正常展示，文件变更块（5）以 Diff 视图展示。

---

## 代码示例：包含所有块类型

```tsx
import React from 'react';
import { ChatMessage } from '@svton/agent-ui';
import type { ContentBlock } from '@svton/agent-ui';

const blocks: ContentBlock[] = [
  {
    type: 'thinking',
    text: '用户要求重构这个函数。我需要先理解当前实现，然后提取公共逻辑。',
  },
  {
    type: 'tool_call',
    call: {
      id: 'call-1',
      name: 'bash',
      arguments: { command: 'cat src/utils.ts' },
      status: 'completed',
      result: { output: 'export function formatDate(...)' },
    },
  },
  {
    type: 'plan',
    plan: {
      steps: [
        { text: '提取日期格式化逻辑', status: 'completed' },
        { text: '创建新的工具模块', status: 'in_progress' },
        { text: '更新所有引用', status: 'pending' },
      ],
    },
  },
  {
    type: 'text',
    text: '我已开始按照计划执行重构。当前正在创建新的工具模块。',
  },
  {
    type: 'file_change',
    changes: [
      {
        path: 'src/utils.ts',
        status: 'modified',
        additions: 15,
        deletions: 8,
        diff: '@@ -1,5 +1,12 @@\n export function formatDate(...)',
      },
    ],
  },
  {
    type: 'reference',
    refs: [
      { path: 'src/utils.ts', line: 42, label: 'formatDate 函数定义' },
    ],
  },
  {
    type: 'warning',
    text: '检测到 3 处其他文件仍在使用旧的函数签名，需要同步更新。',
  },
  {
    type: 'text',
    text: '重构已完成。所有引用已更新，测试通过。',
  },
];

export function MessageExample() {
  return (
    <ChatMessage
      id="msg-demo"
      role="assistant"
      content=""
      blocks={blocks}
      isStreaming={false}
      duration={12500}
      onOpenReference={(path, line) => {
        console.log(`打开 ${path}:${line}`);
      }}
    />
  );
}
```

---

## 系统消息渲染

系统消息有两种渲染模式：

```tsx
// 1. 上下文压缩通知
<ChatMessage
  id="sys-1"
  role="system"
  content=""
  systemType="context_compacted"
/>
// 渲染为：── 上下文已压缩 ──

// 2. 普通系统通知
<ChatMessage
  id="sys-2"
  role="system"
  content="会话已保存到检查点"
/>
// 渲染为居中的小号灰字
```

---

## 相关组件

- [ChatPanel](./chat-panel.md) — 聊天面板容器
- [ToolCallCard](./tool-call-card.md) — 工具调用卡片（`tool_call` 块使用）
- [ChatInput](./chat-input.md) — 输入框组件
