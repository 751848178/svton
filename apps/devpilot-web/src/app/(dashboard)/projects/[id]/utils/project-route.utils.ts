import type { ReleaseOrderStep } from '../types/release-order.types';
import { buildProjectRoute } from './project-route-query.utils';

export { settingsHref } from './project-settings-route.utils';

export type DeliveryView = 'releases' | 'environment-versions' | 'deployments';
export type ReleaseOrderFocus = Partial<
  Record<'buildRunId' | 'deploymentRunId' | 'releaseRunId', string>
>;
/** 环境发布链节点：预发（首个发布类型）→ 生产（后续环境发布）。 */
export type ReleaseChainNode = 'staging' | 'production';
/** 预发发布内的历史抽屉：构建历史 / 部署历史。 */
export type ReleaseHistoryTab = 'builds' | 'deploys';
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
] as const;
export type SettingsEnvTab = (typeof SETTINGS_ENV_TABS)[number];

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
  const settingsSection = SETTINGS_TABS[tab];
  if (settingsSection) {
    next.set('section', settingsSection);
    return buildProjectRoute(`/projects/${encodeURIComponent(projectId)}/settings`, next);
  }
  if (tab === 'deployments') next.set('view', 'deployments');
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
 * 实际渲染内容保持一致。受支持的 view：deployments / releases；其余参数原样保留。
 */
export function resolveUnknownViewHref(projectId: string, searchParams: URLSearchParams) {
  const view = searchParams.get('view');
  if (!view || view === 'deployments' || view === 'releases') return null;
  const next = new URLSearchParams(searchParams);
  next.delete('view');
  return buildProjectRoute(`/projects/${encodeURIComponent(projectId)}`, next);
}

export function readSettingsSection(searchParams: URLSearchParams): SettingsSection {
  const section = searchParams.get('section');
  return Object.values(SETTINGS_TABS).includes(section as SettingsSection)
    ? (section as SettingsSection)
    : 'repository';
}

export function readSettingsEnvKey(searchParams: URLSearchParams): string | null {
  const env = searchParams.get('env')?.trim();
  return env || null;
}

export function readSettingsEnvTab(searchParams: URLSearchParams): SettingsEnvTab {
  const tab = searchParams.get('envTab') ?? '';
  return (SETTINGS_ENV_TABS as readonly string[]).includes(tab)
    ? (tab as SettingsEnvTab)
    : 'versions';
}

export function readReleaseOrderStep(
  searchParams: URLSearchParams,
  fallback: ReleaseOrderStep,
): ReleaseOrderStep {
  return readExplicitReleaseOrderStep(searchParams) || fallback;
}

export function readExplicitReleaseOrderStep(searchParams: URLSearchParams) {
  const steps = searchParams.getAll('step');
  if (steps.length !== 1) return null;
  const step = steps[0];
  return ['preflight', 'build', 'staging', 'production'].includes(step || '')
    ? (step as ReleaseOrderStep)
    : null;
}

export function deliveryHref(projectId: string, view: DeliveryView, searchParams: URLSearchParams) {
  const next = new URLSearchParams(searchParams);
  next.delete('tab');
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

export function releaseOrderHref(
  projectId: string,
  releaseOrderId: string,
  step: ReleaseOrderStep | null,
  searchParams: URLSearchParams,
  focus?: string | ReleaseOrderFocus,
  chain: ReleaseChainNode = 'staging',
  history?: ReleaseHistoryTab,
) {
  const next = new URLSearchParams(searchParams);
  next.delete('tab');
  next.delete('view');
  next.delete('section');
  next.delete('runId');
  next.delete('analysisRunId');
  next.delete('environmentId');
  next.delete('env');
  next.delete('envTab');
  next.delete('releasePlanId');
  next.delete('stageId');
  next.set('releaseOrderId', releaseOrderId);
  // 兼容旧调用形态：step=production 等价于生产链节点（不再产出畸形 URL）。
  if (chain === 'production' || step === 'production') {
    next.set('release', 'production');
    // 生产链节点无步骤条/历史参数；运行聚焦用 releaseRunId。
    next.delete('step');
    next.delete('history');
    next.delete('buildRunId');
    next.delete('deploymentRunId');
    const requested = typeof focus === 'string' ? {} : focus;
    if (requested?.releaseRunId) next.set('releaseRunId', requested.releaseRunId);
    else next.delete('releaseRunId');
  } else {
    next.delete('release');
    if (step) next.set('step', step);
    else next.delete('step');
    next.delete('releaseRunId');
    // 聚焦与历史相互独立：裸聚焦 = 直接日志抽屉；history = 历史列表抽屉
    // （其内聚焦 = 二层日志）。二者可同时存在。delete 后 set 保证参数顺序确定。
    const requestedFocus = typeof focus === 'string' ? { buildRunId: focus } : focus;
    next.delete('buildRunId');
    if (requestedFocus?.buildRunId) next.set('buildRunId', requestedFocus.buildRunId);
    next.delete('deploymentRunId');
    if (requestedFocus?.deploymentRunId) {
      next.set('deploymentRunId', requestedFocus.deploymentRunId);
    }
    next.delete('history');
    if (history) next.set('history', history);
  }
  // IA 重构：发布详情为 /releases 路径页（query 驱动 releaseOrderId/release/step）。
  return buildProjectRoute(`/projects/${encodeURIComponent(projectId)}/releases`, next);
}

export function releaseOrderListHref(projectId: string, searchParams: URLSearchParams) {
  const next = new URLSearchParams(searchParams);
  next.delete('releaseOrderId');
  next.delete('step');
  next.delete('buildRunId');
  next.delete('deploymentRunId');
  next.delete('releaseRunId');
  next.delete('env');
  next.delete('envTab');
  // IA 重构：发布为路径页 /releases（不再用 ?view=releases，避免与
  // 路由宿主重定向形成循环）。
  return buildProjectRoute(`/projects/${encodeURIComponent(projectId)}/releases`, next);
}

/** 预发部署深链：直接打开该运行的日志详情抽屉（单层，不经过历史列表）。 */
export function deploymentRunHref(
  projectId: string,
  deploymentRunId: string,
  releaseOrderId?: string,
) {
  const next = new URLSearchParams();
  next.set('deploymentRunId', deploymentRunId);
  if (releaseOrderId) next.set('releaseOrderId', releaseOrderId);
  return buildProjectRoute(
    `/projects/${encodeURIComponent(projectId)}/releases`,
    next,
  );
}

/** 旧 `?view=releases` → `/releases` 路径化重定向（保留其余参数）。 */
export function releasesViewRedirectHref(projectId: string, searchParams: URLSearchParams) {
  const next = new URLSearchParams(searchParams);
  next.delete('view');
  const query = next.toString();
  return query
    ? `/projects/${encodeURIComponent(projectId)}/releases?${query}`
    : `/projects/${encodeURIComponent(projectId)}/releases`;
}

/** 旧 `?view=deployments&runId=x` → `/releases?deploymentRunId=x`（Drawer 解析归属单）。 */
export function deploymentRunRedirectHref(projectId: string, searchParams: URLSearchParams) {
  const next = new URLSearchParams(searchParams);
  next.delete('view');
  const runId = next.get('runId');
  if (runId) {
    next.delete('runId');
    next.set('deploymentRunId', runId);
  }
  const query = next.toString();
  return query
    ? `/projects/${encodeURIComponent(projectId)}/releases?${query}`
    : `/projects/${encodeURIComponent(projectId)}/releases`;
}
