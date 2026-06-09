# Issue #009: 会话保存丢失 thinking 内容和多轮对话

**日期**: 2026-06-02
**严重级别**: CRITICAL
**状态**: FIXED

## 现象

1. 页面刷新后，只有第一轮对话保留
2. 思考内容（thinking）刷新后完全丢失

## 根因

### 问题 A: 转换函数丢弃所有扩展字段

`displayToChatMessages()` 把 `DisplayMessage` 映射为 `ChatMessage` 时只保留 `{ role, content }`：

```typescript
function displayToChatMessages(msgs: DisplayMessage[]): ChatMessage[] {
  return msgs.map((m) => ({ role: m.role, content: m.content }));
  // thinking, toolCalls, error 全部丢弃
}
```

`ChatMessage` 类型（来自 agent-core）没有 `thinking` 字段，即使想保留也无法通过类型系统。

### 问题 B: SessionData.messages 类型限制

```typescript
interface SessionData {
  messages: ChatMessage[];  // 类型限制导致只能存 ChatMessage 格式
}
```

## 修复

1. `SessionData.messages` 类型改为 `unknown[]`，解除类型限制
2. 新增 `displayToStoredMessages()` / `storedToDisplayMessages()` 转换函数
3. 直接序列化/反序列化 DisplayMessage 的关键字段（role, content, thinking），不经 ChatMessage 中转
4. `loadMessages()` 仍然为 runtime context 做 DisplayMessage → ChatMessage 的转换（runtime 只需要 role + content）

**修改文件**:
- `ai/agent-client/src/service/session.service.ts` — SessionData.messages 类型
- `ai/agent-client/src/hooks/useSession.ts` — 新的转换函数

## 教训

- 会话持久化应直接序列化 UI 层的 DisplayMessage，而非经 ChatMessage 中转
- ChatMessage 是 LLM API 层的类型，不包含 UI 展示信息（thinking、toolCalls 等）
- 「存储格式」和「运行时格式」是两个不同关注点，不应共用同一类型
