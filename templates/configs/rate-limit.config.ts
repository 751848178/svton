import { ConfigService } from '@nestjs/config';
import { RateLimitModuleOptions } from '@svton/nestjs-rate-limit';

export const useRateLimitConfig = (
  configService: ConfigService,
): RateLimitModuleOptions => ({
  redis: {
    host: configService.get('REDIS_HOST', 'localhost'),
    port: parseInt(configService.get('REDIS_PORT', '6379'), 10),
    password: configService.get('REDIS_PASSWORD'),
  },
  global: {
    ttl: 60, // 时间窗口（秒）
    limit: 100, // 最大请求数
  },
});
