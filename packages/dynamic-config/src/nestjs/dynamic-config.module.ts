import { Module, DynamicModule, Provider, Type } from '@nestjs/common';
import { DynamicConfigService } from './config.service';
import { DynamicDictionaryService } from './dictionary.service';
import { BaseConfigController } from './config.controller';
import { BaseDictionaryController } from './dictionary.controller';
import { MemoryCache } from '../core/cache/memory-cache';
import {
  CONFIG_MANAGER,
  DICTIONARY_MANAGER,
  CONFIG_REPOSITORY,
  DICTIONARY_REPOSITORY,
  CACHE_STRATEGY,
  CONFIG_MODULE_OPTIONS,
} from './constants';
import type {
  DynamicConfigModuleOptions,
  DynamicConfigModuleAsyncOptions,
  DynamicConfigModuleOptionsFactory,
} from './interfaces';

/**
 * 动态配置模块
 *
 * @example
 * ```typescript
 * // 同步配置
 * @Module({
 *   imports: [
 *     DynamicConfigModule.forRoot({
 *       configRepository: new PrismaConfigRepository(prisma),
 *       dictionaryRepository: new PrismaDictionaryRepository(prisma),
 *       cache: new TieredCache(redisCache, memoryCache),
 *     }),
 *   ],
 * })
 * export class AppModule {}
 *
 * // 异步配置
 * @Module({
 *   imports: [
 *     DynamicConfigModule.forRootAsync({
 *       imports: [PrismaModule, RedisModule],
 *       useFactory: (prisma, redis) => ({
 *         configRepository: new PrismaConfigRepository(prisma),
 *         dictionaryRepository: new PrismaDictionaryRepository(prisma),
 *         cache: new RedisCache(redis),
 *       }),
 *       inject: [PrismaService, RedisService],
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
@Module({})
export class DynamicConfigModule {
  /**
   * 同步配置
   */
  static forRoot(options: DynamicConfigModuleOptions = {}): DynamicModule {
    const controllers: Type<any>[] = [];

    if (options.registerController !== false) {
      controllers.push(options.configController ?? BaseConfigController);
      controllers.push(options.dictionaryController ?? BaseDictionaryController);
    }

    const providers: Provider[] = [
      {
        provide: CONFIG_MODULE_OPTIONS,
        useValue: options,
      },
      {
        provide: CACHE_STRATEGY,
        useValue: options.cache ?? new MemoryCache({ prefix: 'config:' }),
      },
      {
        provide: CONFIG_REPOSITORY,
        useValue: options.configRepository,
      },
      {
        provide: DICTIONARY_REPOSITORY,
        useValue: options.dictionaryRepository,
      },
      DynamicConfigService,
      DynamicDictionaryService,
    ];

    return {
      module: DynamicConfigModule,
      global: options.isGlobal ?? false,
      controllers,
      providers,
      exports: [
        DynamicConfigService,
        DynamicDictionaryService,
        CACHE_STRATEGY,
        CONFIG_REPOSITORY,
        DICTIONARY_REPOSITORY,
      ],
    };
  }

  /**
   * 异步配置
   */
  static forRootAsync(options: DynamicConfigModuleAsyncOptions): DynamicModule {
    const providers: Provider[] = [
      ...this.createAsyncProviders(options),
      DynamicConfigService,
      DynamicDictionaryService,
    ];

    return {
      module: DynamicConfigModule,
      global: options.isGlobal ?? false,
      imports: options.imports ?? [],
      providers,
      exports: [
        DynamicConfigService,
        DynamicDictionaryService,
        CACHE_STRATEGY,
        CONFIG_REPOSITORY,
        DICTIONARY_REPOSITORY,
      ],
    };
  }

  private static createAsyncProviders(
    options: DynamicConfigModuleAsyncOptions,
  ): Provider[] {
    if (options.useFactory) {
      return [
        {
          provide: CONFIG_MODULE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
        {
          provide: CACHE_STRATEGY,
          useFactory: (opts: DynamicConfigModuleOptions) =>
            opts.cache ?? new MemoryCache({ prefix: 'config:' }),
          inject: [CONFIG_MODULE_OPTIONS],
        },
        {
          provide: CONFIG_REPOSITORY,
          useFactory: (opts: DynamicConfigModuleOptions) => opts.configRepository,
          inject: [CONFIG_MODULE_OPTIONS],
        },
        {
          provide: DICTIONARY_REPOSITORY,
          useFactory: (opts: DynamicConfigModuleOptions) => opts.dictionaryRepository,
          inject: [CONFIG_MODULE_OPTIONS],
        },
      ];
    }

    if (options.useClass) {
      return [
        {
          provide: options.useClass,
          useClass: options.useClass,
        },
        {
          provide: CONFIG_MODULE_OPTIONS,
          useFactory: async (optionsFactory: DynamicConfigModuleOptionsFactory) =>
            optionsFactory.createDynamicConfigOptions(),
          inject: [options.useClass],
        },
        {
          provide: CACHE_STRATEGY,
          useFactory: (opts: DynamicConfigModuleOptions) =>
            opts.cache ?? new MemoryCache({ prefix: 'config:' }),
          inject: [CONFIG_MODULE_OPTIONS],
        },
        {
          provide: CONFIG_REPOSITORY,
          useFactory: (opts: DynamicConfigModuleOptions) => opts.configRepository,
          inject: [CONFIG_MODULE_OPTIONS],
        },
        {
          provide: DICTIONARY_REPOSITORY,
          useFactory: (opts: DynamicConfigModuleOptions) => opts.dictionaryRepository,
          inject: [CONFIG_MODULE_OPTIONS],
        },
      ];
    }

    if (options.useExisting) {
      return [
        {
          provide: CONFIG_MODULE_OPTIONS,
          useFactory: async (optionsFactory: DynamicConfigModuleOptionsFactory) =>
            optionsFactory.createDynamicConfigOptions(),
          inject: [options.useExisting],
        },
        {
          provide: CACHE_STRATEGY,
          useFactory: (opts: DynamicConfigModuleOptions) =>
            opts.cache ?? new MemoryCache({ prefix: 'config:' }),
          inject: [CONFIG_MODULE_OPTIONS],
        },
        {
          provide: CONFIG_REPOSITORY,
          useFactory: (opts: DynamicConfigModuleOptions) => opts.configRepository,
          inject: [CONFIG_MODULE_OPTIONS],
        },
        {
          provide: DICTIONARY_REPOSITORY,
          useFactory: (opts: DynamicConfigModuleOptions) => opts.dictionaryRepository,
          inject: [CONFIG_MODULE_OPTIONS],
        },
      ];
    }

    return [];
  }
}
