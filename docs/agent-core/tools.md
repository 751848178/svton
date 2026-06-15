# 工具系统(Tools)

> Agent 与外部世界交互的桥梁 — 基于"定义与执行分离"原则，内置 30+ 工具。

Agent 通过工具(Tools)与外部世界交互:`@svton/agent-core` 的工具系统基于"定义与执行分离"原则——工具定义是纯数据(JSON Schema),执行器是平台相关的实现。

## 快速使用

<Demo name="tool-registration" :height="500" />

```typescript
import { ToolRegistry, builtins } from '@svton/agent-core';

const registry = new ToolRegistry();

// 注册内置工具
registry.register(builtins.fileReadDef, new builtins.FileReadExecutor(fs));
registry.register(builtins.bashDef, new builtins.BashExecutor(platform));

// 执行工具
const result = await registry.execute('file_read', { path: '/README.md' });
```

## 核心类型

### ToolDefinition

```typescript
interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
  annotations?: ToolAnnotations;
}

interface ToolParameterSchema {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
}

interface ToolAnnotations {
  readOnlyHint?: boolean;       // 只读操作
  destructiveHint?: boolean;    // 破坏性操作
  idempotentHint?: boolean;     // 幂等操作
  openWorldHint?: boolean;      // 与外部世界交互
}
```

### ToolCall 与 ToolResult

```typescript
interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

interface ToolResult {
  callId: string;
  output: string;
  isError?: boolean;
  metadata?: Record<string, unknown>;
}
```

### IToolExecutor

```typescript
interface IToolExecutor {
  execute(call: ToolCall, context: ToolContext): Promise<ToolResult>;
}

interface ToolContext {
  platform: IPlatform;
  sessionId: string;
  workingDir: string;
  signal?: AbortSignal;
  onProgress?: (message: string) => void;
}
```

### ToolEntry

```typescript
interface ToolEntry {
  definition: ToolDefinition;
  executor: IToolExecutor;
}
```

---

## ToolRegistry

`ToolRegistry` 管理所有已注册的工具定义和执行器。

```typescript
class ToolRegistry {
  register(definition: ToolDefinition, executor: IToolExecutor): void;
  unregister(name: string): boolean;
  get(name: string): ToolEntry | null;
  listDefinitions(): ToolDefinition[];
  has(name: string): boolean;
  execute(call: ToolCall, context: ToolContext): Promise<ToolResult>;
  get size(): number;
}
```

### 注册工具

```typescript
import { ToolRegistry } from '@svton/agent-core';

const registry = new ToolRegistry();
registry.register(fileReadDef, new FileReadExecutor());
registry.register(bashDef, new BashExecutor());

console.log(`已注册 ${registry.size} 个工具`);
```

### 执行工具

```typescript
const result = await registry.execute(
  {
    id: 'call_1',
    name: 'file_read',
    arguments: { path: '/tmp/test.txt' },
  },
  {
    platform,
    sessionId: 'session_1',
    workingDir: '/tmp',
  },
);

if (result.isError) {
  console.error('执行失败:', result.output);
} else {
  console.log('输出:', result.output);
}
```

---

## 创建自定义工具

实现一个自定义工具只需要:一个 `ToolDefinition` 和一个 `IToolExecutor`。

```typescript
import type { ToolDefinition } from '@svton/agent-core';
import type { ToolCall, ToolResult, IToolExecutor, ToolContext } from '@svton/agent-core';

// 1. 定义工具
const weatherDef: ToolDefinition = {
  name: 'get_weather',
  description: '查询指定城市的天气',
  parameters: {
    type: 'object',
    properties: {
      city: { type: 'string', description: '城市名称' },
    },
    required: ['city'],
  },
  annotations: {
    readOnlyHint: true,
    openWorldHint: true,
  },
};

// 2. 实现执行器
class WeatherExecutor implements IToolExecutor {
  async execute(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
    const { city } = call.arguments as { city: string };
    ctx.onProgress?.(`正在查询 ${city} 的天气...`);

    try {
      const resp = await fetch(
        `https://wttr.in/${encodeURIComponent(city)}?format=3`,
      );
      const text = await resp.text();
      return { callId: call.id, output: text.trim() };
    } catch (err) {
      return {
        callId: call.id,
        output: `查询失败: ${err}`,
        isError: true,
      };
    }
  }
}

// 3. 注册
registry.register(weatherDef, new WeatherExecutor());
```

---

## 内置工具完整列表

`@svton/agent-core` 提供以下内置工具,按类别分组:

### 文件操作(3 个)

| 工具名 | 说明 | 执行器 |
| --- | --- | --- |
| `file_read` | 读取文件内容 | `FileReadExecutor` |
| `file_write` | 写入文件(覆盖) | `FileWriteExecutor` |
| `file_edit` | 精确字符串替换编辑 | `FileEditExecutor` |

```typescript
import {
  fileReadDef, FileReadExecutor,
  fileWriteDef, FileWriteExecutor,
  fileEditDef, FileEditExecutor,
} from '@svton/agent-core';
```

### 代码搜索(2 个)

| 工具名 | 说明 | 执行器 |
| --- | --- | --- |
| `grep` | 正则内容搜索 | `GrepExecutor` |
| `glob` | 文件名模式匹配 | `GlobExecutor` |

```typescript
import { grepDef, GrepExecutor, globDef, GlobExecutor } from '@svton/agent-core';
```

### Shell(1 个)

| 工具名 | 说明 | 执行器 |
| --- | --- | --- |
| `bash` | 执行 Shell 命令 | `BashExecutor` |

```typescript
import { bashDef, BashExecutor } from '@svton/agent-core';
```

### Web(2 个)

| 工具名 | 说明 | 执行器 |
| --- | --- | --- |
| `web_search` | 网页搜索 | `WebSearchExecutor` |
| `web_fetch` | 抓取网页内容 | `WebFetchExecutor` |

```typescript
import { webSearchDef, WebSearchExecutor, webFetchDef, WebFetchExecutor } from '@svton/agent-core';
```

### 记忆(2 个)

| 工具名 | 说明 | 执行器 |
| --- | --- | --- |
| `memory_save` | 保存记忆条目 | `MemorySaveExecutor` |
| `memory_recall` | 检索相关记忆 | `MemoryRecallExecutor` |

```typescript
import { memorySaveDef, MemorySaveExecutor, memoryRecallDef, MemoryRecallExecutor } from '@svton/agent-core';
```

### 规划(3 个)

| 工具名 | 说明 | 执行器 |
| --- | --- | --- |
| `plan_create` | 创建多步骤计划 | `PlanCreateExecutor` |
| `plan_get_status` | 查询计划进度 | `PlanGetStatusExecutor` |
| `plan_update_step` | 更新步骤状态 | `PlanUpdateStepExecutor` |

```typescript
import {
  planCreateDef, PlanCreateExecutor,
  planGetStatusDef, PlanGetStatusExecutor,
  planUpdateStepDef, PlanUpdateStepExecutor,
} from '@svton/agent-core';
```

### Computer Use(10 个)

桌面级屏幕操作,通过截图+鼠标键盘控制图形界面。

| 工具名 | 说明 |
| --- | --- |
| `screenshot` | 截取屏幕 |
| `mouse_click` | 单击 |
| `mouse_double_click` | 双击 |
| `mouse_move` | 移动鼠标 |
| `mouse_down` | 按下鼠标键 |
| `mouse_up` | 释放鼠标键 |
| `mouse_drag` | 拖拽 |
| `scroll` | 滚动 |
| `keyboard_type` | 输入文本 |
| `keyboard_press_key` | 按下特定按键 |

```typescript
import {
  screenshotDef, ScreenshotExecutor,
  mouseClickDef, MouseClickExecutor,
  keyboardTypeDef, KeyboardTypeExecutor,
  // ... 等
} from '@svton/agent-core';
```

### Chrome CDP(6 个)

通过 Chrome DevTools Protocol 直接控制浏览器。

| 工具名 | 说明 |
| --- | --- |
| `chrome_navigate` | 导航到 URL |
| `chrome_screenshot` | 页面截图 |
| `chrome_click` | 点击元素 |
| `chrome_type` | 在输入框输入文本 |
| `chrome_evaluate` | 执行 JavaScript |
| `chrome_get_content` | 获取页面内容 |

```typescript
import {
  chromeNavigateDef, ChromeNavigateExecutor,
  chromeScreenshotDef, ChromeScreenshotExecutor,
  chromeClickDef, ChromeClickExecutor,
  chromeTypeDef, ChromeTypeExecutor,
  chromeEvaluateDef, ChromeEvaluateExecutor,
  chromeGetContentDef, ChromeGetContentExecutor,
} from '@svton/agent-core';
```

### Git 代码审查(2 个)

| 工具名 | 说明 | 执行器 |
| --- | --- | --- |
| `git_diff` | 查看 Git diff | `GitDiffExecutor` |
| `git_log_range` | 查看 commit 日志范围 | `GitLogRangeExecutor` |

```typescript
import { gitDiffDef, GitDiffExecutor, gitLogRangeDef, GitLogRangeExecutor } from '@svton/agent-core';
```

### 图像生成(1 个)

| 工具名 | 说明 | 执行器 |
| --- | --- | --- |
| `image_generate` | 调用多供应商图像生成 API | `ImageGenerateExecutor` |

```typescript
import { imageGenerateDef, ImageGenerateExecutor } from '@svton/agent-core';
```

### CSV 扇出(1 个)

| 工具名 | 说明 | 执行器 |
| --- | --- | --- |
| `csv_fanout` | 为 CSV 每行创建子代理任务 | `CsvFanoutExecutor` |

```typescript
import { csvFanoutDef, CsvFanoutExecutor } from '@svton/agent-core';
```

### 文档预览(1 个)

| 工具名 | 说明 | 执行器 |
| --- | --- | --- |
| `preview_document` | 预览文档内容 | `PreviewDocumentExecutor` |

```typescript
import { previewDocumentDef, PreviewDocumentExecutor } from '@svton/agent-core';
```

---

## 批量注册所有内置工具

```typescript
import { ToolRegistry } from '@svton/agent-core';
import * as builtins from '@svton/agent-core';

const registry = new ToolRegistry();

const builtinPairs = [
  [builtins.fileReadDef, new builtins.FileReadExecutor()],
  [builtins.fileWriteDef, new builtins.FileWriteExecutor()],
  [builtins.fileEditDef, new builtins.FileEditExecutor()],
  [builtins.grepDef, new builtins.GrepExecutor()],
  [builtins.globDef, new builtins.GlobExecutor()],
  [builtins.bashDef, new builtins.BashExecutor()],
  [builtins.webSearchDef, new builtins.WebSearchExecutor()],
  [builtins.webFetchDef, new builtins.WebFetchExecutor()],
  [builtins.memorySaveDef, new builtins.MemorySaveExecutor()],
  [builtins.memoryRecallDef, new builtins.MemoryRecallExecutor()],
  // ... 根据平台能力按需注册
];

for (const [def, executor] of builtinPairs) {
  registry.register(def, executor);
}
```

## 使用建议

- **按平台能力注册**:浏览器平台无法使用 `bash` 和文件系统工具;桌面平台可以注册全部工具。
- **使用 annotations**:`readOnlyHint`、`destructiveHint` 等注解会被权限系统使用,务必正确标注。
- **错误处理**:执行器内部抛出的异常会被 `ToolRegistry.execute` 捕获并转换为 `isError: true` 的 `ToolResult`,不会中断 Agent 循环。
- **进度回调**:通过 `ctx.onProgress` 可以向 UI 推送工具执行进度。

## 相关文档

- [index](./index) — agent-core 总览
- [AgentRuntime](./runtime) — 通过 ToolRegistry 执行工具
- [权限系统](./permission) — 工具调用权限控制
- [MCP 协议](./mcp) — 动态注册外部 MCP 工具
- [第三方集成](./integrations) — 通过集成注入外部服务工具
