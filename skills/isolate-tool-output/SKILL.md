---
name: isolate-tool-output
description: "Use when noisy commands or research may flood context: type-check/lint/test/build/docker, broad rg/find/grep, large diff/cat/nl, web research, or final verification. Delegate to sub agents, save full logs, return concise summaries."
---

<!-- Generated from skills/isolate-tool-output/skill.config.json. Edit skill.config.json instead of this file. -->

# Isolate Tool Output

Apply this whenever tool output is likely to overwhelm the main conversation. The main agent keeps strategy, code edits, and final decisions; sub agents run noisy commands or research, save complete output to local logs, and return only structured summaries with precise log paths.

## Use When

- 运行 `type-check`、`lint`、`test`、`build`、`docker build`、`docker logs` 等可能产生大量输出的命令。
- 执行根目录或大目录 `rg`、`find`、`grep`，搜索 `.next`、`dist`、`build`、lockfile 或日志文件。
- 读取大型 `git diff`、完整文件 `nl -ba`、长 `cat`、构建产物搜索结果或其他预计超过 2K token 的输出。
- 做 web research、多来源调研、最终验证，或单轮内同类工具调用超过 3 次需要合并批处理。

## Avoid When

- 只需运行 `pwd`、`git status --short`、小目录 `ls`、`rg --files | head` 或精确 `sed -n 'x,yp'`。
- 搜索范围已经收窄到已知文件的小片段，预计输出明显低于 2K token。
- 用户明确要求主 Agent 直接展示完整输出，且该输出本身就是交付物。

## Trigger Signals

- type-check lint test build docker build docker logs pnpm build npm test turbo run tsc eslint vitest jest playwright。
- rg find grep broad search root search .next dist build lockfile logs large output noisy command huge log。
- git diff cat nl -ba full file long output terminal output tool output token bloat context bloat。
- web research 多来源调研 网页调研 最终验证 验证阶段 子 Agent subagent delegate summary full_log。
- 预计输出超过 2K token 实际输出超过 4K token 同类命令超过 3 次 批处理 隔离日志。

## Default Workflow

1. 先把当前任务拆成主 Agent 决策、可隔离工具执行、代码修改、最终验证四类工作。
2. 用隔离判定矩阵判断每个工具调用：预计超过 2K token、属于默认隔离类别、或同类命令超过 3 次时派发子 Agent。
3. 给子 Agent 一个自包含任务：命令、cwd、范围、要提取的错误类别、相关文件过滤条件、完整日志必须写入的位置。
4. 本地命令优先让子 Agent 使用 bundled `scripts/capture-tool-run.mjs` 捕获完整输出，并只把摘要 JSON 和人工提炼结论带回。
5. 要求子 Agent 按固定摘要契约返回 `task`、`status`、`command`、`exit_code`、`summary`、`relevant_errors`、`full_log`、`recommended_next`。
6. 主 Agent 只读取摘要和必要的精确日志片段；不要把完整日志、全量搜索结果或大段网页摘录重新拉进主上下文。
7. 如果摘要显示错误与当前改动相关，主 Agent 决策并修改代码；如果是 baseline 噪声，记录为无关并避免扩散范围。
8. 最终验证也默认隔离执行；最终回复报告关键命令、状态、相关错误、日志路径和仍未覆盖的风险。

## Preferred Moves

- 把高噪声命令合并给一个子 Agent 批处理，让它统一保存日志并返回一份对比摘要。
- 在子 Agent prompt 中明确 touched-path、baseline、相关错误、无关噪声的分类标准。
- 日志目录默认使用 `/tmp/codex-tool-runs/{project}`，避免项目内临时目录被后续搜索误扫。
- 日志文件名使用 `{task}-{YYYYMMDD-HHmmss}.log`，task 名只用字母、数字、点、下划线和连字符。
- 宽范围 `rg` 必须带排除 glob，默认排除 `node_modules`、`.next`、`dist`、`build`、`target`、`.turbo`、`.codegraph`、`coverage`。
- 读取日志时用精确 `sed -n`、`rg -n` 或错误行号片段，只取决策需要的上下文。
- web research 让子 Agent 返回来源链接、结论分歧、日期和可信度；长摘录或原始网页笔记放日志文件。

## Rules

- 主 Agent 不长期携带大段 type-check、搜索、日志、构建产物或网页调研原文。
- 子 Agent 不得把完整日志贴回主上下文；必须返回结构化摘要和 `full_log` 路径。
- 预计输出超过 2K token 默认派发子 Agent；实际输出超过 4K token 后，同类命令在本轮强制隔离。
- 单轮内同类命令超过 3 次时，合并成一个子 Agent 批处理，不要连续在主上下文刷屏。
- 需要可验证性时保留完整日志路径，并在必要时按路径读取精确片段。
- 相关错误必须包含文件路径、行号或可搜索错误码；没有路径时给出最短可复现定位线索。
- 不得无界读取或搜索 `.next`、`target`、`.codegraph`、`node_modules`、`dist`、`.turbo`、`coverage`。
- 不得运行未裁剪的全仓 `find .`、`du .`、`wc -c`、长 `cat` 或完整 `nl -ba`；必须先 prune、限路径或限输出。
- 子 Agent 的 `recommended_next` 只能建议，不替代主 Agent 的最终决策。
- 如果环境没有可用子 Agent，使用捕获脚本在主线程保存完整日志，并手写同样格式的短摘要。

## Review Checklist

- 是否识别出本轮哪些命令或调研会产生高噪声输出？
- 是否把默认隔离类别、超过阈值或重复同类命令派发给子 Agent？
- 子 Agent 是否保存了完整日志，并只返回结构化摘要、关键错误和日志路径？
- 主 Agent 是否只读取了必要的精确日志片段，而不是重新载入完整输出？
- 摘要是否区分 touched-path 相关错误、baseline 无关错误和需要追查的不确定项？
- 最终回复是否包含验证状态、关键命令结果、日志路径和剩余风险？

## References

- [Delegation Matrix](references/delegation-matrix.md) - 判定哪些工具调用必须隔离、哪些可以由主 Agent 直接执行。
- [Summary Contract](references/summary-contract.md) - 子 Agent prompt、日志策略、返回字段和错误提炼规则。
- [Examples](references/examples.md) - 高噪声命令、批量搜索、web research 和最终验证示例。
