import { DynamicModule, Module, Provider, OnModuleDestroy, Logger, InjectionToken } from '@nestjs/common';
import Redis from 'ioredis';
import type { RedisModuleOptions, RedisModuleAsyncOptions, RedisOptionsFactory } from './interfaces';
import { REDIS_CLIENT, REDIS_OPTIONS } from './constants';
import { CacheService } from './cache.service';

@Module({})
export class RedisModule implements OnModuleDestroy {
  private static redis: Redis | null = null;
  private readonly logger = new Logger(RedisModule.name);

  async onModuleDestroy() {
    if (RedisModule.redis) {
      this.logger.log('Closing Redis connection...');
      await RedisModule.redis.quit();
      RedisModule.redis = null;
    }
  }

  /**
   * 同步注册模块
   */
  static forRoot(options: RedisModuleOptions): DynamicModule {
    const providers = this.createProviders(options);

    return {
      module: RedisModule,
      global: true,
      providers,
      exports: [REDIS_CLIENT, REDIS_OPTIONS, CacheService],
    };
  }

  /**
   * 异步注册模块
   */
  static forRootAsync(options: RedisModuleAsyncOptions): DynamicModule {
    const providers = this.createAsyncProviders(options);

    return {
      module: RedisModule,
      global: true,
      imports: options.imports || [],
      providers,
      exports: [REDIS_CLIENT, REDIS_OPTIONS, CacheService],
    };
  }

  private static createProviders(options: RedisModuleOptions): Provider[] {
    return [
      {
        provide: REDIS_OPTIONS,
        useValue: options,
      },
      {
        provide: REDIS_CLIENT,
        useFactory: () => this.createRedisClient(options),
      },
      CacheService,
    ];
  }

  private static createAsyncProviders(options: RedisModuleAsyncOptions): Provider[] {
    const providers: Provider[] = [
      {
        provide: REDIS_CLIENT,
        useFactory: (moduleOptions: RedisModuleOptions) => this.createRedisClient(moduleOptions),
        inject: [REDIS_OPTIONS],
      },
      CacheService,
    ];

    if (options.useClass) {
      providers.push(
        {
          provide: options.useClass,
          useClass: options.useClass,
        },
        {
          provide: REDIS_OPTIONS,
          useFactory: async (optionsFactory: RedisOptionsFactory) =>
            optionsFactory.createRedisOptions(),
          inject: [options.useClass],
        },
      );
    } else if (options.useExisting) {
      providers.push({
        provide: REDIS_OPTIONS,
        useFactory: async (optionsFactory: RedisOptionsFactory) =>
          optionsFactory.createRedisOptions(),
        inject: [options.useExisting],
      });
    } else if (options.useFactory) {
      providers.push({
        provide: REDIS_OPTIONS,
        useFactory: options.useFactory,
        inject: (options.inject || []) as InjectionToken[],
      });
    }

    return providers;
  }

  private static createRedisClient(options: RedisModuleOptions): Redis {
    const logger = new Logger(RedisModule.name);

    if (options.url) {
      this.redis = new Redis(options.url, options);
    } else {
      this.redis = new Redis(options);
    }

    this.redis.on('connect', () => {
      logger.log('Redis connected');
    });

    this.redis.on('error', (err) => {
      logger.error('Redis connection error', err);
    });

    this.redis.on('close', () => {
      logger.warn('Redis connection closed');
    });

    return this.redis;
  }
}
