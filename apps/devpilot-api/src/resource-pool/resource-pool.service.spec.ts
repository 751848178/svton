import { PrismaService } from '../prisma/prisma.service';
import { PoolType } from './dto/resource-pool.dto';
import { decryptResourcePoolCredential } from './resource-pool-credential.utils';
import { ResourcePoolService } from './resource-pool.service';

describe('ResourcePoolService read scoping', () => {
  it('loads user allocations within the current team only', async () => {
    const prisma = {
      resourceAllocation: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'allocation-1',
            pool: { type: 'mysql', name: 'MySQL Pool' },
            resourceName: 'db_project',
            project: { name: 'Project A' },
            status: 'active',
            createdAt: new Date('2026-07-02T00:00:00.000Z'),
            releasedAt: null,
          },
        ]),
      },
    };
    const service = new ResourcePoolService(prisma as unknown as PrismaService);

    await expect(service.getUserAllocations('team-1', 'user-1')).resolves.toHaveLength(1);
    expect(prisma.resourceAllocation.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { teamId: 'team-1', userId: 'user-1' },
      orderBy: { createdAt: 'desc' },
    }));
  });

  it('encrypts adminConfig on the main resource-pool create path', async () => {
    const prisma = {
      resourcePool: {
        create: jest.fn(({ data }) => Promise.resolve({
          id: 'pool-1',
          allocated: 0,
          createdAt: new Date('2026-07-02T00:00:00.000Z'),
          updatedAt: new Date('2026-07-02T00:00:00.000Z'),
          ...data,
        })),
      },
    };
    const service = new ResourcePoolService(prisma as unknown as PrismaService);

    await service.createPool({
      type: PoolType.MYSQL,
      name: 'MySQL Pool',
      endpoint: 'mysql.internal:3306',
      adminConfig: { username: 'root', password: 'secret' },
      capacity: 10,
    });
    const createArgs = prisma.resourcePool.create.mock.calls[0][0];

    expect(createArgs.data.adminConfig).not.toContain('secret');
    expect(JSON.parse(decryptResourcePoolCredential(createArgs.data.adminConfig))).toEqual({
      username: 'root',
      password: 'secret',
    });
  });
});
