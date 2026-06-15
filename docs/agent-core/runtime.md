# AgentRuntime 与 ReAct 循环

> 核心运行时 — 实现 Think → Act → Observe 的 ReAct 循环，集成所有能力管理器。

`AgentRuntime` 是 `@svton/agent-core` 的核心,实现了 Think → Act → Observe 的 ReAct(Reasoning + Acting)循环。它集成所有能力管理器(Prompt、Skill、Memory、Permission、Hook、MCP、Subagent、Planning 等),对外暴露一个简单的 `run()` 异步生成器。

## 快速使用

```typescript
import { AgentRuntime, OpenAIProvider, ToolRegistry } from '@svton/agent-core';

const runtime = await AgentRuntime.createAsync({
  provider: new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY! }),
  model: 'gpt-4o',
  toolRegistry: new ToolRegistry(),
  workingDir: '/project',
});

for await (const event of runtime.run('分析项目结构')) {
  console.log(event.type);
}
```

## 架构概览

```
用户消息
   ↓
┌─────────────────────────────────────────┐
│             AgentRuntime.run()          │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  1. 注入 Skill / Memory 上下文  │    │
│  │  2. 上下文压缩(compaction)     │    │
│  │  3. 调用 LLM Provider           │    │
│  │  4. 解析流式事件                │    │
│  │  5. 若有工具调用:              │    │
│  │     a. 权限检查                 │    │
│  │     b. 触发 pre_tool_use 钩子   │    │
│  │     c. 执行工具                 │    │
│  │     d. 触发 post_tool_use 钩子  │    │
│  │     e. 将结果加入上下文         │    │
│  │  6. 回到第 2 步(ReAct 循环)   │    │
│  └─────────────────────────────────┘    │
│                                         │
│  输出: AsyncGenerator<AgentEvent>       │
└─────────────────────────────────────────┘
```

## AgentConfig

```typescript
interface AgentConfig {
  provider: IProvider;
  model: string;
  toolRegistry: ToolRegistry;
  systemPrompt?: string;
  contextConfig?: Partial<ContextConfig>;
  maxIterations?: number;            // 默认 50
  workingDir?: string;
  capabilities?: AgentCapabilities;  // 可选的高级能力
}

interface ContextConfig {
  maxTokens: number;
  compactionThreshold: number;       // 0.0-1.0,例如 0.8 = 80% 时压缩
  reservedForResponse: number;
  preserveRecentMessages: number;
}
```

## AgentCapabilities

所有高级能力都是可选的,按需注入:

```typescript
interface AgentCapabilities {
  skillManager?: SkillManager;
  memoryManager?: MemoryManager;
  promptManager?: PromptManager;
  permissionManager?: PermissionManager;
  hookManager?: HookManager;
  mcpClients?: MCPClient[];
  mcpServerConfigs?: Map<string, McpServerToolConfig>;
  pluginManager?: PluginManager;
  subagentManager?: SubagentManager;
  planningManager?: PlanningManager;
  resumeManager?: SessionResumeManager;
  agentDefinitionManager?: AgentDefinitionManager;
  worktreeManager?: WorktreeManager;
  autoReviewer?: AutoReviewerManager;
}
```

---

## 工厂方法

### AgentRuntime.create()(同步)

不桥接 MCP 工具,适合不使用 MCP 的场景:

```typescript
static create(config: AgentConfig, platform: IPlatform): AgentRuntime;
```

### AgentRuntime.createAsync()(异步)

会初始化 MCP 客户端、桥接 MCP 工具到注册表,并重新组合系统提示词。**有 MCP 客户端时必须使用此方法**。

```typescript
static async createAsync(config: AgentConfig, platform: IPlatform): Promise<AgentRuntime>;
```

```typescript
import { AgentRuntime, AnthropicProvider, ToolRegistry, MCPClient, HTTPTransport } from '@svton/agent-core';

const mcpClient = new MCPClient();
await mcpClient.connect(new HTTPTransport({ url: 'https://mcp.example.com/sse' }));

const runtime = await AgentRuntime.createAsync(
  {
    provider: new AnthropicProvider({ apiKey: '...' }),
    model: 'claude-sonnet-4-20250514',
    toolRegistry: new ToolRegistry(),
    capabilities: {
      mcpClients: [mcpClient],
    },
  },
  platform,
);
```

---

## run() 方法

```typescript
async *run(
  userMessage: string | ContentBlock[],
  options?: RunOptions,
): AsyncGenerator<AgentEvent>;
```

### RunOptions

```typescript
interface RunOptions {
  mode?: 'default' | 'plan' | 'auto';   // 运行模式
  signal?: AbortSignal;                  // 中断信号
  maxIterations?: number;                // 本次运行的最大迭代数
  sessionId?: string;                    // 用于检查点/恢复
}
```

---

## AgentEvent 类型(11 种)

`run()` 生成器输出的所有事件类型:

| 事件类型 | 字段 | 说明 |
| --- | --- | --- |
| `text_delta` | `text` | LLM 输出的文本片段 |
| `thinking_delta` | `thinking` | LLM 思考过程片段(extended thinking) |
| `tool_call_start` | `call: ToolCall` | 工具调用开始 |
| `tool_call_progress` | `callId, message, arguments?` | 工具执行进度更新 |
| `tool_call_end` | `result: ToolResult` | 工具调用结束 |
| `tool_approval_needed` | `call: ToolCall` | 需要用户审批 |
| `context_compacted` | `summary` | 上下文已被压缩 |
| `subagent_start` | `agentId, task` | 子代理启动 |
| `subagent_end` | `agentId, summary` | 子代理完成 |
| `warning` | `text, source?` | 警告信息 |
| `error` | `error: Error` | 错误 |
| `done` | `stopReason, usage` | 运行完成 |

---

## 迭代示例

```typescript
for await (const event of runtime.run('帮我重构 src/utils.ts')) {
  switch (event.type) {
    case 'text_delta':
      // 流式输出 LLM 文本
      process.stdout.write(event.text);
      break;

    case 'thinking_delta':
      // 可选:展示思考过程
      console.log(`[思考] ${event.thinking}`);
      break;

    case 'tool_call_start':
      console.log(`\n🔧 调用工具: ${event.call.name}`);
      console.log(`   参数: ${JSON.stringify(event.call.arguments)}`);
      break;

    case 'tool_call_progress':
      console.log(`   进度: ${event.message}`);
      break;

    case 'tool_call_end':
      if (event.result.isError) {
        console.error(`   ❌ 失败: ${event.result.output}`);
      } else {
        console.log(`   ✅ 完成 (${event.result.output.length} 字符)`);
      }
      break;

    case 'tool_approval_needed':
      // 需要用户确认,详见"工具审批"小节
      console.log(`需要审批: ${event.call.name}`);
      break;

    case 'context_compacted':
      console.log(`\n[上下文压缩] ${event.summary}`);
      break;

    case 'warning':
      console.warn(`\n[警告] ${event.text}`);
      break;

    case 'error':
      console.error(`\n[错误] ${event.error.message}`);
      break;

    case 'done':
      console.log(`\n\n完成 (reason: ${event.stopReason})`);
      console.log(`Tokens: ${event.usage.totalTokens}`);
      break;
  }
}
```

---

## 中断运行

### 通过 AbortSignal

```typescript
const controller = new AbortController();

// 5 秒后自动中断
setTimeout(() => controller.abort(), 5000);

for await (const event of runtime.run('一个大任务', { signal: controller.signal })) {
  if (event.type === 'done' && event.stopReason === 'aborted') {
    console.log('已中断');
  }
}
```

### 通过 runtime.abort()

```typescript
// 在另一个地方调用
runtime.abort();
```

---

## 工具审批流程

当权限系统决定某个工具调用需要审批时(`needsApproval: true`),运行时会发出 `tool_approval_needed` 事件并暂停,等待外部决策。

```typescript
import type { PendingApproval } from '@svton/agent-core';

// 从 runtime 获取待审批项
const pending = runtime.getPendingApprovals(); // Map<string, PendingApproval>

for (const [callId, approval] of pending) {
  console.log(`工具: ${approval.call.name}`);
  console.log(`参数: ${JSON.stringify(approval.call.arguments)}`);

  // 用户点击"允许"或"拒绝"
  const userApproved = await showApprovalDialog(approval.call);
  approval.resolve(userApproved);  // true=允许, false=拒绝
}
```

`PendingApproval` 结构:

```typescript
interface PendingApproval {
  call: ToolCall;
  resolve: (approved: boolean) => void;
  timestamp: number;
}
```

如果用户拒绝,工具不会执行,LLM 会收到一条拒绝消息并据此决定下一步。

---

## 其他 API

### getMessages()

获取当前完整的消息历史(包括系统消息、用户消息、助手消息、工具结果):

```typescript
const messages = runtime.getMessages();
```

### setSubagentManager()

由于循环依赖,子代理管理器必须在 runtime 创建后注入:

```typescript
const subagentMgr = new SubagentManager(config, runtime, platform, registry);
runtime.setSubagentManager(subagentMgr);
```

### setPermissionManager() / setHookManager()

运行时更新权限/钩子管理器(会重建 ToolExecutionService):

```typescript
runtime.setPermissionManager(new PermissionManager({ mode: 'accept_edits' }));
runtime.setHookManager(new HookManager());
```

### setReasoningEffort()

控制后续运行的推理强度:

```typescript
runtime.setReasoningEffort('high');
// 支持: 'low' | 'medium' | 'high' | 'xhigh'
```

### switchAgentDefinition()

切换激活的 Agent 定义(对应 `/agent <name>` 命令):

```typescript
runtime.switchAgentDefinition('researcher');
// 会更新系统提示词、权限模式和工具过滤
```

---

## 运行模式(AgentMode)

| 模式 | 说明 |
| --- | --- |
| `default` | 默认模式,读操作自动通过,写操作和命令需审批 |
| `plan` | 规划模式,只允许只读操作,不修改任何文件 |
| `auto` | 全自动模式,所有操作自动批准(慎用) |

```typescript
for await (const event of runtime.run('分析项目结构', { mode: 'plan' })) {
  // 在 plan 模式下,所有写操作会被拒绝
}
```

## 默认最大迭代

`DEFAULT_MAX_ITERATIONS = 50`。如果 Agent 在 50 次工具调用后仍未完成,会自动停止。可以通过 `AgentConfig.maxIterations` 或 `RunOptions.maxIterations` 调整。

## 相关文档

- [index](./index) — agent-core 总览
- [Provider](./provider) — LLM 提供商接口
- [工具系统](./tools) — 工具注册与执行
- [权限系统](./permission) — 运行时权限检查
- [生命周期钩子](./hooks) — 运行时事件拦截
- [记忆系统](./memory) — 上下文注入
- [规划系统](./planning) — 多步骤计划追踪
