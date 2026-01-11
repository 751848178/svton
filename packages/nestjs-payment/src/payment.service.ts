import { Injectable, Inject } from '@nestjs/common';
import { PAYMENT_OPTIONS } from './constants';
import type { PaymentModuleOptions } from './interfaces';
import { WechatPayProvider } from './providers/wechat-pay.provider';
import { AlipayProvider } from './providers/alipay.provider';

@Injectable()
export class PaymentService {
  constructor(
    @Inject(PAYMENT_OPTIONS) private readonly options: PaymentModuleOptions,
    private readonly wechatPayProvider: WechatPayProvider,
    private readonly alipayProvider: AlipayProvider,
  ) {}

  /**
   * 获取微信支付 Provider
   */
  get wechat(): WechatPayProvider {
    return this.wechatPayProvider;
  }

  /**
   * 获取支付宝 Provider
   */
  get alipay(): AlipayProvider {
    return this.alipayProvider;
  }
}
