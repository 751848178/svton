# 4. 代理能力应该升级为站点管控

> 稳定产品文档。Site 实现进度见 `progress/P3-site-governance.md`。

当前 `ProxyConfig` 更像"反向代理配置"。但用户实际要的不是只配一条 upstream,而是管理一个能对外服务的站点。

竞品依据:

- 1Panel 的 Website 能创建多种站点:应用一键部署、运行时环境、反向代理、静态网站、子网站,并把主域名、其他域名、HTTPS、站点目录、数据库、FTP 等作为同一站点表单的一部分。Source: https://1panel.pro/docs/v2/user_manual/websites/website_create/
- 1Panel 的 OpenResty 设置支持启动、停止、重启、reload、状态、配置修改、性能调优、日志和模块管理。Source: https://1panel.pro/docs/v2/user_manual/websites/openresty/
- Nginx Proxy Manager 聚焦转发域名、重定向、stream、免费 SSL、访问列表、HTTP Basic Auth、用户权限和审计日志。Source: https://nginxproxymanager.com/guide/
- Coolify 在 Docker Compose 场景中会给部署服务创建网络并添加 proxy service;服务可以通过 domain 暴露,端口映射则被提醒可能绕过 proxy 控制。Source: https://coolify.io/docs/knowledge-base/docker/compose

建议把能力从 `ProxyConfig` 演进为 `Site`。

| 层级 | 能力目标 |
| --- | --- |
| Site | 名称、项目、主域名、别名、状态、归属服务器 |
| Route | path、负载均衡、超时、headers、rewrite(第一版通过 `runtimeConfig.upstreamUrl`/Docker 容器端口生成根路径代理) |
| TLS | TLS 类型、Let's Encrypt 命令计划、certbot 续期、证书探测回填、证书资产快照、续期结果回写;待补证书库、上传/绑定、OCSP、HSTS |
| Runtime | 静态目录、Docker 服务、运行时服务、外部 upstream 的配置位 |
| Access | IP 白名单和 Basic Auth 配置计划;待补鉴权转发、限流 |
| Ops | Nginx 配置预览、配置 diff、OperationApproval 审批门禁、写入配置、可选 certbot、`nginx -t`、reload 的 Server executor dry-run/live sync/queued sync 边界,以及 `SiteSyncRun` 历史和基于成功配置快照的回滚;待补访问日志、错误日志、模块管理 |

执行层建议仍然沿用当前方向:第一阶段用稳定 `ServerExecutor`。资源动作、部署运行、站点同步、服务运行态操作、服务器备份和日志采集都统一走 `server-executor` adapter,输出标准 `commandPlan/result/logs/status`。
