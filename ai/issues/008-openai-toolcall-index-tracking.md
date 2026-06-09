# Issue #008: OpenAI SSE 流中 tool call 参数始终为空 {}

**日期**: 2026-06-02
**严重级别**: CRITICAL
**状态**: FIXED

## 现象

所有 tool call 的参数显示为 `{}`。LLM 收到错误后不断重试，形成死循环。

## 根因

OpenAI SSE 流式格式中，tool call 分多次传输：

```
Chunk 1: { index: 0, id: "call_abc", function: { name: "plan_create", arguments: "" } }
Chunk 2: { index: 0, function: { arguments: "{\"title\":" } }
Chunk 3: { index: 0, function: { arguments: "\"My Plan\"}" } }
```

**关键点**: `id` 仅在第一个 chunk 中存在。后续 chunk 只有 `index`。

原始代码用 `tc.id` 作为 `toolCallBuffers` 的 key：
```typescript
const buf = toolCallBuffers.get(tc.id);  // tc.id === undefined in subsequent chunks!
```

`Map.get(undefined)` 返回 `undefined`，参数永远不会被累积到 buffer 中。

## 修复

改用 `tc.index`（每个 chunk 都有）作为 key，在第一个 chunk 中记录 `id`：

```typescript
const toolCallBuffers = new Map<number, { id: string; name: string; args: string }>();
// ...
const idx = tc.index ?? 0;
if (tc.function?.name) {
  toolCallBuffers.set(idx, { id: tc.id, name: tc.function.name, args: '' });
}
if (tc.function?.arguments) {
  const buf = toolCallBuffers.get(idx);  // idx always present!
  if (buf) buf.args += tc.function.arguments;
}
```

**修改文件**: `ai/agent-core/src/provider/openai.ts`

## 教训

- 不同 LLM provider 的 SSE 格式有细微差异，OpenAI 的 tool call 用 `index` 追踪增量
- 任何基于流式增量累积的逻辑，必须使用**每个 chunk 都存在**的字段作为 key
- `id` 是「首次出现」字段，不适合作为增量累积的 key
