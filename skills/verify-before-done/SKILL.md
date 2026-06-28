---
name: verify-before-done
description: "Use only after code edits are complete and before the final response when concrete verification evidence is needed. Check the diff, run relevant tests, and report gaps or risks."
---

<!-- Generated from skills/verify-before-done/skill.config.json. Edit skill.config.json instead of this file. -->

# Verify Before Done

Apply this as a completion gate after code edits and before the final response. The skill forces requirement-fit review, automated verification choice, real-data validation for data-dependent changes, and honest reporting of gaps or blockers.

## Use When

- 完成任何项目代码修改、bug 修复、feature、refactor、配置变更或测试补充之后，准备回复用户之前。
- 需要判断本次产出是否符合用户最新需求、明确约束、隐含工作流和已修改文件的实际行为。
- 涉及前端流程、后端接口、数据读写、迁移、权限、计费、同步、队列、缓存或第三方集成等需要验证真实行为的改动。

## Avoid When

- 没有修改项目文件，只是在做代码阅读、方案讨论、概念解释或文本整理。
- 用户明确要求不要运行验证命令，或当前环境缺少必要权限且无法安全替代验证。

## Trigger Signals

- 完成代码变更后验证 收尾验证 验证证据 diff 对照用户需求
- 代码改动完成后运行 typecheck lint unit e2e regression checks
- 发布前验证 上线前验证 回归测试 需求符合性检查 真实数据验证
- verify-before-done completion gate after patch before final response

## Default Workflow

1. 重建用户需求清单：列出最新请求、显式验收点、隐含工作流、限制条件和本次不应触碰的范围。
2. 对照实际 diff 或修改文件，逐项判断已满足、部分满足、未满足和超范围改动；发现不符合时优先修正。
3. 选择验证阶梯：优先使用仓库已有脚本和最高信号验证，覆盖类型检查、lint、单测、集成测试、e2e 或端到端手动可观测路径。
4. 如果改动涉及数据，必须用真实数据或安全的真实数据副本跑自动化验证；不能访问真实数据时，明确说明阻塞和替代验证的局限。
5. 验证失败时诊断根因、修复、重跑相关验证，直到通过或清楚说明仍未解决的风险。
6. 最终回复只报告真实状态：需求符合性、执行过的验证、真实数据证据、未覆盖风险和需要用户决策的事项。

## Preferred Moves

- 把验证当成实现的一部分，不把最终自查留成口头承诺。
- 优先运行仓库已有 npm、pnpm、pytest、vitest、playwright、cypress、jest、go test 或 cargo test 等脚本。
- 用户工作流变化优先跑 e2e 或接近 e2e 的集成验证，不只验证孤立 helper。
- 数据相关改动优先选择 staging、只读查询、事务回滚、脱敏快照或真实形状的安全数据集。
- 最终说明使用具体命令、关键结果和不能验证的原因，不使用泛泛的“看起来没问题”。

## Rules

- 回复完成前必须对照用户需求逐项自查；不符合的地方要修正或清楚列出。
- 不能声称已验证，除非实际运行了相应命令、脚本、e2e 流程或可复现检查。
- 涉及数据读写、查询、迁移、统计、缓存或同步时，必须用真实数据或安全真实数据副本验证；合成数据只能作为补充，并要说明限制。
- 不得为了验证直接破坏生产数据；使用只读路径、staging、事务、回滚或脱敏副本。
- 如果环境、凭证、服务或数据不可用，必须说明阻塞原因、已做的替代验证和剩余风险。
- 验证失败不能直接收尾；先定位、修复并重跑，除非用户明确接受风险。
- 最终响应要包含需求符合性和验证证据，避免只给变更摘要。

## Review Checklist

- 用户最新需求是否逐条满足？是否有未完成、误解或超范围修改？
- 是否运行了与本次风险匹配的自动化验证？命令和结果是什么？
- 是否需要 e2e 或集成测试？如果没有运行，理由是否充分？
- 涉及数据时是否使用真实数据或安全真实数据副本？证据是什么？
- 是否还有无法验证的风险、环境阻塞或需要用户确认的事项？

## References

- [Verification Ladder](references/verification-ladder.md) - 按改动类型选择自动化验证、e2e 和真实数据验证的方法。
- [Report Examples](references/examples.md) - 完成前自查与最终回复的简洁样例。
