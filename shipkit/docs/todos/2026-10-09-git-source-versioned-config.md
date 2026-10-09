# Git 项目来源与版本化发布配置方案

路线：specialized。设计提交 `899f02ee`，用户已授权实施两个模块；不移动 `shipkit/0.0.1`，不推送远端，不改生产环境或用户原型。

| 项目 | 交付与证据 | 状态 |
| --- | --- | --- |
| 提交核对 | HEAD 为 `49f31106`；tracked 工作区无未提交加固代码 | done |
| 现状与影响图 | 项目路径 → spec → 计划指纹 → Builder Git/tarball → Runtime env/snapshot；限定源码核对完成 | done |
| Git 来源方案 | 轻量元数据读取适配既有构建管道，固定 SHA，凭据与路径边界；Git 链路研究完成 | done |
| 配置版本方案 | 项目/已有环境/服务的草稿冻结版本，加密与独立密钥，按服务关联；持久化研究完成 | done |
| 集成审查 | Git/持久化交叉审查完成；补齐 app 身份、连接与凭据快照、离线对账、冻结重新加密和旧/新脱敏 | done |
| 方案交付 | 主设计文档与本 TODO 一同提交；围栏、相对链接、空白检查通过；仅设计，未实现/部署/推送 | done |

默认解释：“动态环境变量”指平台管理并通过发布生效的运行时配置；不默认要求运行中进程热更新。已有目录项目与 envFile 保持兼容。暂不扩展业务权限限制。

设计入口：[方案](../git-source-and-versioned-config.md)。以下实施部分单独记录开发与验收，不将原设计提交当作功能交付。

## 已批准实施（2026-10-09）

新增约束：平台优先通过 Git provider API 仅获取 commit/spec；完整源码由 Builder 拉取。通用 Git 兼容使用限定大小、超时的临时缓存，读后删除，不保留完整仓库缓存。

| 切片 | 验收 | 状态 |
| --- | --- | --- |
| 合约与模块实现 | Provider API/generic临时解析、加密仓库凭据、草稿/CAS/冻结、项目子页面已实现 | done |
| 发布与恢复集成 | 固定私密输入、SHA阻断、configRef/noEnv、仅配置与历史恢复；Runtime-only重启与0映射发现均通过 | done |
| 隔离集成 | 最终Core/Agent652、API27、Web86；真实HTTPS Git9、Runtime容器9；构建/类型/迁移通过 | done |
| 浏览器验收 | 原空间46；配置生命周期4/4、部分回滚0.0.11源码归属、完整Runtime指纹均通过；最终Git0.0.12恢复两服务配置01，113事件/18完整日志scope无trace/fatal/秘密泄漏，页面保留供用户查看 | done |
| 交付 | 运维说明、可重复隔离验收脚本、实际验收摘要已保存；本机提交，不部署/推送或移动冻结标签 | done |

写入边界：core/Agent 由 protocol；API secrets/configs/Prisma 由 persistence；Web 由 project_context；根代理负责 API projects/tasks/executor 接入、契约与最终验收。共享模块先约定再使用，源码文件≤200行。
