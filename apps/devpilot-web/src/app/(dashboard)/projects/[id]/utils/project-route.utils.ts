import type { ReleaseOrderStep } from '../types/release-order.types';

export type DeliveryView = 'releases' | 'environment-versions' | 'deployments';
export type SettingsSection = 'repository' | 'environments' | 'resources' | 'webhooks' | 'general';

const SETTINGS_TABS: Record<string, SettingsSection> = {
  repository: 'repository',
  environments: 'environments',
  resources: 'resources',
  webhooks: 'webhooks',
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
  const settingsSection = SETTINGS_TABS[tab];
  if (settingsSection) {
    next.set('section', settingsSection);
    return route(`/projects/${encodeURIComponent(projectId)}/settings`, next);
  }
  if (tab === 'deployments') next.set('view', 'deployments');
  else next.delete('view');
  return route(`/projects/${encodeURIComponent(projectId)}`, next);
}

export function readDeliveryView(searchParams: URLSearchParams): DeliveryView {
  const view = searchParams.get('view');
  return view === 'environment-versions' || view === 'deployments' ? view : 'releases';
}

export function readSettingsSection(searchParams: URLSearchParams): SettingsSection {
  const section = searchParams.get('section');
  return Object.values(SETTINGS_TABS).includes(section as SettingsSection)
    ? (section as SettingsSection)
    : 'repository';
}

export function readReleaseOrderStep(
  searchParams: URLSearchParams,
  fallback: ReleaseOrderStep,
): ReleaseOrderStep {
  const step = searchParams.get('step');
  return ['preflight', 'build', 'staging', 'production'].includes(step || '')
    ? step as ReleaseOrderStep
    : fallback;
}

export function deliveryHref(
  projectId: string,
  view: Exclude<DeliveryView, 'deployments'>,
  searchParams: URLSearchParams,
) {
  const next = new URLSearchParams(searchParams);
  next.delete('tab');
  next.delete('section');
  next.delete('runId');
  next.delete('analysisRunId');
  next.delete('environmentId');
  next.delete('releasePlanId');
  next.delete('stageId');
  next.delete('releaseOrderId');
  next.delete('step');
  next.delete('buildRunId');
  if (view === 'releases') next.delete('view');
  else next.set('view', view);
  return route(`/projects/${encodeURIComponent(projectId)}`, next);
}

export function releaseOrderHref(
  projectId: string,
  releaseOrderId: string,
  step: ReleaseOrderStep | null,
  searchParams: URLSearchParams,
  buildRunId?: string,
) {
  const next = new URLSearchParams(searchParams);
  next.delete('tab');
  next.delete('view');
  next.delete('section');
  next.delete('runId');
  next.delete('analysisRunId');
  next.delete('environmentId');
  next.delete('releasePlanId');
  next.delete('stageId');
  next.set('releaseOrderId', releaseOrderId);
  if (step) next.set('step', step);
  else next.delete('step');
  if (buildRunId) next.set('buildRunId', buildRunId);
  else next.delete('buildRunId');
  return route(`/projects/${encodeURIComponent(projectId)}`, next);
}

export function releaseOrderListHref(
  projectId: string,
  searchParams: URLSearchParams,
) {
  const next = new URLSearchParams(searchParams);
  next.delete('releaseOrderId');
  next.delete('step');
  next.delete('buildRunId');
  return route(`/projects/${encodeURIComponent(projectId)}`, next);
}

export function settingsHref(
  projectId: string,
  section: SettingsSection,
  searchParams: URLSearchParams,
) {
  const next = new URLSearchParams(searchParams);
  next.delete('tab');
  next.delete('view');
  next.delete('runId');
  next.delete('releasePlanId');
  next.delete('stageId');
  next.delete('releaseOrderId');
  next.delete('step');
  next.delete('buildRunId');
  if (section !== 'repository') next.delete('analysisRunId');
  if (section !== 'environments') next.delete('environmentId');
  next.set('section', section);
  return route(`/projects/${encodeURIComponent(projectId)}/settings`, next);
}

function route(pathname: string, searchParams: URLSearchParams) {
  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}
