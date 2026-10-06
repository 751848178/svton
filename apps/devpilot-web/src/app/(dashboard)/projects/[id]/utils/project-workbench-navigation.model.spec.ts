import { describe, expect, it } from 'vitest';
import { projectWorkbenchHeaderNavigation } from './project-workbench-navigation.model';

describe('projectWorkbenchHeaderNavigation', () => {
  it('returns from overview to projects and offers configuration', () => {
    expect(projectWorkbenchHeaderNavigation('project/1', '/projects/project%2F1')).toEqual({
      back: { key: 'projects', labelKey: 'backToProjects', href: '/projects' },
      contextAction: {
        key: 'settings',
        labelKey: 'projectConfigurationTitle',
        href: '/projects/project%2F1/settings',
      },
    });
  });

  it.each(['settings', 'deployments', 'domains', 'repository-analysis', 'releases'])(
    'returns from the %s child page to overview without a duplicate context action',
    (child) => {
      expect(projectWorkbenchHeaderNavigation('project-1', `/projects/project-1/${child}`)).toEqual(
        {
          back: {
            key: 'overview',
            labelKey: 'projectOverviewAction',
            href: '/projects/project-1',
          },
          contextAction: null,
        },
      );
    },
  );
});
