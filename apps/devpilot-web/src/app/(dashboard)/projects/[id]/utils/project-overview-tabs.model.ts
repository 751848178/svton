export const PROJECT_OVERVIEW_TAB_KEYS = ['releases', 'environments', 'components'] as const;

export type ProjectOverviewTabKey = (typeof PROJECT_OVERVIEW_TAB_KEYS)[number];

export function projectOverviewTabFromSearchParams(
  searchParams: URLSearchParams,
): ProjectOverviewTabKey {
  const value = searchParams.get('view');
  if (value === 'details') return 'environments';
  return PROJECT_OVERVIEW_TAB_KEYS.includes(value as ProjectOverviewTabKey)
    ? (value as ProjectOverviewTabKey)
    : 'releases';
}

export function projectOverviewTabHref(
  projectId: string,
  searchParams: URLSearchParams,
  tab: ProjectOverviewTabKey,
) {
  const next = new URLSearchParams(searchParams);
  if (tab === 'releases') next.delete('view');
  else next.set('view', tab);
  const query = next.toString();
  return `/projects/${encodeURIComponent(projectId)}${query ? `?${query}` : ''}`;
}

/** Resolve the next automatically activated tab for keyboard navigation. */
export function nextProjectOverviewTab(
  current: ProjectOverviewTabKey,
  key: string,
): ProjectOverviewTabKey {
  if (key === 'Home') return PROJECT_OVERVIEW_TAB_KEYS[0];
  if (key === 'End') return PROJECT_OVERVIEW_TAB_KEYS.at(-1) ?? current;
  const offset = key === 'ArrowRight' ? 1 : key === 'ArrowLeft' ? -1 : 0;
  if (!offset) return current;
  const index = PROJECT_OVERVIEW_TAB_KEYS.indexOf(current);
  return PROJECT_OVERVIEW_TAB_KEYS[
    (index + offset + PROJECT_OVERVIEW_TAB_KEYS.length) % PROJECT_OVERVIEW_TAB_KEYS.length
  ];
}
