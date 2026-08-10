import type { SettingsEnvTab } from './project-route.utils';

export function settingsEnvironmentTabHref(
  projectId: string,
  environmentKey: string | null,
  tab: SettingsEnvTab,
) {
  const query = new URLSearchParams({ section: 'environments', envTab: tab });
  if (environmentKey) query.set('env', environmentKey);
  return `/projects/${encodeURIComponent(projectId)}/settings?${query.toString()}`;
}
