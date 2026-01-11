import { DynamicModule, Module, Provider, InjectionToken } from '@nestjs/common';
import type {
  PaymentModuleOptions,
  PaymentModuleAsyncOptions,
  PaymentOptionsFactory,
} from './interfaces';
import { PAYMENT_OPTIONS } from './constants';
import { PaymentService } from './payment.service';
import { WechatPayProvider } from './providers/wechat-pay.provider';
import { AlipayProvider } from './providers/alipay.provider';

@Module({})
export class PaymentModule {
  static forRoot(options: PaymentModuleOptions = {}): DynamicModule {
    const providers = this.createProviders(options);
    return {
      module: PaymentModule,
      global: true,
      providers,
      exports: [PAYMENT_OPTIONS, PaymentService, WechatPayProvider, AlipayProvider],
    };
  }

  static forRootAsync(options: PaymentModuleAsyncOptions): DynamicModule {
    const providers = this.createAsyncProviders(options);
    return {
      module: PaymentModule,
      global: true,
      imports: options.imports || [],
      providers,
      exports: [PAYMENT_OPTIONS, PaymentService, WechatPayProvider, AlipayProvider],
    };
  }

  private static createProviders(options: PaymentModuleOptions): Provider[] {
    const wechatProvider: Provider = {
      provide: WechatPayProvider,
      useFactory: () => {
        const provider = new WechatPayProvider();
        if (options.wechat) provider.setConfig(options.wechat);
        return provider;
      },
    };

    const alipayProvider: Provider = {
      provide: AlipayProvider,
      useFactory: () => {
        const provider = new AlipayProvider();
        if (options.alipay) provider.setConfig(options.alipay);
        return provider;
      },
    };

    return [
      { provide: PAYMENT_OPTIONS, useValue: options },
      wechatProvider,
      alipayProvider,
      PaymentService,
    ];
  }

  private static createAsyncProviders(options: PaymentModuleAsyncOptions): Provider[] {
    const wechatProvider: Provider = {
      provide: WechatPayProvider,
      useFactory: (opts: PaymentModuleOptions) => {
        const provider = new WechatPayProvider();
        if (opts.wechat) provider.setConfig(opts.wechat);
        return provider;
      },
      inject: [PAYMENT_OPTIONS],
    };

    const alipayProvider: Provider = {
      provide: AlipayProvider,
      useFactory: (opts: PaymentModuleOptions) => {
        const provider = new AlipayProvider();
        if (opts.alipay) provider.setConfig(opts.alipay);
        return provider;
      },
      inject: [PAYMENT_OPTIONS],
    };

    const providers: Provider[] = [wechatProvider, alipayProvider, PaymentService];

    if (options.useClass) {
      providers.push(
        { provide: options.useClass, useClass: options.useClass },
        {
          provide: PAYMENT_OPTIONS,
          useFactory: async (f: PaymentOptionsFactory) => f.createPaymentOptions(),
          inject: [options.useClass],
        },
      );
    } else if (options.useExisting) {
      providers.push({
        provide: PAYMENT_OPTIONS,
        useFactory: async (f: PaymentOptionsFactory) => f.createPaymentOptions(),
        inject: [options.useExisting],
      });
    } else if (options.useFactory) {
      providers.push({
        provide: PAYMENT_OPTIONS,
        useFactory: options.useFactory,
        inject: (options.inject || []) as InjectionToken[],
      });
    }

    return providers;
  }
}
