# 7. 建议路线 (骨架)

> 这是路线骨架。**每个 P 只有一句目标 + 状态 + 下一步**。详细"已支持"清单在各 `progress/P*.md`。
> 跨 P 的下一步优先级见末尾。

### P0. 项目纳管入口

- 目标:`Project` 作为项目管控容器,支持 generated/imported/external 三种来源和 full/deployment/resources 三种管理范围。
- 状态:✅ 第一版完成。
- 进度:`../progress/P0-onboarding.md`
- 下一步:— (已闭环,后续增强挂在 P1/P5)

### P1. 项目环境与资源绑定

- 目标:跨环境配置复制、资源接管、环境工作台。
- 状态:✅ 第一版完成(环境绑定闭环、跨环境 Site/CDN/Resource/Secret copy、资源接管入口、未绑定资源归属；后端 project-environment/resource-control 非 spec 文件已收敛到 ≤200 行)。
- 进度:`../progress/P1-environment-binding.md`
- 下一步:更细的项目/环境级 RBAC;把 Site copy queued live sync 的 follow-up 摘要接到前端治理入口/worker 运行态可视化;资源 copy 后的同步/指标/告警接管入口做深。

### P2. Webhook 与部署运行

- 目标:Git push/PR 触发部署,dry-run/queued/live 审批化执行,回滚与 Smoke 闭环。
- 状态:🟡 主体完成,真实 live transport 审批执行和部署日志待补。
- 进度:`../progress/P2-webhook-deployment.md`
- 下一步:provider 级签名时间窗、密钥版本保留、统一加密密钥治理、真实 preview 环境资源、临时 Site/域名、PR 关闭真实资源销毁、live webhook 策略审计;部署观测和真实部署日志。

### P3. 站点管控

- 目标:`Site` 模型承载 Nginx/OpenResty 同步、诊断、Smoke、配置 diff、审批、回滚、TLS 证书生命周期。
- 状态:🟡 主链路完成(Site 闭环、live sync 边界、诊断、Smoke、告警、配置 diff、审批、同步历史、配置快照回滚、证书探测/续期链路)，后端 runtime/DTO 文件已收敛到 ≤200 行；模块管理、证书库、真实环境 smoke 自动化、日志归档自动化和队列/并发治理待补。
- 进度:`../progress/P3-site-governance.md`
- 下一步:把 ProxyConfig 收敛为 Site 路由能力;OpenResty 模块基线策略化与失败告警、性能调优、日志归档自动化、队列/并发治理;证书库、上传、绑定、私钥敏感存储、更细粒度证书策略告警。

### P4. 应用与服务工作区

- 目标:`Application`/`ApplicationService` 作为部署/站点/服务器/资源的服务视角,带服务运行态操作。
- 状态:🟡 最小闭环完成(模型、API、服务运行态操作、Server executor 队列桥、单服务 SLO 摘要);真实日志流、监控指标详情、环境变量和 Secret 注入待补。
- 进度:`../progress/P4-app-service.md`
- 下一步:接入真实日志流、监控指标详情、环境变量和 Secret 注入。

### P5. 数据库和备份

- 目标:数据库引擎选择、云凭据、DB/Redis 只读账号、连接探测、只读查询、备份计划。
- 状态:🟡 最小闭环完成(引擎选择、凭据管理、绑定、探测、只读查询计划、结果预览、DB/Redis live readonly、服务器资源动作队列桥、备份计划 dry-run 和服务器备份队列桥);数据库资源交付联动、Postgres 查询/备份、云 SDK 查询、真实备份和恢复待补。
- 进度:`../progress/P5-database-backup.md`
- 下一步:live Aliyun/Tencent provider SDK 调用、Postgres、账号管理、查询权限策略、更完整结果表格;真实备份执行、恢复记录、恢复演练、备份失败告警;S3/COS/OSS/R2 备份目的地和凭证治理。

### P6. 监控告警

- 目标:统一告警规则/事件、静默、去重、多通道通知、服务 SLO、资源指标。
- 状态:🟡 主体完成(规则/事件、定时评估、静默、去重、Webhook/飞书/钉钉/企微/邮件通知、手动/自动重试、严重升级、SLO 大盘、burn-rate、错误预算、耗尽预测、SLO 模板、Docker 指标采集/趋势/阈值告警);真实 SLO 周期/多周期错误预算策略待补。
- 进度:`../progress/P6-monitoring.md`
- 下一步:资源指标大盘扩展更多字段 + 证书有效期采集;模板化通知内容;真实 SLO 周期/多周期错误预算策略、静默规则、抑制规则。

### P7. 日志中心

- 目标:统一日志归档/查询、采集 dry-run、SLS live 查询、SSE 流式 tail、会话治理。
- 状态:🟡 主体完成(日志流/条目、采集 dry-run、队列桥、定时 follow、SLS dry-run/live 查询、按流回填、自动入库、脱敏、SSE tail、cursor resume、断线重连、有界会话、活跃会话控制、限流、级别统计、错误告警、保留清理、agent follow task-pull 只读 sample、默认关闭 claim/ack/terminal writeback 边界、log collection finish sync);agent 级持续日志 runtime、长连接和非日志业务 Run 结果同步待补。
- 进度:`../progress/P7-log-center.md`
- 下一步:远端命令/agent 级持续日志 follow、跨实例会话持久化、更细的租户级限流策略;更细的日志告警模板和 SLS 真实凭据 smoke。

### P8. 安全和运维治理

- 目标:统一审计、高风险审批、Server executor 命令策略、并发门禁、执行治理可视化、控制面访问策略、server-agent 边界。
- 状态:🟡 大量最小闭环完成(审计事件、审批门禁、Operation Approval repository/match 边界、审批要求 metadata、Control Access Policy repository/CRUD/access/audit 边界、命令策略/模板、live lease、execution job、队列 worker、Supervisor 各状态面、6 个业务 Run 队列桥、锁租约恢复、持久取消、SSH 远端 cleanup、stale orphan cleanup、访问策略覆盖主要读写接口、第一组授权回归、task-pull 只读 log-follow sample、默认关闭 claim/ack/terminal writeback 边界、log collection finish sync、non-log business-run finish sync、claimed task payload、terminal command-plan fallback、terminal result fallback、ack cancellation hint、ack progress writeback、supervisor progress visibility、claimed task lifecycle envelope、lifecycle contract discovery/claim-field alignment、CLI once runner、CLI bounded poll runner、CLI heartbeat writeback、CLI graceful stop、CLI command-step cancellation、CLI once signal wiring、CLI abortable poll sleep、CLI command-step force kill fallback、CLI in-step ack renewal、CLI timeout terminal summary、CLI optional timeout semantics、CLI final ack cancellation、CLI configurable ack renewal interval、CLI configurable force-kill grace、CLI command cwd boundary、CLI output truncation visibility、CLI dry-run command skip、CLI spawn error writeback、CLI loop heartbeat failure summary、CLI loop heartbeat rejection guard、CLI step ack rejection guard、CLI finish writeback helper extraction、CLI finish response summary、CLI once summary builder extraction、CLI loop finish writeback failure stop、CLI run failure exit surface、CLI once failure exit surface、CLI loop poll failure summary);真实 agent runtime 长连接、daemon 化、多实例治理、更多 e2e 授权覆盖待补。
- 进度:`../progress/P8-ops-governance.md`
- 下一步:控制面只读可见性过滤扩展到更多读路径;真实 agent runtime 长连接/任务拉取/生命周期执行、跨实例远端 orphan 治理、实际多实例队列协调;资源危险操作二次确认。

## 8. 推荐下一步优先级

建议优先做真实执行治理、P3 的真实站点同步,以及可观测性:

1. 继续补安全治理:扩展真实 DB fixture/e2e 权限覆盖、资源实例级策略、agent supervisor、跨实例远端 orphan 治理和实际多实例队列治理。
2. 继续完善 Nginx/OpenResty adapter:模块基线策略化与失败告警、性能调优、真实环境 smoke,并把 ProxyConfig 收敛到 Site。
3. 补服务可观测性:实时日志流/SLS 查询、容器指标、健康趋势、通知通道、SLO、环境变量和 Secret 注入。
4. 在环境工作台基础上继续把 Site copy queued live sync 的 follow-up 摘要接到前端治理入口和 worker 运行态可视化,并把资源 copy 后的同步、指标、告警接管入口做深。

这样 Devpilot 会从"能登记资源"变成"项目代码变更后能触发部署并落到服务器资源",产品主线会明显更完整。

### PT. 工程债:手搓功能应替换为三方库

- 目标:把当前"从零手写"的能力(加密、调度器、任务队列、SSH、Docker/API 客户端、YAML/模板、SSE、前端表单/表格/日期/i18n 等)逐步替换为成熟三方库,先消除安全风险与代码重复,再补功能性。
- 状态:🟡 第一批完成(P0 安全项全部、P1 去重项、P2 小项、P3 dayjs),零回归;大件(SSH/docker/octokit/CDN/mustache/SSE/bullmq/react-hook-form/tanstack-table/next-intl)评估为独立 epic 待推进。
- 进度:`../progress/PT-tech-debt-libraries.md`(唯一锚点,含完整状态表、本批次新增的共享基础设施清单、以及延后大件的评估结论)。
- 下一步:按"独立 epic"清单逐项立项推进;优先 SSH(695 行 CLI spawn,安全与可维护性收益最大)与 bullmq 队列(5,700 行手搓)。
