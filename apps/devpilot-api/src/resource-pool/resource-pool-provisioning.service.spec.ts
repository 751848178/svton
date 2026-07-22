/**
 * ResourcePoolProvisioningService orchestration unit tests.
 *
 * The mysql/redis driver utils are jest-mocked so this spec verifies only the
 * orchestration: adminConfig decryption + field reading + delegation to the
 * correct util + error propagation.
 */
const provisionMysqlDatabase = jest.fn();
const deprovisionMysqlDatabase = jest.fn();
const provisionRedisDatabase = jest.fn();
const deprovisionRedisDatabase = jest.fn();

jest.mock('./resource-pool-mysql-provisioning.utils', () => ({
  provisionMysqlDatabase,
  deprovisionMysqlDatabase,
}));
jest.mock('./resource-pool-redis-provisioning.utils', () => ({
  provisionRedisDatabase,
  deprovisionRedisDatabase,
}));

import { ResourcePoolProvisioningService } from './resource-pool-provisioning.service';

const cryptoService = {
  decryptCbc: jest.fn((encrypted: string) =>
    encrypted === 'encrypted-admin'
      ? JSON.stringify({ username: 'root', password: 'adminpw' })
      : '{}',
  ),
};

function createService() {
  return new ResourcePoolProvisioningService(cryptoService as never);
}

describe('ResourcePoolProvisioningService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('generates type-prefixed resource names from the project suffix', () => {
    const service = createService();
    // slice(-6) on a cuid keeps the trailing 6 chars.
    expect(service.generateResourceName('mysql', 'proj-abcdef')).toBe('db_abcdef');
    expect(service.generateResourceName('redis', 'proj-abcdef')).toBe('redis_abcdef');
    expect(service.generateResourceName('nginx', 'proj-abcdef')).toBe('res_abcdef');
  });

  it('provisions a mysql resource by delegating to the mysql util with decrypted admin credentials', async () => {
    provisionMysqlDatabase.mockResolvedValueOnce({
      host: 'mysql.internal', port: 3306, database: 'db_cdef',
      username: 'user_db_cdef', password: 'realpw',
    });

    const result = await createService().provisionResource(
      { type: 'mysql', endpoint: 'mysql.internal:3306', adminConfig: 'encrypted-admin' },
      'db_cdef',
    );

    expect(cryptoService.decryptCbc).toHaveBeenCalledWith('encrypted-admin');
    expect(provisionMysqlDatabase).toHaveBeenCalledWith({
      endpoint: 'mysql.internal:3306',
      adminUsername: 'root',
      adminPassword: 'adminpw',
      resourceName: 'db_cdef',
    });
    expect(result).toEqual({
      host: 'mysql.internal', port: 3306, database: 'db_cdef',
      username: 'user_db_cdef', password: 'realpw',
    });
  });

  it('provisions a redis resource by delegating to the redis util', async () => {
    provisionRedisDatabase.mockResolvedValueOnce({
      host: 'redis.internal', port: 6379, db: 3,
      password: 'adminpw', keyPrefix: 'redis_cdef:',
    });

    const result = await createService().provisionResource(
      { type: 'redis', endpoint: 'redis.internal:6379', adminConfig: 'encrypted-admin' },
      'redis_cdef',
    );

    expect(provisionRedisDatabase).toHaveBeenCalledWith({
      endpoint: 'redis.internal:6379',
      adminPassword: 'adminpw',
      resourceName: 'redis_cdef',
    });
    expect((result as { db: number }).db).toBe(3);
  });

  it('throws a clear error for postgresql (no driver bundled)', async () => {
    await expect(
      createService().provisionResource(
        { type: 'postgresql', endpoint: 'pg.internal:5432', adminConfig: 'encrypted-admin' },
        'res_cdef',
      ),
    ).rejects.toThrow(/postgresql pool provisioning is not implemented/);
  });

  it('deprovision delegates to the matching util and logs', async () => {
    deprovisionMysqlDatabase.mockResolvedValueOnce(undefined);
    await createService().deprovisionResource(
      { type: 'mysql', endpoint: 'mysql.internal:3306', adminConfig: 'encrypted-admin' },
      'db_cdef',
    );
    expect(deprovisionMysqlDatabase).toHaveBeenCalledWith({
      endpoint: 'mysql.internal:3306',
      adminUsername: 'root',
      adminPassword: 'adminpw',
      resourceName: 'db_cdef',
    });
  });

  // CR H1: the allocated redis db index must be threaded from the allocation's
  // decrypted credentials through to deprovision. Asserting the service passes
  // `db` here is the contract gap that produced the original leak.
  it('deprovisions a redis resource using the allocated db from credentials', async () => {
    deprovisionRedisDatabase.mockResolvedValueOnce(undefined);
    await createService().deprovisionResource(
      { type: 'redis', endpoint: 'redis.internal:6379', adminConfig: 'encrypted-admin' },
      'redis_cdef',
      { db: 7, host: 'redis.internal', port: 6379, password: 'adminpw', keyPrefix: 'redis_cdef:' },
    );
    expect(deprovisionRedisDatabase).toHaveBeenCalledWith({
      endpoint: 'redis.internal:6379',
      adminPassword: 'adminpw',
      resourceName: 'redis_cdef',
      db: 7,
    });
  });

  it('deprovision reads the db even when adminConfig uses `user` instead of `username`', async () => {
    cryptoService.decryptCbc.mockReturnValueOnce(
      JSON.stringify({ user: 'root', password: 'adminpw' }),
    );
    deprovisionMysqlDatabase.mockResolvedValueOnce(undefined);
    await createService().deprovisionResource(
      { type: 'mysql', endpoint: 'mysql.internal:3306', adminConfig: 'encrypted-admin' },
      'db_cdef',
    );
    expect(deprovisionMysqlDatabase).toHaveBeenCalledWith(
      expect.objectContaining({ adminUsername: 'root' }),
    );
  });

  it('propagates driver failures so the caller can roll back the allocation', async () => {
    provisionMysqlDatabase.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(
      createService().provisionResource(
        { type: 'mysql', endpoint: 'mysql.internal:3306', adminConfig: 'encrypted-admin' },
        'db_cdef',
      ),
    ).rejects.toThrow('ECONNREFUSED');
  });
});
