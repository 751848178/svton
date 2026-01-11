import { DynamicModule, Module, Provider, InjectionToken } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import type {
  RateLimitModuleOptions,
  RateLimitModuleAsyncOptions,
  RateLimitOptionsFactory,
} from './interfaces';
import { RATE_LIMIT_OPTIONS } from './constants';
import { RateLimitGuard } from './rate-limit.guard';

@Module({})
export class RateLimitModule {
  /**
   * 同步注册模块
   */
  static forRoot(options: RateLimitModuleOptions = {}): DynamicModule {
    const providers = this.createProviders(options);

    return {
      module: RateLimitModule,
      global: true,
      providers,
      exports: [RATE_LIMIT_OPTIONS, RateLimitGuard],
    };
  }

  /**
   * 异步注册模块
   */
  static forRootAsync(options: RateLimitModuleAsyncOptions): DynamicModule {
    const providers = this.createAsyncProviders(options);

    return {
      module: RateLimitModule,
      global: true,
      imports: options.imports || [],
      providers,
      exports: [RATE_LIMIT_OPTIONS, RateLimitGuard],
    };
  }

  private static createProviders(options: RateLimitModuleOptions): Provider[] {
    const providers: Provider[] = [
      {
        provide: RATE_LIMIT_OPTIONS,
        useValue: options,
      },
      RateLimitGuard,
    ];

    if (options.global !== false) {
      providers.push({
        provide: APP_GUARD,
        useClass: RateLimitGuard,
      });
    }

    return providers;
  }

  private static createAsyncProviders(options: RateLimitModuleAsyncOptions): Provider[] {
    const providers: Provider[] = [RateLimitGuard];

    if (options.useClass) {
      providers.push(
        {
          provide: options.useClass,
          useClass: options.useClass,
        },
        {
          provide: RATE_LIMIT_OPTIONS,
          useFactory: async (optionsFactory: RateLimitOptionsFactory) =>
            optionsFactory.createRateLimitOptions(),
          inject: [options.useClass],
        },
      );
    } else if (options.useExisting) {
      providers.push({
        provide: RATE_LIMIT_OPTIONS,
        useFactory: async (optionsFactory: RateLimitOptionsFactory) =>
          optionsFactory.createRateLimitOptions(),
        inject: [options.useExisting],
      });
    } else if (options.useFactory) {
      providers.push({
        provide: RATE_LIMIT_OPTIONS,
        useFactory: options.useFactory,
        inject: (options.inject || []) as InjectionToken[],
      });
    }

    // 添加全局 Guard
    providers.push({
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    });

    return providers;
  }
}
