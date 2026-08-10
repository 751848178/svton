import { describe, expect, it } from 'vitest';
import { createProjectConfigTypes } from './project-config.types';

describe('createProjectConfigTypes', () => {
  it('uses the governed release baselines as the project defaults', () => {
    expect(createProjectConfigTypes().initialConfig.environments).toEqual([
      'staging',
      'production',
    ]);
  });
});
