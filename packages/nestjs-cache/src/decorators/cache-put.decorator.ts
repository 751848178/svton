import { SetMetadata } from '@nestjs/common';
import { CACHE_PUT_METADATA } from '../constants';
import type { CachePutOptions } from '../interfaces';

/**
 * 强制更新缓存装饰器
 * 无论缓存是否存在，都执行方法并更新缓存
 *
 * @example
 * ```typescript
 * @CachePut({ key: 'user:#id', ttl: 3600 })
 * async refreshUser(id: string) {
 *   return this.userRepo.findById(id);
 * }
 * ```
 */
export const CachePut = (options: CachePutOptions = {}): MethodDecorator => {
  return SetMetadata(CACHE_PUT_METADATA, options);
};
