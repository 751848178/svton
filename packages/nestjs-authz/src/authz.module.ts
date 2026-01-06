import { DynamicModule, Module, Provider, InjectionToken } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import {
  AuthzModuleOptions,
  AuthzModuleAsyncOptions,
  AuthzOptionsFactory,
} from './interfaces';
import { AUTHZ_OPTIONS } from './constants';
import { RolesGuard } from './guards/roles.guard';

@Module({})
export class AuthzModule {
  /**
   * 同步注册模块
   */
  static forRoot(options: AuthzModuleOptions = {}): DynamicModule {
    const providers = this.createProviders(options);

    return {
      module: AuthzModule,
      global: true,
      providers,
      exports: [AUTHZ_OPTIONS, RolesGuard],
    };
  }

  /**
   * 异步注册模块
   */
  static forRootAsync(options: AuthzModuleAsyncOptions): DynamicModule {
    const providers = this.createAsyncProviders(options);

    return {
      module: AuthzModule,
      global: true,
      imports: options.imports || [],
      providers,
      exports: [AUTHZ_OPTIONS, RolesGuard],
    };
  }

  private static createProviders(options: AuthzModuleOptions): Provider[] {
    const providers: Provider[] = [
      {
        provide: AUTHZ_OPTIONS,
        useValue: options,
      },
      RolesGuard,
    ];

    // 全局启用 RolesGuard
    if (options.enableGlobalGuard) {
      providers.push({
        provide: APP_GUARD,
        useClass: RolesGuard,
      });
    }

    return providers;
  }

  private static createAsyncProviders(options: AuthzModuleAsyncOptions): Provider[] {
    const providers: Provider[] = [RolesGuard];

    if (options.useClass) {
      providers.push(
        {
          provide: options.useClass,
          useClass: options.useClass,
        },
        {
          provide: AUTHZ_OPTIONS,
          useFactory: async (optionsFactory: AuthzOptionsFactory) =>
            optionsFactory.createAuthzOptions(),
          inject: [options.useClass],
        },
      );
    } else if (options.useExisting) {
      providers.push({
        provide: AUTHZ_OPTIONS,
        useFactory: async (optionsFactory: AuthzOptionsFactory) =>
          optionsFactory.createAuthzOptions(),
        inject: [options.useExisting],
      });
    } else if (options.useFactory) {
      providers.push({
        provide: AUTHZ_OPTIONS,
        useFactory: options.useFactory,
        inject: (options.inject || []) as InjectionToken[],
      });
    }

    return providers;
  }
}
