import type { PrismaClient } from '@prisma/client';

export async function waitForRepositoryRunLockWaiters(
  prisma: PrismaClient,
  minimum: number,
): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const [result] = await prisma.$queryRaw<Array<{ waiters: bigint }>>`
      SELECT COUNT(*) AS waiters
      FROM performance_schema.data_lock_waits AS waiting
      JOIN performance_schema.data_locks AS requested
        ON requested.ENGINE_LOCK_ID = waiting.REQUESTING_ENGINE_LOCK_ID
      WHERE requested.OBJECT_SCHEMA = DATABASE()
        AND requested.OBJECT_NAME = 'RepositoryAnalysisRun'
    `;
    if (Number(result.waiters) >= minimum) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`timed out waiting for ${minimum} repository run lock waiters`);
}
