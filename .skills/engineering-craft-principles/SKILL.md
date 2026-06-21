---
name: engineering-craft-principles
description: "Use for React/TypeScript TSX refactors: split overloaded components/pages, clarify variant or mode boundaries, remove duplicated useState/useEffect derived state, and move async fallback behavior into hooks or models."
---

<!-- Generated from skills/engineering-craft-principles/skill.config.json. Edit source instead of .skills output. -->

# Engineering Craft Principles

Apply this when a frontend surface has collapsed presentation, state, and fallback behavior into one place. The skill favors narrower components, explicit variant boundaries, derived state, and hook or model owned async control.

## Use When

- 拆分复杂页面、表单、弹窗、卡片、列表和详情区等 React/TSX 视图。
- 重新划分组件、Hook、Model、配置层之间的职责边界。
- 处理 prop 过多、派生状态重复、变体纠缠、视图层异步过重的前端代码。
- 把列表项、详情区、工具条、只读态等对等 UI 形态拆成更稳定的组合关系。

## Avoid When

- 问题主要在领域建模、服务边界或后端编排，而不是前端视图结构。
- 组件很小且线性，复杂度还不足以支撑拆分、配置化或额外抽象。
- 用户只是想做视觉样式微调、命名整理或格式化，并没有结构性重构需求。

## Trigger Signals

- React TSX component page useState useEffect props variant mode readonly compact frontend refactor。
- 组件 重构 页面 表单 弹窗 卡片 列表 详情 Hook Model 派生状态 异步 兜底。
- 一个 TSX 文件同时处理多种数据形态、多个布局意图和多段副作用。
- 组件里出现大量 `mode`、`variant`、`readonly`、`compact` 之类的 prop 分支切换。
- 由 props、query 结果或 store 可直接推导的值又被复制进 `useState`。
- 视图层直接承载重试、fallback、兜底请求、乐观更新或多步异步编排。
- 同一组字段在 JSX 中被反复拼装，结构化展示逻辑散落在条件分支里。
- 子组件拿到一堆匿名回调和拼出来的临时对象，导致边界和重渲染都很混乱。

## Default Workflow

1. 先标出页面里真正的视图单元、状态来源和副作用入口，决定这次重构的主拆分轴。
2. 先写或收紧 props 类型和空骨架，让新边界先稳定下来，再往里搬实现。
3. 按数据形态、布局意图或交互职责拆成 hub 组件、姊妹组件或复合组件变体。
4. 把重复字段渲染改成配置或小型 render descriptor，让 JSX 只保留布局意图。
5. 把跨请求业务状态、fallback 策略和多步异步下沉到 Hook、Model 或 action。
6. 最后回头清理派生 state、匿名回调和过宽 props，确保组件关系比原来更窄更稳。

## Preferred Moves

- 优先按视图语义拆分，而不是按文件长度机械切块。
- 把对等 UI 形态做成姊妹组件或显式复合变体，而不是继续堆 mode prop。
- 把可计算值改成 derived value 或 memo，而不是再维护一份同步 state。
- 把字段展示和操作项写成配置生产逻辑，再交给通用渲染骨架消费。
- 把请求重试、源切换、降级兜底收回 Hook 或 Model，让视图只拿结果。

## Rules

- 一个组件文件只承载一种主要展示语义，不同时做页面装配、细节渲染和业务兜底。
- 对等变体优先姊妹组件或显式复合变体，不用布尔开关把差异塞回同一实现。
- 上层组件负责装配和顺序，业务细节、数据加工和异步策略下沉到 Hook 或 Model。
- 视图层不持有跨请求业务状态，也不实现“试 A 失败试 B”的降级编排。
- 派生值优先派生，不复制；需要缓存时用 memo，避免把同步问题变成状态问题。
- 传给子组件的契约尽量窄而稳定，避免把父组件内部噪音原样透传下去。
- 防御性空值处理放在使用点，不把局部判空升级成整个树上的调用负担。

## Review Checklist

- 是否还存在应该拆成姊妹组件的对等 UI 形态？
- 是否还有可派生值被复制成 state 或在 effect 中手动同步？
- 是否仍把 fallback、重试、乐观更新或源切换留在视图层？
- 是否有重复字段渲染逻辑仍散落在 JSX 分支里？
- 子组件拿到的 props 是否比重构前更窄、更稳定、更容易理解？

## References

- [Principles](references/principles.md) - 前端重构原则、拆分轴与常见反模式。
- [Playbook Examples](references/playbook.md) - 前端 refactor 场景、判断路径与推荐动作。
- [Code Examples](references/examples.md) - 高频前端重构模式的 before/after 代码示例。
