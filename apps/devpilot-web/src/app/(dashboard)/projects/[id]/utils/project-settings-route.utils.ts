import type { SettingsSection } from './project-route.utils';
import { buildProjectRoute } from './project-route-query.utils';

export function settingsHref(
  projectId: string,
  section: SettingsSection,
  searchParams: URLSearchParams,
) {
  const next = new URLSearchParams(searchParams);
  for (const key of [
    'tab',
    'view',
    'runId',
    'releasePlanId',
    'stageId',
    'releaseOrderId',
    'step',
    'buildRunId',
    'deploymentRunId',
    'releaseRunId',
  ]) {
    next.delete(key);
  }
  if (section !== 'repository') next.delete('analysisRunId');
  if (section !== 'environments') {
    next.delete('environmentId');
    next.delete('env');
    next.delete('envTab');
  }
  next.set('section', section);
  return buildProjectRoute(`/projects/${encodeURIComponent(projectId)}/settings`, next);
}
