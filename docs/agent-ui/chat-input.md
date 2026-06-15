# ChatInput 输入框组件

`ChatInput` 是 Codex 风格的圆角卡片式聊天输入组件，集成斜杠命令（Slash Command）自动补全、`@` 提及弹窗、文件引用、图片附件等功能。组件设计为自包含的单体输入卡片，前后插槽（`leadingSlot` / `trailingSlot`）可嵌入模型选择器、模式切换等自定义控件。

> 源码位置：`packages/agent-ui/src/components/chat/ChatInput.tsx`

---

## 概述

ChatInput 的核心交互特性：

- **斜杠命令**：输入 `/` 触发命令列表，支持模糊搜索和键盘导航。
- **@ 提及**：输入 `@` 触发两层弹窗 —— 第一层为分类列表（文件/文件夹/工具/技能），第二层为选中分类下的具体条目。
- **文件引用**：通过 `onFileReference` 回调打开宿主应用的文件选择器，选择后插入引用标记。
- **图片附件**：支持粘贴或拖拽图片作为消息附件。
- **流式中状态**：当 `isStreaming` 为 `true` 时，发送按钮变为停止按钮，触发 `onAbort`。
- **多行文本**：支持 Shift+Enter 换行，Enter 发送。

---

## 类型定义

### SlashCommand

```ts
export interface SlashCommand {
  /** 命令名称，如 "/clear"、"/export" */
  name: string;
  /** 简短描述，显示在补全列表中 */
  description: string;
  /** 执行命令的回调函数 */
  action: () => void;
}
```

### MentionItem

```ts
export interface MentionItem {
  /** 显示标签，如 "src/index.ts" */
  label: string;
  /** 可选描述 */
  description?: string;
  /** 可选图标 */
  icon?: React.ReactNode;
  /** 分类，用于弹窗中的分组 */
  category?: 'file' | 'folder' | 'tool' | 'skill';
}
```

### ImageAttachment

```ts
export interface ImageAttachment {
  /** Base64 编码的图片数据 */
  data: string;
  /** MIME 类型，如 "image/png" */
  mimeType: string;
}
```

---

## ChatInputProps

```ts
export interface ChatInputProps {
  onSend: (content: string, images?: ImageAttachment[]) => void;
  onAbort?: () => void;
  isStreaming?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** 底部栏前置内容（如模型选择器、模式控制） */
  leadingSlot?: React.ReactNode;
  /** 发送按钮后的额外操作按钮 */
  trailingSlot?: React.ReactNode;
  /** 可用的斜杠命令 */
  slashCommands?: SlashCommand[];
  /** @ 提及候选项 */
  mentionItems?: MentionItem[];
  /** 选择提及项时的回调，返回要插入输入框的文本 */
  onMentionSelect?: (item: MentionItem) => string;
  /** 点击"引用文件"时的回调 */
  onFileReference?: () => void;
  className?: string;
}
```

---

## Props 一览表

| 属性 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `onSend` | `(content: string, images?: ImageAttachment[]) => void` | 是 | 发送消息回调 |
| `onAbort` | `() => void` | 否 | 中止流式响应 |
| `isStreaming` | `boolean` | 否 | 是否正在流式输出（影响发送/停止按钮） |
| `disabled` | `boolean` | 否 | 禁用整个输入框 |
| `placeholder` | `string` | 否 | 占位提示文字 |
| `leadingSlot` | `React.ReactNode` | 否 | 底部栏前置插槽 |
| `trailingSlot` | `React.ReactNode` | 否 | 底部栏后置插槽 |
| `slashCommands` | `SlashCommand[]` | 否 | 斜杠命令列表 |
| `mentionItems` | `MentionItem[]` | 否 | `@` 提及候选项 |
| `onMentionSelect` | `(item: MentionItem) => string` | 否 | 提及选择回调 |
| `onFileReference` | `() => void` | 否 | 文件引用回调 |
| `className` | `string` | 否 | 额外类名 |

---

## 两层 @mention 弹窗机制

当用户输入 `@` 时，ChatInput 会弹出两层选择器：

### 第一层：分类选择

显示所有提及项按 `category` 分组后的分类列表：

```
┌─────────────────────┐
│  📁 文件 (5)         │
│  📁 文件夹 (2)       │
│  🔧 工具 (3)         │
│  ⭐ 技能 (4)         │
└─────────────────────┘
```

### 第二层：具体条目

选中某个分类后，展开该分类下的所有 MentionItem：

```
┌──────────────────────────────┐
│  📁 src/index.ts              │
│     入口文件                   │
│  📁 src/utils/format.ts       │
│     格式化工具                 │
│  📁 package.json              │
│     项目配置                   │
└──────────────────────────────┘
```

选中条目后，调用 `onMentionSelect(item)` 获取要插入的文本（如 `@src/index.ts`），并替换输入框中的 `@` 触发字符。

### 键盘导航

- `↑` / `↓`：在列表中移动选中项
- `Enter`：确认选择
- `Escape`：关闭弹窗
- 继续输入可实时过滤候选项

---

## 文件引用流程

除了 `@` 提及外，ChatInput 还提供专门的"引用文件"入口：

1. 用户点击输入栏中的附件按钮。
2. 触发 `onFileReference()` 回调。
3. 宿主应用打开文件选择器（如 Tauri 的 `dialog.open()` 或 Web 的 `<input type="file">`）。
4. 用户选择文件后，宿主应用更新 `mentionItems` 或直接调用内部方法插入引用标记。

```ts
// 宿主应用实现示例
const handleFileReference = useCallback(async () => {
  const selected = await openFilePicker();
  if (selected) {
    // 方式一：更新 mentionItems 列表
    setMentionItems(prev => [...prev, {
      label: selected.path,
      category: 'file',
      description: selected.summary,
    }]);
    // 方式二：直接插入引用文本（需通过 ref 调用）
  }
}, []);
```

---

## 代码示例

### 基础用法

```tsx
import React, { useState } from 'react';
import { ChatInput } from '@svton/agent-ui';
import type { SlashCommand, MentionItem } from '@svton/agent-ui';

export function BasicInput() {
  const [isStreaming, setIsStreaming] = useState(false);

  const slashCommands: SlashCommand[] = [
    {
      name: '/clear',
      description: '清空对话',
      action: () => console.log('清空'),
    },
    {
      name: '/help',
      description: '显示帮助',
      action: () => console.log('帮助'),
    },
  ];

  const mentionItems: MentionItem[] = [
    { label: 'src/index.ts', category: 'file', description: '入口' },
    { label: 'README.md', category: 'file', description: '说明文档' },
  ];

  return (
    <ChatInput
      onSend={(content, images) => {
        console.log('发送:', content, images);
        setIsStreaming(true);
      }}
      onAbort={() => setIsStreaming(false)}
      isStreaming={isStreaming}
      placeholder="输入消息…"
      slashCommands={slashCommands}
      mentionItems={mentionItems}
      onMentionSelect={(item) => `@[${item.label}]`}
      onFileReference={() => console.log('选择文件')}
    />
  );
}
```

### 带自定义插槽

```tsx
<ChatInput
  onSend={handleSend}
  leadingSlot={
    <div className="flex items-center gap-2">
      <ModelSelector
        value={model}
        onChange={setModel}
      />
      <ModeToggle mode={mode} onChange={setMode} />
    </div>
  }
  trailingSlot={
    <button
      onClick={() => setShowHistory(true)}
      className="p-1.5 rounded hover:bg-white/5"
    >
      <HistoryIcon />
    </button>
  }
  slashCommands={commands}
  mentionItems={fileList}
  onMentionSelect={(item) => `@${item.label}`}
  onFileReference={openFilePicker}
/>
```

### 图片附件

```tsx
const handleSend = (content: string, images?: ImageAttachment[]) => {
  if (images && images.length > 0) {
    // 处理图片附件
    images.forEach(img => {
      console.log(`图片: ${img.mimeType}, 大小: ${img.data.length} bytes`);
    });
  }
  // 发送到 Agent
  agentClient.send(content, images);
};
```

---

## 按键快捷

| 按键 | 行为 |
|------|------|
| `Enter` | 发送消息 |
| `Shift + Enter` | 换行 |
| `/` | 触发斜杠命令补全 |
| `@` | 触发提及弹窗 |
| `Escape` | 关闭弹窗 |
| `↑` / `↓` | 弹窗内导航 |

---

## 相关组件

- [ChatPanel](./chat-panel.md) — 聊天面板（内嵌 ChatInput）
- [ChatMessage](./chat-message.md) — 消息渲染组件
