# Issue #010: OpenAI provider 参数重复累积导致 JSON 解析失败

**日期**: 2026-06-02
**严重级别**: CRITICAL
**状态**: FIXED

## 现象

工具授权弹窗和 ToolCallCard 中参数显示为 `{"raw": "{\"title\": ...}"}`，而非可读的 `{"title": "..."}`。

## 根因

OpenAI provider 的 `parseSSEStream()` 中，第一个 chunk 同时包含 `tc.function.name` 和 `tc.function.arguments` 时：

```typescript
// 第一个 if: tc.function?.name 存在
if (tc.function?.name) {
  toolCallBuffers.set(idx, {
    id: tc.id,
    name: tc.function.name,
    args: tc.function.arguments || '',  // ← 捕获了初始 arguments
  });
}
// 第二个 if: tc.function?.arguments 也存在（同一个 chunk）
if (tc.function?.arguments) {
  const buf = toolCallBuffers.get(idx);
  if (buf) buf.args += tc.function.arguments;  // ← 又追加了一次！
}
```

同一个 chunk 的 arguments 被**累积了两次**。例如 `"{"title":"` 变成 `"{"title":"{"title":"`，`JSON.parse` 失败后回退到 `{raw: buf.args}`。

## 修复

第一个 `if` 中始终设置 `args: ''`，让第二个 `if` 统一处理所有 argument 累积。

**修改文件**: `ai/agent-core/src/provider/openai.ts`

## 教训

- OpenAI SSE 的 tool call 第一个 chunk 可能同时包含 `name` 和 `arguments`
- 两个 `if` 块在同一轮循环中都会执行，必须确保不重复处理
- 参数解析失败时的 `{raw: ...}` 回退格式应在 UI 层做二次解析兜底
