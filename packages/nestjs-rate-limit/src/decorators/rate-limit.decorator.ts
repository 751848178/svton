import { SetMetadata } from '@nestjs/common';
import { RATE_LIMIT_METADATA, SKIP_RATE_LIMIT } from '../constants';
import type { RateLimitConfig } from '../interfaces';

/**
 * 限流装饰器
 *
 * @example
 * ```typescript
 * @RateLimit({ limit: 10, windowSec: 60 })
 * @Get('api')
 * async api() {}
 *
 * @RateLimit({ limit: 5, windowSec: 60, key: 'login' })
 * @Post('login')
 * async login() {}
 * ```
 */
export const RateLimit = (config: RateLimitConfig): MethodDecorator & ClassDecorator => {
  return SetMetadata(RATE_LIMIT_METADATA, config);
};

/**
 * 跳过限流装饰器
 */
export const SkipRateLimit = (): MethodDecorator & ClassDecorator => {
  return SetMetadata(SKIP_RATE_LIMIT, true);
};
