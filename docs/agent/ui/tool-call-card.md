# ToolCallCard

> 工具调用卡片 — 自动分类（Shell/文件/截图）+ 4 种状态 + 级联渲染输出

## 效果展示

三种工具调用状态：

<Demo name="tool-call" :height="200" />

Shell 命令调用：

<Demo name="tool-call-shell" :height="240" />

失败的工具调用：

<Demo name="tool-call-error" :height="160" />

## 快速开始

ToolCallCard 的核心设计：

1. **状态图标**：通过 `STATUS_ICON` 映射四种状态到不同颜色和字符（蓝色脉冲圆点、绿色对勾、红色叉号、黄色警告）。
2. **工具分类**：将工具名归入 Shell、文件编辑、Computer Use、截图四类，每类有专属的图标和展示方式。
3. **输出截断**：采用头尾截断策略（`OUTPUT_MAX_LINES = 20`），同时展示输出的开头和结尾，中间用省略号代替。
4. **审批交互**：当工具状态为 `pending_approval` 时，显示"允许"/"拒绝"按钮。
5. **折叠控制**：已完成的工具调用可通过 `defaultCollapsed` 设置初始折叠状态。

---

## ToolCallInfo 接口

```ts
export interface ToolCallInfo {
  /** 工具调用唯一 ID */
  id: string;
  /** 工具名称，如 "bash"、"file_edit"、"screenshot" */
  name: string;
  /** 工具参数 */
  arguments: Record<string, unknown>;
  /** 工具执行结果 */
  result?: {
    /** 标准输出文本 */
    output: string;
    /** 是否出错 */
    isError?: boolean;
    /** 附带元数据（如截图 base64） */
    metadata?: Record<string, unknown>;
  };
  /** 调用状态 */
  status: 'running' | 'completed' | 'error' | 'pending_approval';
}
```

---

## ToolCallCardProps

```ts
export interface ToolCallCardProps {
  toolCall: ToolCallInfo;
  onApprove?: (callId: string) => void;
  onReject?: (callId: string) => void;
  /** 初始折叠状态（用于已完成的历史轮次） */
  defaultCollapsed?: boolean;
  className?: string;
}
```

---

## STATUS_ICON 状态图标映射

```ts
const STATUS_ICON: Record<ToolCallInfo['status'], { char: string; color: string }> = {
  running:          { char: '●', color: 'text-blue-400 animate-pulse' },  // 蓝色脉冲圆点
  completed:        { char: '✓', color: 'text-green-400' },               // 绿色对勾
  error:            { char: '✗', color: 'text-red-500' },                 // 红色叉号
  pending_approval: { char: '⚠', color: 'text-yellow-500' },              // 黄色警告
};
```

---

## 工具分类系统

ToolCallCard 通过预定义的 Set 对工具名进行分类：

### SHELL_TOOLS（Shell 命令工具）

```ts
const SHELL_TOOLS = new Set([
  'bash', 'shell', 'exec', 'run_command', 'terminal'
]);
```

这些工具的卡片会高亮显示命令文本，并以等宽字体渲染命令和输出。

### FILE_EDIT_TOOLS（文件编辑工具）

```ts
const FILE_EDIT_TOOLS = new Set([
  'file_edit', 'edit', 'write_file', 'create_file', 'apply_diff'
]);
```

这些工具的卡片展示文件路径，并在结果中渲染 Diff 视图（通过 `DiffView` 组件）。

### COMPUTER_USE_TOOLS（Computer Use + Chrome CDP 工具）

```ts
const COMPUTER_USE_TOOLS = new Set([
  // 屏幕操作
  'screenshot', 'mouse_click', 'mouse_double_click', 'mouse_move',
  'mouse_down', 'mouse_up', 'mouse_drag', 'scroll',
  'keyboard_type', 'keyboard_press_key',
  // Chrome CDP 操作
  'chrome_navigate', 'chrome_screenshot', 'chrome_click',
  'chrome_type', 'chrome_evaluate', 'chrome_get_content',
]);
```

这些工具的卡片展示操作类型和目标坐标/按键信息。

### SCREENSHOT_TOOLS（截图工具）

```ts
const SCREENSHOT_TOOLS = new Set([
  'screenshot', 'chrome_screenshot'
]);
```

截图工具的结果会通过 `ScreenshotView` 组件渲染为图片预览。

---

## 输出渲染级联

ToolCallCard 按以下优先级顺序尝试渲染输出内容（级联策略，命中即停止）：

```
1. isError === true?
   └─ 是 → 渲染错误信息（红色文本 + 错误图标）

2. SHELL_TOOLS 包含该工具?
   └─ 是 → 渲染命令行 + 文本输出（等宽字体）

3. FILE_EDIT_TOOLS 包含该工具?
   └─ 是 → 检查 output 是否为 Diff 格式
       ├─ 是 → 渲染 DiffView（语法高亮的 Diff）
       └─ 否 → 渲染纯文本输出

4. SCREENSHOT_TOOLS 包含该工具?
   └─ 是 → 渲染 ScreenshotView（图片预览）

5. isImageOutput(output)?
   └─ 是 → 渲染 ScreenshotView（base64 图片）

6. 其他情况
   └─ 渲染 Markdown 格式的输出文本
```

### 截断策略

当输出行数超过 `OUTPUT_MAX_LINES`（20 行）时，采用头尾截断：

```ts
function truncateOutput(output: string, maxLines: number) {
  const lines = output.split('\n');
  if (lines.length <= maxLines) {
    return { text: output, truncated: 0 };
  }
  const headCount = Math.ceil(maxLines * 0.6);  // 前 60%
  const tailCount = Math.floor(maxLines * 0.4);  // 后 40%
  const head = lines.slice(0, headCount);
  const tail = lines.slice(-tailCount);
  const truncated = lines.length - headCount - tailCount;
  return {
    text: [...head, `... (${truncated} 行已省略) ...`, ...tail].join('\n'),
    truncated,
  };
}
```

---

## 代码示例

### 示例 1：Shell 命令

```tsx
import React from 'react';
import { ToolCallCard } from '@svton/agent-ui';
import type { ToolCallInfo } from '@svton/agent-ui';

const shellCall: ToolCallInfo = {
  id: 'call-shell-1',
  name: 'bash',
  arguments: { command: 'npm test -- --coverage' },
  status: 'completed',
  result: {
    output: `PASS  src/utils/format.test.ts
PASS  src/utils/validate.test.ts
PASS  src/components/Button.test.tsx
----------|---------|----------|
File      | % Stmts | % Branch |
----------|---------|----------|
All files |   92.31 |    88.50 |
----------|---------|----------|
Test Suites: 3 passed, 3 total
Tests:       28 passed, 28 total`,
  },
};

export function ShellExample() {
  return (
    <ToolCallCard
      toolCall={shellCall}
      defaultCollapsed={false}
    />
  );
}
```

### 示例 2：文件编辑

```tsx
const fileEditCall: ToolCallInfo = {
  id: 'call-edit-1',
  name: 'file_edit',
  arguments: {
    path: 'src/utils/format.ts',
    old_string: 'export function formatDate(d: Date) {',
    new_string: 'export function formatDate(d: Date, locale = "zh-CN") {',
  },
  status: 'completed',
  result: {
    output: `--- a/src/utils/format.ts
+++ b/src/utils/format.ts
@@ -1,4 +1,4 @@
-export function formatDate(d: Date) {
+export function formatDate(d: Date, locale = "zh-CN") {
   return d.toLocaleDateString();
 }`,
  },
};

export function FileEditExample() {
  return (
    <ToolCallCard
      toolCall={fileEditCall}
      defaultCollapsed={false}
    />
  );
}
```

### 示例 3：通用工具（待审批）

```tsx
const pendingCall: ToolCallInfo = {
  id: 'call-generic-1',
  name: 'web_search',
  arguments: { query: 'TypeScript 5.4 release notes' },
  status: 'pending_approval',
};

export function GenericExample() {
  return (
    <ToolCallCard
      toolCall={pendingCall}
      onApprove={(callId) => {
        console.log('批准搜索:', callId);
      }}
      onReject={(callId) => {
        console.log('拒绝搜索:', callId);
      }}
    />
  );
}
```

### 示例 4：截图工具

```tsx
const screenshotCall: ToolCallInfo = {
  id: 'call-screenshot-1',
  name: 'screenshot',
  arguments: {},
  status: 'completed',
  result: {
    output: '',
    metadata: {
      imageBase64: 'iVBORw0KGgoAAAANSUhEUgAA...',
      width: 1920,
      height: 1080,
    },
  },
};

export function ScreenshotExample() {
  return (
    <ToolCallCard toolCall={screenshotCall} />
  );
}
```

---

## 状态行为总结

| 状态 | 图标 | 行为 |
|------|------|------|
| `running` | 蓝色脉冲 ● | 展示工具名和参数，等待结果 |
| `completed` | 绿色 ✓ | 展示输出（可折叠） |
| `error` | 红色 ✗ | 以红色文本展示错误输出 |
| `pending_approval` | 黄色 ⚠ | 显示"允许"/"拒绝"按钮 |

---

## 工具名显示

工具的显示名称通过 `getToolDisplayName()` 函数（来自 `tool-names.ts`）进行本地化映射，例如：

- `bash` → "终端命令"
- `file_edit` → "文件编辑"
- `screenshot` → "屏幕截图"
- `chrome_navigate` → "浏览器导航"

---

## 相关组件

- [ChatMessage](./chat-message.md) — 在消息中渲染 `tool_call` 块时使用 ToolCallCard
- [ChatPanel](./chat-panel.md) — 工具审批通过 ToolApprovalModal 处理
