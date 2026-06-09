# Issue #004: 浏览器中 logger 不工作

**日期**: 2026-06-02
**严重级别**: HIGH
**状态**: FIXED

## 现象

在浏览器中设置 `localStorage.setItem('agent:debug', 'true')` 后，控制台没有任何 `[Agent:xxx]` 日志输出。

## 根因

`logger.ts` 的 `isEnabled()` 检查顺序错误：

```typescript
// 原始代码
if (typeof process !== 'undefined' && process.env?.AGENT_DEBUG === 'true') {
  _enabled = true; return true;     // Node.js path
}
if (typeof window !== 'undefined') {
  _enabled = localStorage.getItem('agent:debug') === 'true';
  return _enabled;                   // Browser path
}
```

在浏览器打包环境中（tsup/webpack/vite），`process` 全局对象存在（polyfill/shim），但 `process.env.AGENT_DEBUG` 永远不为 `'true'`。代码执行到第一个 `if`：
1. `typeof process !== 'undefined'` → `true`
2. `process.env?.AGENT_DEBUG === 'true'` → `false`
3. `_enabled` 被缓存为 `false`（通过其他路径）— 实际上不会执行到 `_enabled = true`
4. 函数返回到第三个分支 `_enabled = false; return false;`

**localStorage 检查永远不会被执行到。**

## 修复

交换检查顺序：先检查 `window/localStorage`，再检查 `process.env`。

**修改文件**: `ai/agent-core/src/utils/logger.ts`

## 教训

- 在同构/isomorphic 代码中，环境检测的顺序至关重要
- 浏览器打包环境可能存在 Node.js 全局变量的 shim，`typeof process !== 'undefined'` 在浏览器中也可能为 `true`
- 缓存变量（`_enabled`）会锁死首次检测结果，必须确保首次检查的优先级正确
