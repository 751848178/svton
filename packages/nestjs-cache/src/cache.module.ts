import { DynamicModule, Module, Provider, InjectionToken } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import type {
  CacheModuleOptions,
  CacheModuleAsyncOptions,
  CacheOptionsFactory,
} from './interfaces';
import { CACHE_OPTIONS } from './constants';
import { CacheInterceptor } from './cache.interceptor';

@Module({})
export class CacheModule {
  /**
   * 同步注册模块
   */
  static forRoot(options: CacheModuleOptions = {}): DynamicModule {
    const providers = this.createProviders(options);

    return {
      module: CacheModule,
      global: true,
      providers,
      exports: [CACHE_OPTIONS],
    };
  }

  /**
   * 异步注册模块
   */
  static forRootAsync(options: CacheModuleAsyncOptions): DynamicModule {
    const providers = this.createAsyncProviders(options);

    return {
      module: CacheModule,
      global: true,
      imports: options.imports || [],
      providers,
      exports: [CACHE_OPTIONS],
    };
  }

  private static createProviders(options: CacheModuleOptions): Provider[] {
    return [
      {
        provide: CACHE_OPTIONS,
        useValue: { enabled: true, ...options },
      },
      {
        provide: APP_INTERCEPTOR,
        useClass: CacheInterceptor,
      },
    ];
  }

  private static createAsyncProviders(options: CacheModuleAsyncOptions): Provider[] {
    const providers: Provider[] = [
      {
        provide: APP_INTERCEPTOR,
        useClass: CacheInterceptor,
      },
    ];

    if (options.useClass) {
      providers.push(
        {
          provide: options.useClass,
          useClass: options.useClass,
        },
        {
          provide: CACHE_OPTIONS,
          useFactory: async (optionsFactory: CacheOptionsFactory) => ({
            enabled: true,
            ...(await optionsFactory.createCacheOptions()),
          }),
          inject: [options.useClass],
        },
      );
    } else if (options.useExisting) {
      providers.push({
        provide: CACHE_OPTIONS,
        useFactory: async (optionsFactory: CacheOptionsFactory) => ({
          enabled: true,
          ...(await optionsFactory.createCacheOptions()),
        }),
        inject: [options.useExisting],
      });
    } else if (options.useFactory) {
      providers.push({
        provide: CACHE_OPTIONS,
        useFactory: async (...args: unknown[]) => ({
          enabled: true,
          ...(await options.useFactory!(...args)),
        }),
        inject: (options.inject || []) as InjectionToken[],
      });
    }

    return providers;
  }
}
