# Issue #013: Tool Executor 输入校验缺失 + Plan 集成耦合 + Thinking 多轮合并

**日期**: 2026-06-02
**严重级别**: MEDIUM
**状态**: FIXED

## 现象

1. 9 个工具执行器（WebSearch, WebFetch, Bash, Grep, Glob, FileRead, FileWrite, FileEdit, SubagentSpawn）没有输入参数校验
2. ChatService 的 Plan 联动通过正则解析 markdown 文本实现（与 formatPlan 输出格式强耦合）
3. 多轮 ReAct 循环的 thinking 内容合并在一个 block 中展示（反直觉）

## 根因

### A. 工具执行器无参数校验

所有工具执行器都使用 `call.arguments as { ... }` 模式解构，没有运行时校验。如果 LLM 传递了错误/缺失的参数：
- 错误会传播到平台层（platform.fs / platform.search / fetch），产生不可读的错误信息
- FileEditExecutor 中空字符串 `old_string` 会导致 `replaceAll('', new_string)` 在每个字符之间插入内容，**破坏文件**

### B. Plan 联动耦合在文本解析

`ChatService.updatePlanProgress()` 用正则从 `formatPlan()` 的 markdown 输出中解析 planId、title、steps。这依赖 formatPlan 的输出格式不变 — 如果 PlanningManager 修改了 formatPlan 的格式，ChatService 也会静默失效。

### C. Thinking 多轮合并

ChatService 只有一个 `thinking` 字段，所有 ReAct 迭代的 thinking 都追加到同一个字符串。用户无法区分第一次思考和工具执行后的第二次思考。

## 修复

### A. 输入校验（9 个执行器）

在所有执行器的 `execute()` 方法顶部添加参数校验：
- 必填参数检查 null/undefined/type
- 类型不匹配时返回清晰的错误信息
- FileEditExecutor 额外检查 `old_string` 不能为空字符串
- FileReadExecutor 检查 offset/limit 为正整数
- BashExecutor 检查 timeout 为正数

### B. Plan 集成解耦

- PlanCreateExecutor、PlanGetStatusExecutor、PlanUpdateStepExecutor 在 `ToolResult.metadata` 中返回 `planProgress` 结构化数据
- `ChatService.updatePlanProgress()` 直接读取 `metadata.planProgress`，不再用正则解析 markdown

```typescript
// 之前（耦合）
const planIdMatch = output.match(/Plan ID: (plan_\S+)/);
const stepRegex = /^\[([ x~!\-])\] (step_\d+): (.+)$/gm;

// 之后（解耦）
const progress = result.metadata.planProgress as PlanProgress;
this.activePlan = { planId: progress.planId, title: progress.title, steps: progress.steps };
```

### C. Thinking 分隔

- ChatService 新增 `lastEventType` 追踪
- `thinking_delta` 到来时，如果 `lastEventType === 'tool_call_end'`（标志新一轮 ReAct 迭代），在 thinking 前插入 `\n---\n` 分隔符

**修改文件**:
- `ai/agent-core/src/tool/builtins/web.ts` — WebSearchExecutor + WebFetchExecutor 校验
- `ai/agent-core/src/tool/builtins/shell.ts` — BashExecutor 校验
- `ai/agent-core/src/tool/builtins/search.ts` — GrepExecutor + GlobExecutor 校验
- `ai/agent-core/src/tool/builtins/file.ts` — FileRead/Write/EditExecutor 校验
- `ai/agent-client/src/service/chat.service.ts` — metadata 读取 + thinking 分隔 + SubagentSpawnExecutor 校验
- `apps/agent-web/src/lib/agent-setup.ts` — Plan 执行器返回 metadata.planProgress

## 教训

- `ToolResult.metadata` 是工具与 UI 层传递结构化数据的正确通道，不应依赖文本格式的正则解析
- 所有工具执行器必须在入口处校验参数 — `as` 类型断言不提供运行时安全
- 空字符串是有效的 string 类型，但作为搜索/替换模式会产生灾难性后果，必须显式拦截
- 状态机的状态转换（thinking → tool_call → thinking）可以用来触发 UI 行为
