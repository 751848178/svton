---
name: code-structure-standards
description: "Mandatory structural standard for ALL code implementation — new features, fixes, and refactors alike. Enforces the 200-line file ceiling, one-responsibility-per-file, layered-by-suffix (controller/service/repository/dto/vo/types/utils/constants/hooks/component), no duplicated logic, and acyclic dependencies. Apply on every non-trivial code task: write new file, add feature, fix bug, extract logic, or refactor. Trigger on any code-implementation intent, and on phrases like 重构, 拆分, 拆, 新建文件, 加功能, 写一个 service, 文件太长, 职责混杂, 抽公共逻辑, 分层."
---

# Code Structure Standards

This is the **mandatory structural standard** for every code change in this repo — not just refactors. Whether you are writing a brand-new feature, fixing a bug, or extracting logic, the code you produce must obey these rules: 200-line ceiling, one responsibility per file, layered by suffix, no duplication, acyclic dependencies.

These rules apply at the moment code is written. Do not write a file knowing it violates them and promise to "clean it up later."

## Why this is always-on

The goal is code that is easy to understand, modify, test, and reuse. Splitting serves *clear boundaries*, not line-count quotas. Applying these standards from the first line of a new file is far cheaper than retrofitting them onto a 600-line file later. So this skill triggers on **any implementation task**, not only on refactor requests.

## Optional Related Guidance

This skill is independently usable. It provides the concrete floor: line limits, file suffixes, layering rules, and an acceptance checklist.

When available and relevant, broader craft guidance can add design rationale for module-level refactors or React/TSX boundary work. Those workflows are optional composition, not prerequisites for using this standard.

## Use When

- **新建任何源码文件** —— 写之前就要想清楚它落在哪一层、职责是什么。
- **新增功能** —— 决定代码应该进 controller / service / repository / dto / vo / hook / component 中的哪一层。
- **修 bug 或小改动** —— 即使改动很小，也不应让所在文件进一步恶化（超出 200 行、混入新职责）。
- **抽取 / 移动代码** —— 移动时按职责归位到对应后缀文件。
- **重构已有文件** —— 当文件已经违反标准时，按本规则修正。
- **验收一次代码改动** —— 用下方验收清单核对。

## Avoid When

- 只改一个常量值、typo、缩进或 import 顺序——没有引入新结构，无需触发。
- 纯文档、配置（非代码逻辑）改动。
- 任务是「探索性 spike」且明确不会保留代码——但一旦决定保留，立刻补齐到符合标准。

## Trigger Signals

- 任何写代码、加功能、修 bug、抽逻辑、拆文件的请求（无论是否出现「重构」字样）。
- 新建文件时还没决定它属于哪一层、职责是什么。
- 一个文件同时包含接口入口、业务规则、数据读写、格式转换、UI 展示。
- 文件接近或超过 200 行。
- 出现重复或高度相似的代码块。
- `helper.ts` / `common.ts` / `misc.ts` / `manager.ts` 这种无清晰职责的兜底文件。
- Controller 或 UI 组件直接读写底层存储 / 数据库。
- 修改小功能需要先读懂整个大文件；或测试需要 mock 一堆无关依赖。

## Hard Rules (non-negotiable)

这些是硬性约束，违反即视为代码未达标：

1. **200 行硬上限。** 任何源码文件不得超过 200 行（含空行注释）。新建文件时就要规划好结构，不要写到 200 行才发现要拆。注：测试文件、生成的代码、构建产物不受此限。
2. **一个文件一个职责。** 职责要能用一句话说清。说不清就是太杂。
3. **一个函数一个主要动作。** 函数名描述动作；函数体不应再藏着另一个等价层级的动作。
4. **按文件后缀分层。** 见下方 [File Responsibilities](#file-responsibilities)。controller 不碰数据，service 不碰 transport，repository 不碰业务规则。
5. **依赖单向、无环。** 依赖方向必须清晰、可追踪，严禁循环依赖。
6. **禁止复制粘贴。** 出现第二份高度相似代码时，立刻抽公共逻辑，不要等到第三份。
7. **禁止兜底命名。** 不创建 `helper` / `common` / `misc` / `manager`（除非真的是无业务状态纯工具）这类无职责文件。
8. **禁止把业务逻辑藏进工具函数。** `utils` 里只能放无状态纯函数。
9. **禁止 Controller / 组件直接操作底层数据。** 数据访问必须经 repository 层。
10. **重构不改变业务行为**（仅当任务是重构时）。新增功能或修 bug 当然会改变行为，但拆分动作本身不应引入非预期的行为变化。

## File Responsibilities

每个后缀只承载一种职责。详细对照见 [references/file-responsibilities.md](references/file-responsibilities.md)。

| Suffix | 只允许做什么 | 禁止做什么 |
|---|---|---|
| `*.controller.ts` | 请求入口、参数校验、权限入口、响应封装 | 业务规则、直接读写存储 |
| `*.service.ts` | 业务规则、流程编排、状态变化 | transport 细节、直接 SQL |
| `*.repository.ts` | 数据读写（DB / 缓存 / 外部存储） | 业务规则判断 |
| `*.dto.ts` | 输入结构定义 | 输出结构、业务逻辑 |
| `*.vo.ts` / `*.view.ts` | 输出结构定义 | 输入结构、业务逻辑 |
| `*.types.ts` | 类型、枚举、接口 | 运行时逻辑 |
| `*.utils.ts` | 无业务状态的纯工具函数 | 业务规则、状态 |
| `*.constants.ts` | 常量 | 逻辑、可变状态 |
| `*.hooks.ts` | 前端请求 / 状态逻辑 | UI 展示 |
| `*.component.tsx` | UI 展示和交互 | 复杂业务规则、直接数据访问 |

## Default Workflow

无论新建还是重构，写代码时按这个顺序：

1. **先定职责和落点。** 动手前先回答：这块代码属于哪一层？它的职责用一句话怎么说？目标文件是哪个后缀？想清楚再写第一行。
2. **先定边界再填实现。** 先写类型签名和空骨架（dto、vo、types 先行），让边界稳定，再填实现。不要边写边让契约漂移。
3. **按后缀归位。** 每个逻辑块落到上表对应后缀的文件。没有现成落点的，先问「职责是什么」再决定新建哪个文件——而不是先建 `helper.ts`。
4. **遇到重复立即抽。** 写的过程中发现重复，立刻抽到 utils / service / hook / rules，禁止带着重复继续写。
5. **校验依赖方向。** controller → service → repository，单向无环。出现回边立刻处理。
6. **校验行数。** 文件接近 200 行时，主动按职责拆分，不要等到超限。
7. **跑测试。** 改动后原有测试必须通过；新增了公共逻辑或有分支时补测试。
8. **对照验收清单。** 用下方 [Acceptance Checklist](#acceptance-checklist) 逐条核对。

## When a file already violates the standard

遇到已超 200 行或职责混杂的文件时，按以下优先级处理：

1. 先拆**明显超长**文件（>200 行，或接近且职责混杂）。
2. 再拆**职责混杂**文件（不超长但混了多类职责）。
3. 再抽**重复逻辑**。
4. 再整理**类型和常量**（归到 types / constants / dto / vo）。
5. 最后优化**命名和目录结构**。

最小可行修正原则：如果本次任务只改了某文件的一小段、且改动本身不增加新职责，可以不立即拆整个文件，但**不得让它进一步恶化**（不能让超长文件更长、不能往职责混杂文件里再加新职责）。在响应里说明这个判断。

## Acceptance Checklist

代码改动完成后逐条核对，全部满足才算达标：

- [ ] 每个文件不超过 200 行。
- [ ] 每个文件的职责能用一句话说清。
- [ ] 模块入口清晰，内部实现被隐藏（只暴露必要接口）。
- [ ] 依赖方向单向、稳定、可追踪，无循环依赖。
- [ ] 测试通过（原有测试不破，新增公共逻辑或有分支处已补测试）。
- [ ] 业务行为符合任务预期（重构场景下与重构前一致；新功能场景下符合需求）。
- [ ] 命名更准确而非更抽象——没有出现 `helper` / `common` / `misc` / `manager` 兜底文件。
- [ ] 每个拆分/新建都能回答：为什么这样切、落在哪一层、谁依赖谁。

## References

- [File Responsibilities](references/file-responsibilities.md) - 各后缀文件的职责边界、常见越界反模式与归位方式。
- [Code Examples](references/examples.md) - 典型场景的 before/after 代码示例（职责混杂、重复逻辑、超长文件、前端下沉）。
