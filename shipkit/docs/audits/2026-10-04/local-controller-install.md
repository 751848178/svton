# 安装前复核与本机控制端安装

日期：2026-10-04。用户授权复核、必要修复、本机安装及复用 ZCode 之前 Shipkit 脚本的腾讯云凭据。本轮不执行真实发布或创建云资源。

## 复核与修复

本轮确认并修复两项遗漏：

1. 容器激活成功后，发布状态提交失败没有恢复运行版本。部署和回滚现在都会尝试恢复提交前的完整快照，明确返回恢复成功/失败；首次部署没有旧快照时明确报告无法恢复。已提交后的快照 GC 失败单独记警告，不触发错误回滚。新增 5 项故障回归，修复前均失败。
2. 内置 HTTP 分发把分发服务端口写成 Agent 监听端口。现在默认监听 7410；自定义 HTTP 直连端口正确传入安装器；HTTPS 对外 443/8443 与内部 7410 分离。真实 HTTP 渲染安装器并模拟 CVM 引导验证，不访问真实云实例。

当前受审范围没有未处理的已确认安装阻断。此结论不替代真实服务器、Docker、TLS、仓库推拉和云费用生命周期验收。

## 最终验证

- 全套 Node 回归 **317/317**，失败/跳过 0；安装器 **17/17**。
- 重新打包后仓库外安装：包内回归 **50/50**，冒烟检查 **20 项**。
- 两个安装包各 **159 个** JavaScript 文件与当前 dist 字节一致；SHA-256 文件已更新。
- 本轮维护源码 135–200 行，限定路径 diff 检查通过；新端口修复经过独立交叉复核。
- 安装后的 CLI 在仓库外、最小环境、新登录 shell 下都可调用。
- 已通过腾讯云 `DescribeRegions` 只读请求验证凭据；未验证创建/销毁权限，未创建或删除云资源。

日志目录：`/tmp/codex-tool-runs/svton/local-install/`。机器证据：[local-controller-install-evidence.json](local-controller-install-evidence.json)。故障复现日志分别在 `/tmp/codex-tool-runs/svton/install-gate-review/` 与 `/tmp/codex-tool-runs/svton/bundle-agent-port/`。

## 已完成的本机配置

- 命令：`/Users/zhaoxingbo/.local/bin/ship`，版本 0.5.0。
- 独立安装目录：`/Users/zhaoxingbo/.local/share/shipkit/0.5.0-4d03248ef36e`；不依赖仓库内 node_modules 软链接。
- 云凭据：`/Users/zhaoxingbo/.ship/tencent-cloud.json`，权限 0600。只复制了已验证的 SecretId/SecretKey；不写入仓库或日志。
- 启动器自动载入 `TENCENTCLOUD_SECRET_ID` 和 `TENCENTCLOUD_SECRET_KEY`，无需 AI Agent 手动 export；显式覆盖必须同时提供两项，避免混用。
- 待填模板：`/Users/zhaoxingbo/.ship/config.dynamic.template.yaml`。未作为有效配置启用，防止占位内容被误当成已配置环境。
- `ship doctor --json` 退出 1，原因是尚无部署配置；这是准确的未就绪状态。

## 剩余配置与顺序

1. 确定要发布的应用目录，准备 Dockerfile、ship.yaml（应用名、端口、健康检查）及应用环境文件。
2. 提供运行服务器地址/登录方式，安装本次 `ship-agent-0.5.0.tgz`，接通 HTTPS 或可信私网，使用 `ship pair <url> --name prod` 配对。
3. 提供镜像仓库域名、命名空间及推送/拉取凭据。云 API 密钥不替代仓库凭据；动态构建机要通过预制镜像或引导注入推送凭据，运行端配置拉取凭据。
4. 补齐腾讯云可用区、机型、Linux 镜像、VPC、子网和安全组。模板保留 `keepMinutes: 0`，构建结束尝试释放；默认任务预算对应 `maxLifetimeMinutes: 180`。首次验收需要核实云端定时销毁和主动释放结果。
5. 接通动态构建机引导分发、Agent 访问和 TLS。`bundleBaseUrl` 需要实际代理/隧道到本机 7411；本机不开放入站时可使用固定服务器托管 `installUrl + installToken`。TLS 与域名路由须预先准备，配置字段不会自动签证书或更新 DNS。
6. 填完模板另存为应用目录的 `ship.config.yaml`，先执行 doctor，再进行一次最小真实构建、推送、部署及释放验收。

动态模式目前不适用 `ship init` 的 static 初始化或 `ship verify-registry` 的 static 实测；此场景直接补模板。`ship builder up` 会创建按量实例，不把它当作免费诊断。

AI Agent 可直接执行：

```sh
/Users/zhaoxingbo/.local/bin/ship help
# 下列命令在应用目录、配置接通后使用：
ship doctor --json
ship release --to prod --from-dir . --json
ship status --to prod --json
```

同版本号 0.5.0 已重新生成安装包，运行端应使用本轮新包。CLI 包 SHA-256：`4d03248ef36e3a7959d08b1729e8d927ea2794baa8124d328c4c50988fdee084`；Agent 包 SHA-256：`11f5bdcfd7bdd84fd9bcea444424673f157f168c431f6312963435c12607d254`。
