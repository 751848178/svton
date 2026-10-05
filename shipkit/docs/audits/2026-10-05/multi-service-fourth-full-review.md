# 第四次完整独立复核与修复（2026-10-05）

基线：`33a0d44d`。本轮重新检查原 R01–R12、S01–S06，以及控制端参数/规格/计划/来源、构建推送、运行端归属/状态提交/恢复、实例账本与租约、GC 和安装产物。确认缺陷按用户已有授权直接修复。只使用模拟 SDK、临时文件和隔离 Docker；未访问真实云端/生产端，未升级已安装 CLI，未修改 TCP 锁协议。

结论：本轮确认的 14 类本地缺陷已修复；最新全量、当前产物的包外安装和隔离真实 Docker 验收通过。下列真实环境与规划边界仍开放，不能用本地结果宣称整套生产链路已完成，也不宣称不存在覆盖范围之外的缺陷。

路线 specialized：三名复核者交换上轮负责模块，分别检查 CLI/shared、运行端、provider；协调者检查来源/构建入口/凭证清理并统一验收。模块写入范围互不重叠。CodeGraph 索引未覆盖新增符号，本轮采用限定目录源码和真实调用 seam。

## 确认的问题

| ID | 问题与修复 | 回归证明 |
| --- | --- | --- |
| A01 | P1：ensure 与 lease claim 分离使两个进程进入同一构建机；后结束者可能被旧任务清租约，机器在工作中被释放。准入与 claim 合成同一锁内事务；renew/release 验证精确 pid/token，旧任务不得更新新任务的租约或空闲时间 | 真实 provider、两个子进程 barrier；同进程不同 owner、旧 token 操作新租约 |
| A02 | P1：账本 EACCES 当 null 导致新建机器并覆盖旧 ID；非法时间绕过 admission。账本/目录读取仅 ENOENT 为空；严格校验 shape/time；当前事务复用既有 TCP mutex，保留 legacy mkdir 门闸、按精确 token 释放 | 实际权限拒绝、损坏记录/日期、0 SDK 变更；原正常取消/销毁回读回归 |
| A03 | P2：已有部署缺 binding，GET group-state 返回组合让计划通过，付费构建后才失败。只读规划对非 fresh 磁盘证据缺绑定即拒绝；真正空/不存在目录保持空状态且不认领 | 真实 route + GroupStore，fresh/旧证据/foreign identity |
| A04 | P2：健康等待、commit 元数据读取或 atomic 临时文件写入时改绑仍提交成功。deploy/rollback 健康后、元数据读取后和唯一 rename 前复核；typed refusal 锁存停止恢复；拒绝仅清本次唯一临时文件 | 16 个健康/提交读写窗口回归，改绑、缺失、损坏、拒绝后瞬间修回均不 shift，不对新 owner up/down；其他操作临时文件保留 |
| A05 | P2：`constructor` 等继承属性被当作声明服务/依赖；实际 CLI 可进入 lease/build/push。服务选择、依赖与计划继承使用 own 检查；pipeline 入口复用选择验证 | 实际 cmdBuild 输入，0 lease/build/push；合法显式 constructor 仍可使用，无 committed entry 时不可继承 |
| A06 | P2：push.imageRef 已固定 digest 时再次拼接形成非法引用。统一 digestRef 归一化并验证既有 digest 一致 | 同 digest 保持单个 @sha256；冲突拒绝，失败不产完整 manifest |
| A07 | P2：v1 build 的 --services 被静默忽略。与 release 契约一致，在构建前明确拒绝 | 真实 cmdBuild，0 lease/build/push |
| A08 | P2：v2 --tag 被忽略。参数传入每个选中服务的 build 请求，结果保留实际 tag | cmdBuild/cmdRelease seam 核对请求与结果 |
| A09 | P2：继承 arm64 服务在计划中显示 amd64。使用经规格一致性校验的服务生效平台 | inherited arm64 计划断言 |
| A10 | P2：缺失运行 envFile 在 build/push 后才发现。release 在租借前读取、校验选中服务环境文件，并将私有快照用于部署 | 缺文件 0 lease/build/push；构建期间改文件仍部署预先读取快照，输出不含内容 |
| A11 | P2：顶层构建 context/Dockerfile 符号链接可解析到物化源码外。Docker 调用前解析 realpath、验证归属与文件类型，并使用解析后的路径 | 4 个拒绝路径均 0 Docker；源码内 alias 与 repo-root Dockerfile/子目录 context 兼容 |
| A12 | P2：Git progress/子进程和 CLI 来源日志可能包含 URL 凭证或 token；嵌入凭证可留在 clone remote 或发布来源记录。agent 日志脱敏已知 token/URL password，持久 remote 清除凭证；CLI 日志/manifest 使用公共 repo URL，认证传输保留原输入 | 真实 ensureSource + subprocess seam，URL/明文/编码 token 不进入日志；真实 resolveGitSource/multi pipeline seam 验证日志与 provenance 清除 userinfo、原认证输入不变 |
| A13 | P3：pull 登录失败在进入调用者 finally 前遗留私有 Docker auth 目录。失败路径清理本任务创建的私有目录 | 模拟 login 写入 partial config 后失败，config 与目录均不存在 |
| A14 | P2：包冒烟直接安装旧的同版本归档，exit 0 也不能证明当前补丁进入安装产物。入口现在先 build + pack，再隔离安装，逐文件核对安装内容；身份拒绝回归接入常规 test | 实际旧归档与当前 dist 对比：6 个关键文件中 3 missing/3 stale；修后 215 个归档/安装文件均与当前 dist 一致；4 个身份回归覆盖 current/stale/missing/empty |

## 本轮验证记录

- 起始工作区快照：`/tmp/codex-tool-runs/svton/fourth-full-review/status-before.json`（含本轮 active TODO；其余 569 项改动独立对比）。
- 起始 Docker 快照：同目录 `docker-before.json`，77 条镜像、17 个容器、8 个网络、28 个卷，另记录已有容器 StartedAt 与卷 CreatedAt。
- 根来源/构建边界修前：`fourth-root-red-20261005-213610.log`，8/8 行为断言失败；修后最终：`fourth-root-green-final-20261005-214206.log`，11/11、完整隔离 tsc，exit 0。早先两次修前执行的 test 编译错误已更正，不算红行为证据；一次并行编译撞其他模块修改，也不算验收通过。
- 运行端修前：`fourth-runtime-red-20261005-213646.log`（10 fail/2 pass）；补充提交内部读取窗口：`fourth-runtime-commit-window-red-20261005-213936.log`（2 fail/12 pass）。最终：`fourth-runtime-final-compile-20261005-214202.log`、`fourth-runtime-final-green-20261005-214213.log`（14/14），exit 0。既有 7 文件 55/55：`fourth-runtime-green-20261005-214040.log`；独立 18 条运行调用链：`fourth-runtime-cross-green-20261005-214121.log`，exit 0。
- 原子写准备窗口补充红例：`fourth-atomic-window-red-20261005-215129.log`（14 pass/2 fail）；最新全仓隔离 compile：`fourth-atomic-window-green-compile-20261005-215155.log`；最新运行端 16/16：`fourth-atomic-window-green-20261005-215222.log`，exit 0。该校验覆盖程序内部 awaited 准备；不宣称能对 project.json/state.json 的任意人工并发改写提供跨文件原子 CAS。
- Provider 修前：`fourth-provider-lease-before-20261005-213650.log`，19 pass/5 fail，跨进程租约、旧 owner、账本读取/日期反例；该次私有编译排除了当时无关编译错误的来源测试。最终正常全项目隔离 compile + 13/13 状态/租约：`fourth-provider-state-final-20261005-214755.log`；Provider/S06 41/41：`fourth-provider-final-green-20261005-214833.log`，exit 0。未知 legacy owner 例预热本测试 mutex，防止首次分配耗时污染 500ms 门闸断言；默认沙箱 TCP EPERM 的尝试不作为功能验收。
- CLI 扩大范围修前：`fourth-full-review/cli-shared/expanded-before.log`，16 项，13 fail/3 pass；补充 CLI 凭证红例 `a12-before.log`，2/2 fail。最终完整隔离 compile：同目录 `a12-after-compile.log`；9 文件 70/70：`final-with-a12-tests.log`，exit 0。22 场景实际 CLI seam、arm64 计划、回滚请求 services/baseReleaseId、所有 build 先于 push、真实 tar 字面排除与同一 digest：`scenarios-final.jsonl`。root 拒绝将测试编译错误或 sandbox EPERM 当作功能红/绿证据。
- 根补丁经运行端复核者只读交叉检查，8/8：`fourth-source-cross-review-20261005-214415.log`；Provider 补丁经 CLI 复核者只读核对准入/认领同事务、精确 token 与取消 lock 次序，未发现确定新增缺陷。
- 全量最新源码：`fourth-full-test-20261005-215330.log`，`env -u TENCENTCLOUD_SECRET_ID -u TENCENTCLOUD_SECRET_KEY pnpm --filter shipkit test`，exit 0，498/498、installer 17/17。本轮新增 56 项（442→498），原 TCP 与全部 R/S 回归包含在内。
- 首次包冒烟 `fourth-package-smoke-20261005-215549.log` exit 0，但实际安装旧归档，**不作为当前补丁的包验收**。只读对比 `fourth-full-review/package-before.json`：6 个关键文件 3 missing/3 stale。首次 fresh 重放 `fourth-package-fresh-20261005-215805.log` exit 0；随后按职责抽出 artifact helper、加入安装后逐文件身份 gate，最新 `fourth-package-final-20261005-220149.log` exit 0，215 文件身份一致、包内 50 项部署隔离回归通过。独立归档对比 `fourth-full-review/package-after.json` 同样 215/215，mismatch 0，记录归档 sha256。
- A14 身份回归 `fourth-package-identity-20261005-220137.log`，4/4，exit 0；已接入 package.json 常规 test。包装入口与 helper 分别 200/31 行，测试 harness 按结构技能明确豁免，不以拆分测试虚报生产源文件上限。
- 最终常规 test 重放：`fourth-full-final-20261005-220405.log`，exit 0，498/498 主回归、4/4 产物身份、installer 17/17。此前已通过的全量因新增 A14 包验收与测试入口改动而再次重跑；源码冻结/来源、锁、取消、恢复等原回归均包含在内。
- 真实 Docker：`fourth-docker-final-20261005-220714.log`，`env -u TENCENTCLOUD_SECRET_ID -u TENCENTCLOUD_SECRET_KEY node scripts/e2e-multi-docker.mjs`，exit 0。全量/部分/坏探针恢复/回滚/混合 keep-env/新增未选拒绝通过；真实 prod target marker 可读，未选服务 ID/StartedAt 不变，外部卷数据与 CreatedAt 保留。清理本轮 2 容器、2 网络、1 卷、6 镜像标签，报告 zero new residue。
- 独立资源复检：`fourth-full-review/docker-after.json` / `docker-delta.json`，各项 new/missing_or_changed 均 0。已有 77 条镜像、17 个容器（6 running、11 exited）、8 网络、28 卷保持身份；容器 State/StartedAt、卷 CreatedAt 一致，不以“容器 ID 没变”替代误停验证。没有以全局 prune 清理任何对象。
- 静态检查：维护的 TS/MJS 非测试文件 136 个、最大 200 行，`fourth-full-review/structure-check.json`；测试和生成产物按结构标准豁免。TCP 四个核心协议文件无 diff；`git diff --check -- shipkit` 通过。最终工作区与原快照比对：其余 569 项改动状态一致，提交只包含本轮 Shipkit 路径。

## 覆盖与外部边界

原 R01–R03/S02/S04（归属变化、逐动作检查、恢复健康/计数）由运行端 matrix 和全量回归覆盖；R04–R06（外部卷、混合 keep-env、新未选）另用真实 Docker；R07/R10/R11/S01/S03（digest、平台、冻结来源/秘密排除）由 CLI 与原归档回归覆盖；R08（混合 v1/v2 GC fail closed）、R09/S06（信号取消与真实 provider 模拟 SDK）、R12/S05（清理基线及零新增残留）均统一重跑，不以新增用例替代旧回归。

真实 TCR 推拉、真实 CVM 主动/定时销毁回读、TWGG 接管/多轮/仅 admin/回滚/H5/数据保留，仍没有本轮真实环境证据。联动探针与同机多环境并存保留 TODO，用户已安装 CLI 未升级。这里的通过只用于本地源码与隔离产物，不能宣称整套生产链路已验收。

RunInstances 尚未返回 ID 而超过 settle/信号预算时，无法安全猜测实例销毁；ActionTimer 是云侧后备，仍需真实回读。当前 provider 使用已验证 TCP mutex；legacy mkdir 门闸只保留旧持锁者兼容，旧二进制之间或新旧版本混用的完整并发保证不在本轮证明范围。
