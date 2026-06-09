# Issue #011: ReAct 循环在工具调用后提前终止

**日期**: 2026-06-02
**严重级别**: CRITICAL
**状态**: FIXED

## 现象

工具执行完成后（如 subagent_spawn），AI 停止响应。`completions` 请求已返回 `[DONE]`，但 ReAct 循环不再继续，LLM 无法看到工具结果。

## 根因

`AgentRuntime.run()` 的终止条件：

```typescript
if (toolCalls.length === 0 ||
    (stopReason !== 'tool_use' && stopReason !== 'tool_calls')) {
  yield done; return;
}
```

这是 OR 条件——只要任一侧为 true 就终止。问题场景：

1. LLM 返回 tool calls（`toolCalls.length > 0`）
2. 但 `stopReason` 是 `'stop'`（某些 provider 即使有 tool calls 也返回 `'stop'`）
3. 第二个条件为 true → 循环终止
4. 工具被执行了，但 LLM 永远看不到结果
5. 下一次迭代不会发生

DeepSeek 模型在返回 tool calls 时 `finish_reason` 为 `"tool_calls"`，但某些 OpenAI 兼容 provider 可能返回 `"stop"`。

## 修复

只要存在 tool calls，就继续循环。`stopReason` 不应作为终止条件：

```typescript
if (toolCalls.length === 0) {
  yield done; return;
}
```

LLM 明确选择了调用工具，就应该让循环继续，让 LLM 处理工具结果。

**修改文件**: `ai/agent-core/src/agent/runtime.ts`

## 教训

- ReAct 循环的终止条件应以**实际行为**（是否有 tool calls）为准，而非依赖 provider 的 stopReason
- 不同 provider 对 `finish_reason` 的实现不一致，不能假设所有 provider 都遵循同一规范
- 工具调用执行后不继续循环 = 白白浪费了工具执行的结果
