import { ConfigService } from '@nestjs/config';
import { CacheModuleOptions } from '@svton/nestjs-cache';

export const useCacheConfig = (
  configService: ConfigService,
): CacheModuleOptions => ({
  ttl: 3600, // 默认缓存时间 1 小时
  prefix: 'cache', // 缓存 key 前缀
  enabled: true, // 启用缓存
  // 注意：Redis 连接需要通过 RedisModule 单独配置
  // 参考：@svton/nestjs-redis
});
