# Issue #012: Plan ID 不在输出中导致 update 失败 + Plan 界面不可见

**日期**: 2026-06-02
**严重级别**: HIGH
**状态**: FIXED

## 现象

1. `plan_update_step` 报错 "Failed to update step step_5 in plan xxx"
2. 创建的 Plan 在界面上看不到任何进度展示

## 根因

### 问题 A: Plan ID 不在 formatPlan() 输出中

`PlanningManager.formatPlan()` 输出格式：
```
# Plan Title

[ ] step_1: Do something
```

**没有 planId！** LLM 从工具输出中无法获取 planId，只能从 `metadata` 中获取（LLM 通常不直接读取 metadata）。导致 LLM 在后续调用 `plan_update_step` 时使用错误的 planId。

### 问题 B: Plan 状态不与 UI 联动

PlanningManager 是纯内存对象，没有任何事件机制通知 UI 层。ChatService 不感知 plan 状态变化，UI 无法展示 plan 进度。

## 修复

**A**: 在 `formatPlan()` 输出中添加 `Plan ID: plan_xxx` 行

**B**: 新增 PlanPanel UI 组件：
- ChatService 的 `handleEvent` 解析工具输出中的 plan markdown 格式
- 维护 `@observable() activePlan` 状态
- useChat hook 订阅 activePlan
- ChatPanel 在输入框上方渲染 PlanPanel，展示进度条和步骤状态

**C**: 增强 PlanUpdateStepExecutor 参数校验，返回具体错误信息（plan 不存在、step 不存在等）

**修改文件**:
- `ai/agent-core/src/planning/manager.ts` — formatPlan 包含 planId
- `apps/agent-web/src/lib/agent-setup.ts` — PlanUpdateStepExecutor 校验
- `ai/agent-client/src/service/chat.service.ts` — activePlan 追踪
- `ai/agent-client/src/hooks/useChat.ts` — 订阅 activePlan
- `packages/ui/src/components/chat/PlanPanel.tsx` — 新组件
- `packages/ui/src/components/chat/ChatPanel.tsx` — 集成 PlanPanel

## 教训

- 工具输出文本是 LLM 与工具系统的主要通信渠道，所有关键信息（ID、状态）必须包含在文本输出中
- metadata 字段不能作为 LLM 获取信息的可靠途径
- 内置工具的状态应与 UI 实时联动，否则用户无法感知 Agent 的行为
