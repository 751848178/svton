import { Inject } from '@nestjs/common';
import { REDIS_CLIENT } from './constants';

/**
 * 注入 Redis 客户端
 */
export const InjectRedis = () => Inject(REDIS_CLIENT);
