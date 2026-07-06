/**
 * Pure audit-event input builders for the project-environment feature.
 *
 * Extracted verbatim from `ProjectEnvironmentService`'s 6 private writeXAudit
 * methods. Each function returns the `AuditEventService.create()` input object;
 * the caller handles the `auditEventService` null-guard and the actual create
 * call. Stateless data shaping. No behavior change.
 */

type EnvRef = { id: string; key: string; name: string };

function baseAuditInput(teamId: string, userId: string | string[] | null, result: {
  projectId: string; sourceEnvironment: EnvRef; targetEnvironment: EnvRef;
  dryRun: boolean; status: string; plannedCount: number; appliedCount: number; skippedCount: number; warnings: string[];
}, action: string, summaryDry: string, summaryLive: string) {
  return {
    teamId, actorId: userId, projectId: result.projectId, environmentId: result.targetEnvironment.id,
    category: 'project_environment', action, targetType: 'project_environment',
    targetId: result.targetEnvironment.id, risk: result.dryRun ? 'low' : 'medium', status: result.status,
    summary: result.dryRun ? summaryDry : summaryLive,
    metadata: {
      sourceEnvironment: result.sourceEnvironment, targetEnvironment: result.targetEnvironment,
      dryRun: result.dryRun, plannedCount: result.plannedCount, appliedCount: result.appliedCount,
      skippedCount: result.skippedCount, warnings: result.warnings,
    } as Record<string, unknown>,
  };
}

export function buildSyncApplyAuditInput(teamId: string, userId: string, result: any) {
  const base = baseAuditInput(teamId, userId, result, 'project_environment.sync_suggestions.apply',
    `生成环境同步计划：${result.sourceEnvironment.name} -> ${result.targetEnvironment.name}`,
    `应用环境同步计划：${result.sourceEnvironment.name} -> ${result.targetEnvironment.name}`);
  base.metadata = { ...base.metadata, stepKinds: (result.steps || []).map((s: any) => ({ kind: s.kind, status: s.status })) };
  return base;
}

export function buildSiteCopyAuditInput(teamId: string, userId: string, result: any) {
  const base = baseAuditInput(teamId, userId, result, 'project_environment.sites.copy',
    `生成跨环境站点复制计划：${result.sourceEnvironment.name} -> ${result.targetEnvironment.name}`,
    `应用跨环境站点复制：${result.sourceEnvironment.name} -> ${result.targetEnvironment.name}`);
  base.metadata = { ...base.metadata, stepStatus: (result.steps || []).map((s: any) => ({ sourceSiteId: s.sourceSiteId, targetSiteId: s.targetSiteId || null, status: s.status })), followUp: result.followUp };
  return base;
}

export function buildCdnConfigCopyAuditInput(teamId: string, userId: string, result: any) {
  const base = baseAuditInput(teamId, userId, result, 'project_environment.cdn_configs.copy',
    `生成跨环境 CDN 配置复制计划：${result.sourceEnvironment.name} -> ${result.targetEnvironment.name}`,
    `应用跨环境 CDN 配置复制：${result.sourceEnvironment.name} -> ${result.targetEnvironment.name}`);
  base.metadata = { ...base.metadata, stepStatus: (result.steps || []).map((s: any) => ({ sourceCdnConfigId: s.sourceCdnConfigId, targetCdnConfigId: s.targetCdnConfigId || null, status: s.status })) };
  return base;
}

export function buildResourceCopyAuditInput(teamId: string, userId: string, result: any) {
  const base = baseAuditInput(teamId, userId, result, 'project_environment.resources.copy',
    `生成跨环境资源/密钥复制计划：${result.sourceEnvironment.name} -> ${result.targetEnvironment.name}`,
    `应用跨环境资源/密钥复制：${result.sourceEnvironment.name} -> ${result.targetEnvironment.name}`);
  base.metadata = { ...base.metadata, stepStatus: (result.steps || []).map((s: any) => ({ type: s.type, sourceId: s.sourceId, targetId: s.targetId || null, status: s.status })) };
  return base;
}

export function buildResourceBulkBindingAuditInput(teamId: string, userId: string, result: any) {
  return {
    teamId, actorId: userId, projectId: result.projectId, environmentId: result.environment.id,
    category: 'project_environment', action: 'project_environment.resources.bulk_bind',
    targetType: 'project_environment', targetId: result.environment.id,
    risk: result.dryRun ? 'low' : 'medium', status: result.status,
    summary: result.dryRun
      ? `生成环境资源批量绑定计划：${result.environment.name}`
      : `应用环境资源批量绑定：${result.environment.name}`,
    metadata: {
      dryRun: result.dryRun, plannedCount: result.plannedCount, appliedCount: result.appliedCount,
      skippedCount: result.skippedCount, summary: result.summary,
      stepTypes: (result.steps || []).map((s: any) => ({ type: s.type, status: s.status })),
      warnings: result.warnings,
    },
  };
}

export function buildServerBindingAuditInput(teamId: string, userId: string, input: {
  projectId: string; environmentId: string; environmentName: string;
  serverId: string; serverName: string; role?: string | null; action: 'bind' | 'unbind'; status: string;
}) {
  const bindingAction = input.action === 'bind' ? 'project_environment.server.bind' : 'project_environment.server.unbind';
  return {
    teamId, actorId: userId, projectId: input.projectId, environmentId: input.environmentId,
    serverId: input.serverId, category: 'project_environment', action: bindingAction,
    targetType: 'project_environment_server', targetId: input.serverId, risk: 'medium', status: input.status,
    summary: input.action === 'bind'
      ? `绑定服务器 ${input.serverName} 到环境 ${input.environmentName}`
      : `解绑环境 ${input.environmentName} 的服务器 ${input.serverName}`,
    metadata: { environmentName: input.environmentName, serverName: input.serverName, role: input.role },
  };
}
