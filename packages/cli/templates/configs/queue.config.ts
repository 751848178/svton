import { ConfigService } from '@nestjs/config';
import { QueueModuleOptions } from '@svton/nestjs-queue';

export const useQueueConfig = (
  configService: ConfigService,
): QueueModuleOptions => ({
  connection: {
    host: configService.get('REDIS_HOST', 'localhost'),
    port: parseInt(configService.get('REDIS_PORT', '6379'), 10),
    password: configService.get('REDIS_PASSWORD'),
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});
