# Issue #002: OpenAI SSE 流不发射 tool_call_end 事件

**日期**: 2026-06-02
**严重级别**: CRITICAL
**状态**: FIXED

## 现象

使用 OpenAI 兼容 provider（DeepSeek、Ollama 等）时，tool 调用的 UI 卡片永远显示蓝色闪烁点（running 状态），即使 AI 已停止输出。

## 根因

OpenAI provider 的 `parseSSEStream()` 方法处理 SSE 流时：
- `tool_call_start` — 正常发射 ✓
- `tool_call_delta` — 累积参数但不发射给上层 ✓
- `tool_call_end` — **从未发射** ✗

OpenAI SSE 格式中，tool call 的参数通过 `delta.tool_calls` 增量传输，没有显式的 "end" 事件。provider 在流结束（`[DONE]` 或 `finish_reason`）时只发射了 `done`，没有合成 `tool_call_end`。

对比：Anthropic provider 在 `content_block_stop` 时正确发射了 `tool_call_end`。

## 修复

在 `parseSSEStream()` 中：
1. 维护 `toolCallBuffers` Map 追踪每个 tool call 的参数累积
2. 在流结束时（`[DONE]` 和 `finish_reason`），调用 `flushToolCallBuffers()` 为每个累积的 tool call 合成 `tool_call_end` 事件

**修改文件**: `ai/agent-core/src/provider/openai.ts`

## 教训

- OpenAI SSE 格式与 Anthropic SSE 格式在 tool call 生命周期管理上有本质差异
- 每个 provider 必须确保发射完整的工具调用生命周期：`start → delta → end`
