# Agent 注册中心实施清单

状态：实施中，2026-10-10。用户已授权开发、按功能模块提交、逐项验收及部署。未勾选项尚未通过验收，不代表上线能力。方案与现状核对见 [设计文档](../agent-registration-center.md)。

已确认：先部署当前加固版，后续通过 Shipkit 自身的构建部署能力发布新 Server/Agent。先升级兼容旧 Agent 的 Server，再逐台升级/注册并切换项目绑定。

当前活动项：A1 注册身份、机器认证与会话租约（`in_progress`，执行路径 `specialized`）。E1–E3 已逐项验收：固定提交 `cfafa790` 正常 Git 构建、独立仓库推送和 Runtime `deploy-group` 更新成功；真实页面登记自身项目、关联冻结配置 `0.0.1` 并核对只读计划；离线备份解包校验与 Server 重启后项目、配置、计划和原主密钥均保持。原 10 个业务容器、Builder 中继、Runtime、旧 Agent 和 Docker 的身份及启动状态保持。顺序继续为 A–D 注册中心 → E4–E8 自发布与 Agent 升级，尚未通过平台任务发布自身。域名由用户后续配置，先仅经 SSH 隧道访问；临时本机 Builder 与中继不是永久托管。真实地址和凭据保存在私密部署记录，不进入公开仓库。

E1 隔离审查新增验收门槛：迁移与服务停止须等待完整进程树退出后才能释放维护锁；发布定义经 Runtime Agent 渲染后须保留首次安装的只读根文件系统、临时目录、安全选项与停止宽限；通用私有 Git 认证须在临时目录禁止执行的环境完成真实读取。回环端口模块已提交 `c636e85e`，容器停机身份校验备份已提交 `518962bf`，控制端辅助状态备份已提交 `3d010150`，Runtime 容器安全策略已提交 `ce52b813`，完整进程树监督与停止竞态修复已提交 `1d73c141`。

首次部署接管影响图：`runtime-policy-types/schema → compiler/legacy 转换 → group 快照 → compose-runtime-policy → Docker`，补受限 `json-file` 日志轮转，验证历史恢复及 Builder 排除；`container/ship.yaml → host-isolation/render-spec → 仓库内派生规格 → Git specPath`，补生成一致性检查。接管必须使用真实 registry manifest digest，先验证固定镜像身份与救援备份，再通过正常首次 `deploy-group` 建立完整基线；禁止手工填写 Agent 状态。随后登记已推送的固定 Git 提交与可解析的独立 Builder/Runtime 连接并验收计划。

E3 仓库请求修复影响图：`repository-provider → repositoryReader → resolveGitAddresses → Node HTTPS lookup`。保留先校验全部 DNS 地址、固定连接地址、TLS 和请求预算；覆盖 Node 22 自动地址族选择要求的 `all:true` 回调格式。当前 Builder 本机系统 DNS 为代理 fake-IP，安全校验已拒绝；临时隔离 Builder 使用自己的公共 DNS，保留地址防护，不修改全局网络设置。该路径用于有限验收，不是永久构建端托管。

E3 文件锁运行路径补齐：正常 Builder registry-creds 接口发现只读容器没有可写 `/var/tmp/shipkit-lock-ports`。保留固定全局锁注册表与算法，在 bootstrap Compose 和源规格统一增加 UID10001、0700、16MiB、noexec/nosuid/nodev 的 `/var/tmp` tmpfs；生成规格一致性及真实锁获取/并发互斥作为门槛。未发布任何平台任务。

E3 Git 元数据预算影响图：`source.ensureSource → git-command.assertSupportedGitTree → shared.exec → Job 日志`。实际冻结树 8,881 行、1,054,015 字节超过 1MiB；检查改为紧凑 mode、独立 `.gitmodules` 和现有 LFS 查询，内部 stdout 不进入用户日志。保留 DNS/TLS/认证、超时和截断拒绝；使用大树、异常元数据和真实 Git 回归。临时 Builder 控制 Agent 必须冻结完整编译输出后替换，不热补单文件或把本机编译标成实际 Git 镜像。

E3 会话读取与配置冻结影响图：`LocalRequestGuard → SessionStore.read → Prisma interactive transaction (BEGIN IMMEDIATE)` 与 `ConfigRepository.freeze` 竞争 SQLite 写锁。真实页面一次冻结失败，原 etag/版本重试成功；隔离真实数据库已复现 16 次普通会话读与一次冻结的 P2028/P1008，失败完全回滚。活动修复限定为原子只读会话快照，保留停用、过期、撤销及用户种类校验；验收包含实际并发、无读取写锁、单一冻结结果和审计、完整编译及最终实际镜像更新。注册中心实现仍等待本基础门槛完成。

E3 仓库限流影响图：`ProjectService.status → inspectionInput → inspectProject → resolveRepositorySource → GitHub commits/contents`。真实匿名首个 commits 请求已 403、配额 60/剩余 0；两端 Agent 的 Server 认证检查均 200。修复只将服务端已核对 SourceSnapshot 保存在既有按项目/源码修订绑定的加密 envelope，状态/历史使用该登记定义；发布计划、任务输入、显式仓库检查仍走原解析路径。真实 token 决定凭据标识，旧 envelope 无快照保留兼容，存在但不匹配或损坏的快照拒绝。403 限流与未知权限失败分别处理，不能公开响应正文或通过新凭据绕过。验收覆盖密码投影、跨范围/篡改/修订、无状态元数据请求、计划重新读取及仓库 CAS 保存。

当前补充门槛：日志轮转已提交 `7104d672`、仓库规格与构建门禁已提交 `bf66cc5e`。独立 registry 镜像已推送并获准向新 Runtime 分发拉取凭据。自身服务 key 必须保持 `server`，补 `ServiceSpec.imageRepository → buildSliceFor/push → 固定spec指纹` 的可选仓库 leaf 映射，并拒绝有效仓库名冲突，使构建/推送落到已批准的独立仓库。远端动态 Builder 缺少受保护 HTTPS 下载/控制入口；临时独立本机 Builder 与 SSH 加密中继只作为验收路径，需另行验收且不宣称永久托管完成。

开发分支：`codex/shipkit-self-hosted-registration`。功能模块独立提交，旧冻结标签不移动；构建/测试全日志位于 `/tmp/codex-tool-runs/svton/self-hosting/`，协调板位于 `/tmp/codex-tool-runs/svton/long-goals/shipkit-self-hosted-registration/board.json`。

## A. 身份与资源目录

A1 实施边界：三个新增模型 `Agent/AgentEnrollment/AgentSession`，既有用户与会话不变；共享严格 v1 协议由 core 导出，Server 持有认证、事务与资源批准。仅支持明确批准用途的持久 Agent，临时注册暂时拒绝，原动态构建机保持。注册码有效期与消费后的响应恢复期各 15 分钟；心跳 15 秒、疑似离线 45 秒、租约 90 秒。机器入口默认关闭，启用时需明确可信 HTTPS 入口；不能凭客户端 forwarded 头判定 TLS。机器凭据不授权人类 API，用户会话不授权机器方法，所有写事务重新鉴权。带 epoch/sequence 的重复响应不续租，撤销与换证须封闭旧会话。A1 的执行就绪始终为 false，待 B 通信通道验收后开放。

A1 分模块验收：新增协议与实际旧数据迁移/DDL 回滚 → 一次性注册、同请求恢复和精确机器入口/人类回归 → 会话、心跳、撤销、换证与独立目录。每个模块保持单一职责与 200 行文件上限；真实 SQLite 竞态、实际 Next 入口、隔离 TLS 与秘密不出现在响应/审计作为验收门槛，不用 mocked DB 替代。

- [ ] 新增 Agent/Session/Enrollment 模型，区分稳定身份、数据实例和进程会话。验收：重启 ID 保留，丢台账不能恢复为原执行身份。
- [ ] 实现一次性注册、幂等响应恢复、机器认证、用途批准与审计。验收：过期/重用/跨范围/伪造角色被拒绝，丢响应不产生重复资源。
- [ ] 实现带 epoch 的心跳租约和禁用/撤销/轮换。验收：旧会话不能覆盖新会话，复制身份并发被拒绝，Server 重启可恢复。
- [ ] 独立资源目录与 legacy 配置视图并存。验收：未关联项目的 Agent 可见，未注册连接不会显示成心跳在线。

## B. 通信与任务

- [ ] 为现有操作定义 AgentTransport、直连和注册通道两种实现。验收：core 不依赖 Nest；状态、源上传、Job 查询、日志、事件、取消和历史均覆盖。
- [ ] 实现持久命令箱与 Agent HTTPS 长轮询/ACK。验收：没有 Agent 入站端口也可执行任务，控制/日志/心跳互不饿死。
- [ ] 复用操作幂等与持久 Job，不引入任意 shell 队列。验收：ACK 丢失重投不重复执行，变更参数同 operationId 被拒绝。
- [ ] 接入 Job 发现、日志游标、取消及断线/重启对账。验收：Server 在关键提交窗口重启可找到原任务，Agent 重启不假报续跑。
- [ ] 增加有认证、配额和 TTL 的临时 tarball 通道。验收：本机目录模式可用、文件受限并清理，命令库不存大二进制，Git 仍在 Builder checkout。

## C. 项目绑定与发布安全

- [ ] 项目环境绑定稳定 Runtime/Builder 身份，保留动态云创建策略。验收：用途/就绪/禁用检查明确，旧项目继续可发布。
- [ ] 新增版本化的注册身份快照，保留原 direct 指纹校验。验收：同身份重连可用；身份、信任、授权或绑定变化使计划失效。
- [ ] RemoteJob/发现/恢复/回滚按 agentId+incarnation 关联。验收：同地址不同身份、相同 Job ID 不会串任务，离线 Runtime 不被自动改派。
- [ ] 临时 Builder 注册资格绑定创建任务与租约。验收：登记和云实例受控关联，归档完成后再释放，离线不伪装成销毁完成。
- [ ] 保留 config-only/rollback 不依赖 Builder 的边界。验收：Builder 离线时运行端配置发布与历史回滚成功。

## D. 安装与页面验收

- [ ] 安装源、生成脚本和离线包支持 Server/CA/注册配置。验收：首次接入、升级保留身份、注册码退出后清除、回退可恢复。
- [ ] 现有 Agent 资源页面增加注册入口、用途、在线/就绪、关联、排空/禁用和撤销。验收：资源列表与独立目录一致，控制地址和业务入口含义清楚。
- [ ] 项目连接设置提供资源选择与未就绪修复入口。验收：保存后重读绑定一致，不绕过计划核对直接改线上运行环境。
- [ ] 隔离环境完成 Git 双服务发布、日志/取消、故障恢复、旧直连回归及临时构建机清理；浏览器逐项验收并记录证据。验收：A–D 全部达标后才宣称“动态注册可发布”。

## E. 首次部署与平台自发布

- [x] 首次部署前补齐 Shipkit Server/Web Dockerfile、`ship.yaml`、生产入口和健康检查。验收：固定提交构建并由独立 Runtime Agent 部署；Server 不包含宿主 Agent 或 Docker socket。
- [x] 建立外置数据/日志/原主密钥/配置目录和引导安装入口。验收：替换 Server 镜像后项目、版本、历史任务和秘密仍可用，目录/卷需显式预建。
- [x] Shipkit 自身登记为 Git 项目，绑定独立 Builder/宿主 Runtime。验收：平台页面选择固定提交后能核对自发布计划，旧 Agent 在 Server 升级期间保持兼容。
- [ ] 增加受限 Server 自发布任务及持久维护交接。验收：排空其他任务、完整指令交接后 Server 可退出，宿主接手；`.ops.lock` 与备份活任务保护无死锁或泛化绕过。
- [ ] 完成迁移前备份、单写者切换、限制写入的升级健康验证和恢复策略。验收：新版本失败时按兼容边界恢复旧代码/迁移前数据，原密钥保留；普通镜像回滚不能伪装成数据恢复。
- [ ] 增加受控 Agent 升级包构建、校验和独立宿主升级程序。验收：原 Agent 停止后程序继续完成替换/健康核验/回退，不能执行任意宿主脚本。
- [ ] Agent 升级结果独立持久化并与原任务对账。验收：升级成功或失败后新/旧 Agent 均能恢复事实，身份/任务数据保留，旧版本→注册版本的认领与绑定明确。
- [ ] 用当前实际部署版本做 Server/Agent 灰度自发布与故障注入。验收：页面发起构建部署，控制面恢复后补录原任务最终结果；坏镜像、迁移失败、Agent 启动失败可恢复，离线救援入口可用。

## 当前证据边界

- 已完成：当前资源派生、入站 HTTP 认证、Job/游标、私有快照和云构建机链路的源码核对；方案评审输入已保存。
- 未完成：任何注册/心跳/反向通信实现、数据库迁移、安装升级、页面或真实运行验收。
- 已完成：生产镜像、发布定义、离线初始化、持久化目录与完整进程树监督的隔离测试；浏览器已保存合成项目、秘密变量与冻结版本，并在替换镜像后重读。私有 Git noexec 修复已提交 `1723d32e`，容器与引导已提交 `53df3f7e`，受控重启策略已提交 `680f91b7`；固定提交 amd64 离线镜像通过校验，仍未视为 E1–E3 整体达标。详见[基础验收记录](../audits/2026-10-10/self-hosting-foundation.md)。
- 已完成：冻结镜像 `4cce3e0a` 的真实首次部署；空配置离线迁移、登录、容器替换后持久化、独立 Runtime Agent 认证健康、内核跨 bridge 拒绝及初始备份。原有 7 个业务容器和旧 Agent 的身份及启动状态保持；旧 Git 冻结标签未改变。
- 已完成：bootstrap 的正常 Agent 接管、后续固定提交 Git 构建/推送/更新、自身 Git 项目与配置计划、最终离线备份解包校验与 Server 重启页面重读。当前真实数据库为 1 个项目、1 个冻结版本、1 个关联计划、0 个平台任务；合成隔离数据的历史任务与秘密保留另有替换镜像证据。没有将原始 Agent Job 冒充平台任务。
- 未完成：注册中心、永久 Builder 托管、公网 HTTPS、宿主自升级任务、维护交接和 Server/Agent 自发布验收。真实开机/Docker daemon 重启及外部 L2/DNAT 路径尚未回放，不将 synthetic 检查等同于这些验收。
