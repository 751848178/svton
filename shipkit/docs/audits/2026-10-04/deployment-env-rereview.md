# Shipkit 环境与状态追加复核

日期：2026-10-04。范围：沿用上轮部署归属边界，追加核对环境变量保留、发布快照完整性和异常状态拒绝；按用户已有授权直接修复。

## 结论

本轮发现 3 类上轮未覆盖的问题，已直接修复。环境保留、快照读取异常、状态结构损坏及旧格式缺失文件场景均补充了回归。最终全套与独立安装包回归通过，当前受审范围内没有未修复的已确认问题。上轮“298 项通过”仅证明当时的测试覆盖，不能证明本轮新增的异常路径正确。

## 发现与修复

| 问题 | 可复现的影响 | 修复 |
| --- | --- | --- |
| P1：`--keep-env` 没有从 CLI 传到 Agent | 第二次部署原本应沿用环境，却删除 `runtime.env`，新快照也没有环境文件，可能导致应用缺少运行配置 | 请求携带明确布尔值；Agent 在应用锁内从当前成功发布复制环境快照；显式环境文件含空文件均优先；首次发布或当前状态丢失时拒绝保留请求 |
| P1：环境快照读取失败被当作不存在 | EACCES/EIO、快照丢失或旧格式缺少存在标记时，回滚可能按空环境继续启动 | 新快照写入 `hasEnv`；只有明确 `hasEnv:false` 允许文件不存在；读取失败拒绝；可读旧环境快照兼容，无文件且无标记的旧快照须人工核对迁移；部署前先读取恢复快照 |
| P2：只验证 JSON 语法，没有校验发布状态/快照结构 | `null`、数组、非法 current/history 等数据会被继续使用，可能先修改运行资源再在状态提交时报错 | 严格校验状态结构和快照 id、镜像、环境标记；异常在激活前拒绝，保留原文件字节 |

CLI 对 `--keep-env` 检查运行端的 `deployment-env-preserve-v1` 能力；旧 Agent 无能力时拒绝，release 在创建构建机前进行该能力检查。API 拒绝非布尔 keepEnv 和非字符串 envFileContent。原有项目/环境绑定、容器归属复查和禁止孤儿清理保持生效。

主要文件：`src/cli/pipeline.ts`、`src/cli/deployment-protocol.ts`、`src/agent/handlers-deploy.ts`、`src/agent/release.ts`、`src/agent/routes-images.ts`。原有 GC 调用严格读取 ReleaseStore；快照不可读时同样中止清理，没有扩大删除范围。

## 证据

- 初始失败复现：新增 5 个用例中 4 个失败；日志 `before-fix.log`。失败分别证明环境被删除、快照读取错误被吞、已保存环境文件丢失未拒绝和非法状态结构未拒绝。
- 旧格式边界复现：8 个用例中 1 个失败，证明无存在标记且无环境文件时仍被猜测为空；日志 `legacy-before-fix.log`。修复后纳入最终全套和包内回归。
- 最终 `pnpm --filter shipkit test`：**308/308**，失败/跳过 0；安装器 **17/17**。
- 最终 `node shipkit/scripts/package-smoke.mjs`：仓库外临时前缀离线安装；包内隔离与环境回归 **39/39**；**20 项**冒烟检查通过。
- 两个包各 **157 个**实际 JavaScript 文件与当前 dist 逐字节一致；SHA-256 校验文件已更新。
- 相关路径 `git diff --check` 退出 0；维护源码最多 200 行，本轮改动模块未形成导入环。

日志目录：`/tmp/codex-tool-runs/svton/env-rereview/`；关键最终日志为 `final-full.log`、`pack.log`、`package-smoke.log`。完整计数、源码摘要与包摘要见 [机器可读证据](deployment-env-rereview-evidence.json)。

## 使用与验收边界

- 控制端和运行端都应安装本次重新生成的 0.5.0 包；同版本号不能替代能力校验。安装包路径仍为 `shipkit/pack/shipkit-0.5.0.tgz` 与 `shipkit/pack/ship-agent-0.5.0.tgz`。
- 老快照 env 文件缺失且无 hasEnv 标记时，不自动迁移。按原配置/备份恢复环境文件；只有确认该历史发布本来就不含环境文件，才可备份后添加 `hasEnv:false`。指南已同步 Markdown 和 HTML。
- 验证使用真实本机 HTTP/TCP、文件和 tar/npm 安装，Docker 列表与命令通过测试替身执行；没有创建云机器、发布到 npm 或操作真实服务器容器、卷。
- 真实运行服务器、Docker/私有仓库/TLS、动态云构建与费用生命周期仍需目标环境验收。本轮没有将模拟验证标为真机验收。
