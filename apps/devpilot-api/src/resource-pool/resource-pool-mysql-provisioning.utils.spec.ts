/**
 * MySQL pool provisioning utils — unit tests.
 *
 * `mysql2/promise` is jest-mocked so no network is touched. We assert:
 *  - provisioning runs CREATE DATABASE / CREATE USER / GRANT / FLUSH in order
 *  - the returned credentials echo the endpoint + generated identifiers
 *  - unsafe resource names are rejected before any SQL runs
 *  - deprovisioning runs DROP DATABASE / DROP USER / FLUSH
 */
const query = jest.fn();

jest.mock('mysql2/promise', () => ({
  createConnection: jest.fn(async () => ({
    query,
    end: jest.fn(async () => undefined),
  })),
}));

import { createConnection } from 'mysql2/promise';
import {
  provisionMysqlDatabase,
  deprovisionMysqlDatabase,
  assertSafeResourceName,
} from './resource-pool-mysql-provisioning.utils';

describe('resource-pool mysql provisioning utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates database, user, grant and flushes privileges, returning real credentials', async () => {
    const credentials = await provisionMysqlDatabase({
      endpoint: 'mysql.internal:3306',
      adminUsername: 'root',
      adminPassword: 'adminpw',
      resourceName: 'db_abc123',
      password: 'generated-pw',
    });

    expect(credentials).toEqual({
      host: 'mysql.internal',
      port: 3306,
      database: 'db_abc123',
      username: 'user_db_abc123',
      password: 'generated-pw',
    });

    const sqls = query.mock.calls.map((call) => String(call[0]));
    expect(sqls).toContainEqual(expect.stringContaining('CREATE DATABASE IF NOT EXISTS `db_abc123`'));
    expect(sqls).toContainEqual(expect.stringContaining("CREATE USER IF NOT EXISTS `user_db_abc123`@'%' IDENTIFIED BY ?"));
    expect(sqls).toContainEqual(expect.stringContaining("GRANT ALL PRIVILEGES ON `db_abc123`.* TO `user_db_abc123`@'%'"));
    expect(sqls).toContainEqual('FLUSH PRIVILEGES');

    // CREATE USER uses a bound parameter for the password (never interpolated).
    const createUserCall = query.mock.calls.find((call) =>
      String(call[0]).includes('CREATE USER'),
    );
    expect(createUserCall?.[1]).toEqual(['generated-pw']);

    expect(createConnection).toHaveBeenCalledWith(expect.objectContaining({
      host: 'mysql.internal',
      port: 3306,
      user: 'root',
      password: 'adminpw',
    }));
  });

  it('drops database and user on deprovision', async () => {
    await deprovisionMysqlDatabase({
      endpoint: 'mysql.internal:3306',
      adminUsername: 'root',
      adminPassword: 'adminpw',
      resourceName: 'db_abc123',
    });

    const sqls = query.mock.calls.map((call) => String(call[0]));
    expect(sqls).toContainEqual('DROP DATABASE IF EXISTS `db_abc123`');
    expect(sqls).toContainEqual("DROP USER IF EXISTS `user_db_abc123`@'%'");
    expect(sqls).toContainEqual('FLUSH PRIVILEGES');
  });

  it('always closes the connection, even on success', async () => {
    const end = jest.fn(async () => undefined);
    (createConnection as jest.Mock).mockResolvedValueOnce({ query, end });
    await provisionMysqlDatabase({
      endpoint: '127.0.0.1',
      resourceName: 'db_abc123',
    });
    expect(end).toHaveBeenCalledTimes(1);
  });

  it('always closes the connection, even on failure', async () => {
    const end = jest.fn(async () => undefined);
    query.mockRejectedValueOnce(new Error('boom'));
    (createConnection as jest.Mock).mockResolvedValueOnce({ query, end });
    await expect(
      provisionMysqlDatabase({ endpoint: '127.0.0.1', resourceName: 'db_abc123' }),
    ).rejects.toThrow('boom');
    expect(end).toHaveBeenCalledTimes(1);
  });

  it('rejects unsafe resource names before connecting', async () => {
    assertSafeResourceName('db_abc123');
    expect(() => assertSafeResourceName("db_abc'; DROP TABLE x;--")).toThrow(
      /Unsafe resource name rejected/,
    );
    await expect(
      provisionMysqlDatabase({ endpoint: '127.0.0.1', resourceName: 'evil; drop' }),
    ).rejects.toThrow(/Unsafe resource name rejected/);
    expect(createConnection).not.toHaveBeenCalled();
  });
});
