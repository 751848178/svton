# Universal Craft Principles Playbook

## Scenario 1: Call sites know too much

### Typical request

“现在每个调用方都得自己决定走主服务、备用服务还是本地缓存，代码越铺越开。”

### Preferred response

1. 定义一个统一入口和统一结果。
2. 把策略判断、fallback 和异常包装收回服务层。
3. 让调用方回到业务意图，而不是执行策略。

## Scenario 2: A handler is half dispatcher, half worker

### Typical request

“这个任务消费者里既判断类型，又执行具体步骤，还写日志、改状态、做失败恢复。”

### Preferred response

1. 把入口层收敛成 dispatcher shell。
2. 把每种类型拆成并列处理单元。
3. 把共用副作用和异常包装放进更下层的通用执行器或服务。

### Avoid

- 只是在大 `switch` 里抽几个私有函数，但职责边界没变
- 用更多参数继续扩充同一个 handler

## Scenario 3: Redundant business facts are drifting

### Typical request

“这个模块同时存 `status`、`displayStatus`、`resolvedStatus`，每次改逻辑都怕同步漏掉。”

### Preferred response

1. 找出唯一真实事实来源。
2. 把其余字段改成派生值或集中组装结果。
3. 让跨层传递的数据回到最小必要集。

## Rewrite posture

- 优先减少调用方必须知道的事。
- 优先把新增一种实现的改动面压缩到局部。
- 优先修正错误的职责归属，而不是仅把巨型函数切成更小的巨型函数。
