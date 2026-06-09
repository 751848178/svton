# Issue #006: DeepSeek 思考过程未展示

**日期**: 2026-06-02
**严重级别**: MEDIUM
**状态**: FIXED

## 现象

使用 DeepSeek 模型时，思考/推理过程只显示少量文本，不是完整的思考内容。

## 根因

两个独立问题叠加：

### 问题 A: OpenAI provider 不提取 reasoning_content
DeepSeek 模型在 SSE 流中通过 `delta.reasoning_content` 字段返回推理内容。OpenAI provider 的 `parseSSEStream()` 只处理了 `delta.content`（文本）和 `delta.tool_calls`（工具调用），完全忽略了 `reasoning_content`。

### 问题 B: ThinkingBlock 默认折叠且预览过短
`ThinkingBlock` 组件默认 `open=false`，折叠时仅显示第一行前 80 字符。用户看到的是截断预览而非完整内容。

## 修复

**A**: 在 `parseSSEStream()` 中添加 `reasoning_content` 提取：
```typescript
if (delta?.reasoning_content) {
  yield { type: 'thinking_delta', thinking: delta.reasoning_content };
}
```

**B**: `ThinkingBlock` 改为默认展开，预览改为 3 行/200 字符，添加行数提示。

**修改文件**:
- `ai/agent-core/src/provider/openai.ts`
- `packages/ui/src/components/chat/ChatMessage.tsx`

## 教训

- 不同 LLM provider 使用不同字段名返回思考内容（Anthropic: `thinking`，DeepSeek: `reasoning_content`）
- Provider 实现应该兼容所有已知供应商的特殊字段
- UI 组件的默认状态应优先展示信息（展开），而非隐藏信息（折叠）
