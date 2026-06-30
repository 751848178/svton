/**
 * 项目详情域 - 环境同步/复制工具
 *
 * 单一职责：同步建议、复制流程的链接与状态样式（纯函数）。
 */

import type {
  EnvironmentSyncSuggestionAction,
  EnvironmentSyncApplyStep,
} from '../types/environment-sync';
import type {
  EnvironmentResourceBulkBindStep,
  EnvironmentSiteCopyStep,
  EnvironmentCdnConfigCopyStep,
  EnvironmentResourceCopyStep,
} from '../types/environment-copy';

export function buildScopedHref(
  path: string,
  projectId: string,
  environmentId?: string | null,
  extraParams: Record<string, string> = {},
): string {
  const params = new URLSearchParams(extraParams);
  params.set('projectId', projectId);
  if (environmentId) params.set('environmentId', environmentId);
  return `${path}?${params.toString()}`;
}

export function getEnvironmentSuggestionHref(
  action: EnvironmentSyncSuggestionAction,
  projectId: string,
  environmentId: string,
): string {
  if (action.target === 'applications' || action.kind === 'run_deployment') {
    return buildScopedHref('/applications', projectId, environmentId);
  }
  if (action.target === 'sites')
    return buildScopedHref('/sites', projectId, environmentId, { new: 'true' });
  if (action.target === 'keys') return buildScopedHref('/keys', projectId, environmentId);
  if (action.target === 'cdn-configs')
    return buildScopedHref('/cdn-configs', projectId, environmentId);
  return buildScopedHref('/resource-control', projectId, environmentId);
}

export function getSuggestionActionClassName(
  severity: EnvironmentSyncSuggestionAction['severity'],
): string {
  if (severity === 'critical') return 'text-red-700';
  if (severity === 'warning') return 'text-yellow-700';
  return 'text-primary';
}

export function getSyncApplyStepClassName(status: EnvironmentSyncApplyStep['status']): string {
  if (status === 'applied') return 'text-green-700';
  if (status === 'skipped') return 'text-muted-foreground';
  return 'text-yellow-700';
}

export function getResourceBulkBindStepClassName(
  status: EnvironmentResourceBulkBindStep['status'],
): string {
  if (status === 'applied') return 'text-green-700';
  if (status === 'skipped') return 'text-muted-foreground';
  return 'text-orange-800';
}

export function getSiteCopyStepClassName(status: EnvironmentSiteCopyStep['status']): string {
  if (status === 'applied') return 'text-green-700';
  if (status === 'skipped') return 'text-muted-foreground';
  return 'text-yellow-700';
}

export function getCdnCopyStepClassName(status: EnvironmentCdnConfigCopyStep['status']): string {
  if (status === 'applied') return 'text-green-700';
  if (status === 'skipped') return 'text-muted-foreground';
  return 'text-yellow-700';
}

export function getResourceCopyStepClassName(
  status: EnvironmentResourceCopyStep['status'],
): string {
  if (status === 'applied') return 'text-green-700';
  if (status === 'skipped') return 'text-muted-foreground';
  return 'text-yellow-700';
}

export function buildSiteCopyResultKey(
  sourceEnvironmentId: string,
  targetEnvironmentId: string,
): string {
  return `${sourceEnvironmentId}:${targetEnvironmentId}`;
}

export function buildCopyResultKey(
  sourceEnvironmentId: string,
  targetEnvironmentId: string,
): string {
  return `${sourceEnvironmentId}:${targetEnvironmentId}`;
}

export function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase();
}

export function buildManagedResourceCopyKey(
  sourceType: string,
  provider: string,
  externalId: string,
): string {
  return `${sourceType}:${provider}:${externalId}`;
}

export function getCdnProviderLabel(provider: string): string {
  if (provider === 'qiniu') return '七牛云';
  if (provider === 'aliyun') return '阿里云';
  if (provider === 'cloudflare') return 'Cloudflare';
  return provider;
}

export function getCdnCredentialType(provider: string): string {
  return `cdn_${provider}`;
}

export function buildEnvironmentGaps(input: {
  serverCount: number;
  serviceCount: number;
  resourceCount: number;
  siteCount: number;
  deploymentCount: number;
}): string[] {
  const gaps: string[] = [];
  if (input.serverCount === 0) gaps.push('缺服务器');
  if (input.serviceCount === 0) gaps.push('缺应用服务');
  if (input.resourceCount === 0) gaps.push('缺资源');
  if (input.siteCount === 0) gaps.push('缺站点');
  if (input.deploymentCount === 0) gaps.push('暂无部署');
  return gaps;
}

export function getEnvironmentGapHref(
  gap: string,
  hrefs: { resourceControlHref: string; applicationsHref: string; siteCreateHref: string },
): string {
  if (gap === '缺应用服务' || gap === '暂无部署') return hrefs.applicationsHref;
  if (gap === '缺站点') return hrefs.siteCreateHref;
  return hrefs.resourceControlHref;
}
