import { decryptResourcePoolCredential } from '../resource-pool/resource-pool-credential.utils';
import { AdminService } from './admin.service';

describe('AdminService resource-pool secret governance', () => {
  it('does not select adminConfig when listing resource pools', async () => {
    const prisma = {
      resourcePool: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new AdminService(prisma as never);

    await expect(service.getResourcePools()).resolves.toEqual([]);
    expect(prisma.resourcePool.findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.not.objectContaining({ adminConfig: expect.anything() }),
    }));
  });

  it('encrypts adminConfig when creating a resource pool through legacy admin API', async () => {
    const prisma = {
      resourcePool: {
        create: jest.fn(({ data }) => Promise.resolve({ id: 'pool-1', ...data })),
      },
    };
    const service = new AdminService(prisma as never);

    await service.createResourcePool({
      type: 'mysql',
      name: 'MySQL Pool',
      endpoint: 'mysql.internal:3306',
      adminConfig: '{"username":"root","password":"secret"}',
      capacity: 10,
    });

    const createArgs = prisma.resourcePool.create.mock.calls[0][0];
    expect(createArgs.data.adminConfig).not.toBe('{"username":"root","password":"secret"}');
    expect(createArgs.data.adminConfig).toMatch(/^[0-9a-f]{32}:/);
    expect(JSON.parse(decryptResourcePoolCredential(createArgs.data.adminConfig))).toEqual({
      username: 'root',
      password: 'secret',
    });
  });
});
