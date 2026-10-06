export type ProjectWorkbenchActionKey = 'overview' | 'projects' | 'settings';

interface ProjectWorkbenchAction {
  key: ProjectWorkbenchActionKey;
  labelKey: 'backToProjects' | 'projectOverviewAction' | 'projectConfigurationTitle';
  href: string;
}

interface ProjectWorkbenchHeaderNavigation {
  back: ProjectWorkbenchAction;
  contextAction: ProjectWorkbenchAction | null;
}

/** Overview returns to projects; every child route returns to its project overview. */
export function projectWorkbenchHeaderNavigation(
  projectId: string,
  pathname: string,
): ProjectWorkbenchHeaderNavigation {
  const base = `/projects/${encodeURIComponent(projectId)}`;
  const isOverview = pathname === base || pathname === `${base}/`;

  if (isOverview) {
    return {
      back: { key: 'projects', labelKey: 'backToProjects', href: '/projects' },
      contextAction: {
        key: 'settings',
        labelKey: 'projectConfigurationTitle',
        href: `${base}/settings`,
      },
    };
  }

  return {
    back: { key: 'overview', labelKey: 'projectOverviewAction', href: base },
    contextAction: null,
  };
}
