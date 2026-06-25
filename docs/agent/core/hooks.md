# 生命周期钩子(Hooks)

> 8 种生命周期事件的钩子机制 — 拦截、修改或拒绝操作，实现日志、审计和预处理。

`HookManager` 提供 8 种生命周期事件的钩子注册和触发机制。钩子可以拦截、修改或拒绝操作,实现日志记录、审计、自定义权限、输入预处理等。

## 快速使用

<Demo name="hooks-flow" :height="500" />

```typescript
import { HookManager } from '@svton/agent-core';

const hookManager = new HookManager();

// 注册工具执行前的审计钩子
hookManager.register({
  event: 'pre_tool_use',
  priority: 100,
  handler: async (ctx) => {
    console.log(`[AUDIT] ${ctx.toolName}:`, ctx.input);
    return { action: 'continue' };
  },
});

// 注册拒绝特定操作的安全钩子
hookManager.register({
  event: 'pre_tool_use',
  priority: 1,
  handler: async (ctx) => {
    if (ctx.toolName === 'bash' && ctx.input.command.includes('rm -rf')) {
      return { action: 'deny', reason: '禁止删除操作' };
    }
    return { action: 'continue' };
  },
});
```

## 8 种钩子事件

| 事件 | 触发时机 | 典型用途 |
| --- | --- | --- |
| `pre_tool_use` | 工具执行前 | 参数校验、审计日志、自定义权限 |
| `post_tool_use` | 工具执行后 | 结果处理、日志记录、自动评审 |
| `permission_request` | 权限检查时 | 动态权限决策 |
| `session_start` | 会话开始 | 加载配置、初始化上下文 |
| `session_end` | 会话结束 | 清理资源、保存状态 |
| `context_compact` | 上下文压缩时 | 自定义压缩策略 |
| `message_sent` | 用户消息发送后 | 输入预处理、敏感信息过滤 |
| `message_received` | 收到 LLM 回复后 | 输出过滤、格式化 |

---

## 类型定义

### HookEvent

```typescript
type HookEvent =
  | 'pre_tool_use'
  | 'post_tool_use'
  | 'permission_request'
  | 'session_start'
  | 'session_end'
  | 'context_compact'
  | 'message_sent'
  | 'message_received';
```

### HookContext

```typescript
interface HookContext {
  event: HookEvent;
  toolName?: string;
  toolCall?: ToolCall;
  toolResult?: ToolResult;
  [key: string]: unknown;    // 可扩展任意字段
}
```

### HookResult

钩子处理函数的返回值,控制后续流程:

```typescript
type HookResult =
  | { action: 'continue' }                              // 继续(默认)
  | { action: 'modify'; updates: Record<string, unknown> }  // 修改上下文
  | { action: 'deny'; reason: string }                  // 拒绝操作
  | { action: 'approve' };                              // 批准操作
```

### HookHandler

```typescript
type HookHandler = (ctx: HookContext) => Promise<HookResult>;
```

### HookConfig

```typescript
interface HookConfig {
  event: HookEvent;
  handler: HookHandler;
  id?: string;          // 可选的唯一 ID
  priority?: number;    // 优先级,数字越小越早执行,默认 100
}
```

---

## HookManager API

### 构造函数

```typescript
import { HookManager } from '@svton/agent-core';

const hookManager = new HookManager();
```

### register()

注册钩子,返回钩子 ID(可用于后续注销):

```typescript
register(config: HookConfig): string;
```

```typescript
// 注册一个 pre_tool_use 钩子
const hookId = hookManager.register({
  event: 'pre_tool_use',
  priority: 10,
  handler: async (ctx) => {
    console.log(`[审计] 工具: ${ctx.toolName}`);
    console.log(`[审计] 参数: ${JSON.stringify(ctx.toolCall?.arguments)}`);
    return { action: 'continue' };
  },
});
```

### unregister()

通过事件类型和钩子 ID 注销:

```typescript
unregister(event: HookEvent, id: string): boolean;
```

```typescript
hookManager.unregister('pre_tool_use', hookId);
```

### trigger()

触发指定事件的所有钩子,返回合并结果:

```typescript
async trigger(event: HookEvent, context: HookContext): Promise<HookResult>;
```

触发逻辑:
1. 按 priority 升序获取该事件的所有钩子。
2. 依次执行每个钩子。
3. 如果返回 `deny`,立即停止并返回拒绝。
4. 如果返回 `modify`,将 `updates` 合并到上下文中。
5. `continue` 和 `approve` 继续执行下一个钩子。
6. 钩子抛异常会被 catch 并记录,不影响后续钩子。

### clear()

清除钩子:

```typescript
clear(event?: HookEvent): void;
// 不传 event 则清除所有钩子
```

### listHooks()

列出所有已注册的钩子(仅元数据,不含 handler):

```typescript
listHooks(): Array<{ event: HookEvent; id: string; priority: number }>;
```

---

## 使用场景

### 1. 工具调用审计日志

```typescript
hookManager.register({
  event: 'pre_tool_use',
  handler: async (ctx) => {
    appendToAuditLog({
      timestamp: Date.now(),
      tool: ctx.toolName,
      args: ctx.toolCall?.arguments,
    });
    return { action: 'continue' };
  },
});

hookManager.register({
  event: 'post_tool_use',
  handler: async (ctx) => {
    appendToAuditLog({
      timestamp: Date.now(),
      tool: ctx.toolName,
      success: !ctx.toolResult?.isError,
      outputLength: ctx.toolResult?.output.length,
    });
    return { action: 'continue' };
  },
});
```

### 2. 危险命令拦截

```typescript
hookManager.register({
  event: 'pre_tool_use',
  priority: 1,  // 高优先级,最先执行
  id: 'block-dangerous-commands',
  handler: async (ctx) => {
    if (ctx.toolName === 'bash') {
      const cmd = (ctx.toolCall?.arguments as any)?.command as string;
      const dangerous = ['rm -rf', 'mkfs', 'dd if=', '> /dev/sda'];
      if (dangerous.some(d => cmd.includes(d))) {
        return { action: 'deny', reason: `危险命令被拦截: ${cmd}` };
      }
    }
    return { action: 'continue' };
  },
});
```

### 3. 修改工具参数

```typescript
hookManager.register({
  event: 'pre_tool_use',
  handler: async (ctx) => {
    if (ctx.toolName === 'file_write') {
      // 强制所有写入操作都添加备份
      return {
        action: 'modify',
        updates: {
          toolCall: {
            ...ctx.toolCall!,
            arguments: {
              ...ctx.toolCall!.arguments,
              createBackup: true,
            },
          },
        },
      };
    }
    return { action: 'continue' };
  },
});
```

### 4. 会话生命周期管理

```typescript
hookManager.register({
  event: 'session_start',
  handler: async (ctx) => {
    console.log('会话开始,加载配置...');
    // 加载用户偏好、初始化资源等
    return { action: 'continue' };
  },
});

hookManager.register({
  event: 'session_end',
  handler: async (ctx) => {
    console.log('会话结束,保存状态...');
    // 保存会话状态、清理临时文件等
    return { action: 'continue' };
  },
});
```

### 5. 自动代码审查

```typescript
hookManager.register({
  event: 'post_tool_use',
  handler: async (ctx) => {
    if (ctx.toolName === 'file_write' || ctx.toolName === 'file_edit') {
      // 工具写入文件后自动触发代码审查
      const review = await autoReviewer.review({
        file: (ctx.toolCall?.arguments as any)?.path,
      });
      if (review.hasIssues) {
        return {
          action: 'modify',
          updates: {
            toolResult: {
              ...ctx.toolResult!,
              output: ctx.toolResult!.output + '\n\n[审查建议] ' + review.feedback,
            },
          },
        };
      }
    }
    return { action: 'continue' };
  },
});
```

---

## 与 AgentRuntime 集成

```typescript
const runtime = await AgentRuntime.createAsync(
  {
    provider,
    model: 'claude-sonnet-4-20250514',
    toolRegistry,
    capabilities: {
      hookManager,
    },
  },
  platform,
);
```

集成后,runtime 会在以下时机自动触发钩子:

| 时机 | 事件 |
| --- | --- |
| 每次 `run()` 开始 | `session_start` |
| 工具执行前 | `pre_tool_use` |
| 工具执行后 | `post_tool_use` |
| 上下文压缩时 | `context_compact` |
| 会话结束 | `session_end` |

也可以运行时更新:

```typescript
runtime.setHookManager(new HookManager());
```

---

## 优先级与执行顺序

钩子按 `priority` 升序执行(数字越小越早)。同优先级的钩子按注册顺序执行。

```typescript
hookManager.register({ event: 'pre_tool_use', priority: 1, handler: fn1 });  // 最先
hookManager.register({ event: 'pre_tool_use', priority: 50, handler: fn2 }); // 中间
hookManager.register({ event: 'pre_tool_use', priority: 100, handler: fn3 }); // 最后(默认)
```

一旦某个钩子返回 `deny`,后续钩子不会执行。

## 最佳实践

- **审计钩子用低优先级**:确保在其他钩子之后执行,记录最终决策。
- **安全拦截用高优先级**(如 `priority: 1`):在所有其他钩子之前拦截。
- **钩子要快速**:钩子是同步等待的,慢钩子会阻塞整个 ReAct 循环。
- **异常处理**:钩子内的异常会被自动 catch,不会中断 Agent,但应尽量避免。
- **使用唯一 ID**:为重要钩子指定 `id`,方便后续动态移除。

## 相关文档

- [index](./index) — agent-core 总览
- [AgentRuntime](./runtime) — 运行时触发各种钩子事件
- [权限系统](./permission) — `permission_request` 钩子与权限系统协作
- [工具系统](./tools) — `pre_tool_use` / `post_tool_use` 钩子
