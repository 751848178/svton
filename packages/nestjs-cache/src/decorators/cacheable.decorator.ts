import { SetMetadata } from '@nestjs/common';
import { CACHEABLE_METADATA } from '../constants';
import type { CacheableOptions } from '../interfaces';

/**
 * 方法级缓存装饰器
 * 如果缓存存在则返回缓存，否则执行方法并缓存结果
 *
 * @example
 * ```typescript
 * @Cacheable({ key: 'user:#id', ttl: 3600 })
 * async getUser(id: string) {
 *   return this.userRepo.findById(id);
 * }
 * ```
 */
export const Cacheable = (options: CacheableOptions = {}): MethodDecorator => {
  return SetMetadata(CACHEABLE_METADATA, options);
};
