import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { REDIS_CLIENT } from '@svton/nestjs-redis';
import { DISTRIBUTED_LOCK } from './distributed-lock';
import { NoopDistributedLock } from './noop-distributed-lock';
import { RedlockDistributedLock } from './redlock-distributed-lock';

/**
 * 分布式锁模块。
 *
 * 当 Redis client 可用且配置了 REDIS_HOST 时，绑定 `RedlockDistributedLock`（强一致互斥）；
 * 否则绑定 `NoopDistributedLock`（降级到纯 DB lease）。
 * 消费方（server-executor）通过 `@Inject(DISTRIBUTED_LOCK)` 获取，与具体实现解耦。
 */
@Global()
@Module({
  providers: [
    {
      provide: DISTRIBUTED_LOCK,
      inject: [REDIS_CLIENT, ConfigService],
      useFactory: (redis: unknown, config: ConfigService) => {
        const logger = new Logger('LockModule');
        const redisHost = config.get<string>('REDIS_HOST');
        // 仅当显式配置 REDIS_HOST 且 client 有可用的连接方法时启用 redlock。
        if (redisHost && redis && typeof (redis as { status?: string }).status === 'string') {
          logger.log(`Redlock distributed lock enabled (redis=${redisHost})`);
          return new RedlockDistributedLock(redis as never);
        }
        logger.warn('Redis not configured; distributed lock degraded to Noop (DB lease only)');
        return new NoopDistributedLock();
      },
    },
  ],
  exports: [DISTRIBUTED_LOCK],
})
export class LockModule {}
