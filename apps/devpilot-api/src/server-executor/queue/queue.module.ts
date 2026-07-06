import { Global, Module } from '@nestjs/common';
import { DbJobQueue } from './db-job-queue';
import { JOB_QUEUE_PORT } from './job-queue.port';

/**
 * Job 队列模块。
 *
 * 把 `DbJobQueue`（Prisma 实现）绑定为 `JOB_QUEUE_PORT` token 的默认实现。
 * `ServerExecutorService` 注入 `@Inject(JOB_QUEUE_PORT)`，与具体实现解耦，
 * 未来可替换为 `BullMqJobQueue`（基于 Redis）而无需改消费方。
 */
@Global()
@Module({
  providers: [
    DbJobQueue,
    { provide: JOB_QUEUE_PORT, useExisting: DbJobQueue },
  ],
  exports: [JOB_QUEUE_PORT, DbJobQueue],
})
export class ServerExecutorQueueModule {}
