import { PrismaService } from '../prisma/prisma.service';
import { DeploymentRunDetailRepository } from './deployment-run-detail.repository';

describe('DeploymentRunDetailRepository', () => {
  it('loads list and detail evidence relations from one exact run projection', async () => {
    const prisma = { deploymentRun: { findFirst: jest.fn().mockResolvedValue(null) } };
    const repository = new DeploymentRunDetailRepository(prisma as unknown as PrismaService);
    await repository.findById('team-1', 'run-1', 'project-1');
    const query = prisma.deploymentRun.findFirst.mock.calls[0][0];
    expect(query.where).toEqual({ id: 'run-1', teamId: 'team-1', projectId: 'project-1' });
    expect(query.include).toEqual(expect.objectContaining({
      artifactManifest: expect.any(Object),
      releaseStageAttempts: expect.any(Object),
      sourceRun: expect.any(Object),
      releaseRun: expect.any(Object),
    }));
  });
});
