# Engineering Craft Principles

## First choices

当一个前端文件已经失控，优先按下面顺序做判断：

1. **先找主拆分轴**：当前问题更像数据形态混杂、布局意图混杂，还是状态与副作用混杂。
2. **先稳边界再搬逻辑**：先写新 props 或新 Hook 契约，再迁移实现。
3. **先收回复杂度再美化 JSX**：先把 fallback、派生 state、匿名回调、字段拼装收回正确层级。

## Core principles

### 1. View composition

- 一个组件文件只承载一种主要展示语义。
- 对等 UI 形态优先姊妹组件或复合变体，不把差异塞进 `mode`、`compact`、`readonly` 之类的分支。
- 上层组件负责装配顺序和区域关系，细节渲染下沉。

### 2. State ownership

- 能从 props、query、store 推导出来的值，不再复制成 `useState`。
- 跨请求业务状态属于 Hook、Model 或 action，不属于视图节点。
- 防御性空值处理放在使用点，不把局部噪音往上传。

### 3. Async and fallback

- 视图层只表达 loading、error、empty、ready 等结果，不编排“试 A 失败试 B”。
- 重试、数据源切换、乐观更新、恢复逻辑收回数据层或状态层。
- 多步异步优先写成可复用的状态动作，而不是夹在 JSX 周围。

### 4. Structured rendering

- 重复字段渲染优先收敛成配置生产逻辑。
- 把“字段定义”和“布局骨架”分开，让 JSX 更像布局语言。
- 给子组件传递窄而稳定的 props，减少匿名对象和匿名函数噪音。

## Anti-pattern translations

- `一个 TSX 文件很长`：先别按行数切，先找是否同时承载多种 UI 语义。
- `条件渲染很多`：检查是不是对等变体还挤在同一实现里。
- `state 很多`：先分辨哪些是真状态，哪些只是派生值。
- `接口兜底写在组件里`：说明业务策略还没从视图层收回去。

## Success criteria

- 组件关系更窄，命名更像角色而不是模式开关。
- JSX 更像布局骨架，业务判断和降级策略不再四处冒头。
- 新增一种视图形态时，优先新增姊妹组件或配置，而不是继续改大组件本体。
