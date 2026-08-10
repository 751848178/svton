import { describe, expect, it } from 'vitest';
import { groupSettingsEnvironments } from './settings-environment-groups.model';

describe('groupSettingsEnvironments', () => {
  it('separates release baselines from custom and legacy environments', () => {
    const groups = groupSettingsEnvironments([
      { id: 'dev', key: 'dev', name: 'Dev', status: 'active', sortOrder: 0 },
      { id: 'staging', key: 'staging', name: 'Staging', status: 'active', sortOrder: 1, baselineRole: 'staging' },
      { id: 'production', key: 'production', name: 'Production', status: 'active', sortOrder: 2, baselineRole: 'production' },
      { id: 'prod', key: 'prod', name: 'Legacy Prod', status: 'active', sortOrder: 3, baselineRole: null },
      { id: 'old', key: 'old', name: 'Old', status: 'archived', sortOrder: 4 },
    ]);

    expect(groups.map((group) => [group.key, group.environments.map((env) => env.key)]))
      .toEqual([
        ['release-baseline', ['staging', 'production']],
        ['custom', ['dev', 'prod']],
      ]);
  });
});
