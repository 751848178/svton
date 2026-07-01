# 3. Webhook 能力

> 稳定产品文档。能力实现进度见 `progress/P2-webhook-deployment.md`。

结论:应该支持,而且它应该属于"部署与自动化触发器",不是简单 HTTP 回调。

竞品依据:

- Coolify 支持 GitHub App、GitHub Actions 和 Webhooks 三种自动部署方式,并要求 webhook secret 匹配后才接受请求。Source: https://coolify.io/docs/applications/ci-cd/github/auto-deploy
- Coolify 的 GitHub 集成覆盖公有仓库、私有仓库、自动部署、GitHub Actions、PR 预览部署。Source: https://coolify.io/docs/applications/ci-cd/github/overview
- Portainer 的 GitOps 更新支持轮询或 webhook 触发;触发后会比较最新 commit hash,必要时拉取仓库并执行 Docker Compose、Docker Stack 或 Kubernetes apply。Source: https://docs.portainer.io/faqs/troubleshooting/stacks-deployments-and-updates/how-do-automatic-updates-for-stacks-applications-work
- Dokploy 的 Auto Deploy 支持 Webhooks 或 API,覆盖 GitHub、GitLab、Bitbucket、Gitea、DockerHub,并强调分支或 tag 匹配。Source: https://docs.dokploy.com/docs/core/auto-deploy

建议模型:

| 模型 | 关键字段 |
| --- | --- |
| `ProjectWebhook` | projectId、environmentId、provider、secret、enabled、eventTypes、branchPattern、tagPattern、deploymentMode、maxAttempts |
| `WebhookDelivery` | webhookId、eventType、providerEventId、idempotencyKey、sourceIp、signatureStatus、payloadHash、receivedAt、status、deploymentRunId、error |
| `AutomationAction` | triggerType、targetType、executorType、action、parameters |
| `DeploymentRun` | projectId、environment、mode、sourceRunId、targetType、dryRun、commitSha、branch、status、commandPlan、logs、result |

第一阶段只需要做 push webhook:

1. Git 平台发送 push event。
2. Devpilot 校验签名、secret、分支、重复投递。
3. 生成 `DeploymentRun`。
4. 调用 `ServerExecutor` 执行稳定脚本,例如 pull、build、docker compose up、health check。
5. 写入日志、状态和可回滚信息。

安全设计不能省:

- 每个 webhook 都有独立 secret。
- GitHub/GitLab/Gitee 等 provider 用各自签名校验 adapter。
- payload 存 hash 和裁剪后的原文,避免无限存储敏感内容。
- 按 commitSha、branch、eventId 做幂等。
- 操作命令从白名单 action/template 生成,不允许 payload 直接拼 shell。
