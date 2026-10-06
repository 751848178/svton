import { describe, expect, it } from 'vitest';
import { PROJECT_DEPLOYMENT_STATUS_FILTERS } from './project-deployment-filters';

describe('PROJECT_DEPLOYMENT_STATUS_FILTERS', () => {
  it('uses the persisted DeploymentRun lifecycle values', () => {
    expect(PROJECT_DEPLOYMENT_STATUS_FILTERS).toEqual([
      'queued',
      'running',
      'blocked',
      'completed',
      'failed',
      'cancelled',
    ]);
    expect(PROJECT_DEPLOYMENT_STATUS_FILTERS).not.toContain('succeeded');
  });
});
