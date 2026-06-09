# Issue #003: 会话消息刷新后丢失

**日期**: 2026-06-02
**严重级别**: CRITICAL
**状态**: FIXED

## 现象

页面刷新后，所有对话消息丢失。只有第一次的消息偶尔保留。

## 根因

会话持久化存在**四重缺陷**：

### 1. 无对话完成后自动保存
`useSession` 只在两个场景触发 `saveSession()`：
- 切换会话时（`currentSessionId` 变化）
- 创建新会话时（`create()` 调用）

**从未在对话完成后自动保存。** 用户发消息 → AI 回复 → 对话完成，此时不触发任何保存。

### 2. 无页面关闭前保存
没有 `beforeunload`、`visibilitychange` 或任何生命周期保存机制。

### 3. 无启动时会话恢复
页面加载时，`currentSessionId` 为 null（React 状态重置），没有代码尝试恢复上次活跃的会话。

### 4. 无自动创建初始会话
首次使用时没有自动创建 session，消息仅存在于内存中。

## 修复

在 `useSession` 中实现三层保存机制：

1. **自动保存**: 监听 `chatStatus` 变化，当状态从 `running` → `idle` 时自动保存当前会话
2. **页面隐藏保存**: `visibilitychange` 事件，当 `document.visibilityState === 'hidden'` 时异步保存（支持 IndexedDB）
3. **启动恢复**: 初始化时检查是否有保存的 `currentSessionId`，如有则加载对应会话的消息

**修改文件**: `ai/agent-client/src/hooks/useSession.ts`

## 教训

- 消息持久化不能依赖用户行为（切换会话），必须有自动保存机制
- 页面生命周期事件（`visibilitychange`、`beforeunload`）是数据安全的重要保障
- 启动恢复是 session-based 应用的基本需求，不是可选功能
