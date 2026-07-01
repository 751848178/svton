# 6. Devpilot 现在还缺的关键东西

> 产品级缺口判断。每个缺口的**具体进度**在 `progress/` 对应模块文件里。

最核心缺口不是某一个页面,而是一条完整控制闭环:

```mermaid
flowchart LR
  Repo["代码源"] --> Build["构建"]
  Build --> Deploy["部署"]
  Deploy --> Site["站点入口"]
  Site --> Observe["日志/监控/告警"]
  Observe --> Operate["操作/回滚/扩容"]
  Operate --> Backup["备份/恢复"]
  Backup --> Audit["审计/权限"]
```

现在 Devpilot 已有项目、资源、服务器、执行器的雏形,但缺少把它们串起来的产品对象(各对象实现进度见对应 `progress/P*.md`):

- `Environment`:项目的 dev/test/staging/prod 边界。
- `Application/Service`:一个项目里可部署和观察的服务。
- `Deployment`:从代码/镜像/compose 到服务器的执行记录。
- `Site`:域名、证书、路由、访问控制和 Nginx/OpenResty 生命周期。
- `Database` / `ResourceConnectionRun` / `ResourceQueryRun`:MySQL/Postgres/Redis/RDS/SLS/COS 这类可连接、可查询、可备份、可监控的资源。
- `BackupPlan` / `BackupRun`:数据库/Redis/RDS 备份计划与运行记录。
- `AlertRule` / `AlertSilence` / `AlertNotificationChannel`:告警规则、静默、通知通道。
- `LogStream` / `LogCollectionRun`:日志归档、查询、采集与流式 tail。
- `AuditEvent`:统一审计事件。

## 尚未完成的高层缺口

(每个的详细状态见对应 `progress/P*.md`)

- **真实执行治理还不够完整**:SSH live 已默认关闭接入,命令策略、live lease 并发门禁、execution job、队列 worker、Supervisor 状态面、各业务 Run 队列桥、回滚链路、基础锁租约、持久取消轮询、SSH live 远端进程树 cleanup、stale orphan cleanup、审批链路访问策略、主要读写接口访问策略、自动 retry 入队、只读 task-pull readiness 和 task-pull contract skeleton 已有内置基线;但真实 server-agent task-pull endpoint/claim/ack、完整 server agent supervisor、多实例 worker 协调和更多集成/e2e 级授权覆盖还要补。详见 `progress/P8-ops-governance.md`。
- **站点生命周期未完全闭环**:已进入 Nginx/OpenResty live sync、诊断运行、Smoke 检查、配置 diff、审批门禁、配置快照回滚、证书探测/续期链路;但模块管理、证书库/上传绑定、真实环境 smoke 自动化、日志归档自动化和完整队列治理还没闭环。详见 `progress/P3-site-governance.md`。
- **数据库/备份真实执行待补**:已有连接/授权探测、只读查询/浏览计划、DB/Redis live readonly 查询、阿里云 RDS/SLS 与腾讯 COS live inventory;备份到 dry-run 计划、运行记录和服务器备份队列桥,真实备份/恢复仍待补。详见 `progress/P5-database-backup.md`。
- **可观测性待补**:已具备状态型告警、证书告警、维护窗口静默、事件去重、多通道通知、日志归档/SSE tail、容器指标、SLO 大盘与策略;仍缺 agent 级持续日志 follow 和真实 SLO 周期/多周期错误预算策略。详见 `progress/P6-monitoring.md` 与 `progress/P7-log-center.md`。
- **权限覆盖待补**:控制面策略已覆盖主要读写接口;第一组 Jest 回归已覆盖 owner bypass、deny 优先、默认角色门槛等;下一步扩展到真实 DB fixture 或 e2e 级权限用例。详见 `progress/P8-ops-governance.md`。
