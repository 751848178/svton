import type { ModuleMetadata, Type } from '@nestjs/common';

export type PaymentProvider = 'wechat' | 'alipay';

export interface WechatPayConfig {
  /** 商户号 */
  mchId: string;
  /** 商户 API 私钥 */
  privateKey: string;
  /** 商户 API 证书序列号 */
  serialNo: string;
  /** 微信支付平台证书 (用于验签) */
  platformCert?: string;
  /** APIv3 密钥 */
  apiV3Key: string;
  /** 关联的 AppID */
  appId: string;
  /** 回调通知地址 */
  notifyUrl?: string;
}

export interface AlipayConfig {
  /** 应用 ID */
  appId: string;
  /** 应用私钥 */
  privateKey: string;
  /** 支付宝公钥 */
  alipayPublicKey: string;
  /** 是否沙箱环境 */
  sandbox?: boolean;
  /** 回调通知地址 */
  notifyUrl?: string;
  /** 同步跳转地址 */
  returnUrl?: string;
}

export interface PaymentModuleOptions {
  wechat?: WechatPayConfig;
  alipay?: AlipayConfig;
}

export interface PaymentOptionsFactory {
  createPaymentOptions(): Promise<PaymentModuleOptions> | PaymentModuleOptions;
}

export interface PaymentModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useExisting?: Type<PaymentOptionsFactory>;
  useClass?: Type<PaymentOptionsFactory>;
  useFactory?: (...args: unknown[]) => Promise<PaymentModuleOptions> | PaymentModuleOptions;
  inject?: unknown[];
}

// 统一下单参数
export interface CreateOrderParams {
  /** 商户订单号 */
  outTradeNo: string;
  /** 订单金额 (分) */
  totalAmount: number;
  /** 商品描述 */
  description: string;
  /** 用户标识 (微信 openid / 支付宝 buyer_id) */
  userId?: string;
  /** 附加数据 */
  attach?: string;
  /** 订单过期时间 */
  expireTime?: Date;
}

// 微信支付类型
export type WechatPayType = 'jsapi' | 'native' | 'app' | 'h5' | 'miniprogram';

// 支付宝支付类型
export type AlipayType = 'page' | 'wap' | 'app';

// 统一下单结果
export interface CreateOrderResult {
  success: boolean;
  /** 预支付信息 (用于前端调起支付) */
  prepayData?: Record<string, string>;
  /** 二维码链接 (native 支付) */
  codeUrl?: string;
  /** H5 支付链接 */
  h5Url?: string;
  /** 支付宝表单 HTML */
  formHtml?: string;
  error?: {
    code: string;
    message: string;
  };
}

// 查询订单结果
export interface QueryOrderResult {
  success: boolean;
  /** 交易状态 */
  tradeState?: 'SUCCESS' | 'REFUND' | 'NOTPAY' | 'CLOSED' | 'USERPAYING' | 'PAYERROR';
  /** 第三方交易号 */
  transactionId?: string;
  /** 支付完成时间 */
  paidAt?: Date;
  error?: {
    code: string;
    message: string;
  };
}

// 退款参数
export interface RefundParams {
  /** 商户订单号 */
  outTradeNo: string;
  /** 商户退款单号 */
  outRefundNo: string;
  /** 退款金额 (分) */
  refundAmount: number;
  /** 原订单金额 (分) */
  totalAmount: number;
  /** 退款原因 */
  reason?: string;
}

// 退款结果
export interface RefundResult {
  success: boolean;
  /** 退款单号 */
  refundId?: string;
  error?: {
    code: string;
    message: string;
  };
}

// 回调通知数据
export interface PaymentNotification {
  /** 商户订单号 */
  outTradeNo: string;
  /** 第三方交易号 */
  transactionId: string;
  /** 交易状态 */
  tradeState: string;
  /** 支付金额 (分) */
  totalAmount: number;
  /** 支付时间 */
  paidAt: Date;
  /** 附加数据 */
  attach?: string;
  /** 原始数据 */
  raw: unknown;
}
