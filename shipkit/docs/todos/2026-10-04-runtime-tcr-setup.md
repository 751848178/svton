# 运行端与 TCR 个人版接入

路线：todo-plan。用户已提供指定服务器连接信息并授权直接开通腾讯云 TCR；沿用本机控制端安装后的接入流程。多个项目各自使用应用名与发布配置。

- [done] 指定服务器安装 runtime Agent 0.5.0 并配对本机；复用现有 Docker/Node，7 个既有容器与 5 个卷安装前后相同，未部署业务应用。
- [done] 确认账号已有免费 TCR 个人版，创建 shipkit-zxb 命名空间；API 与控制台均回读成功。
- [done] 验证 runtime 配对、SSH 隧道与受限密钥；更新多项目配置模板并记录剩余动态构建配置。
- [done] 用户后续明确授权设置新 TCR 密码；已重设、本机/临时构建机真实登录通过，运行端拉取凭据已分发，密码只保存在本机私有文件。

## TWGG 首次发布接入（用户后续选择）

路线：todo-plan。目标为本机控制、临时按量构建机、既有运行服务器；用户指定 TWGG，并委托按 ai-driven 项目实际需求选择构建规格。

- [done] 核对 TWGG 本地/远端状态、Compose 兼容性与迁移历史；选定 SA9.2XLARGE16（8核16GB）、100GB SSD，广州六区，当前询价1.12元/小时加0.8元/GB出站流量。
- [done] 三镜像构建/推送、Compose 发布适配、备份及回滚路径已通过本地测试和真实 r1 部署；38个有数据表的业务值/权限关系未变，仅既有seed刷新4表时间字段。
- [paused] 浏览器发现 H5 React18/19依赖提升冲突；已修复移动端解析配置，但用户暂停后续部署并要求释放临时实例，r2 上线及完整页面验收尚未完成。
- [done] 按用户要求释放第二临时机 ins-ik6ays6c 及其专属安全组；2026-10-04 23:07（北京时间）独立回读确认两台临时构建机和专属安全组均不存在，运行服务器保持原状。证据：`/tmp/codex-tool-runs/svton/twgg-release/instance-release-verification.json`。

已发现：本地与服务器 Git HEAD 均为 `0d45cdf242e61b5bdfa396448271055f860140f6`；TWGG 为五服务 Compose，当前 Shipkit 缺少多构建 target 和运行端 Compose 卷/网络能力，不能直接使用单镜像 release 接管既有栈。暂不修改现有业务容器。

迁移证据：本地/容器迁移与 schema 哈希一致；`prisma migrate status` exit 0，无待执行迁移。数据库历史的5条记录来自2026-09-25基线压平，保留原样。本轮使用 TWGG 专用 Compose 适配，不宣称 Shipkit 已具备原生多服务发布能力。

敏感值不进入文档或日志。证据目录：`/tmp/codex-tool-runs/svton/runtime-setup/`。

安装记录：`docs/audits/2026-10-04/runtime-tcr-setup.md`。
