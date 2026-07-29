# TauriPlatform

`TauriPlatform` 是 Agent Desktop 的系统能力适配器。Core、Client、SDK 和 UI
不直接调用 Tauri；它们只依赖 `IPlatform`。

## 安装与创建

```typescript
import { TauriPlatform, setPlatform } from '@svton/agent-platform';

const platform = new TauriPlatform();
setPlatform(platform);
```

`TauriPlatform` 从包根导出，不需要单独子路径。

## 能力

| 属性 | 实现 |
| --- | --- |
| `fs` | 文件读写、编辑、删除、stat、目录、watch 和 path 操作 |
| `process` | 命令执行、子进程、stdin、abort/timeout |
| `storage` | Tauri 持久化 key-value store |
| `search` | grep/glob |
| `sandbox` | macOS Seatbelt 等平台沙箱 |
| `preview` | PDF/Excel/PPTX 等文档预览 |
| `http` | 默认通过原生 curl 路径绕过 WebView CORS |
| `computerUse` | 截屏、鼠标和键盘 Tauri command |

所有底层操作通过 `invoke()` 到 Rust command，但这个细节被限制在
`agent-platform/src/tauri.ts` 内。

## 与 Agent 集成

```typescript
import { createAgent } from '@svton/agent-sdk';
import { TauriPlatform } from '@svton/agent-platform';

const agent = await createAgent({
  provider: {
    type: 'openai',
    apiKey: process.env.OPENAI_API_KEY!,
  },
  model: 'gpt-4o',
  platform: new TauriPlatform(),
  workingDir: '/Users/me/project',
});
```

或直接创建 Core runtime：

```typescript
import {
  SvtonAgentRuntime,
  ToolRegistry,
  createPiModelsForProvider,
} from '@svton/agent-core';
import { TauriPlatform } from '@svton/agent-platform';

const { models, model } = createPiModelsForProvider('gpt-4o', {
  family: 'openai',
  apiKey,
});

const runtime = await SvtonAgentRuntime.createAsync(
  {
    models,
    piModel: model,
    model: 'gpt-4o',
    toolRegistry: new ToolRegistry(),
    workingDir,
  },
  new TauriPlatform(),
);
```

## 原生 Pi 流

Tauri 不改变 Runtime 事件：

```typescript
for await (const event of runtime.run('检查项目')) {
  if (
    event.type === 'message_update'
    && event.assistantMessageEvent.type === 'text_delta'
  ) {
    renderText(event.assistantMessageEvent.delta);
  }

  if (event.type === 'tool_execution_update') {
    renderToolProgress(event.toolCallId, event.partialResult);
  }

  if (event.type === 'agent_end') {
    persistSettledView();
  }
}
```

Pi 负责消息、工具和 Agent 生命周期。Tauri 只执行被 Svton security pipeline
允许的系统操作。

## 文件系统

```typescript
const platform = new TauriPlatform();

await platform.fs.writeFile('/tmp/example.txt', 'hello');
const text = await platform.fs.readFile('/tmp/example.txt');
const entries = await platform.fs.listDir('/tmp');
```

## 进程与取消

```typescript
const controller = new AbortController();
const result = await platform.process.exec('pnpm test', {
  cwd: '/workspace',
  timeout: 120_000,
  signal: controller.signal,
});
```

`ExecResult` 包含 `stdout`、`stderr`、`exitCode`、`signal` 和 `timedOut`。

## HTTP

```typescript
const response = await platform.http.request('https://example.com/api', {
  method: 'GET',
  timeoutMs: 30_000,
});
```

Desktop 默认 HTTP 实现使用 `CurlHttpClient` 和 `platform.process.exec`，
避免 WKWebView CORS。测试可替换 `platform.http` 为确定性 mock。

## Computer Use

```typescript
await platform.computerUse.invoke('mouse_click', { x: 320, y: 240 });
await platform.computerUse.invoke('keyboard_type', { text: 'hello' });
```

Computer Use commands 必须通过已注册的 Agent tools 进入；调用前仍会经过
permission、approval、auto-review、sandbox、hooks、redaction 和 audit。

## Desktop 产品路径

真实桌面验收应同时证明：

1. `tauri dev` 启动实际 App 进程和 WKWebView；
2. WKWebView 内的 `AgentProvider → ChatService → SvtonAgentRuntime` 完成一轮；
3. UI 消费 native Pi stream 并回到 idle；
4. 至少一个真实 Tauri IPC command 成功；
5. 测试进程、端口和临时资源被清理。

单独的 Vite build、jsdom 测试或 Rust unit test 不能替代上述产品路径。

## 安全边界

- Runtime 不直接 `invoke()`；
- tool executor 只能通过 `IPlatform`；
- MCP、Subagent 与内置工具共享同一安全管线；
- API key 不写入 Display/Session DTO、日志或 UI；
- Desktop provider seam 必须默认关闭，且只允许测试显式启用。

## 相关文档

- [Platform 总览](./)
- [集成指南](../integration)
- [Core runtime](../core/runtime)
- [权限](../core/permission)
