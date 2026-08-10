/**
 * mapPrismaError 回归测试（F457）：
 * Prisma P2002 的 meta.target 依驱动/约束既可能是字符串数组也可能是单个字符串。
 * 异常过滤器内部绝不能抛错——过滤器内抛出的未捕获 TypeError 会杀死整个进程
 * （F457 在并发生产执行时实测崩溃：`target?.join is not a function`）。
 */
import { HttpStatus } from '@nestjs/common';
import { mapPrismaError } from './prisma-error.util';

describe('mapPrismaError (F457 string meta.target guard)', () => {
  it('array meta.target → fields joined', () => {
    const mapped = mapPrismaError({
      code: 'P2002',
      meta: { target: ['ReleaseRun', 'releaseOrderId_idempotencyKey'] },
      message: 'Unique constraint failed',
      clientVersion: '5.x',
    });
    expect(mapped.status).toBe(HttpStatus.CONFLICT);
    expect(mapped.code).toBe(40901);
    expect(mapped.message).toContain('releaseOrderId_idempotencyKey');
  });

  it('string meta.target (single-column unique) → no crash, field surfaced', () => {
    const mapped = mapPrismaError({
      code: 'P2002',
      meta: { target: 'EnvironmentVersion.deploymentRunId' },
      message: 'Unique constraint failed',
      clientVersion: '5.x',
    });
    expect(mapped.status).toBe(HttpStatus.CONFLICT);
    expect(mapped.code).toBe(40901);
    expect(mapped.message).toContain('deploymentRunId');
  });

  it('missing meta.target → safe fallback', () => {
    const mapped = mapPrismaError({
      code: 'P2002',
      meta: {},
      message: 'Unique constraint failed',
      clientVersion: '5.x',
    });
    expect(mapped.status).toBe(HttpStatus.CONFLICT);
    expect(mapped.message).toContain('field');
  });

  it('unmapped prisma codes → 50001 database operation failed', () => {
    const mapped = mapPrismaError({
      code: 'P9999',
      meta: {},
      message: 'boom',
      clientVersion: '5.x',
    });
    expect(mapped.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mapped.code).toBe(50001);
  });
});
