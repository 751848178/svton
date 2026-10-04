# Shipkit M1 审计处置记录（2026-09-29 修复轮）

> 2026-09-30 独立验收：R1–R5 共 7 个失败场景全部通过复核，9 组既有修复未回退；171/171、build/typecheck 及隔离安装检查通过，**M1 本轮代码修复可以收口**。详细边界及证据见 [独立验收报告](../2026-09-30/m1-final-verification.md)。下方保留各轮处置历史。

对象：[M1 独立审计](m1-audit.md)（保持原文不动）。本文件记录 11 项 M1 问题与 1 项既有阻塞的处置结果；修复基于审计时的工作区状态核实后实施，未重写审计证据。

> 独立收口复核更新：153/153 重跑及隔离安装通过，主要修复有效，但曾确认 5 项遗漏（2 P1、3 P2），详见 [M1 修复轮独立复核](m1-closure-audit.md)。**R1–R5 已在同日追加修复轮全部处置并回归关闭（171/171，含安装包实测），见文末「R1–R5 追加处置」。**

- 修复前基线：127/127 旧测试通过（与审计一致）。
- 修复后回归：**153/153 通过**（新增 26 项回归测试，其中 13 个对应审计复现场景 A01–A13，其余为边界变体：A01b/A02b/A03b/A04b/A07b/A13b/A13-CLI 等）。日志：`/tmp/codex-tool-runs/svton/m1-remediation-20260929/test-run3.log`。
- build / typecheck：exit 0（`build.log`）。重新打包：`pack/shipkit-0.3.0.tgz`（`pack.log`，未发布）。
- 仓库外隔离安装实测（`package-smoke.mjs` → `package-smoke-results.json`）：help exit 0；无 Dockerfile init exit 2（`init_no_dockerfile`）；`.yml` 项目完整 init exit 0（端口保留、context/buildArgs/source/prod target 保留、无 .yaml 遮蔽、秘密文件被 git 忽略）；幂等重跑 `wrote: []`；token 变更后审阅输出（--json stderr）不泄露新旧 token；安装包 agent /health、/api/status 实测可达（虚构 token，只读）。

## 逐项处置

| 编号 | 级别 | 修复内容 | 回归证据 | 状态 |
| --- | --- | --- | --- | --- |
| M1-01 | P1 | 脱敏改为对象级递归（`init/mask.ts`），在序列化与 diff 计算之前完成；`PlannedFile.beforePreview/afterPreview` 均为脱敏视图，`renderReview` 只消费脱敏预览；无法解析的旧文件原文不进任何输出，改为提示“整体替换+备份”。仅 token 变更（脱敏后无差异）明确显示“差异仅涉及已脱敏字段” | `render.test.ts` A01/A01b/A11/flow-json/invalid；安装包实测 leakedOld/NewToken=false | 已关闭 |
| M1-02 | P1 | `init/defaults.ts`：`step=done` 的历史草稿不再作为默认值来源；未完成草稿按保存时的 spec/config 指纹（sha256，存入 state `files` 字段）比对，变化组改用当前文件值；机器 URL+token 成组取默认（`machineDefaults`），用户改 URL 时 token 不预填、必须重新输入（`machines.ts`） | `resume.test.ts` A13/A13b；`compat.test.ts` A13-CLI（记录桩服务器实际 Authorization 目的地） | 已关闭 |
| M1-03 | P1 | `init/gitignore.ts`：写入前规划 `.gitignore` 覆盖 `.ship/` 与实际秘密配置文件名（.yaml/.yml/.json 之一）；git 仓库内用 `check-ignore`/`ls-files` 判定；已跟踪时输出明确警示（`git rm --cached` + 轮换 token），不假称忽略规则可解决；用户声明的 envFile 未受保护时给建议但不代改 | `write.test.ts` A02/A02b；安装包实测 secretIgnored=true | 已关闭 |
| M1-04 | P1 | `questions.ts portsDefault`：现有 `spec.ports`（含显式空列表）最优先，历史草稿次之，EXPOSE 检测仅在交互模式下补未映射容器的空缺；非交互模式绝不扩展已设映射 | `compat.test.ts` A03（真实子进程 8080:3000 保留+幂等）/A03b（无 EXPOSE、多 EXPOSE） | 已关闭 |
| M1-05 | P1 | `planFileWrites` 接受实际使用的 spec/config 路径（detect 结果），原格式原路径写回：.json 文件以 JSON 写回，.yaml/.yml 以 YAML 写回；不再生成遮蔽原配置的 ship.yaml；合并基底来自真实文件，context/buildArgs/source/其他 runtime targets 保留 | `compat.test.ts` A04/A04b（真实 init 子进程覆盖 .yml/.json） | 已关闭 |
| M1-06 | P2 | `apply.ts`：回滚后逐文件校验内容与权限，`WriteFailedError.rollback ∈ {verified, partial}`，仅 verified 才声明“旧文件保持不变”；partial 如实列出未恢复文件与备份位置；进度保存失败（`trySave`）不再进入 write-failed 分支，而是 ok:true + warnings 说明“配置已保存、进度未保存”与恢复指引 | `write.test.ts` 回滚校验用例；`resume.test.ts` A05（配置已提交+进度失败 → ok+警告，无“已回滚”字样） | 已关闭 |
| M1-07 | P2 | 恢复时把已答的 dockerfile/ports 传回 `askApp`（dockerfile 需仍是有效候选）；端口默认值含历史端口；no-dockerfile 阻塞分支保留既有草稿字段，只更新 step/blocked | `resume.test.ts` A06；取消恢复语义由 A06 前半段覆盖 | 已关闭 |
| M1-08 | P2 | `safe-write.ts secureWrite`：随机临时名 + `wx` 排他创建 + 显式 chmod + 权限校验后 rename；拒绝符号链接目标；config/备份/进度文件统一复用；apply 前置符号链接检查 | `write.test.ts` A07/A07b（含 0644 旧文件被替换为 0600、符号链接拒绝） | 已关闭 |
| M1-09 | P2 | apply 前对全部变更文件做冲突检测（当前内容 ≠ plan 时抛 `FileConflictError`，不写任何文件）；`.ship/init.lock` 项目级锁（wx+pid，死进程/超时接管）防止并发写入；备份与实际被替换内容一致 | `write.test.ts` A08（用户编辑保留、零写入）；`lock.ts`（锁由 apply 持有） | 已关闭 |
| M1-10 | P2 | 区分“配置已保存”与“环境已就绪”：`ready=false`（任一 agent 检查失败）时结果为 ok:true + ready:false + blocked:'check-failed' + pending 复检项；下一步提示不再宣称“初始化完成”，改为复检指引；非交互模式检查失败仍拒绝写入（exit 2） | `resume.test.ts` A09（state step=done+blocked，next 不含“初始化完成”）；安装包 exit 0 仅在 ready:true | 已关闭 |
| M1-11 | P2 | 可清空的可选字段（端口、健康检查路径/宿主端口、envFile）提供明确三态：回车保留默认、输入新值修改、输入 `-` 清空；提示文案写明；非交互模式保持默认值（清空需 TTY 或直接编辑文件） | `prompt-clear.test.ts` A12（真实 PTY：回车=/health，-=''）+ 非交互保留用例 | 已关闭 |
| LEGACY-01 | P1（既有） | `pipeline.ts` tar 参数补上 `.` 操作数（排除规则不变），抽出可测试的 `packSourceDir`；`uploadTarballSource` 复用之 | `pipeline.test.ts` A10（真实临时目录压缩+`tar -tzf`+解包逐字节比对；秘密文件全部排除）+ 上传桩实测。归因保留：该缺陷 M1 之前即存在（审计已核对 `git show HEAD`） | 已关闭 |

## 新增/重构模块

- 新增：`init/mask.ts`（对象级脱敏）、`init/safe-write.ts`（排他原子写入）、`init/lock.ts`（项目锁）、`init/gitignore.ts`（忽略规划）、`init/defaults.ts`（恢复决策与机器默认成组）、`init/apply.ts`（冲突检测+校验回滚）、`init/machines.ts`（机器问答拆分）。
- 重写：`init/write.ts`（仅规划，含脱敏预览与 .json/.yml 支持）、`init/wizard.ts`（编排与结果模型）、`cmd-init.ts`（ready/blocked/warnings 输出）。
- 单文件 ≤200 行（最大 wizard.ts 192 行）。

## 仍开放的限制（如实声明，不随本轮关闭）

1. 真实远端 agent（TLS/域名/公网）、真实 Registry 认证与推拉、云端到期销毁、真实 Docker 长 GC：仍属待实机验收（与审计 limitations 一致，转 UX06/UX07）。
2. 机器安装与配对（agent 未安装场景）仍属 M2。
3. `.ship/init.lock` 锁为单机文件锁，防同目录并发 init；不覆盖多用户 NFS 等极端场景。
4. 已跟踪秘密文件的历史轮换、非 git 环境（无版本控制）的秘密保护依赖用户按警示自行处理。
5. 非交互模式的可选字段清空：非 TTY 无输入通道，需交互一次或直接编辑文件（文档已写明）。

## R1–R5 追加处置（2026-09-29 收口修复轮）

对象：[收口复核](m1-closure-audit.md) 确认的 5 项遗漏（7 个失败场景）。修复前先逐项复现确认（`/tmp/codex-tool-runs/svton/m1-r-fix-20260929/repro-before.mjs` → `repro-before.json`），修复后同构脚本全部转为 fixed（`repro-after.mjs` → `repro-after.json`）。回归 **171/171**（原 153 + 新增 18：`closure.test.ts` R1/R1b/R1c/R1d/R2/R2b/R3/R4a/R4b/R4c/R4d、`pty-resume.test.ts` R4-pty×2、`write.test.ts` R3/R5a/R5b/R5c、`apply-partial.test.ts` R5d）。build/typecheck exit 0；重新打包并在仓库外隔离安装实测 R1/R2/R3/R4c 全部 fixed（`package-smoke-results.json`），安装包 agent 只读健康探测通过。

| 编号 | 修复位置 | 修复内容 | 复现/回归结果 | 状态 |
| --- | --- | --- | --- | --- |
| R1 · P1 | [machines.ts](../../src/cli/init/machines.ts) `askMachines`；[defaults.ts](../../src/cli/init/defaults.ts) `machineDefaults` | 运行目标的 URL/token 组在**用户选定 targetName 之后**从 `runtimeTargets` map 解析，不再沿用预选目标；提示区分“沿用已有目标自己的入口与 token”与“新名称=新建目标（需填写入口）”；新建目标无任何继承默认；改 URL 时 token 默认依旧成组丢弃 | 复现 fixed：staging→prod 保存后 `prod.url=B`、staging 不动、prod token 未发往 staging 入口；回归 R1/R1b（反向）/R1c（新建目标零继承、prod 不受影响）/R1d（替换 URL 丢弃 token 默认）；安装包 PTY 实测 R1 fixed | 已关闭 |
| R2 · P1 | [gitignore.ts](../../src/cli/init/gitignore.ts) `planSecretIgnore`/`verifySecretIgnored`；[write.ts](../../src/cli/init/write.ts)、[wizard.ts](../../src/cli/init/wizard.ts) | 忽略判定以 `git check-ignore` 实际结果为准；“同名行已存在”不再视为已保护；被否定规则压制时把秘密文件名**追加到 .gitignore 末尾**（末条规则生效）并在 warnings 明示冲突；写入后复检 check-ignore，仍失败则返回待处理警告而非宣布保护完成；已跟踪警示保留 | 复现 fixed（否定规则场景 exit 0 + 警告 + check-ignore 通过）；回归 R2（否定）/R2b（通配不重复追加、子目录项目经父仓库否定后由本地 .gitignore 生效）；安装包 R2 fixed | 已关闭 |
| R3 · P2 | [write.ts](../../src/cli/init/write.ts) `PlannedFile.beforeMode`/`changed` | 秘密文件的**现有权限**纳入计划与幂等判断：内容不变但权限 ≠0600 即视为变更，重写并校正权限，`wrote` 如实列出；失败走既有校验回滚路径 | 复现 fixed（0644 → wrote 含 config → 0600，再跑 wrote:[]）；回归 R3（计划级）+ R3 子进程（修正成功、幂等、无内容差异场景）；安装包 R3 fixed | 已关闭 |
| R4 · P2 | [wizard.ts](../../src/cli/init/wizard.ts)（进度合并、registry 草稿优先）；[defaults.ts](../../src/cli/init/defaults.ts) `appDefaults`（草稿优先，含空值）；[questions.ts](../../src/cli/init/questions.ts) `portsDefault`；[plan.ts](../../src/cli/init/plan.ts)（`ports: []` 持久化） | 指纹未变化的可信草稿是比未变文件更新的意图，应用组默认值草稿优先（含已清空字段）；取消时 progress 从 prior 组初始化合并，未重新作答的字段不丢失；端口清空持久化为显式 `ports: []`（与“未配置”区分），EXPOSE 不再复活；健康检查/envFile 清空后同样稳定；文件外部变化仍拒绝过期草稿 | 复现 fixed（R4a 草稿 9090 默认、R4b 再取消保留 app、R4c ports [] 不复活）；回归 R4a/R4b/R4c（交互+非交互幂等）/R4d（外部变更拒绝 + hc/envFile set→clear→幂等）；真实 PTY：R4-pty（修改→Ctrl+C→恢复默认=草稿值）、R4-pty-clear（`-` 清空全程落盘 `ports: []`）；安装包 R4c fixed | 已关闭 |
| R5 · P2 | [apply.ts](../../src/cli/init/apply.ts) `verifyRestored`/`restore` | 回滚校验符合真实状态：`before === null` 时目标不存在即恢复成功；原文件存在时校验**原内容+原权限**（`beforeMode`），恢复也按原权限 chmod；真实恢复失败（如备份拷贝 EACCES）仍如实报 partial 并点名文件 | 复现 fixed（新建文件误报 partial → verified、detail 空）；回归 R5a（新建删除=verified）/R5b（原内容+原 0640 权限）/R5c（混合：新文件删除+既有文件不动）/R5d（node:test mock copyFile 注入真实恢复失败 → partial 点名 ship.yaml，磁盘状态与报告一致） | 已关闭 |

### 本轮新增/调整模块

- 新增：`init/defaults-resume.ts`（恢复决策独立：指纹比对）、`init/pty-driver.ts`（测试用 expect 文件式 PTY 驱动 + SIGKILL 看门狗）、`closure.test.ts`、`pty-resume.test.ts`、`apply-partial.test.ts`。
- 调整：`defaults.ts`（machineDefaults 返回 targets map；新增 appDefaults 草稿优先）、`machines.ts`（选定目标后解析连接组）、`gitignore.ts`（实际生效判定 + 末尾追加 + 写后复检）、`write.ts`/`apply.ts`（beforeMode、R5 校验）、`wizard.ts`（进度合并、R2 复检、警告组装，196 行）、`plan.ts`（`ports: []` 显式持久化）。
- 单文件 ≤200 行（源码最大 wizard.ts 196 行）。

### 已知工程事项（不阻塞收口）

- PTY 测试曾在全量并发下偶发挂起：根因是经 stdin 向 expect 喂脚本，Tcl 报错后 expect 落入交互 REPL。已改为脚本文件 + SIGKILL 看门狗（`pty-driver.ts`），连续两轮全量 171/171 稳定通过。
- R1d/R1c 的 token 成组与新建目标语义依赖交互输入；非交互模式无输入通道，行为为“保留现有目标”，未新增非交互参数面。
