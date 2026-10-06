import { buildProjectRoute } from './project-route-query.utils';
import { repositoryAnalysisPageHref } from './project-repository-analysis-route';

export { settingsHref } from './project-settings-route.utils';
export {
  deploymentRunHref,
  readExplicitReleaseOrderStep,
  readReleaseOrderStep,
  releaseOrderHref,
  releaseOrderListHref,
} from './project-release-navigation.utils';
export type {
  ReleaseChainNode,
  ReleaseHistoryTab,
  ReleaseOrderFocus,
} from './project-release-navigation.utils';

export type DeliveryView = 'releases' | 'environment-versions' | 'deployments';
export type SettingsSection =
  | 'repository'
  | 'environments'
  | 'resources'
  | 'webhooks'
  | 'release-policy'
  | 'general';

export const SETTINGS_ENV_TABS = [
  'versions',
  'targets',
  'resources',
  'variables',
  'access',
  'verification',
  'domains',
] as const;
export type SettingsEnvTab = (typeof SETTINGS_ENV_TABS)[number];
export const BASIC_SETTINGS_ENV_TABS = [
  'targets',
  'resources',
  'variables',
] as const satisfies readonly SettingsEnvTab[];

const SETTINGS_TABS: Record<string, SettingsSection> = {
  repository: 'repository',
  environments: 'environments',
  resources: 'resources',
  webhooks: 'webhooks',
  'release-policy': 'release-policy',
  settings: 'general',
};

export function resolveLegacyProjectHref(projectId: string, searchParams: URLSearchParams) {
  const tab = searchParams.get('tab');
  if (!tab) return null;
  const next = new URLSearchParams(searchParams);
  next.delete('tab');
  next.delete('releaseOrderId');
  next.delete('step');
  next.delete('buildRunId');
  next.delete('deploymentRunId');
  next.delete('releaseRunId');
  if (tab === 'repository') {
    return repositoryAnalysisPageHref(projectId, next.get('analysisRunId')?.trim() || undefined);
  }
  const settingsSection = SETTINGS_TABS[tab];
  if (settingsSection) {
    next.set('section', settingsSection);
    return buildProjectRoute(`/projects/${encodeURIComponent(projectId)}/settings`, next);
  }
  if (tab === 'deployments')
    return buildProjectRoute(`/projects/${encodeURIComponent(projectId)}/deployments`, next);
  else if (tab === 'releases') next.set('view', 'releases');
  else next.delete('view');
  return buildProjectRoute(`/projects/${encodeURIComponent(projectId)}`, next);
}

export function readDeliveryView(searchParams: URLSearchParams): DeliveryView {
  const view = searchParams.get('view');
  return view === 'environment-versions' || view === 'deployments' ? view : 'releases';
}

/**
 * EV-1：未受支持的 view（如已下线的 environment-versions）不再静默回退——
 * 返回去掉 view 参数的纠正 href，由路由宿主 302 式替换 URL，让地址栏与
 * 实际渲染内容保持一致。`environments / components` 是概览内的当前内容模式；
 * `deployments / releases` 是待迁移的旧路由值，其余参数原样保留。
 */
export function resolveUnknownViewHref(projectId: string, searchParams: URLSearchParams) {
  const view = searchParams.get('view');
  if (
    !view ||
    view === 'deployments' ||
    view === 'releases' ||
    view === 'environments' ||
    view === 'components'
  )
    return null;
  const next = new URLSearchParams(searchParams);
  next.delete('view');
  return buildProjectRoute(`/projects/${encodeURIComponent(projectId)}`, next);
}

export function readSettingsSection(searchParams: URLSearchParams): SettingsSection {
  const section = searchParams.get('section');
  return Object.values(SETTINGS_TABS).includes(section as SettingsSection)
    ? (section as SettingsSection)
    : 'environments';
}

export function readSettingsEnvKey(searchParams: URLSearchParams): string | null {
  const env = searchParams.get('env')?.trim();
  return env || null;
}

export function readSettingsEnvTab(searchParams: URLSearchParams): SettingsEnvTab {
  const tab = searchParams.get('envTab') ?? '';
  return (BASIC_SETTINGS_ENV_TABS as readonly string[]).includes(tab)
    ? (tab as SettingsEnvTab)
    : 'targets';
}

export function deliveryHref(projectId: string, view: DeliveryView, searchParams: URLSearchParams) {
  const next = new URLSearchParams(searchParams);
  next.delete('tab');
  next.delete('analysis');
  next.delete('section');
  next.delete('runId');
  next.delete('analysisRunId');
  next.delete('environmentId');
  next.delete('env');
  next.delete('envTab');
  next.delete('releasePlanId');
  next.delete('stageId');
  next.delete('releaseOrderId');
  next.delete('step');
  next.delete('buildRunId');
  next.delete('deploymentRunId');
  next.delete('releaseRunId');
  next.set('view', view);
  return buildProjectRoute(`/projects/${encodeURIComponent(projectId)}`, next);
}

/** 旧 `?view=releases` → `/releases` 路径化重定向（保留其余参数）。 */
export function releasesViewRedirectHref(projectId: string, searchParams: URLSearchParams) {
  const next = new URLSearchParams(searchParams);
  next.delete('view');
  const query = next.toString();
  return query
    ? `/projects/${encodeURIComponent(projectId)}?${query}`
    : `/projects/${encodeURIComponent(projectId)}`;
}

/** 旧 `?view=deployments&runId=x` → 独立部署记录页面。 */
export function deploymentRunRedirectHref(projectId: string, searchParams: URLSearchParams) {
  const next = new URLSearchParams(searchParams);
  next.delete('view');
  const runId = next.get('runId');
  if (runId) {
    next.delete('runId');
    next.set('runId', runId);
  }
  const query = next.toString();
  return query
    ? `/projects/${encodeURIComponent(projectId)}/deployments?${query}`
    : `/projects/${encodeURIComponent(projectId)}/deployments`;
}
