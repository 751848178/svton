import { ConfigService } from '@nestjs/config';
import { CacheModuleOptions } from '@svton/nestjs-cache';

export const useCacheConfig = (
  configService: ConfigService,
): CacheModuleOptions => ({
  ttl: 3600, // 默认缓存时间 1 小时
  prefix: 'cache', // 缓存 key 前缀
  redis: {
    host: configService.get('REDIS_HOST', 'localhost'),
    port: parseInt(configService.get('REDIS_PORT', '6379'), 10),
    password: configService.get('REDIS_PASSWORD'),
  },
});
