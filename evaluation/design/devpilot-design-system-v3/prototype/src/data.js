/** Project and repository fixtures shaped like current Devpilot responses. */

export const project = {
  id: 'P-2048',
  name: 'Picshare',
  gitRepo: 'github.com/acme-labs/picshare',
  applications: [{
    id: 'app-picshare',
    name: 'picshare',
    repositoryUrl: 'github.com/acme-labs/picshare',
    defaultBranch: 'main',
    services: [
      service('svc-web', 'web', 'web', 'Next.js 15', [3000], 'apps/web', '9d5c821'),
      service('svc-api', 'api', 'service', 'Node.js 22', [3100], 'apps/api', '9d5c821'),
      service('svc-db', 'postgres', 'database', 'PostgreSQL 16', [5432], 'infra/postgres', '9d5c821'),
    ],
  }],
};

export const repositoryAnalysisRun = {
  id: 'analysis-run-284',
  status: 'succeeded',
  branch: 'main',
  commitSha: 'a1b2c3d',
  createdAt: '2026-08-26T12:12:00+08:00',
  suggestions: [
    suggestion('sg-web', 'svc-web', 'web', 'apps/web', 'Next.js 15', [3000], '检测到新的运行时变量 IMAGE_PROXY_URL。'),
    suggestion('sg-db', 'svc-db', 'postgres', 'infra/postgres', 'PostgreSQL 16', [5432], '检测到新的数据库迁移。'),
  ],
};

export const releasePolicyResponse = {
  current: { id: 'policy-rev-7', revision: 7, strategy: 'standard', requireProductionApproval: true, snapshotHash: 'policy_8a71c2' },
  capabilities: [],
};

export const projectTabs = [['overview', '项目信息'], ['releases', '发布'], ['config', '项目配置'], ['domains', '域名与入口'], ['deployments', '部署记录']];
export const configSections = [['versions', '版本'], ['targets', '部署目标'], ['resources', '资源绑定'], ['secrets', '变量与密钥'], ['access', '访问权限'], ['checks', '验证与监控'], ['domains', '域名与入口']];

function service(id, name, kind, runtime, ports, workingDirectory, commitSha) {
  return { id, name, kind, runtime, ports, deployConfig: { workingDirectory }, metadata: { repositoryAnalysis: { runId: 'analysis-run-283', commitSha } }, status: 'active' };
}

function suggestion(id, serviceId, serviceName, repoPath, runtime, ports, impact) {
  return { id, key: `application_service:${serviceName}`, kind: 'application_service', confidence: 'high', conflict: false, impact, status: 'pending', proposedValue: { applicationName: 'picshare', serviceId, serviceName, repoPath, runtime, ports, deployConfig: { workingDirectory: repoPath } } };
}
