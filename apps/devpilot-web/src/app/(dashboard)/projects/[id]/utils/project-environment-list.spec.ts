import { describe, expect, it } from 'vitest';
import type { ProjectEnvironment } from '../types';
import { selectExistingProjectEnvironments } from './project-environment-list';

describe('selectExistingProjectEnvironments', () => {
  it('keeps active baselines and used environments but hides empty legacy candidates', () => {
    const environments = [
      environment('dev', { _count: { deploymentRuns: 3 } }),
      environment('test'),
      environment('staging', { baselineRole: 'staging' }),
      environment('production', { baselineRole: 'production', config: null }),
      environment('archived', { status: 'archived', config: null }),
    ];

    expect(selectExistingProjectEnvironments(environments).map((item) => item.key)).toEqual([
      'dev',
      'staging',
      'production',
    ]);
  });

  it('keeps explicitly created custom environments even before their first deployment', () => {
    expect(
      selectExistingProjectEnvironments([
        environment('preview', { config: { source: 'manual' } }),
      ]).map((item) => item.key),
    ).toEqual(['preview']);
  });
});

function environment(key: string, patch: Partial<ProjectEnvironment> = {}): ProjectEnvironment {
  return {
    id: `${key}-id`,
    key,
    name: key,
    status: 'active',
    sortOrder: 0,
    config: {
      source: 'project_config',
      initializedBy: 'ProjectEnvironmentService.ensureDefaultsForProject',
    },
    ...patch,
  };
}
