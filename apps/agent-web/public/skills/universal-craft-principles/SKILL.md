---
name: universal-craft-principles
description: "Use for framework-agnostic refactors: untangle modules, services, handlers, jobs, and controllers; isolate orchestration from execution; centralize fallback/retry behavior; and remove redundant persisted state."
---

# Universal Craft Principles

Apply this when general-purpose code has collapsed orchestration, execution, state mutation, and fallback policy into the same place. The skill favors explicit contracts, single-purpose modules, dispatcher shells, and service-owned complexity.

## Use When

- 设计或重构模块、服务、处理器、任务消费者、同步流程和功能域容器。
- 整理职责混杂、参数开关过多、字段冗余、失败策略外泄的业务代码。
- 处理跨语言、跨框架的业务逻辑、多步异步流程和可扩展的分发入口。
- 把调用方承担的空值处理、fallback 分支和执行顺序收回稳定接口后面。

## Avoid When

- 问题主要是 React 视图拆分、组件变体、Hook 边界或 JSX 结构，此时应优先用前端 skill。
- 代码只是一次性的短脚本或局部修补，没有形成可维护的模块边界问题。
- 用户只需要换名、补注释或风格一致性处理，而不是结构性设计收敛。

## Trigger Signals

- module service handler controller job queue dispatcher switch fallback retry provider state orchestration refactor。
- 模块 服务 处理器 任务消费者 分发 编排 执行 fallback 重试 供应商 派生字段 冗余状态。
- 一个模块同时负责路由分支、执行细节、状态写入、日志副作用和异常降级。
- 调用方必须知道太多空值细节、失败分支、备用策略或执行顺序。
- 多个对等实现通过参数开关、字符串常量或大段 `if/else` 硬塞在同一个文件里。
- 可以由现有字段计算出的值被重复存储、同步维护或跨层透传。
- 多步异步流程与 transport、队列、HTTP 细节绑死，测试和复用成本很高。
- 新增一种类型或供应商时，需要改动入口、调用方和大量分支判断。

## Default Workflow

1. 先写清稳定契约：入口函数、请求类型、结果类型，以及调用方真正应该知道的最少信息。
2. 识别哪一层应该只是编排器，哪一层应该是真正执行单元，先拆职责再谈实现。
3. 把类型分支、供应商分支或任务分支下沉成并列处理单元，入口层只负责分发。
4. 把重试、fallback、源切换、异常包装收回服务层，让调用方回到单一稳定入口。
5. 把重复维护的派生字段删回去，改成派生值、查询函数或集中组装的结果对象。
6. 最后检查新增一种类型时的改动面，目标是新增能力主要落在并列单元而不是全链路扩散。

## Preferred Moves

- 先固化接口和结果类型，再移动职责，避免一边拆分一边让契约漂移。
- 把入口层做成 dispatcher shell，把真正执行放进并列 handler 或 service。
- 把 fallback、重试和供应商切换藏进服务层，而不是让调用方知道策略细节。
- 把多步流程表示成步骤序列、handler 映射或 coroutine，而不是散落在条件分支里。
- 让派生数据按需计算或集中组装，不让多个模块同时维护同一业务事实。

## Rules

- 一个模块只承担一种职责意图，不混放编排、执行、持久化、展示和降级策略。
- 对等实现优先并列文件或注册表分发，不用参数开关把差异叠在同一实现里。
- 上层编排器只组合能力和顺序，不展开底层业务细节，也不替服务层做策略判断。
- “试 A 失败试 B” 之类的策略写在服务层，调用方只面对统一契约和统一结果。
- 多步异步优先步骤化或协程式编排，让步骤定义和调度机制分离。
- 防御性访问在使用点处理，不把局部空值复杂度升级成整个调用链的责任。
- 可计算值优先派生或集中组装，不复制成长期维护的冗余字段或缓存阴影。

## Review Checklist

- 调用方现在是否知道得更少，只需要面对一个稳定入口和稳定结果？
- 是否还有模块同时承担编排、执行和降级等多重职责？
- 新增一种类型、供应商或任务时，改动面是否已经收敛到并列单元？
- 是否还有可派生值被复制存储，或者在多个层级手动同步？
- 是否仍靠参数开关、大型 `if/else` 或散乱分支来承载对等实现差异？

## References

- [Principles](references/principles.md) - 通用模块设计原则、分发结构与复杂度收敛方法。
- [Playbook Examples](references/playbook.md) - 跨栈 refactor 场景、判断路径与推荐动作。
- [Code Examples](references/examples.md) - 通用模块重构模式的 before/after 代码示例。
