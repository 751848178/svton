import { DynamicModule, Module, Provider, InjectionToken } from '@nestjs/common';
import type {
  OAuthModuleOptions,
  OAuthModuleAsyncOptions,
  OAuthOptionsFactory,
} from './interfaces';
import { OAUTH_OPTIONS } from './constants';
import { OAuthService } from './oauth.service';
import { WechatProvider } from './providers/wechat.provider';

@Module({})
export class OAuthModule {
  /**
   * 同步注册模块
   */
  static forRoot(options: OAuthModuleOptions = {}): DynamicModule {
    const providers = this.createProviders(options);

    return {
      module: OAuthModule,
      global: true,
      providers,
      exports: [OAUTH_OPTIONS, OAuthService, WechatProvider],
    };
  }

  /**
   * 异步注册模块
   */
  static forRootAsync(options: OAuthModuleAsyncOptions): DynamicModule {
    const providers = this.createAsyncProviders(options);

    return {
      module: OAuthModule,
      global: true,
      imports: options.imports || [],
      providers,
      exports: [OAUTH_OPTIONS, OAuthService, WechatProvider],
    };
  }

  private static createProviders(options: OAuthModuleOptions): Provider[] {
    const wechatProvider: Provider = {
      provide: WechatProvider,
      useFactory: () => {
        const provider = new WechatProvider();
        if (options.wechat) {
          provider.registerConfig(options.wechat);
        }
        return provider;
      },
    };

    return [
      {
        provide: OAUTH_OPTIONS,
        useValue: options,
      },
      wechatProvider,
      OAuthService,
    ];
  }

  private static createAsyncProviders(options: OAuthModuleAsyncOptions): Provider[] {
    const wechatProvider: Provider = {
      provide: WechatProvider,
      useFactory: (opts: OAuthModuleOptions) => {
        const provider = new WechatProvider();
        if (opts.wechat) {
          provider.registerConfig(opts.wechat);
        }
        return provider;
      },
      inject: [OAUTH_OPTIONS],
    };

    const providers: Provider[] = [wechatProvider, OAuthService];

    if (options.useClass) {
      providers.push(
        {
          provide: options.useClass,
          useClass: options.useClass,
        },
        {
          provide: OAUTH_OPTIONS,
          useFactory: async (optionsFactory: OAuthOptionsFactory) =>
            optionsFactory.createOAuthOptions(),
          inject: [options.useClass],
        },
      );
    } else if (options.useExisting) {
      providers.push({
        provide: OAUTH_OPTIONS,
        useFactory: async (optionsFactory: OAuthOptionsFactory) =>
          optionsFactory.createOAuthOptions(),
        inject: [options.useExisting],
      });
    } else if (options.useFactory) {
      providers.push({
        provide: OAUTH_OPTIONS,
        useFactory: options.useFactory,
        inject: (options.inject || []) as InjectionToken[],
      });
    }

    return providers;
  }
}
