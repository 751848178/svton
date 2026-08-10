import { describe, expect, it, vi } from 'vitest';
import { shouldLoadProjectDetail } from '../utils/project-detail-scope.utils';
import { ownsProjectDeploymentRun } from './use-project-detail';

vi.mock('@/store/hooks', () => ({
  useAuthStore: () => ({ user: null }),
  useTeamStore: () => ({ currentTeam: null }),
}));

describe('shouldLoadProjectDetail', () => {
  it('waits for the authenticated active-team context before any project request', () => {
    expect(shouldLoadProjectDetail('actor-1', null)).toBe(false);
    expect(shouldLoadProjectDetail(null, 'team-1')).toBe(false);
    expect(shouldLoadProjectDetail('actor-1', 'team-1')).toBe(true);
  });
});

describe('ownsProjectDeploymentRun', () => {
  it('accepts only the project encoded by the professional deep link', () => {
    expect(ownsProjectDeploymentRun('project-1', { projectId: 'project-1' })).toBe(true);
    expect(ownsProjectDeploymentRun('project-1', { projectId: 'project-2' })).toBe(false);
  });
});
