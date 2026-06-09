# Issue #005: plan_create 工具参数未校验导致崩溃

**日期**: 2026-06-02
**严重级别**: MEDIUM
**状态**: FIXED

## 现象

当 LLM 调用 `plan_create` 工具时，如果省略或传入无效的 `steps` 参数，工具执行报错：
```
Cannot read properties of undefined (reading 'map')
```

## 根因

`PlanCreateExecutor.execute()` 直接解构 `call.arguments` 不做任何校验：

```typescript
const { title, steps } = call.arguments as { title: string; steps: Array<...> };
const plan = this.pm.createPlan(title, steps);  // steps.map() crashes if undefined
```

当 LLM 省略 `steps` 或传入 malformed JSON 时，`steps` 为 `undefined`，`steps.map()` 抛出 TypeError。

`ToolRegistry.execute()` 捕获了异常并返回 error result（不会导致应用崩溃），但用户看到的是一个难以理解的 JS 错误信息，而非有用的提示。

## 修复

在 executor 中添加参数校验，返回有意义的错误提示：

```typescript
if (!title || typeof title !== 'string') {
  return { callId: call.id, output: 'Error: "title" is required...', isError: true };
}
if (!Array.isArray(steps) || steps.length === 0) {
  return { callId: call.id, output: 'Error: "steps" is required...', isError: true };
}
```

**修改文件**: `apps/agent-web/src/lib/agent-setup.ts`

## 教训

- 所有 tool executor 必须校验输入参数，不能信任 LLM 总是发送正确格式
- `ToolRegistry.execute()` 的 try-catch 是最后防线，但 executor 应该主动返回友好错误
- 参数校验应尽早（在 executor 入口），避免错误传播到深层业务逻辑
