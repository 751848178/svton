import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { DbJobQueue } from './db-job-queue';

/**
 * DbJobQueue 并发原语单元测试。
 *
 * 验证 claim/extend/complete/recover 的核心语义：
 *  - claim 用 compare-and-set 保证原子性（并发只有一个成功）
 *  - claim 跳过未到期 / 已被领取的 job
 *  - extend 仅作用于 running job
 *  - complete 释放锁并写终态
 *  - recover 重置锁过期的 running job
 */
function createConfigService(overrides: Record<string, string> = {}) {
  return {
    get: jest.fn((key: string, fallback?: unknown) => overrides[key] ?? fallback),
  } as unknown as ConfigService;
}

describe('DbJobQueue concurrency primitives', () => {
  function createQueue(prisma: unknown, config?: ConfigService) {
    return new DbJobQueue(prisma as PrismaService, config ?? createConfigService());
  }

  describe('claimNextDueJob', () => {
    it('claims the earliest due queued job with highest priority and marks it running', async () => {
      const job = {
        id: 'job-1',
        teamId: 'team-1',
        actorId: null,
        operationKey: 'deployment.run',
        adapterKey: 'deployment',
        attempt: 1,
        maxAttempts: 3,
        retryOfId: null,
        inputSnapshot: { steps: [] },
        status: 'queued',
      };
      const prisma = {
        serverExecutionJob: {
          findFirst: jest.fn().mockResolvedValue(job),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUnique: jest.fn().mockResolvedValue({ ...job, status: 'running' }),
        },
      };
      const queue = createQueue(prisma);

      const claimed = await queue.claimNextDueJob('team-1');

      expect(claimed).toEqual(expect.objectContaining({ id: 'job-1', operationKey: 'deployment.run' }));
      // findFirst 按到期+优先级+入队时间选取
      expect(prisma.serverExecutionJob.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            teamId: 'team-1',
            status: 'queued',
            queueMode: 'queued',
            availableAt: { lte: expect.any(Date) },
          }),
          orderBy: [{ priority: 'desc' }, { queuedAt: 'asc' }],
        }),
      );
      // updateMany 是 compare-and-set：where 含 status='queued'
      expect(prisma.serverExecutionJob.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'job-1', status: 'queued' },
          data: expect.objectContaining({
            status: 'running',
            lockOwner: expect.stringMatching(/^server-executor-/),
            lockExpiresAt: expect.any(Date),
          }),
        }),
      );
    });

    it('returns null when no due job exists', async () => {
      const prisma = {
        serverExecutionJob: { findFirst: jest.fn().mockResolvedValue(null) },
      };
      const queue = createQueue(prisma);

      await expect(queue.claimNextDueJob()).resolves.toBeNull();
    });

    it('returns null when compare-and-set loses the race (count === 0)', async () => {
      const job = { id: 'job-1', status: 'queued' };
      const prisma = {
        serverExecutionJob: {
          findFirst: jest.fn().mockResolvedValue(job),
          updateMany: jest.fn().mockResolvedValue({ count: 0 }), // 被别的 worker 抢走
          findUnique: jest.fn(),
        },
      };
      const queue = createQueue(prisma);

      await expect(queue.claimNextDueJob()).resolves.toBeNull();
      expect(prisma.serverExecutionJob.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('extendJobLock', () => {
    it('refreshes lockExpiresAt and lastHeartbeatAt only for running jobs owned by this worker', async () => {
      const updateMany = jest.fn().mockResolvedValue({ count: 1 });
      const prisma = { serverExecutionJob: { updateMany } };
      const queue = createQueue(prisma);

      await queue.extendJobLock('job-1');

      expect(updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'job-1', status: 'running' },
          data: expect.objectContaining({
            lockOwner: expect.stringMatching(/^server-executor-/),
            lockExpiresAt: expect.any(Date),
            lastHeartbeatAt: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe('completeJob', () => {
    it('writes terminal status and clears lock fields', async () => {
      const updateMany = jest.fn().mockResolvedValue({ count: 1 });
      const prisma = { serverExecutionJob: { updateMany } };
      const queue = createQueue(prisma);

      await queue.completeJob('job-1', 'completed', {
        status: 'completed',
        commandPlan: { steps: [] },
        logs: [],
        result: { mode: 'executed' },
      });

      expect(updateMany).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: expect.objectContaining({
          status: 'completed',
          lockedAt: null,
          lockOwner: null,
          lockExpiresAt: null,
          finishedAt: expect.any(Date),
        }),
      });
    });

    it('sets cancelledAt only when status is cancelled', async () => {
      const updateMany = jest.fn().mockResolvedValue({ count: 1 });
      const prisma = { serverExecutionJob: { updateMany } };
      const queue = createQueue(prisma);

      await queue.completeJob('job-1', 'cancelled', { status: 'cancelled' });
      const cancelledCall = updateMany.mock.calls[0][0].data;
      expect(cancelledCall.cancelledAt).toEqual(expect.any(Date));

      updateMany.mockClear();
      await queue.completeJob('job-1', 'failed', { status: 'failed' });
      const failedCall = updateMany.mock.calls[0][0].data;
      expect(failedCall.cancelledAt).toBeUndefined();
    });
  });

  describe('recoverStaleJobs', () => {
    it('resets lock-expired running jobs to failed via compare-and-set', async () => {
      const staleJobs = [
        { id: 'job-1', teamId: 'team-1', operationKey: 'deployment.run' },
        { id: 'job-2', teamId: 'team-1', operationKey: 'site.sync' },
      ];
      const updateMany = jest.fn()
        .mockResolvedValueOnce({ count: 1 }) // job-1 恢复成功
        .mockResolvedValueOnce({ count: 0 }); // job-2 已被别的 worker 续租
      const prisma = {
        serverExecutionJob: {
          findMany: jest.fn().mockResolvedValue(staleJobs),
          updateMany,
        },
      };
      const queue = createQueue(prisma);

      const recovered = await queue.recoverStaleJobs('team-1');

      expect(recovered).toEqual([
        { jobId: 'job-1', teamId: 'team-1', operationKey: 'deployment.run' },
      ]);
      // 每个候选都用 compare-and-set（where 含 lockExpiresAt <= now）
      expect(updateMany).toHaveBeenCalledTimes(2);
      expect(updateMany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'job-1',
            status: 'running',
            lockExpiresAt: { lte: expect.any(Date) },
          }),
          data: expect.objectContaining({
            status: 'failed',
            lockOwner: null,
          }),
        }),
      );
    });

    it('returns empty when no stale jobs', async () => {
      const prisma = {
        serverExecutionJob: { findMany: jest.fn().mockResolvedValue([]) },
      };
      const queue = createQueue(prisma);

      await expect(queue.recoverStaleJobs()).resolves.toEqual([]);
    });
  });

  describe('configuration clamping', () => {
    it('falls back to default 120s when configured TTL is below the 10s floor', async () => {
      const updateMany = jest.fn().mockResolvedValue({ count: 1 });
      const prisma = { serverExecutionJob: { updateMany } };
      // 配置 5 秒（低于 10 秒下限）→ 回退到默认 120 秒
      const queue = createQueue(prisma, createConfigService({
        SERVER_EXECUTOR_QUEUE_LOCK_TTL_SECONDS: '5',
      }));

      await queue.extendJobLock('job-1');
      const lockExpiresAt = updateMany.mock.calls[0][0].data.lockExpiresAt as Date;
      const ttlMs = lockExpiresAt.getTime() - Date.now();
      expect(ttlMs).toBeGreaterThanOrEqual(115_000);
      expect(ttlMs).toBeLessThanOrEqual(121_000);
    });

    it('respects a valid configured lock TTL above the floor', async () => {
      const updateMany = jest.fn().mockResolvedValue({ count: 1 });
      const prisma = { serverExecutionJob: { updateMany } };
      const queue = createQueue(prisma, createConfigService({
        SERVER_EXECUTOR_QUEUE_LOCK_TTL_SECONDS: '30',
      }));

      await queue.extendJobLock('job-1');
      const lockExpiresAt = updateMany.mock.calls[0][0].data.lockExpiresAt as Date;
      const ttlMs = lockExpiresAt.getTime() - Date.now();
      expect(ttlMs).toBeGreaterThanOrEqual(29_500);
      expect(ttlMs).toBeLessThanOrEqual(31_000);
    });
  });

  describe('lease primitives (acquireLiveLease/releaseLiveLease/expireStaleLeases)', () => {
    it('acquireLiveLease creates a running lease and returns it', async () => {
      const leaseRecord = { id: 'lease-1', operationKey: 'op', adapterKey: 'ad', acquiredAt: new Date(), expiresAt: new Date() };
      const prisma = {
        serverExecutionLease: {
          create: jest.fn().mockResolvedValue(leaseRecord),
        },
      };
      const queue = createQueue(prisma);

      const result = await queue.acquireLiveLease({
        teamId: 'team-1', serverId: 'server-1', activeKey: 'team-1:server-1',
        operationKey: 'op', adapterKey: 'ad', transport: 'ssh', dryRun: false,
        ttlMs: 30000, metadata: { target: {} },
      });

      expect(result.lease).toEqual(leaseRecord);
      expect(prisma.serverExecutionLease.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            activeKey: 'team-1:server-1',
            status: 'running',
          }),
        }),
      );
    });

    it('acquireLiveLease returns blocked on unique constraint conflict', async () => {
      const { Prisma } = require('@prisma/client');
      const prismaError = new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: '5.0' });
      const blockingLease = { id: 'existing-lease', operationKey: 'existing-op', acquiredAt: new Date(), expiresAt: new Date() };
      const create = jest.fn().mockRejectedValue(prismaError);
      const findFirst = jest.fn().mockResolvedValue(blockingLease);
      const prisma = { serverExecutionLease: { create, findFirst } };
      const queue = createQueue(prisma);

      const result = await queue.acquireLiveLease({
        teamId: 'team-1', serverId: 'server-1', activeKey: 'team-1:server-1',
        operationKey: 'op', adapterKey: 'ad', transport: 'ssh', dryRun: false,
        ttlMs: 30000, metadata: {},
      });

      expect(result.lease).toBeUndefined();
      expect(result.blocked).toEqual(expect.objectContaining({
        blockingLeaseId: 'existing-lease',
        blockingOperationKey: 'existing-op',
      }));
    });

    it('releaseLiveLease updates lease via compare-and-set (status=running)', async () => {
      const updateMany = jest.fn().mockResolvedValue({ count: 1 });
      const prisma = { serverExecutionLease: { updateMany } };
      const queue = createQueue(prisma);

      await queue.releaseLiveLease('lease-1', 'completed');

      expect(updateMany).toHaveBeenCalledWith({
        where: { id: 'lease-1', status: 'running' },
        data: expect.objectContaining({ status: 'completed', activeKey: null }),
      });
    });

    it('expireStaleLeases sweeps expired running leases and returns count', async () => {
      const updateMany = jest.fn().mockResolvedValue({ count: 3 });
      const prisma = { serverExecutionLease: { updateMany } };
      const queue = createQueue(prisma);
      const now = new Date();

      const count = await queue.expireStaleLeases(now, 'team-1');

      expect(count).toBe(3);
      expect(updateMany).toHaveBeenCalledWith({
        where: { teamId: 'team-1', status: 'running', expiresAt: { lte: now } },
        data: expect.objectContaining({ status: 'expired', activeKey: null }),
      });
    });
  });
});
