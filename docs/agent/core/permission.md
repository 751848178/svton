# 权限系统(Permission)

> 控制工具调用权限 — 5 种模式 + 精细规则系统，平衡自动化效率与安全。

`PermissionManager` 控制工具调用的权限,决定哪些工具可以自动执行、哪些需要用户审批、哪些被完全禁止。通过 5 种模式和精细的规则系统,平衡自动化效率与安全。

## 快速使用

<Demo name="permission-modes" :height="500" />

```typescript
import { PermissionManager } from '@svton/agent-core';

const permission = new PermissionManager({
  mode: 'default',  // 只读工具自动通过,写操作需审批
  rules: [
    { tool: 'bash(git *)', effect: 'allow' },   // 允许 git 命令
    { tool: 'bash(rm *)', effect: 'deny' },      // 禁止 rm 命令
  ],
});

// 检查工具权限
const decision = permission.check('file_edit', { path: '/README.md' });
// → { allowed: false, needsApproval: true }
```

## 5 种权限模式

| 模式 | 说明 | 只读工具 | 文件编辑 | Shell 命令 |
| --- | --- | --- | --- | --- |
| `read_only` | 只读模式 | 自动允许 | 拒绝 | 拒绝 |
| `plan` | 规划模式 | 自动允许 | 拒绝 | 拒绝 |
| `default` | 默认模式 | 自动允许 | 需审批 | 需审批 |
| `accept_edits` | 接受编辑 | 自动允许 | 自动允许 | 需审批 |
| `auto` | 全自动 | 自动允许 | 自动允许 | 自动允许 |

### 只读工具列表

以下工具在所有非 `auto` 模式下都被视为只读:

```typescript
const readOnlyTools = [
  'file_read', 'grep', 'glob',
  'web_search', 'web_fetch',
  'screenshot', 'chrome_screenshot', 'chrome_get_content',
  'scroll', 'mouse_move',
];
```

### 编辑工具列表

```typescript
const editTools = ['file_write', 'file_edit'];
```

---

## 类型定义

### PermissionMode

```typescript
type PermissionMode = 'read_only' | 'plan' | 'default' | 'accept_edits' | 'auto';
```

### PermissionRule

```typescript
interface PermissionRule {
  tool: string;               // 工具名或模式,如 "Bash" 或 "Bash(git *)"
  effect: 'allow' | 'ask' | 'deny';
}
```

### PermissionConfig

```typescript
interface PermissionConfig {
  mode: PermissionMode;
  rules: PermissionRule[];
}
```

### PermissionDecision

```typescript
interface PermissionDecision {
  allowed: boolean;
  needsApproval: boolean;
  reason?: string;
}
```

---

## PermissionManager API

### 构造函数

```typescript
new PermissionManager(config?: Partial<PermissionConfig>);
// 默认: { mode: 'default', rules: [] }
```

```typescript
import { PermissionManager } from '@svton/agent-core';

const pm = new PermissionManager({
  mode: 'default',
  rules: [
    { tool: 'bash', effect: 'ask' },
    { tool: 'file_write', effect: 'allow' },
    { tool: 'file_delete', effect: 'deny' },
  ],
});
```

### check()

检查工具调用是否被允许:

```typescript
check(toolCall: ToolCall): PermissionDecision;
```

```typescript
const decision = pm.check({
  id: 'call_1',
  name: 'bash',
  arguments: { command: 'rm -rf /' },
});

if (!decision.allowed) {
  console.log(`拒绝: ${decision.reason}`);
} else if (decision.needsApproval) {
  console.log('需要用户审批');
  // 展示审批对话框
} else {
  console.log('自动允许');
}
```

### setMode() / getMode()

动态切换权限模式:

```typescript
pm.setMode('accept_edits');
console.log(pm.getMode());  // 'accept_edits'
```

### addRule() / removeRule()

添加/移除规则:

```typescript
pm.addRule({ tool: 'bash(git *)', effect: 'allow' });
pm.addRule({ tool: 'bash(rm *)', effect: 'deny' });
pm.removeRule('bash');
```

---

## 规则匹配

### 匹配优先级

`deny > ask > allow`,即:
1. 先检查是否有匹配的 `deny` 规则 → 拒绝
2. 再检查 `ask` 规则 → 需要审批
3. 再检查 `allow` 规则 → 允许
4. 都不匹配 → 使用模式默认行为

### 工具名模式

规则支持两种匹配方式:

```typescript
// 精确匹配
{ tool: 'bash', effect: 'ask' }

// 带参数的 Glob 匹配
{ tool: 'bash(git *)', effect: 'allow' }  // 匹配 bash 工具且参数包含 "git "
{ tool: 'bash(rm *)', effect: 'deny' }    // 匹配 bash 工具且参数包含 "rm "
```

Glob 模式中:
- `*` 匹配任意字符序列
- `?` 匹配单个字符
- 匹配对象是 `JSON.stringify(toolCall.arguments)` 的结果

---

## 模式默认行为

当没有规则匹配时,根据当前模式决定:

### read_only 模式

```typescript
// 只读工具 → 允许
{ allowed: true, needsApproval: false }

// 其他工具 → 拒绝
{ allowed: false, needsApproval: false, reason: 'Read-only mode' }
```

### plan 模式

```typescript
// 只读工具 → 允许
// 其他工具 → 拒绝(reason: 'Plan mode - no modifications allowed')
```

### default 模式

```typescript
// 只读工具 → 允许
// 其他工具 → 允许但需审批
{ allowed: true, needsApproval: true, reason: 'Requires approval' }
```

### accept_edits 模式

```typescript
// 只读工具 + 编辑工具 → 允许
// 其他工具(shell 等) → 允许但需审批
```

### auto 模式

```typescript
// 所有工具 → 允许,不需要审批
{ allowed: true, needsApproval: false }
```

---

## 与 AgentRuntime 集成

将 PermissionManager 注入到 runtime:

```typescript
const runtime = await AgentRuntime.createAsync(
  {
    provider,
    model: 'claude-sonnet-4-20250514',
    toolRegistry,
    capabilities: {
      permissionManager: pm,
    },
  },
  platform,
);
```

集成后的工具调用流程:

```
LLM 请求工具调用
       ↓
  PermissionManager.check()
       ↓
  ┌─────────────────────────────┐
  │ allowed && !needsApproval   │ → 自动执行
  │ allowed && needsApproval    │ → 发出 tool_approval_needed 事件
  │ !allowed                    │ → 返回拒绝消息给 LLM
  └─────────────────────────────┘
```

### 运行时动态切换

```typescript
// 用户在 UI 上切换模式
runtime.setPermissionManager(new PermissionManager({ mode: 'accept_edits' }));

// 或直接修改现有 manager
pm.setMode('auto');
```

### 通过 RunOptions 控制模式

```typescript
// 本次运行使用 plan 模式
for await (const event of runtime.run('分析项目', { mode: 'plan' })) {
  // ...
}
```

---

## 工具审批处理

当 `check()` 返回 `needsApproval: true` 时,runtime 会暂停并发出 `tool_approval_needed` 事件:

```typescript
for await (const event of runtime.run('删除临时文件')) {
  if (event.type === 'tool_approval_needed') {
    console.log(`工具: ${event.call.name}`);
    console.log(`参数: ${JSON.stringify(event.call.arguments)}`);

    // 展示 UI,获取用户决策
    const approved = await showApprovalDialog(event.call);

    // 从 runtime 的 pendingApprovals 中 resolve
    const pending = runtime.getPendingApprovals().get(event.call.id);
    if (pending) {
      pending.resolve(approved);  // true=执行, false=拒绝
    }
  }
}
```

---

## 最佳实践

- **生产环境用 `default`**:平衡自动化和安全。
- **CI/CD 用 `auto`**:无人值守场景,确保所有操作自动执行。
- **探索阶段用 `plan`**:让 Agent 只分析不修改。
- **快速编辑用 `accept_edits`**:文件操作自动通过,命令仍需审批。
- **用规则细化控制**:例如允许 `git` 命令但禁止 `rm` 命令:

```typescript
rules: [
  { tool: 'bash(git *)', effect: 'allow' },
  { tool: 'bash(rm *)', effect: 'deny' },
  { tool: 'bash', effect: 'ask' },
]
```

## 相关文档

- [index](./index) — agent-core 总览
- [AgentRuntime](./runtime) — 运行时权限检查
- [工具系统](./tools) — annotations 影响权限判断
- [生命周期钩子](./hooks) — `permission_request` 钩子可自定义决策
- [自定义 Agent](./agent-definition) — 通过 AgentDefinition 配置权限模式
