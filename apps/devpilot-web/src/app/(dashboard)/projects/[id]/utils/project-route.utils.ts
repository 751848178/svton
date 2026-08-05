import type { ReleaseOrderStep } from '../types/release-order.types';

export type DeliveryView = 'releases' | 'environment-versions' | 'deployments';
export interface ReleaseOrderFocus {
  buildRunId?: string;
  deploymentRunId?: string;
  releaseRunId?: string;
}
export type SettingsSection =
  | 'repository'
  | 'environments'
  | 'resources'
  | 'webhooks'
  | 'release-policy'
  | 'general';

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
  next.delete('deploymentRunId');
  next.delete('releaseRunId');
  if (view === 'releases') next.delete('view');
  else next.set('view', view);
  return route(`/projects/${encodeURIComponent(projectId)}`, next);
}

export function releaseOrderHref(
  projectId: string,
  releaseOrderId: string,
  step: ReleaseOrderStep | null,
  searchParams: URLSearchParams,
  focus?: string | ReleaseOrderFocus,
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
  const requestedFocus = typeof focus === 'string' ? { buildRunId: focus } : focus;
  if (step === 'build' && requestedFocus?.buildRunId) {
    next.set('buildRunId', requestedFocus.buildRunId);
  } else {
    next.delete('buildRunId');
  }
  next.delete('deploymentRunId');
  next.delete('releaseRunId');
  if (step === 'staging' && requestedFocus?.deploymentRunId) {
    next.set('deploymentRunId', requestedFocus.deploymentRunId);
  }
  if (step === 'production' && requestedFocus?.releaseRunId) {
    next.set('releaseRunId', requestedFocus.releaseRunId);
  }
  if (step === 'production' && requestedFocus?.deploymentRunId) {
    next.set('deploymentRunId', requestedFocus.deploymentRunId);
  }
  return route(`/projects/${encodeURIComponent(projectId)}`, next);
}

export function releaseOrderListHref(projectId: string, searchParams: URLSearchParams) {
  const next = new URLSearchParams(searchParams);
  next.delete('releaseOrderId');
  next.delete('step');
  next.delete('buildRunId');
  next.delete('deploymentRunId');
  next.delete('releaseRunId');
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
  next.delete('deploymentRunId');
  next.delete('releaseRunId');
  if (section !== 'repository') next.delete('analysisRunId');
  if (section !== 'environments') next.delete('environmentId');
  next.set('section', section);
  return route(`/projects/${encodeURIComponent(projectId)}/settings`, next);
}

function route(pathname: string, searchParams: URLSearchParams) {
  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}
