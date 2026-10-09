import type { Prisma } from '../../generated/client/index.js';

/** Close residual service observations only from an actual whole-stage result. */
export async function finalizeStages(transaction: Prisma.TransactionClient, taskId: string, status: string): Promise<void> {
  const completed = status === 'succeeded' ? await transaction.stage.findMany({
    where: { taskId, serviceKey: '', status: { in: ['succeeded', 'skipped'] } },
  }) : [];
  await transaction.stage.updateMany({ where: { taskId, status: 'pending' }, data: { status: status === 'cancelled' ? 'cancelled' : 'skipped' } });
  if (status !== 'succeeded') {
    await transaction.stage.updateMany({ where: { taskId, status: 'running' }, data: { status: status === 'cancelled' ? 'cancelled' : 'failed' } });
    return;
  }
  for (const summary of completed) {
    await transaction.stage.updateMany({ where: {
      taskId, stageKey: summary.stageKey, attempt: summary.attempt, serviceKey: { not: '' }, status: 'running',
    }, data: { status: summary.status } });
  }
}
