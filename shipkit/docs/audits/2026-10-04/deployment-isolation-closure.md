# Shipkit 部署归属隔离复核与修复闭环

日期：2026-10-04。用户授权直接修复，并连续进行审计、修复与复验。

追加复核说明：本记录对应上一轮代码与包摘要。后续发现了环境保留、环境快照读取及发布状态结构校验的遗漏，已继续修复；当前结果与新包摘要以 [环境与状态追加复核](deployment-env-rereview.md) 为准。上一轮测试通过不能证明这些当时未覆盖的异常路径正确。

结论：完成三轮复核。本轮部署身份、源码来源、旧部署认领、容器归属及分发包一致性范围内，已发现的问题均已修复，没有待修复项。最终代码的全套回归和独立安装包回归均通过。本结论限于脚本和本机模拟验证，不代表真实 Docker 主机或腾讯云端到端验收。

## 修复结果

| 问题 | 最终行为 | 主要验证 |
| --- | --- | --- |
| 旧部署资料不完整时可能被重新认领；证据读取错误可能被当作不存在 | 任意已有应用目录条目或 Compose 容器均阻止无绑定自动认领；读取失败、非法绑定保留现场并拒绝；首次绑定使用独占创建，不覆盖其他首次请求 | `project-binding.test`、真实 HTTP 的旧状态和容器遗留场景 |
| `--from-dir` 实际上传来源与配置 `source.repo` 不一致 | 根据实际上传目录计算身份；构建缓存和一键发布传递同一身份；Git 构建使用实际配置源；非默认 Git 端口不会与仓库路径混淆 | `project-id.test`、`deployment-provenance.test` |
| 本地上传后单独部署或回滚可能使用错误来源 | `deploy` 和 `rollback` 支持相同的 `--from-dir DIR`，只识别来源，不重新上传；不同来源的最近构建缓存不混用 | 真实命令编排的本地构建→发布→单独部署→回滚 |
| 旧 Agent 忽略新增身份字段，新 CLI 可能误以为隔离已生效 | 运行端声明 `deployment-identity-v1`；CLI 同时核对机器 runtime 角色与凭据能力；不兼容时拒绝部署、回滚；release 在创建构建机前检查；doctor 如实报告 | 旧能力、错误类型、builder-only 机器的拒绝用例；安装包能力检查 |
| 镜像拉取期间绑定改变或丢失，恢复路径可能继续启动容器 | 激活前以及 pull 后、up 前重新核对项目绑定；部署、手动回滚和自动恢复共用激活入口 | 真实 HTTP 的拉取期间绑定删除、环境替换、容器归属替换；up 调用为零，原 state 字节不变 |
| Docker 查询截断、超时、不完整或项目标签不一致时可能漏检 | 所有查询异常拒绝；inspect 必须覆盖全部候选容器；Compose 项目标签和 working_dir 都需匹配 | Docker 故障、截断、超时、缺失结果、错误标签回归 |
| 环境变量仍可能打开孤儿容器自动删除 | 所有 Compose 调用显式设置 `COMPOSE_REMOVE_ORPHANS=false`，且 up 不带 `--remove-orphans` | 继承 `COMPOSE_REMOVE_ORPHANS=true` 的回归；依据 [Docker 官方变量说明](https://docs.docker.com/compose/how-tos/environment-variables/envvars/#compose_remove_orphans) |

同一 Agent 上的一个应用名只绑定一个项目和一个环境。已有 prod 的同名 staging 请求会被拒绝，原 prod 仍能部署及回滚。同一 Docker daemon 上需要运行多个环境时使用不同应用名；另建目标别名或另一 Agent 目录不能隔离同名 Compose 项目。`web` 与 `web-api` 的正常共存回归通过。

## 三轮验证

1. 第一轮核对调用链并修复认领遗漏，构建与 13 项初始针对性测试通过。
2. 第二轮扩展来源、兼容、激活竞态与 Docker 失败路径，31 项针对性单元回归通过；真实 localhost HTTP 覆盖一个 Agent、同一 appsRoot 的部署和回滚。首次扩大验证有 3 项上传测试依赖宿主 Docker 探测而失败，已隔离该测试依赖并重跑。
3. 第三轮对最终源码运行全套回归，随后在仓库外安装最终 tgz 再运行部署隔离及安装包检查；逐字节比对两个包内全部实际 JavaScript 文件。

最终命令和结果：

| 命令/检查 | 结果 | 日志 |
| --- | --- | --- |
| `pnpm --filter shipkit build` + `node shipkit/scripts/pack.mjs` | 退出 0 | `/tmp/codex-tool-runs/svton/ownership-closure/final-build-pack.log` |
| `pnpm --filter shipkit test` | 298/298 测试；17/17 安装器场景；无失败、跳过或取消 | `/tmp/codex-tool-runs/svton/ownership-closure/final-full.log` |
| `node shipkit/scripts/package-smoke.mjs` | 包内隔离回归 29/29；19 项冒烟检查通过；最终安装使用临时 npm 缓存，离线安装成功 | `/tmp/codex-tool-runs/svton/ownership-closure/final-package-smoke.log` |
| 两个分发包与当前 dist 比对 | 每包 156 个实际 JavaScript 文件一致，无差异；Agent tar 的 AppleDouble 条目为 macOS 元数据，不作为 JavaScript 源码 | `/tmp/codex-tool-runs/svton/ownership-closure/package-integrity.json` |
| 本次相关路径 `git diff --check` | 退出 0 | `/tmp/codex-tool-runs/svton/ownership-closure/diff-check.log` |
| 结构检查 | 本次维护源码不超过 200 行；提取共享激活入口和身份校验；本次改动文件没有形成依赖环 | `/tmp/codex-tool-runs/svton/ownership-closure/source-lines.json` |

CodeGraph 索引早于 Shipkit，本轮使用限定目录搜索建立调用关系，没有重建整个仓库索引。保留全部用户已有改动；没有提交或发布。

## 分发与使用边界

- 新包：`shipkit/pack/shipkit-0.5.0.tgz`、`shipkit/pack/ship-agent-0.5.0.tgz`，各有 `.sha256` 校验文件；完整摘要见 [机器可读证据](deployment-isolation-closure-evidence.json)。
- 版本号仍是 0.5.0，必须使用本次新包；CLI 会通过能力检查拒绝旧的 0.5.0 Agent。控制端和运行端都应更新。
- README、Markdown 手册及 HTML 手册已同步项目、环境、来源与人工迁移规则。旧绑定无法确定时应停止迁移，不可按新请求猜测原归属。
- HTTP/TCP、文件读写、tar 上传和包安装是真实执行；Docker 可用性/容器列表/Compose 操作通过测试替身提供，并设置无效 Docker socket 防止意外访问。
- 没有创建云机器、发布到 npm、操作真实服务器容器或卷。真实 Linux/Docker/私有仓库/TLS/腾讯云费用与生命周期仍属于目标环境验收，不能从本机测试推导已通过。

后续验收可使用全新测试应用和明确隔离的运行目标，核对实际 Docker 归属标签及构建、发布、回滚流程。本次没有留下需要继续修改的部署隔离代码问题。
