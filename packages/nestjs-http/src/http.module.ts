import { DynamicModule, Module, Provider, InjectionToken } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import {
  HttpModuleOptions,
  HttpModuleAsyncOptions,
  HttpOptionsFactory,
} from './interfaces';
import { HTTP_MODULE_OPTIONS } from './constants';
import { GlobalExceptionFilter } from './filters/http-exception.filter';
import { ResponseInterceptor } from './interceptors/response.interceptor';

@Module({})
export class HttpModule {
  /**
   * 同步注册模块
   */
  static forRoot(options: HttpModuleOptions = {}): DynamicModule {
    const providers = this.createProviders(options);

    return {
      module: HttpModule,
      global: true,
      providers,
      exports: [HTTP_MODULE_OPTIONS],
    };
  }

  /**
   * 异步注册模块
   */
  static forRootAsync(options: HttpModuleAsyncOptions): DynamicModule {
    const providers = this.createAsyncProviders(options);

    return {
      module: HttpModule,
      global: true,
      imports: options.imports || [],
      providers,
      exports: [HTTP_MODULE_OPTIONS],
    };
  }

  private static createProviders(options: HttpModuleOptions): Provider[] {
    const providers: Provider[] = [
      {
        provide: HTTP_MODULE_OPTIONS,
        useValue: options,
      },
    ];

    // 默认启用异常过滤器
    if (options.enableExceptionFilter !== false) {
      providers.push({
        provide: APP_FILTER,
        useClass: GlobalExceptionFilter,
      });
    }

    // 默认启用响应拦截器
    if (options.enableResponseInterceptor !== false) {
      providers.push({
        provide: APP_INTERCEPTOR,
        useClass: ResponseInterceptor,
      });
    }

    return providers;
  }

  private static createAsyncProviders(options: HttpModuleAsyncOptions): Provider[] {
    const providers: Provider[] = [];

    if (options.useClass) {
      providers.push(
        {
          provide: options.useClass,
          useClass: options.useClass,
        },
        {
          provide: HTTP_MODULE_OPTIONS,
          useFactory: async (optionsFactory: HttpOptionsFactory) =>
            optionsFactory.createHttpOptions(),
          inject: [options.useClass],
        },
      );
    } else if (options.useExisting) {
      providers.push({
        provide: HTTP_MODULE_OPTIONS,
        useFactory: async (optionsFactory: HttpOptionsFactory) =>
          optionsFactory.createHttpOptions(),
        inject: [options.useExisting],
      });
    } else if (options.useFactory) {
      providers.push({
        provide: HTTP_MODULE_OPTIONS,
        useFactory: options.useFactory,
        inject: (options.inject || []) as InjectionToken[],
      });
    }

    // 添加全局 Filter 和 Interceptor
    providers.push(
      {
        provide: APP_FILTER,
        useClass: GlobalExceptionFilter,
      },
      {
        provide: APP_INTERCEPTOR,
        useClass: ResponseInterceptor,
      },
    );

    return providers;
  }
}
