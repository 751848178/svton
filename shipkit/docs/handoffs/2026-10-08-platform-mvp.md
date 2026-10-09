# Codex Slice Handoff

## Slice Decision
- should_slice: yes
- triggers: last_input 171802 >= 120000; max_last_input 171802 >= 120000
- diagnostics_log: /tmp/codex-tool-runs/svton/slice-handoff-20261008-011736.json

## Minimal Continuation Context
- objective: Implement the complete Shipkit platform MVP using the current svton ecosystem, real CLI and agent integration, and durable data.
- current_stage: shipkit-platform-mvp
- session: /Users/zhaoxingbo/.codex/sessions/2026/10/08/rollout-2026-10-08T01-14-28-01a10050-2d6d-7151-b7fd-be88d93cf1bf_01a1175c-039c-74b1-bd8a-b77e983f41f2.jsonl
- cwd: /Users/zhaoxingbo/Workspace/ai-driven/svton


## Token And Session Facts
- compactions: 0
- token_events: 5
- last_input: 171802
- max_last_input: 171802
- max_uncached_input: 3426
- events_over_100k_input: 5
- events_over_200k_input: 0
- large_tool_output_tokens: 0

## Completed Or Current Work
- Approved static UI in shipkit/prototype; localhost:8768; 19 model tests, 49 browser checks and 12 title-return checks passed.
- Current CLI 0.5.0 supports core release/plan/rollback/recovery/builder management; the appended brief records missing platform capabilities.

## Recent Milestones From Thread
- session line 11: 我会新建一个 GPT-6.1 Sol、Ultra 推理强度的会话，带上原型、脚本能力差异和实现边界，让它从架构、数据库设计开始，持续实现并验证 MVP。疑问交给子代理调研，不等待你回复。
- session line 34: 新会话会在 svton 项目中继续，复用最新原型和现有 CLI/Agent，同时补齐数据库、任务日志、历史回滚和安全取消。暂不做登录与权限管理，但会预留身份和工作空间边界。

  我会用 `codex-slice-handoff` 保存精简交接，避免新会话重读这段长对话。

## Next Work
- Read the appended execution brief, research with bounded subagents, design the database and implement the runnable MVP autonomously.

## Important Files
- shipkit/docs/handoffs/2026-10-08-platform-mvp.md
- shipkit/docs/todos/2026-10-06-local-panel-prototype.md
- shipkit/prototype/.impeccable/review/desktop-final.png

## Git Status Snapshot
- ?? shipkit/docs/handoffs/2026-10-08-platform-mvp.md
- ?? shipkit/docs/todos/2026-10-06-local-panel-prototype.md
- omitted 1 noisy or unrelated status entries; see diagnostics log for full status

## Verification Evidence
- none detected in recent session outputs

## Known Gaps And Risks
- Preserve untracked prototype and TODO; no credentials in handoff; distinguish real support from static display.

## Carry Rules
- Carry only this handoff, the listed files, and referenced log paths into the next slice.
- Do not carry raw tool logs, full diffs, full roadmap/TODO documents, full SKILL.md files, or the previous conversation.
- If a listed file needs inspection, read a narrow symbol or line window only.
- If validation is needed, capture full output under /tmp/codex-tool-runs/svton/ and return only status, key errors, and log path.

## Starter Prompt For New Slice
```text
实现下面执行简报定义的完整Shipkit平台MVP。持续推进架构、数据库、CLI/Agent协议、前端和端到端验证，不停在规划或某个中间模块。所有疑问由子代理调研后按最优方案决定，不等用户回复。使用GPT-6.1 Sol，Ultra推理强度；主会话协调有边界的子任务，压缩后继续原目标，不创建接力会话。
```

## MVP Execution Brief — user authorized 2026-10-08 Asia/Shanghai

用户原话：使用最新svton生态，把现有原型设计的功能全部实现；脚本支持部分接入脚本，前端能力由前端实现，需要数据库的设计数据库。暂不要用户登录和权限管理，但避免给后续接入挖坑。这是通宵长任务，用户休息；所有疑问和必要问题交给subagent调研，按照最优方案实现，不等回复。模型指定GPT-6.1 Sol Ultra。

### Product and acceptance

- 实现可运行的正式MVP，不是继续维护静态模拟页面。保持已确认的页面结构与绿白视觉：项目列表→项目详情→选择服务→核对计划→执行发布→查看结果，标题左侧透明ArrowLeft返回；TWGG固定256px侧栏/搜索/分组/当前项，手机覆盖式抽屉。
- 项目注册/本地目录绑定、服务元数据、服务器IP+显示名称、服务外链、当前版本、源码分支/提交/dirty、构建规格、Agent版本和连接检查全部读取真实来源。服务器显示名和服务URL可用平台元数据补充；不能借改显示名重命名底层target/env身份。
- 首次部署全量、后续全量或部分服务选择、真实只读计划、未选服务继承、外部卷/网络约束、显式开始/再次发布、并发门禁、刷新后继续查看任务、结果页手动进入、失败恢复、临时资源状态与释放重试必须可用。
- 六项执行能力都保留，但阶段排序和状态必须按实际生命周期呈现。每一步可点击打开右侧日志抽屉，支持运行中更新、空态、失败/恢复证据、按服务日志；在动态构建机销毁前归档构建/推送日志。
- 完整整轮发布历史与详情要持久保存（包括失败/取消/释放失败）。实现从历史记录选择服务并恢复对应历史变更前快照的能力，明确目标版本和当前基线，拒绝过期/缺失/越界快照。不要把--base-release防陈旧参数伪装成历史版本选择。
- 实现分阶段的安全取消与必要恢复：本机任务与Agent协作式取消，持久化状态；明确不可取消的提交临界区、取消请求中、已取消、恢复失败等真实结果。仅kill CLI进程或停止轮询不等于取消远端部署，不能虚报成功。保留部署身份、容器/卷归属与外部数据保护。
- 自定义下拉/键盘、步骤条点击/门槛、标题返回、项目导航、原生外链、命令复制由前端完成。原型“执行场景”正常/故障下拉是测试设施，不作为生产控制开关；真实结果由执行器报告，故障注入只在隔离测试使用。
- AI Agent继续可用CLI/JSON；可根据平台API补自动化入口，不引入随意shell执行接口。前端与Agent/云凭据之间由本机后台隔离，不在网页或公开响应中泄露token/SecretKey/env内容。

### Architecture and data

- 先派只读子代理调研最新本地svton packages、templates/apps/backend与admin、现有NestJS/NextJS/Prisma模式、API客户端/状态/表单/日志组件、执行与数据库方案。按实际代码和兼容性选型，使用workspace生态，必要时查官方文档核对发布版本；不要无差别升级整个monorepo或另造平行框架。Shipkit需要Node>=20。
- 建立持久TODO、架构决策、数据库schema/migration/必要初始化数据、接口契约，再分配互不重叠的实现路径。由主会话负责集成、审计与修复；遵循仓库AGENTS和用户层结构/规划/验证技能，维护源文件<=200行、单责与无循环依赖。
- 设计适合本机控制平台的数据库；覆盖项目/服务器/服务配置引用、发布任务/阶段/远端job映射、计划/快照/版本、发布事件与日志归档索引、健康/恢复/取消/资源清理结果。状态机与事务/重启恢复要真实，不能把前端内存作为唯一任务状态。大日志可文件归档+DB索引，按证据选方案。
- 暂不做登录页、账户流程或权限管理界面。预留可替换的request actor/workspace context、资源作用域、审计actor/创建者、服务端策略入口；使用明确本机主体，不把身份边界绑定进业务或伪造管理员。未来接入认证/授权不需重写表关系/执行层；避免过度设计RBAC。
- MVP默认本机监听；任务启动请求要有明确的本机来源边界，避免网页随意触发。所有执行通过受控参数调用CLI/服务层；复用现有锁/身份协议，不绕过既有安全约束。

### Verified capability gaps and exact source entry points

- `shipkit/src/cli/main.ts`：命令、--json与退出码；`cmd-release.ts`/`release-plan.ts`/`pipeline-multi.ts`/`pipeline-group-deploy.ts`：服务选择、计划与真实发布。
- `pipeline-multi.ts:150`/`builder-lease.ts:63`在构建推送后已经尝试释放构建机；`cmd-release.ts:112`随后才部署运行端。释放失败是独立清理状态，不能导致错误的应用回滚；静态/保留窗口也要准确表示。
- `cmd-status.ts`与`agent/routes-lifecycle.ts`有status/groups/jobs/log；`agent/routes-groups.ts`的group-state只有当前组合。完整GroupStore历史/快照尚无公开读取API；快照有保留上限，需要目标可用性与保留策略。
- `cmd-rollback.ts`/`agent/handlers-group-rollback.ts`现有按服务回滚选择最近覆盖所选服务集的变更及其parent；尚无任选历史记录的目标参数，需要真实协议和校验扩展。
- `signal-guard.ts`目前仅动态构建资源的SIGINT/SIGTERM有界清理；Agent JobStore没有部署取消API，不能当成“取消并恢复”已实现。
- `job-report.ts`/`shared/log.ts`/`agent/jobs.ts`有原始日志与状态，但缺整轮发布stageId/服务/跨机器job映射与持久归档。构建机销毁后其任务日志不可再现场读取。
- `cmd-doctor.ts`提供配置/认证角色/Docker/Agent就绪检查；registry已配置不代表推拉实测成功。`cmd-verify-registry.ts:65`当前限定static builder，动态场景应按真实证据分级展示或补合适验证，不能全绿冒充验证。
- `agent/group-activation.ts:127`可能verification skipped；恢复也可能失败；首次部署没有旧版本可恢复。UI要覆盖这些真实结果。
- `shared/types.ts`的TargetConfig没有serverName；`shared/spec-v2.ts`服务字段没有entryUrl/displayName；需平台元数据和项目注册能力，现有CLI无跨本机项目目录发现命令。

### Inputs, boundaries and proof

- 最新视觉/交互源：`shipkit/prototype/`，`PRODUCT.md`/`DESIGN.md`/`README.md`，`qa-evidence.json`。参考截图只需`nav-desktop-project.png`、`nav-mobile-navigation.png`、`nav-mobile-ready.png`、`title-back-desktop.png`、`title-back-mobile.png`，均在`.impeccable/review/`。当前静态预览127.0.0.1:8768。
- 原型及`shipkit/docs/todos/2026-10-06-local-panel-prototype.md`为已获用户确认的未跟踪内容，不得reset/clean删除。交接前按相关路径检查，无其他改动显示；仍需自己核对最新状态。
- 历史生产证据可窄读`shipkit/docs/audits/2026-10-05/production-chain-acceptance.md`，不能把旧证据当最新部署。TWGG在`/Users/zhaoxingbo/Workspace/ai-driven/twgg`，可只读作为项目配置/导航参考；当前MVP不改其业务功能。
- 可复用现有私密配置与凭据引用，不能输出或提交密钥，不猜密码/重置凭据。默认不创建付费CVM、不变更现有生产TWGG/外部数据、不自动升级生产Agent；这些不是停止实现的理由。使用隔离项目、真实本地Docker/本机测试Agent、云SDK仿真验证核心集成，明确尚未重新验证真实云的部分。
- 证明完整真实链路：注册项目→读取状态→全量/部分plan→显式发布→实时阶段日志→健康结果→释放结果→记录刷新/重启保留→再次发布→指定历史服务回滚；另验取消/自动恢复/恢复失败/探针跳过/清理失败重试/并发冲突/过期快照/数据卷保留。不要仅mock全流程、仅单测或仅代码编译就称MVP跑通。
- 分层验证：数据库迁移与关系、受影响CLI/Agent回归、API集成、真实隔离Docker E2E、正式前端桌面/手机浏览器实测和截图。日志隔离在`/tmp/codex-tool-runs/svton/`，不向上下文倾倒。
- 浏览器优先ego-browser，原型的TaskSpace为46、p1桌面/p2手机；不要重复创建大量TaskSpace。正式应用用独立开发端口，验证后给出本机启动命令与预览地址；如替换8768，仅停止精确确认归属本原型的进程。
- 一次性完成并自查修复，不停在建议/提示词/架构文档或等待用户回复。用户未要求远端推送，不push/merge/创建PR；如本地提交只含任务拥有文件，禁止git add .。完成后简短报告实际完成项、运行入口、测试证据及确有的环境缺口。
