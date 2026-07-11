---
name: plan-before-code
description: "Use before starting a non-trivial development change to understand scope, acceptance criteria, and whether the work should be handled as a direct edit, a normal TODO plan, or escalated to a more specialized workflow such as broad-context planning, long-goal orchestration, noisy-output isolation, or code-graph analysis. Skip simple edits, ordinary questions, and already-scoped tasks."
---

# Plan Before Code

Apply this before implementation begins. The skill turns an initial user request into a clarified scope, a persistent hierarchical development TODO document, a concise user-facing summary, and an execution loop where each TODO status is updated as work completes.

## Use When

- 开始任何非平凡项目需求、代码修改、bug 修复、feature、refactor、配置变更或测试补充之前。
- 用户需求可能跨多个文件、多个步骤、多个系统边界或需要取舍判断。
- 需要先判断用户目标、验收标准、范围限制、数据/权限/交互边界是否清楚。
- 需要把开发计划按需求功能维度分层沉淀成文档，并在执行过程中持续更新 TODO 状态。

## Avoid When

- 用户只是要求解释概念、阅读代码、翻译文本、运行一个简单命令或回答一个不涉及项目修改的问题。
- 改动极小且用户明确要求直接处理；这种情况下可用一句内联计划替代完整 TODO 文档，但仍要保留必要假设。
- 已有用户确认过的开发 TODO 文档且本次只是继续执行其中一个明确任务，此时应更新原文档而不是重建计划。

## Trigger Signals

- 非平凡代码变更开始前计划 scope clarification acceptance criteria persistent TODO
- 开始开发前 制定开发计划 写 TODO 文档 需求澄清 验收标准 范围边界
- 跨模块多步骤改动 需要任务拆解 需要先写开发 TODO 需要明确验收路径
- plan-before-code implementation plan development TODO non-trivial scoped code change

## Default Workflow

1. 先重建需求理解：列出用户目标、显式要求、隐含验收点、限制条件、已有上下文和不能擅自触碰的范围。
2. 执行工作流路由门禁：先判断任务形态是 direct、todo-plan、specialized-workflow，还是 long-goal。只在需要时升级；不要为了形式感引入更重流程。首次代码修改前必须留下 1 句 routing 决策记录。
3. 执行澄清门禁：只有当不确定点会改变架构、数据、用户可见行为、不可逆操作、验收标准或验证路径时才询问用户。
4. 询问时一次合并 1 到 3 个高价值问题；对可安全假设的问题直接说明假设并继续，避免为了完美信息反复打断用户。
5. 需求清楚后创建或更新开发 TODO 文档，先按用户可感知的需求功能维度拆出一级功能块，再在每个功能块下拆出原子化子 TODO 和必要的孙 TODO。
6. 保证每个原子 TODO 都可单独执行、可预测结果、上下文尽量纯净，并能对应明确文件变更、验证动作或用户可见行为。
7. 向用户简短概述一级功能块、关键原子 TODO 和执行顺序；除非用户要求先审批计划，否则开始按 TODO 开发。
8. 每开始一个原子 TODO，先把文档中对应状态改为 in_progress；完成后立刻改为 done，并补充完成证据、关键文件或验证结果。
9. 如果开发中发现新事实、范围变化或阻塞，先更新文档中的假设、状态和后续 TODO，再继续执行或向用户请求决策。

## Workflow Routing Gate

在写 TODO 文档前，先用真实上下文判断任务形态：

- `direct`: 改动很小、目标文件明确、验证简单。用一句内联计划即可，不创建重型 TODO。
- `todo-plan`: 多步骤但边界清晰。按本 skill 创建或更新普通 TODO 文档。
- `specialized-workflow`: 范围不清、跨多个模块/系统边界、需要多个独立工作单元、需要保持主上下文很小、需要独立 review/verification，或需要结构化任务板。加载可用的专用工作流 skill 或按同等协议手动执行；不要把专用协议细节复制进本 skill。
- `long-goal`: 目标会跨多轮、多切片或多线程。加载可用的长目标编排/切片 handoff 能力；如果不可用，仍要用持久 TODO 和 compact handoff 记录状态。
- `noisy-tools`: 预计会产生长日志、宽搜索、长 diff、构建/测试输出或多来源调研。加载可用的输出隔离能力；如果不可用，手动把完整输出保存到日志路径，只把摘要带回主上下文。

路由结果必须在首次代码修改前记录到 TODO 文档、工作说明或短进度消息中，保持 1-2 句即可。推荐格式：

- `routing: focused slice; no multi-agent needed because the change is confined to <module>.`
- `routing: todo-plan + noisy-tools verification.`
- `routing: long-goal with compact handoff.`
- `routing: specialized-workflow required because ownership crosses <area A>/<area B>.`

这个门禁只决定是否升级，不承担专用工作流的具体协议；但如果没有升级到更重流程，必须写明原因足够小、边界足够清晰或验证足够局部。

## Preferred Moves

- 先读仓库和已有上下文来消除疑问，不把能自己确认的问题抛给用户。
- 把澄清问题压缩成少量决策点，让用户只回答会改变实现方向的信息。
- 默认把 TODO 文档放在仓库已有规划文档目录；没有约定时使用 `docs/todos/YYYY-MM-DD-<slug>.md`，或仓库约定的隐藏项目本地 TODO 目录。
- 先按需求功能维度拆一级 TODO，再把每个功能块继续拆成小到可独立验证的原子 TODO。
- 把原子 TODO 写成可执行工作单元，每一项都能对应文件变更、验证动作或用户可见结果。
- 同时使用运行时 plan 工具和文档时，以文档作为持久记录，保持两边状态一致。
- 工作流路由只做轻量分类；具体任务板、长目标 worker、噪声输出隔离、代码图谱等细节由对应的专用 skill、项目指令或手动等价协议承载。

## Rules

- 非平凡项目修改开始前必须先完成需求理解和 TODO 文档沉淀；不能直接跳进代码而丢掉用户约束。
- 非平凡项目修改开始前必须先完成并记录工作流路由门禁；如果不升级到专用流程，要能说明任务为何足够小或边界足够清晰。
- 不得为了形式感追问用户；只有阻塞决策或高风险假设才需要澄清。
- 如果选择带假设继续，必须把假设写进 TODO 文档，并在最终交付时保持可追溯。
- TODO 文档必须先按需求功能维度分组，再在组内拆出原子化子 TODO；跨功能共享的准备项或验证项也必须明确归属或单独成组。
- 原子 TODO 必须尽量只依赖一个清晰上下文、一个预期结果和一个验证信号；不能把多个不相关改动塞进同一个原子项。
- TODO 文档必须包含状态字段，状态只使用 pending、in_progress、done、blocked、dropped 等清晰值。
- 每完成一个原子 TODO 必须马上更新文档状态；一级功能块状态要由其子项状态汇总，不能手动伪造完成。
- 计划变更、发现阻塞或需求被重新解释时，必须更新文档中的变更记录和受影响 TODO。
- 最终交付前应与可用的收尾验证流程衔接，确保计划完成状态和验证证据一致。

## Review Checklist

- 是否真正理解了用户目标、验收标准、范围限制和隐含工作流？
- 是否先判断并记录了任务形态，选择了 direct、todo-plan、specialized-workflow、long-goal 或 noisy-tools 的合适组合？
- 是否只询问了会影响实现方向的澄清问题，没有过度打扰用户？
- 是否已创建或更新一份按需求功能维度分层的持久 TODO 文档，并向用户概述了执行内容？
- 每个一级功能块是否已拆成原子化、可预测、上下文尽量纯净的子 TODO 或孙 TODO？
- 每个原子 TODO 是否具备明确状态，开发过程中是否完成一项就更新一项？
- 发现新范围、阻塞或假设变化时，文档是否同步更新并保持可追溯？

## References

- [Clarification Gate](references/clarification-gate.md) - 判断什么时候问用户、问几个问题、什么时候带假设继续。
- [TODO Document](references/todo-document.md) - 开发 TODO 文档结构、状态语义和更新节奏。
- [Examples](references/examples.md) - 典型需求开工前的澄清、TODO 文档和状态更新样例。
