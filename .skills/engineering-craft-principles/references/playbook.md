# Engineering Craft Principles Playbook

## Scenario 1: One TSX file is doing everything

### Typical request

“这个页面文件越来越大，列表、详情、工具条、空态和弹窗都堆在一起了，帮我重构。”

### What to notice first

- 页面区域是否已经天然分成几个视图单元
- 哪些状态是真正共享的，哪些只是局部派生
- 哪些副作用只是因为还没找到正确归属

### Preferred response

1. 先画出区域边界，而不是立刻抽工具函数。
2. 把页面变成编排器，拆出姊妹视图区块。
3. 只把真正共享的状态留在页面级，其余下沉。

## Scenario 2: Variants are trapped in props

### Typical request

“这个卡片支持 `compact`、`readonly`、`danger`、`inline`，每次加一个模式都更难看懂。”

### Preferred response

1. 判断这些模式是不是对等 UI 形态，而不是局部样式差异。
2. 如果是，拆成并列组件或复合变体。
3. 让 hub 组件只负责按 `variant` 分发。

### Avoid

- 在同一个 JSX 里继续加更多布尔分支
- 通过共享一个超宽 props 类型来维持“统一”

## Scenario 3: Derived state and async logic leaked into the view

### Typical request

“这个页面里有一堆 `useState` 和 `useEffect` 在同步名字、状态、按钮可用性，还夹着失败后的备用请求。”

### Preferred response

1. 先删掉能直接推导的 state。
2. 把备用请求、重试和恢复流程挪到 Hook 或 Model。
3. 把视图改回只消费结果的形式。

## Rewrite posture

- 优先重写边界，不优先提炼工具函数。
- 优先消灭错误的状态归属，不优先做语法层小优化。
- 优先让新增一种 UI 形态更容易落地，而不是只让当前 diff 看起来小。
