# Shipkit M1 独立审计

日期：2026-09-29。对象：当前工作区 Shipkit 0.3.0，M1（UX01–UX04）实现与首次发布衔接。

> **处置更新（2026-09-29 修复轮）：** 本报告 11 项 M1 问题与 1 项既有阻塞已全部修复并通过回归验证（153/153，含 13 个复现场景的仓库内回归测试、仓库外隔离安装实测）。逐项处置与证据见 [m1-remediation.md](m1-remediation.md)；下文原发现保持原样，作为审计记录。原审计中“未验证的环境边界”（真实 TLS、Registry 推拉、云端销毁、真实 GC）仍保持待验收，不因本轮关闭。

## 结论

**M1 暂不通过独立验收。** 安装包与基础 CLI 已可在仓库外运行，现有 127 项测试独立重跑全部通过；但配置保留、秘密保护、状态恢复和失败结果仍存在可复现缺陷。

本次确认 **11 项 M1 问题（5 P1、6 P2）**，另有 **1 项既有 P1 集成阻塞**。共 13 个定向复现场景命中问题（预览泄密含两个场景）。未修改业务代码，未执行生产部署、云资源操作或真实 Docker 构建/清理。

P1 表示本阶段收口前应修复的高影响问题；P2 表示正常修复优先级，同样属于已承诺的 M1 验收范围，不应直接推迟到平台化。

## 验证与证据

| 验证 | 独立结果 | 范围 |
| --- | --- | --- |
| build / typecheck | 均 exit 0 | 当前工作区 |
| 项目测试 | 127 tests / 127 pass / 0 fail | 原有测试集，不代表下列新增复现已覆盖 |
| 打包 | 成功生成 shipkit-0.3.0.tgz | 使用临时 npm cache，未公开发布 |
| 仓库外安装 | 成功 | 离线缓存、临时隔离 prefix、`--ignore-scripts`，不修改全局安装 |
| 安装包 CLI | help exit 0；无 Dockerfile 的 init exit 2；完整 init exit 0 | 完整 init 连接本地 HTTP 桩，虚构凭据 |
| 安装包 agent | runtime / v0.3.0 健康接口可访问 | 实际 agent 进程，只读探测 Docker |
| 配置/恢复复现 | 12/12 场景命中 | 临时文件、真实 init 子进程及可控 Prompter；不连接远端环境 |
| TTY 清空字段复现 | 1/1 命中 | 真实 PTY + 当前 TtyPrompter，按回车无法清空默认值 |

完整日志及复现脚本：`/tmp/codex-tool-runs/svton/m1-audit-20260929/`。

- `tests-unsandboxed.log`：完整测试结果。首次沙箱内运行因禁止监听 127.0.0.1 失败；开放本机监听后重跑通过，此处不计为代码缺陷。
- `pack-isolated.log`、`install.log`、`package-smoke-results.json`：打包、隔离安装与运行证据。默认 npm cache 写入受限，改用临时 cache 完成打包，此处不计为代码缺陷。
- `repro.mjs`、`repro-results.json`、`diff-preview.txt`：核心问题复现，全部 token 都是 `AUDIT_*` 虚构值。
- `prompt-clear.mjs`、`prompt-clear-transcript.log`、`prompt-clear-results.json`：TTY 复现。
- 仓库内持久化摘要：[m1-audit-evidence.json](m1-audit-evidence.json)，含检查结果、源码哈希和复现映射。临时日志以后可能被系统清理。

未重做实现方报告的原 66 项 E2E 脚本；本次使用独立复现。未验证真实远端 TLS、Registry 推拉、云端销毁与真实 Docker 长 GC，相关状态继续保持待验收。

## M1 发现

### M1-01 · P1：差异预览会显示新旧 token

位置：[render.ts](../../../src/cli/init/render.ts) 28–29 行；[plan.ts](../../../src/cli/init/plan.ts) 106–113 行。

现有配置更新时先生成含 `+` / `-` 前缀的 diff，再调用只识别普通 YAML 行的 `maskSecrets`。前缀与缩进使 token 行不匹配，审阅文本同时暴露旧 token 和新 token。对 YAML 块字符串，只替换键所在行，后续内容仍会显示。

证据：A01 中旧、新虚构 token 均出现在 `renderReview` 输出；A11 中块字符串的第二行秘密仍可见。该输出会进入终端记录或 stderr 日志。

修复：对解析后的对象进行递归脱敏，再序列化和计算 diff；无效配置不能将原始内容直接输出。测试普通变更、flow-style YAML/JSON、块字符串及格式错误输入；测试最终 `renderReview` 输出，而不仅测试单行正则。

### M1-02 · P1：完成状态中的历史入口覆盖新配置，向旧机器发送新 token

位置：[wizard.ts](../../../src/cli/init/wizard.ts) 54、77–93 行。

`prior` 即使 `step === 'done'` 也用于默认值，而且入口优先于当前配置，token 却从当前配置读取。用户完成初始化后更换机器 URL 与 token，再运行 init，会将新 token 发送到旧 URL，随后把旧 URL 写回配置。已手工修改的应用名也会被历史进度覆盖。

证据：A13 在完成初始化后修改 URL、token、应用名；重跑 exit 0，本地旧入口收到只应交给新入口的虚构 token，机器 URL 和应用名的用户修改均未保留。

修复：已完成草稿不再覆盖当前配置；恢复未完成草稿时检查配置是否变化。URL、身份和 token 必须成组绑定，不能分别从不同版本取值。跨入口复用 token 前要求明确选择，验证请求前先解决冲突。

### M1-03 · P1：生成的凭据配置没有加入 Git 忽略

位置：[write.ts](../../../src/cli/init/write.ts) 56–63 行。

初始化将长期 agent token 写入项目根目录的 `ship.config.yaml`，但只向 `.gitignore` 追加 `.ship/`。0600 限制本机读取权限，并不能阻止 Git 收录。新手按日常提交流程操作，很容易把长期凭据提交到仓库。

证据：A02 在全新临时 Git 仓库初始化后，`git check-ignore ship.config.yaml` 返回 1，`git status` 将其列为未跟踪文件。

修复：写入秘密配置前确保对应文件受忽略；如果已跟踪，明确提示移除跟踪与凭据轮换，不能假称忽略规则可解决已有提交。可逐步采用方案中的凭据引用；检查用户声明的运行环境文件是否也缺少保护，但不擅自覆盖其内容。

### M1-04 · P1：重跑 init 会把已有端口改成 EXPOSE 默认值

位置：[questions.ts](../../../src/cli/init/questions.ts) 86–90 行；[wizard.ts](../../../src/cli/init/wizard.ts) 143–148 行。

端口问题的默认值只来自 Dockerfile EXPOSE，没有读取现有 `spec.ports` 或进度中的端口。非交互模式若其他信息齐全，会直接写入变化，没有额外写入授权。

证据：A03 已有 `8080:3000`，Dockerfile 为 `EXPOSE 3000`；执行真实 `ship init --json`、stdin 关闭，exit 0 后配置变为 `3000:3000`。没有 EXPOSE 时还可能删除已有映射。

修复：已有明确配置优先，检测值仅补空缺；在非交互模式下，对改变已有语义的差异应返回待确认或要求显式写入策略，不能默认采用扫描值覆盖用户配置。回归自定义宿主机端口、无 EXPOSE、多个端口及幂等重跑。

### M1-05 · P1：`.yml/.json` 配置被新 `.yaml` 遮蔽，源仓库和其他目标丢失

位置：[write.ts](../../../src/cli/init/write.ts) 68–84 行；[detect.ts](../../../src/cli/init/detect.ts) 的既有文件检测。

检测和预填支持 `.yml/.json`，但规划写入时只读取固定的 `ship.yaml`、`ship.config.yaml`。合并基底因此为空，创建优先级更高的 `.yaml` 后，原文件还在但不再生效。

证据：A04 分别使用 `.yml` 和 `.json`，真实 init 均 exit 0；新生效配置丢失 `context`、`buildArgs`、`source` 与第二个 runtime target。

修复：将实际加载的文件路径和原始对象传递给写入规划，保留原格式/路径；如需迁移，完整合并并明确展示迁移与优先级变化。兼容性测试必须从各合法文件名运行完整向导，不能仅测固定 `.yaml` 的合并函数。

### M1-06 · P2：最后保存进度失败，却报告配置“已回滚”

位置：[wizard.ts](../../../src/cli/init/wizard.ts) 148–160 行。

`applyFileWrites` 成功提交配置后，`saveInitState(... done)` 仍可能失败。外层 catch 对所有异常统一声称“本次写入已回滚、旧文件保持不变”，但此时并未回滚。

证据：A05 在确认后模拟进度临时路径不可写；返回 `write-failed` 和“已回滚”，实际 `ship.config.yaml` 已替换为新 token。

修复：明确区分配置提交失败、配置提交成功但进度保存失败、回滚失败。要么把状态提交纳入事务，要么如实返回“配置已保存、进度未保存”与恢复指引；只有完成且验证回滚后才能承诺旧文件不变。

### M1-07 · P2：恢复时丢弃已选择的 Dockerfile 和自定义端口

位置：[wizard.ts](../../../src/cli/init/wizard.ts) 75–83 行；[questions.ts](../../../src/cli/init/questions.ts) 78–90 行。

状态文件保存了 Dockerfile 和 ports，但恢复调用没有把它们传给 `askApp`。多候选 Dockerfile 必须重新选，端口重新从 EXPOSE 推断，未达到“从已答项继续”的承诺。

证据：A06 先选 `Dockerfile.prod` 和 `8080:9000`，在机器步骤取消；草稿中两项都存在，重新运行时 Dockerfile 问题仍无默认值。

修复：恢复已答项，重新验证文件和端口仍有效；仅对失效候选或用户选择修改的项重新询问。取消、无 Dockerfile 阻塞等分支也不应无条件抹掉可复用草稿。

### M1-08 · P2：复用固定临时文件不能保证凭据文件是 0600

位置：[write.ts](../../../src/cli/init/write.ts) 97–101 行；[state.ts](../../../src/cli/init/state.ts) 69–72 行。

`writeFile(tmp, ..., {mode: 0600})` 只在创建时设置权限；固定临时文件已经存在时，权限保持原样，rename 后成为最终文件权限。固定路径也缺少排他创建和符号链接保护。

证据：A07 预置权限 0644 的 `ship.config.yaml.shipinit.tmp`，写入成功后凭据配置仍为 0644。

修复：使用随机临时名、排他创建与明确权限设置，拒绝符号链接；在提交前验证最终文件权限。为草稿、备份和配置写入复用同一安全实现，覆盖已有临时文件与异常退出后的恢复。

### M1-09 · P2：审阅期间的用户修改会被静默覆盖

位置：[write.ts](../../../src/cli/init/write.ts) `planFileWrites` 与 `applyFileWrites`。

plan 保存了旧内容，apply 不检查当前文件是否仍与 plan 一致。用户在审阅期间编辑文件或另一个 init 写入后，apply 使用过期 after 覆盖；备份也是过期 before，新修改甚至不在该备份中。

证据：A08 在 plan 后给配置添加 `source.ref=USER_NEW_COMMIT`，再 apply；该修改丢失且无冲突提示。

修复：提交前比较原始内容或哈希，变化时停止并重新审阅；配合项目级初始化锁防止并发写入。备份应与实际被替换的版本一致。

### M1-10 · P2：检查失败后保存草稿被当作“初始化完成”

位置：[wizard.ts](../../../src/cli/init/wizard.ts) 117–120、135–150 行；[cmd-init.ts](../../../src/cli/cmd-init.ts) 成功分支。

交互时可以选择“仍要使用”失败入口，这可以作为保存配置的功能；但之后直接返回 `ok: true`、`step: done`、退出码 0 和首次发布提示。机器检查失败的状态没有成为完成门槛。

证据：A09 使用不可达的本地端口，选择继续保存；结果 `ok=true`、`builder.passed=false`、草稿 `step=done`。

修复：区分“配置已保存”与“环境已就绪”。允许保存但标记 blocked/pending，给出具体复检动作；全部必要检查通过前不宣布向导完成。机器可读结果同样要体现差异。

### M1-11 · P2：可选字段有默认值时无法清空

位置：[prompt.ts](../../../src/cli/init/prompt.ts) 129–130 行；[questions.ts](../../../src/cli/init/questions.ts) 健康检查、端口、环境文件提示。

提示说“留空则不配置”，但空输入会优先返回默认值。已有健康检查、envFile 或 EXPOSE 端口时，用户无法通过向导清除它们，必须重新手工编辑 YAML。

证据：A12 真实 PTY 中，可选健康路径默认 `/health`，输入回车仍返回 `/health`。

修复：明确区分“保留现值”“设置新值”“清空”，例如三项选择或文档化的清空操作；不要让空字符串同时承担保留与删除两种含义。覆盖真实 TTY 以及非交互表达。

## 既有问题：首次发布衔接阻塞

### LEGACY-01 · P1：`--from-dir` 打包没有传入任何文件

位置：[pipeline.ts](../../../src/cli/pipeline.ts) 38–44 行；M1 [render.ts](../../../src/cli/init/render.ts) 的下一步推荐。

tar 参数仅有输出文件、`-C` 和排除项，缺少最终的 `.` 等文件操作数。因此向导推荐的 `ship release --from-dir . --to …` 会在源码打包阶段失败，还未到构建或推送。

证据：A10 实际调用 `runBuildPipeline`，返回 `packing source dir failed: tar: no files or directories specified`。`git show HEAD:shipkit/src/cli/pipeline.ts` 已有相同代码，故明确记为 **M1 之前存在**，不归入 11 项 M1 新问题。

修复：正确构造 tar 操作数，保留排除规则；加入真实临时目录压缩/解包验证，检查源码进入包、秘密文件未进入包。无需真实 Docker 或云资源即可验证这一步。

## 收口建议

1. 先处理 M1-01/02/03 的凭据风险与 M1-04/05 的配置保留问题。
2. 补齐事务结果、权限、并发、恢复、完成状态与字段清空行为。
3. 顺手修复 LEGACY-01，打通向导推荐命令的源码打包步骤，并标注为既有缺陷修复。
4. 将本报告场景纳入持久化回归，重新验证仓库外安装包与真实 CLI；更新方案状态，避免继续把当前覆盖范围写成“全流程已验收”。

上述修复属于当前工具链的 M1 收口及直接衔接，不依赖平台化或真实云环境。M2 的机器安装与配对能力仍保持后续范围。
