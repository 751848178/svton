import { describe, expect, it } from 'vitest';
import { ownsProjectDeploymentRun } from './use-project-detail';

describe('ownsProjectDeploymentRun', () => {
  it('accepts only the project encoded by the professional deep link', () => {
    expect(ownsProjectDeploymentRun('project-1', { projectId: 'project-1' })).toBe(true);
    expect(ownsProjectDeploymentRun('project-1', { projectId: 'project-2' })).toBe(false);
  });
});
