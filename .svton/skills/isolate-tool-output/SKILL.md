---
name: isolate-tool-output
description: "Use when noisy commands/research may flood context: type-check/lint/test/build/docker, broad rg/find/grep, large diff/cat/nl, Codex/Claude session JSONL token audits, web research, or final verification. Save logs and return summaries."
---

# Isolate Tool Output

Apply this whenever tool output is likely to overwhelm the main conversation. The main agent keeps strategy, code edits, and final decisions; sub agents run noisy commands or research, save complete output to local logs, and return only structured summaries with precise log paths.

## Use When

- 运行 `type-check`、`lint`、`test`、`build`、`docker build`、`docker logs` 等可能产生大量输出的命令。
- 执行根目录或大目录 `rg`、`find`、`grep`，搜索 `.next`、`dist`、`build`、lockfile 或日志文件。
- 读取大型 `git diff`、完整文件 `nl -ba`、长 `cat`、构建产物搜索结果或其他预计超过 2K token 的输出。
- 执行宽范围 `rg/find/grep`、长文件阅读、TODO/roadmap 进度文档盘点、`git diff`、Codex/Claude session JSONL 审计等会把整段原文带入上下文的操作。
- 做 web research、多来源调研、最终验证，或单轮内同类工具调用超过 3 次需要合并批处理。
- 需要再读一次「会话内已读过的进度/规划文档」(roadmap、todos、requirements、progress)——这类全文文档禁止重复进上下文。
- 准备重复跑 `type-check`/`build`——不要每次编辑后跑，按逻辑改动单元批处理。
- `/goal` 会话接近收口、发生多次 compaction，或需要建议开新线程继续；必须按本 skill 的切线程协议输出可复制的下一条 `/goal` 命令。

## Avoid When

- 只需运行 `pwd`、`git status --short`、小目录 `ls`、`rg --files | head` 或精确 `sed -n 'x,yp'`。
- 搜索范围已经收窄到已知文件的小片段，预计输出明显低于 2K token。
- 用户明确要求主 Agent 直接展示完整输出，且该输出本身就是交付物。

## Trigger Signals

- type-check lint test build docker build docker logs pnpm build npm test turbo run tsc eslint vitest jest playwright。
- rg find grep broad search root search .next dist build lockfile logs large output noisy command huge log。
- 多关键词 OR 搜索、跨多目录根搜索、无 `--max-count` 的 rg——这三类几乎必然撑爆输出，必须改写为窄范围或走 smart-rg。
- git diff cat nl -ba full file long output terminal output tool output token bloat context bloat。
- 已读过的进度文档 roadmap todos requirements progress 再次读取 重复读 全文复读 单文档累计 N 次。
- build type-check 反复运行 每次编辑后验证 重复构建 250 次 git diff --check。
- /goal next goal command continuation brief 新线程 继续目标 handoff resume compaction budget last_input。
- web research 多来源调研 网页调研 最终验证 验证阶段 子 Agent subagent delegate summary full_log。
- Codex Claude session JSONL token audit context bloat last_token_usage total_token_usage compact tool token-guard smart-rg safe-read progress-snapshot diff-summary。
- 预计输出超过 2K token 实际输出超过 4K token 同类命令超过 3 次 批处理 隔离日志。

## Default Workflow

1. 先把当前任务拆成主 Agent 决策、可隔离工具执行、代码修改、最终验证四类工作。
2. 用隔离判定矩阵判断每个工具调用：预计超过 2K token、属于默认隔离类别、或同类命令超过 3 次时派发子 Agent。
3. 给子 Agent 一个自包含任务：命令、cwd、范围、要提取的错误类别、相关文件过滤条件、完整日志必须写入的位置。
4. 本地命令优先让子 Agent 使用 bundled `scripts/capture-tool-run.mjs` 捕获完整输出，并只把摘要 JSON 和人工提炼结论带回。
5. 对宽搜索、长文件、进度文档、diff、session JSONL 使用 bundled compact tools：`token-guard.mjs`、`smart-rg.mjs`、`safe-read.mjs`、`progress-snapshot.mjs`、`diff-summary.mjs`、`codex-session-token-audit.mjs`。
6. 要求子 Agent 按固定摘要契约返回 `task`、`status`、`command`、`exit_code`、`summary`、`relevant_errors`、`full_log`、`recommended_next`。
7. 主 Agent 只读取摘要和必要的精确日志片段；不要把完整日志、全量搜索结果或大段网页摘录重新拉进主上下文。
8. 如果摘要显示错误与当前改动相关，主 Agent 决策并修改代码；如果是 baseline 噪声，记录为无关并避免扩散范围。
9. 最终验证也默认隔离执行；最终回复报告关键命令、状态、相关错误、日志路径和仍未覆盖的风险。
10. 如果当前是 `/goal` 会话且建议新线程继续，不得假定 goal 状态会自动迁移；最终回复必须附一条可复制的下一线程 `/goal` 命令。

## Session-Level Caching（避免同一内容反复进上下文）

单次命令隔离只解决「一条命令的输出」。会话内反复重读同一份内容会把它一次又一次塞回上下文，是 token 浪费的高频来源，必须用会话级缓存控制：

- **进度/规划文档（roadmap、todos、requirements、progress、onboarding 等 markdown）会话内最多读一次。** 首次读取后用 `progress-snapshot.mjs` 提炼成状态行 + 行号锚点，后续只引用缓存的摘要；只有完成里程碑后才更新一行，不再重读全文。
- **源码文件默认禁 `cat`/整文件 `nl -ba`。** 读源码结构优先用 `codegraph-cli-navigation` 建图一次，读具体片段用 `safe-read.mjs` 按符号或行号窗口；同一段源码在同一会话不重复整段读第二次。
- **同一目录被反复 `rg` 超过 3 次时**，首次结果生成一份结构快照（接口/schema/关键符号清单）写入 `docs-internal/.../*-snapshot.md`，后续引用快照而非重搜。
- **`MEMORY.md`、`SKILL.md`、`AGENTS.md` 等会话内恒定的文件**只读一次；如发现同会话重复读取，按工作流 bug 处理。

## Batch Verification（避免每次编辑后跑构建）

- `type-check`/`lint`/`build` 不要在每次编辑后跑。按一个逻辑改动单元（一个 feature 或一组相关 patch）合并一次，验证统一用 `verify-before-done` 收尾。
- 不要在每次提交前都跑 `git diff --check`。无改动或纯验证场景跳过；只有实际准备提交时才跑一次。
- 多包仓库优先用 turbo/pnpm 的增量目标（如 `--filter @scope/pkg`），而非全仓重新构建。

## Next Goal Command

`/goal` 的目标、预算和状态属于当前线程运行状态，不能自动带到新线程。切线程规则由本 skill 统一约束，不要把通用规则重复写进每条 `/goal`。只要建议 `/goal` 会话开新线程继续，必须在收口消息里提供一条可复制的下一线程 `/goal` 命令，包含：

- `长期目标`: 原始 `/goal` 目标，尽量保持稳定。
- `当前进度`: 已完成切片、关键文件、验证证据、当前工作区/日志/风险。
- `本线程任务`: 下一线程只处理的最小任务边界和验收标准，按优先级列 1-3 项。
- `交接说明`: 简短说明“切线程规则由 `isolate-tool-output` 执行”，不复制通用阈值细节。

## Hard Routing Rules

- 不确定某个命令会不会刷屏时，先跑 `token-guard.mjs --command '<cmd>'`；只要返回 `route_to_compact_tool`，按推荐工具改写命令。
- 宽范围 `rg/find/grep` 默认走 `smart-rg.mjs`；只有搜索范围已经缩到 1-2 个已知小文件，且带 `--max-count`、`-l` 或 `--count` 时才直接运行。
- 读取超过 120 行的 `sed/tail/cat` 默认走 `safe-read.mjs`；读取 TODO、roadmap、requirements、进度文档时优先走 `progress-snapshot.mjs`。
- `git diff` 默认走 `diff-summary.mjs`；raw diff 只允许在已经知道精确文件和小 hunk 后，用小窗口读取。
- 读取 `/tmp/codex-tool-runs` 日志时最多取 80 行精确窗口；不要把隔离后的日志再整段搬回主上下文。
- long-running goal 每完成一个可交付切片后收口汇报；如果同一线程已 compaction 2 次以上或 `last_input` 超过 120K，应建议新线程继续，并附下一线程可直接使用的 `/goal` 命令。

## Preferred Moves

- 把高噪声命令合并给一个子 Agent 批处理，让它统一保存日志并返回一份对比摘要。
- 在子 Agent prompt 中明确 touched-path、baseline、相关错误、无关噪声的分类标准。
- 日志目录默认使用 `/tmp/codex-tool-runs/{project}`，避免项目内临时目录被后续搜索误扫。
- 日志文件名使用 `{task}-{YYYYMMDD-HHmmss}.log`，task 名只用字母、数字、点、下划线和连字符。
- 宽范围 `rg` 必须带排除 glob，默认排除 `node_modules`、`.next`、`dist`、`build`、`target`、`.turbo`、`.codegraph`、`coverage`。
- 宽搜索默认先返回文件清单、计数和少量样例；需要展开时再精确读取文件窗口，不把全部命中行带回主上下文。
- 长文件默认用符号、关键词或行号窗口读取；除非用户明确要求，不读取超过 120 行的连续片段。
- 进度文档默认只返回状态行、F 编号、heading 和行号；后续只对少数行号用 `safe-read.mjs` 精读。
- `git diff` 默认先看 `--stat`、`--name-status`、`--numstat`、`--check`；完整 diff 写日志，主上下文只保留摘要。
- Codex/Claude session JSONL 审计必须用结构化 parser 摘取 token/tool-output 指标；不要用 `rg` 直接返回整条 JSONL 行。
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
- **`rg` 满足以下任一条件即强制改写为窄范围或走 `smart-rg.mjs`：多关键词 OR（含 `|`）、跨多个顶层目录根、缺 `--max-count`/`-l`/`--count`。** 这三类是撑爆 40KB 输出上限的主要来源。
- **进度/规划文档（roadmap/todos/requirements/progress）会话内最多读一次**，后续引用 `progress-snapshot.mjs` 摘要；禁止反复 `cat`/`rg` 同一份 markdown 全文。
- **源码文件默认禁 `cat` 整文件读取**；用 `safe-read.mjs` 按符号或行号窗口，同一段源码本会话不重复读第二次。
- **`type-check`/`build` 不得每次编辑后跑**；按逻辑改动单元合并，收尾统一用 `verify-before-done`，不做无意义的重复 `git diff --check`。
- **`/goal` 新线程不会自动继承当前 goal 状态**；建议切线程时必须提供下一线程可直接使用的 `/goal` 命令。通用切线程规则由本 skill 负责，下一条 `/goal` 只携带目标、进度、下一切片和交接说明。
- 不得对 Codex/Claude session JSONL 做会返回整行的宽 `rg`；一行可能包含完整 prompt、tool schema 或大输出。
- 不得把 `max_output_tokens` 设到 20K/30K 来“硬接住”宽搜索；先压缩为摘要或写日志。
- 子 Agent 的 `recommended_next` 只能建议，不替代主 Agent 的最终决策。
- 如果环境没有可用子 Agent，使用捕获脚本在主线程保存完整日志，并手写同样格式的短摘要。

## Review Checklist

- 是否识别出本轮哪些命令或调研会产生高噪声输出？
- 是否把默认隔离类别、超过阈值或重复同类命令派发给子 Agent？
- 子 Agent 是否保存了完整日志，并只返回结构化摘要、关键错误和日志路径？
- 主 Agent 是否只读取了必要的精确日志片段，而不是重新载入完整输出？
- 进度/源码/记忆类文件是否在会话内只读一次，没有反复 `cat`/`rg` 全文复读？
- `type-check`/`build` 是否按改动单元批处理，而非每次编辑后重跑？
- 宽 `rg`（多关键词 OR / 多目录根 / 无 `--max-count`）是否被改写为窄范围或走 smart-rg？
- 如果建议 `/goal` 新线程继续，是否明确说明 goal 不会自动迁移，并给出可复制的下一线程 `/goal` 命令？
- 摘要是否区分 touched-path 相关错误、baseline 无关错误和需要追查的不确定项？
- 最终回复是否包含验证状态、关键命令结果、日志路径和剩余风险？

## References

- [Delegation Matrix](references/delegation-matrix.md) - 判定哪些工具调用必须隔离、哪些可以由主 Agent 直接执行。
- [Summary Contract](references/summary-contract.md) - 子 Agent prompt、日志策略、返回字段和错误提炼规则。
- [Compact Tools](references/compact-tools.md) - bundled scripts for two-stage search, bounded reads, diff summaries, and Codex session token audits.
- [Examples](references/examples.md) - 高噪声命令、批量搜索、web research 和最终验证示例。
