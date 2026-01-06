import { DynamicModule, Module, Provider, InjectionToken } from '@nestjs/common';
import {
  SmsModuleOptions,
  SmsModuleAsyncOptions,
  SmsOptionsFactory,
  SmsAdapter,
  SmsClient,
} from './interfaces';
import { SMS_CLIENT, SMS_OPTIONS, SMS_ADAPTER } from './constants';

@Module({})
export class SmsModule {
  /**
   * 同步注册模块
   */
  static forRoot(options: SmsModuleOptions): DynamicModule {
    const providers = this.createProviders(options);

    return {
      module: SmsModule,
      global: true,
      providers,
      exports: [SMS_CLIENT, SMS_OPTIONS],
    };
  }

  /**
   * 异步注册模块
   */
  static forRootAsync(options: SmsModuleAsyncOptions): DynamicModule {
    const providers = this.createAsyncProviders(options);

    return {
      module: SmsModule,
      global: true,
      imports: options.imports || [],
      providers,
      exports: [SMS_CLIENT, SMS_OPTIONS],
    };
  }

  private static createProviders(options: SmsModuleOptions): Provider[] {
    return [
      {
        provide: SMS_OPTIONS,
        useValue: options,
      },
      {
        provide: SMS_ADAPTER,
        useFactory: async () => {
          const adapter = typeof options.adapter === 'function'
            ? await options.adapter()
            : options.adapter;
          return adapter;
        },
      },
      {
        provide: SMS_CLIENT,
        useFactory: async (adapter: SmsAdapter): Promise<SmsClient> => {
          return adapter.createClient();
        },
        inject: [SMS_ADAPTER],
      },
    ];
  }

  private static createAsyncProviders(options: SmsModuleAsyncOptions): Provider[] {
    const providers: Provider[] = [
      {
        provide: SMS_ADAPTER,
        useFactory: async (moduleOptions: SmsModuleOptions) => {
          const adapter = typeof moduleOptions.adapter === 'function'
            ? await moduleOptions.adapter()
            : moduleOptions.adapter;
          return adapter;
        },
        inject: [SMS_OPTIONS],
      },
      {
        provide: SMS_CLIENT,
        useFactory: async (adapter: SmsAdapter): Promise<SmsClient> => {
          return adapter.createClient();
        },
        inject: [SMS_ADAPTER],
      },
    ];

    if (options.useClass) {
      providers.push(
        {
          provide: options.useClass,
          useClass: options.useClass,
        },
        {
          provide: SMS_OPTIONS,
          useFactory: async (optionsFactory: SmsOptionsFactory) =>
            optionsFactory.createSmsOptions(),
          inject: [options.useClass],
        },
      );
    } else if (options.useExisting) {
      providers.push({
        provide: SMS_OPTIONS,
        useFactory: async (optionsFactory: SmsOptionsFactory) =>
          optionsFactory.createSmsOptions(),
        inject: [options.useExisting],
      });
    } else if (options.useFactory) {
      providers.push({
        provide: SMS_OPTIONS,
        useFactory: options.useFactory,
        inject: (options.inject || []) as InjectionToken[],
      });
    }

    return providers;
  }
}
