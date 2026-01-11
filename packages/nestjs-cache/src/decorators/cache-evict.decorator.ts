import { SetMetadata } from '@nestjs/common';
import { CACHE_EVICT_METADATA } from '../constants';
import type { CacheEvictOptions } from '../interfaces';

/**
 * 缓存清除装饰器
 *
 * @example
 * ```typescript
 * @CacheEvict({ key: 'user:#id' })
 * async updateUser(id: string, data: UpdateUserDto) {
 *   return this.userRepo.update(id, data);
 * }
 *
 * @CacheEvict({ key: 'user:*', allEntries: true })
 * async clearAllUsers() {
 *   // 清除所有 user:* 缓存
 * }
 * ```
 */
export const CacheEvict = (options: CacheEvictOptions = {}): MethodDecorator => {
  return SetMetadata(CACHE_EVICT_METADATA, options);
};
