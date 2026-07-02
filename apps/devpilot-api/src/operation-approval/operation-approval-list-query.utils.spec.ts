import { buildOperationApprovalWhere } from './operation-approval-list-query.utils';

describe('buildOperationApprovalWhere', () => {
  it('builds scoped approval list filters', () => {
    expect(
      buildOperationApprovalWhere('team-1', {
        status: 'pending',
        projectId: 'project-1',
        environmentId: 'env-1',
        category: 'site_sync',
        action: 'site.sync',
        targetType: 'site',
        risk: 'high',
      }),
    ).toEqual({
      teamId: 'team-1',
      status: 'pending',
      projectId: 'project-1',
      environmentId: 'env-1',
      category: 'site_sync',
      action: 'site.sync',
      targetType: 'site',
      risk: 'high',
    });
  });
});
