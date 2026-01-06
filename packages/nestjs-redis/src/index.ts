// Module
export { RedisModule } from './redis.module';

// Services
export { CacheService } from './cache.service';

// Interfaces
export * from './interfaces';

// Constants
export { REDIS_CLIENT, REDIS_OPTIONS } from './constants';

// Decorators
export { InjectRedis } from './decorators';

// Re-export ioredis types
export type { Redis, RedisOptions } from 'ioredis';
