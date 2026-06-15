# Agent 集成指南

本指南展示如何从零开始将 Svton Agent 集成到你的应用中，包含完整的代码示例。

## 目录

- [快速开始](#快速开始)
- [桌面端集成（Tauri）](#桌面端集成tauri)
- [Web 端集成](#web-端集成)
- [自定义工具](#自定义工具)
- [自定义 Agent 定义](#自定义-agent-定义)
- [自动化任务](#自动化任务)
- [Chrome 浏览器控制](#chrome-浏览器控制)
- [Computer Use（桌面控制）](#computer-use桌面控制)

---

## 快速开始

### 1. 安装依赖

```bash
pnpm add @svton/agent-core @svton/agent-client @svton/agent-ui @svton/ui
```

### 2. 最小可用示例

```tsx
import { AgentProvider, useChat } from '@svton/agent-client';
import { ChatPanel } from '@svton/agent-ui';
import { AgentRuntime, OpenAIProvider, ToolRegistry } from '@svton/agent-core';

// 1. 配置 Provider
const provider = new OpenAIProvider({
  baseUrl: 'https://api.openai.com/v1',
  apiKey: 'your-api-key',
  models: [{ id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000 }],
});

// 2. 注册工具
const toolRegistry = new ToolRegistry();
// toolRegistry.register(fileReadDef, new FileReadExecutor());
// toolRegistry.register(bashDef, new BashExecutor());

// 3. 创建 AgentConfig
const agentConfig = {
  provider,
  model: 'gpt-4o',
  toolRegistry,
  workingDir: '/home/user/project',
  capabilities: {},
};

// 4. 渲染
function App() {
  return (
    <AgentProvider config={agentConfig} platform={platform}>
      <Chat />
    </AgentProvider>
  );
}

function Chat() {
  const { messages, isStreaming, send, abort } = useChat();

  return (
    <ChatPanel
      messages={messages}
      onSend={send}
      onAbort={abort}
      isStreaming={isStreaming}
    />
  );
}
```

---

## 桌面端集成（Tauri）

### 架构

```
┌─────────────────────────────────────────┐
│            Tauri Window (Webview)        │
│  ┌───────────┐  ┌─────────────────────┐ │
│  │  Sidebar   │  │     ChatPanel       │ │
│  │  (sessions │  │  ┌───────────────┐  │ │
│  │   skills   │  │  │ ChatMessage   │  │ │
│  │   plugins) │  │  │  (15 blocks)  │  │ │
│  │            │  │  └───────────────┘  │ │
│  │            │  │  ChatInput          │ │
│  └───────────┘  └─────────────────────┘ │
└─────────────────────────────────────────┘
           ↕ Tauri IPC (invoke)
┌─────────────────────────────────────────┐
│              Rust Backend                │
│  fs_read │ screenshot │ sandbox_exec    │
│  mouse_* │ keyboard_* │ chrome_cdp      │
└─────────────────────────────────────────┘
```

### 初始化 Agent

```typescript
// apps/agent-desktop/src/lib/agent-setup.ts
import { initAgent } from '@/lib/agent-setup';

const result = await initAgent(platform, modelOverride?);

if (result.kind === 'ready') {
  const { config, extra } = result;
  // config: AgentConfig — 传入 AgentProvider
  // extra: AgentExtra — chronicleManager, automationManager, integrationManager, ...
}
```

### 注册工具

```typescript
import {
  // 文件工具
  fileReadDef, FileReadExecutor,
  fileWriteDef, FileWriteExecutor,
  fileEditDef, FileEditExecutor,
  // 搜索工具
  grepDef, GrepExecutor,
  globDef, GlobExecutor,
  // Shell
  bashDef, BashExecutor,
  // Web
  webSearchDef, WebSearchExecutor,
  // Computer Use (10 个工具)
  screenshotDef, mouseClickDef, keyboardTypeDef, ...
  // Chrome CDP (6 个工具)
  chromeNavigateDef, chromeScreenshotDef, ...
  // 规划
  planCreateDef, planGetStatusDef, planUpdateStepDef,
  // 图像生成
  imageGenerateDef, ImageGenerateExecutor,
  // 代码审查
  gitDiffDef, GitDiffExecutor,
} from '@svton/agent-core';

toolRegistry.register(fileReadDef, new FileReadExecutor());
toolRegistry.register(bashDef, new BashExecutor());
// ... 按需注册
```

---

## Web 端集成

Web 端与桌面端共享 `@svton/agent-ui` 和 `@svton/agent-client`，区别在于：

- 无 Computer Use / Chrome CDP（需要桌面 Rust 后端）
- 无自动化任务（需要后台进程）
- 无工作树 / 屏幕记忆（需要桌面能力）

```tsx
// apps/agent-web/src/components/AgentLayout.tsx
import { AgentProvider } from '@svton/agent-client';
import { ChatPanel } from '@svton/agent-ui';

function WebApp() {
  return (
    <AgentProvider config={webConfig} platform={browserPlatform}>
      <Sidebar />
      <ChatPanel
        messages={messages}
        onSend={send}
        isStreaming={isStreaming}
      />
    </AgentProvider>
  );
}
```

---

## 自定义工具

### 1. 定义工具

```typescript
import type { ToolDefinition, ToolCall, ToolResult, IToolExecutor, ToolContext } from '@svton/agent-core';

const weatherDef: ToolDefinition = {
  name: 'get_weather',
  description: '获取指定城市的天气信息',
  parameters: {
    type: 'object',
    properties: {
      city: { type: 'string', description: '城市名称' },
    },
    required: ['city'],
  },
  annotations: {
    readOnlyHint: true,
  },
};
```

### 2. 实现执行器

```typescript
class WeatherExecutor implements IToolExecutor {
  async execute(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
    const { city } = call.arguments as { city: string };

    try {
      const resp = await fetch(`https://api.weather.example.com?q=${city}`);
      const data = await resp.json();

      return {
        callId: call.id,
        output: `${city}: ${data.temp}°C, ${data.condition}`,
        metadata: { city, temp: data.temp },
      };
    } catch (e) {
      return {
        callId: call.id,
        output: `获取天气失败: ${e.message}`,
        isError: true,
      };
    }
  }
}
```

### 3. 注册工具

```typescript
toolRegistry.register(weatherDef, new WeatherExecutor());
```

### 4. 自定义块渲染（可选）

如果你的工具返回结构化数据，可以创建自定义块组件：

```typescript
// 在 chat.service.ts 的 tool_call_end 中
if (toolName === 'get_weather' && !result.isError) {
  blocks.push({
    type: 'text', // 或自定义类型
    text: `🌤️ 天气: ${result.output}`,
  });
}
```

---

## 自定义 Agent 定义

### 文件方式（推荐）

在项目中创建 `.svton/agents/` 目录：

```
my-project/
├── .svton/
│   └── agents/
│       ├── security-auditor.md
│       └── test-writer.md
```

#### 示例：security-auditor.md

```markdown
---
name: security-auditor
title: Security Auditor
description: 安全审计专家，专注于发现代码中的安全漏洞
model: gpt-4o
tools: file_read, grep, glob
icon: shield
permissions: read_only
---

你是一位资深安全审计专家。你的职责：

1. 检查常见安全漏洞（SQL 注入、XSS、CSRF）
2. 验证输入验证和输出编码
3. 检查认证和授权逻辑
4. 审查依赖项的已知漏洞

输出格式：按严重程度排序的漏洞列表，每个包含：
- 严重级别（Critical/High/Medium/Low）
- 文件位置和代码片段
- 修复建议
```

### 全局 Agent

在 `~/.svton/agents/` 放置全局 Agent 定义，所有项目共享。

### 代码方式

```typescript
import { AgentDefinitionManager } from '@svton/agent-core';

const mgr = new AgentDefinitionManager(storage);
await mgr.loadFromStorage();
await mgr.loadFromDirectories(platform.fs, workingDir, homeDir);

// 手动注册
mgr.register({
  name: 'doc-writer',
  title: 'Documentation Writer',
  description: '技术文档撰写专家',
  systemPrompt: '你是一位技术文档专家...',
  tools: ['file_read', 'file_write'],
  permissions: 'accept_edits',
  source: 'user',
});
```

### 动态子 Agent

AI 可以在对话中动态创建子 Agent：

```text
用户: 帮我审查这段代码的安全性，同时检查性能问题

AI: [调用 subagent_spawn 工具]
  - 子 Agent 1: 安全审计专家（只读，tools: file_read, grep）
  - 子 Agent 2: 性能分析专家（只读，tools: file_read, bash）
```

LLM 通过 `subagent_spawn` 工具创建子 Agent，支持自定义：
- `task` — 任务描述
- `roleDescription` — 角色定义
- `tools` — 工具白名单
- `excludeTools` — 工具黑名单
- `model` — 模型覆盖
- `maxIterations` — 最大迭代次数
- `timeout` — 超时（毫秒）

---

## 自动化任务

### 创建定时任务

```typescript
import { AutomationManager, TimerScheduler } from '@svton/agent-core';

const automationManager = new AutomationManager(platform.storage, new TimerScheduler());
await automationManager.init();

// 创建每日报表任务
await automationManager.create({
  name: '每日报表',
  description: '每天早上 9 点生成项目状态报表',
  trigger: { type: 'cron', expression: '0 9 * * *' },
  prompt: '分析 git log 最近 24 小时的提交，生成项目进展报表',
});

// 创建间隔任务
await automationManager.create({
  name: '定时检查 PR',
  trigger: { type: 'interval', minutes: 30 },
  prompt: '检查 GitHub 上的待审 PR 并提醒',
});

// 创建事件触发任务
await automationManager.create({
  name: '提交后检查',
  trigger: { type: 'event', eventType: 'git_commit' },
  prompt: '运行代码检查和测试',
});
```

### 通过 AI 自然语言创建

对话中直接让 AI 创建自动化任务：

```text
用户: 帮我创建一个每天早上 9 点检查 PR 状态的任务

AI: [调用 create_automation 工具]
  name: "每日 PR 检查"
  schedule: "every day at 9am"
  prompt: "检查 GitHub PR 状态，汇报待审 PR"

AI: ✅ 已创建自动化任务「每日 PR 检查」
    触发方式: cron 0 9 * * *
    下次运行: 2026-06-16 09:00:00
```

### 查看执行历史

```typescript
// 获取单个任务的执行历史
const runs = await automationManager.getRuns('auto_1');

// 获取所有任务的最近运行（收件箱）
const recentRuns = await automationManager.getRecentRuns(10);
```

### 触发事件

```typescript
// 外部触发事件型自动化
await automationManager.triggerEvent('git_commit', { branch: 'main' });
```

---

## Chrome 浏览器控制

### 方式 1：Chrome 扩展（推荐）

1. 在 Svton Desktop 的「插件管理」中点击「安装扩展」
2. Chrome 打开 `chrome://extensions/`
3. 开启「开发者模式」
4. 加载已解压的扩展程序

扩展通过 WebSocket 连接到 Svton（`ws://localhost:9223`），使用 Chrome Debugger API 控制 Chrome，无需特殊启动参数。

### 方式 2：启动参数（备用）

```bash
Google Chrome --remote-debugging-port=9222
```

或通过 Svton Desktop 的「插件管理」面板点击「启动 Chrome」。

### 可用工具

| 工具 | 说明 |
|------|------|
| `chrome_navigate` | 导航到 URL |
| `chrome_screenshot` | 截取页面截图 |
| `chrome_click` | 点击元素（CSS 选择器） |
| `chrome_type` | 输入文本 |
| `chrome_evaluate` | 执行 JavaScript |
| `chrome_get_content` | 获取页面内容 |

---

## Computer Use（桌面控制）

### 前提条件

- macOS：需要授予「辅助功能」和「屏幕录制」权限
- 在「插件管理」面板中检查权限状态

### 可用工具（10 个）

| 工具 | 说明 |
|------|------|
| `screenshot` | 截取屏幕（JPEG 压缩，1280px） |
| `mouse_click` | 点击坐标 |
| `mouse_double_click` | 双击 |
| `mouse_move` | 移动鼠标 |
| `mouse_down` / `mouse_up` | 按下/释放鼠标 |
| `mouse_drag` | 拖拽（A → B 平滑插值） |
| `scroll` | 滚动（up/down/left/right） |
| `keyboard_type_text` | 输入文本 |
| `keyboard_press_key` | 按键（支持修饰键 Ctrl/Alt/Shift/Meta） |

### 使用示例

```text
用户: 帮我打开微信，找到「文件传输助手」，发送"测试消息"

AI: [screenshot] → 分析屏幕
    [mouse_click] → 点击微信图标
    [keyboard_type_text] → 搜索"文件传输助手"
    [mouse_click] → 点击搜索结果
    [keyboard_type_text] → 输入"测试消息"
    [keyboard_press_key] → 按 Enter 发送
```

---

## 最佳实践

### 1. 工具按需注册

不要注册所有工具 — 只注册当前场景需要的工具。工具越多，AI 的决策空间越大，准确率越低。

```typescript
// 好的做法：按场景注册
if (scenario === 'coding') {
  registerCodingTools(toolRegistry);
} else if (scenario === 'research') {
  registerResearchTools(toolRegistry);
}
```

### 2. 使用权限系统

```typescript
const permissionManager = new PermissionManager({ mode: 'default' });
// default: 工具调用需要确认
// read_only: 只允许只读工具
// auto: 全自动执行
```

### 3. 启用自动记忆

记忆系统会在每次对话后自动提取关键信息：

```typescript
const memoryManager = new MemoryManager();
await memoryManager.init(platform.storage);
// 每次对话结束后自动提取记忆（由 runtime 自动调用）
```

### 4. 合理设置上下文窗口

```typescript
const config = {
  // ...
  contextConfig: {
    maxTokens: 512000,        // 根据模型调整
    compactionThreshold: 0.8, // 80% 时触发压缩
    preserveRecentMessages: 6, // 保留最近 6 条
  },
};
```

### 5. 项目级 Agent 定义

为不同类型的项目创建专门的 Agent：

```
my-react-project/.svton/agents/
├── component-tester.md    # React 组件测试专家
└── performance-tuner.md   # 性能调优专家
```
