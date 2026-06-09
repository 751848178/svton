# Issue #007: 工具调用参数 UI 显示为空 {}

**日期**: 2026-06-02
**严重级别**: LOW
**状态**: FIXED

## 现象

ToolCallCard 中参数区域始终显示 `{}`，即使工具接收了实际参数。

## 根因

OpenAI SSE 格式的 tool call 生命周期：
1. `delta.tool_calls[i].function.name` 存在时 → `tool_call_start`（此时无 arguments）
2. 后续 chunks 中 `delta.tool_calls[i].function.arguments` 增量传输参数
3. 流结束时无显式 end 事件

Runtime 在 `tool_call_start` 时 yield `arguments: {}`（空对象）。ChatService 将此空对象存入 `DisplayToolCall.arguments`。

虽然 runtime 在 `tool_call_end` 后解析了完整参数，但 `AgentEvent.tool_call_end` 只携带 `ToolResult`，不包含解析后的参数。ChatService 的 `tool_call_end` handler 更新 status/result 但保留原始空 `arguments`。

## 修复

1. 扩展 `AgentEvent.tool_call_progress` 类型，添加可选 `arguments` 字段
2. Runtime 在执行工具前，yield `tool_call_progress` 携带解析后的参数
3. ChatService 处理 `tool_call_progress` 事件，更新 `DisplayToolCall.arguments`

**修改文件**:
- `ai/agent-core/src/agent/types.ts`
- `ai/agent-core/src/agent/runtime.ts`
- `ai/agent-client/src/service/chat.service.ts`

## 教训

- 事件驱动的 UI 更新需要确保每个状态的变更都有对应的事件通知
- `tool_call_start` 到 `tool_call_end` 之间有参数解析的中间状态，需要专门的更新事件
- `tool_call_progress` 是已有的扩展点，应优先利用而非创建新事件类型
