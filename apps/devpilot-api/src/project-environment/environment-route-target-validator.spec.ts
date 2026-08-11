import { BadRequestException } from '@nestjs/common';
import { validateRouteSnapshotTargets } from './environment-route-target-validator';

describe('validateRouteSnapshotTargets', () => {
  const scope = { id: 'staging', teamId: 'team-1', projectId: 'project-1' };

  it('accepts a persisted service id and one of its real ports', async () => {
    const tx = transaction({ id: 'service-1', name: 'frontend', ports: [4173], deployConfig: null });
    await expect(validateRouteSnapshotTargets(tx as never, scope, {
      entries: [{ serviceId: 'service-1', component: 'frontend', port: 4173 }],
    })).resolves.toBeUndefined();
  });

  it('rejects unknown services and ports instead of accepting fabricated defaults', async () => {
    await expect(validateRouteSnapshotTargets(transaction(null) as never, scope, {
      entries: [{ serviceId: 'missing', component: 'web', port: 3000 }],
    })).rejects.toBeInstanceOf(BadRequestException);
    await expect(validateRouteSnapshotTargets(transaction({
      id: 'service-1', name: 'frontend', ports: [4173], deployConfig: null,
    }) as never, scope, {
      entries: [{ serviceId: 'service-1', component: 'frontend', port: 3000 }],
    })).rejects.toThrow('已持久化端口');
  });

  it('keeps legacy/custom entries without serviceId backward compatible', async () => {
    const tx = transaction(null);
    await expect(validateRouteSnapshotTargets(tx as never, scope, {
      entries: [{ serviceId: null, component: 'custom-worker', port: 9123 }],
    })).resolves.toBeUndefined();
    expect(tx.applicationService.findFirst).not.toHaveBeenCalled();
  });

  it('rejects custom targets in governed baselines', async () => {
    await expect(validateRouteSnapshotTargets(transaction(null) as never, {
      ...scope,
      baselineRole: 'production',
    }, {
      entries: [{ serviceId: null, component: 'custom-worker', port: 9123 }],
    })).rejects.toThrow('必须选择真实服务');
  });
});

function transaction(result: unknown) {
  return { applicationService: { findFirst: jest.fn().mockResolvedValue(result) } };
}
