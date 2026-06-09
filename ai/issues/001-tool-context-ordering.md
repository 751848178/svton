# Issue #001: tool role 消息顺序错误导致 OpenAI API 400

**日期**: 2026-06-02
**严重级别**: CRITICAL
**状态**: FIXED

## 现象

AI 回复包含 tool 调用时，后续 API 调用返回 400 错误：
```
Messages with role 'tool' must be a response to a preceding message with 'tool_calls'
```

## 根因

`AgentRuntime.run()` 的流式循环中，`tool_call_end` 事件到达时**立即执行工具**并调用 `addToolResultToContext()` 添加 `tool` role 消息。但 assistant 消息（包含 `tool_use` blocks）直到流式循环**结束后**才通过 `buildAssistantMessage()` 添加。

**错误的上下文顺序**:
```
tool result (addToolResultToContext) ← 在流循环内
assistant message with tool_use      ← 在流循环后
```

OpenAI API 要求 assistant 带 `tool_calls` 必须在 `tool` 结果之前。

## 修复

将工具执行从流式循环中移出，改为流结束后按正确顺序执行：

1. 流循环中仅收集 ToolCall（不执行）
2. 流结束后先添加 assistant 消息到 context
3. 再逐个执行工具，添加 tool result

**修改文件**: `ai/agent-core/src/agent/runtime.ts`

## 教训

- ReAct 循环中，context 消息的**添加顺序**必须严格匹配 OpenAI/Anthropic API 要求
- 流式事件处理和 context 管理是两个独立关注点，不应在同一阶段混合处理
