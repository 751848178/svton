import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import type {
  WechatPayConfig,
  WechatPayType,
  CreateOrderParams,
  CreateOrderResult,
  QueryOrderResult,
  RefundParams,
  RefundResult,
  PaymentNotification,
} from '../interfaces';
import { WECHAT_PAY_ENDPOINTS } from '../constants';

@Injectable()
export class WechatPayProvider {
  private readonly logger = new Logger(WechatPayProvider.name);
  private config?: WechatPayConfig;
  private http: AxiosInstance;

  constructor() {
    this.http = axios.create({ timeout: 10000 });
  }

  setConfig(config: WechatPayConfig): void {
    this.config = config;
  }

  /**
   * 创建订单
   */
  async createOrder(
    params: CreateOrderParams,
    payType: WechatPayType = 'jsapi',
  ): Promise<CreateOrderResult> {
    if (!this.config) {
      return { success: false, error: { code: 'NO_CONFIG', message: 'WechatPay not configured' } };
    }

    try {
      const url = `${WECHAT_PAY_ENDPOINTS.UNIFIED_ORDER}/${payType}`;
      const body: Record<string, unknown> = {
        appid: this.config.appId,
        mchid: this.config.mchId,
        description: params.description,
        out_trade_no: params.outTradeNo,
        notify_url: this.config.notifyUrl,
        amount: {
          total: params.totalAmount,
          currency: 'CNY',
        },
        ...(params.userId && payType === 'jsapi' && { payer: { openid: params.userId } }),
        ...(params.attach && { attach: params.attach }),
        ...(params.expireTime && { time_expire: params.expireTime.toISOString() }),
      };

      const response = await this.request<{ code_url?: string; h5_url?: string; prepay_id?: string }>('POST', url, body);

      if (payType === 'native') {
        return { success: true, codeUrl: response.code_url };
      }

      if (payType === 'h5') {
        return { success: true, h5Url: response.h5_url };
      }

      // JSAPI / APP / 小程序需要返回调起支付的参数
      const prepayData = this.buildPrepayData(response.prepay_id!, payType);
      return { success: true, prepayData };
    } catch (error) {
      this.logger.error('WechatPay createOrder failed', error);
      return {
        success: false,
        error: { code: 'CREATE_ORDER_FAILED', message: (error as Error).message },
      };
    }
  }

  /**
   * 查询订单
   */
  async queryOrder(outTradeNo: string): Promise<QueryOrderResult> {
    if (!this.config) {
      return { success: false, error: { code: 'NO_CONFIG', message: 'WechatPay not configured' } };
    }

    try {
      const url = `${WECHAT_PAY_ENDPOINTS.QUERY_ORDER}/out-trade-no/${outTradeNo}?mchid=${this.config.mchId}`;
      const response = await this.request<{
        trade_state: QueryOrderResult['tradeState'];
        transaction_id: string;
        success_time?: string;
      }>('GET', url);

      return {
        success: true,
        tradeState: response.trade_state,
        transactionId: response.transaction_id,
        paidAt: response.success_time ? new Date(response.success_time) : undefined,
      };
    } catch (error) {
      this.logger.error('WechatPay queryOrder failed', error);
      return {
        success: false,
        error: { code: 'QUERY_ORDER_FAILED', message: (error as Error).message },
      };
    }
  }

  /**
   * 关闭订单
   */
  async closeOrder(outTradeNo: string): Promise<{ success: boolean; error?: { code: string; message: string } }> {
    if (!this.config) {
      return { success: false, error: { code: 'NO_CONFIG', message: 'WechatPay not configured' } };
    }

    try {
      const url = `${WECHAT_PAY_ENDPOINTS.CLOSE_ORDER}/out-trade-no/${outTradeNo}/close`;
      await this.request('POST', url, { mchid: this.config.mchId });
      return { success: true };
    } catch (error) {
      this.logger.error('WechatPay closeOrder failed', error);
      return {
        success: false,
        error: { code: 'CLOSE_ORDER_FAILED', message: (error as Error).message },
      };
    }
  }

  /**
   * 申请退款
   */
  async refund(params: RefundParams): Promise<RefundResult> {
    if (!this.config) {
      return { success: false, error: { code: 'NO_CONFIG', message: 'WechatPay not configured' } };
    }

    try {
      const body = {
        out_trade_no: params.outTradeNo,
        out_refund_no: params.outRefundNo,
        reason: params.reason,
        amount: {
          refund: params.refundAmount,
          total: params.totalAmount,
          currency: 'CNY',
        },
      };

      const response = await this.request<{ refund_id: string }>('POST', WECHAT_PAY_ENDPOINTS.REFUND, body);
      return { success: true, refundId: response.refund_id };
    } catch (error) {
      this.logger.error('WechatPay refund failed', error);
      return {
        success: false,
        error: { code: 'REFUND_FAILED', message: (error as Error).message },
      };
    }
  }

  /**
   * 验证回调通知
   */
  verifyNotification(
    headers: Record<string, string>,
    body: string,
  ): PaymentNotification | null {
    if (!this.config) return null;

    try {
      // 验证签名
      const timestamp = headers['wechatpay-timestamp'];
      const nonce = headers['wechatpay-nonce'];
      const signature = headers['wechatpay-signature'];
      const serial = headers['wechatpay-serial'];

      const message = `${timestamp}\n${nonce}\n${body}\n`;

      if (this.config.platformCert) {
        const verify = crypto.createVerify('RSA-SHA256');
        verify.update(message);
        const isValid = verify.verify(this.config.platformCert, signature, 'base64');
        if (!isValid) {
          this.logger.warn('WechatPay notification signature invalid');
          return null;
        }
      }

      // 解密数据
      const data = JSON.parse(body);
      const resource = data.resource;
      const decrypted = this.decryptResource(resource);

      return {
        outTradeNo: decrypted.out_trade_no,
        transactionId: decrypted.transaction_id,
        tradeState: decrypted.trade_state,
        totalAmount: decrypted.amount.total,
        paidAt: new Date(decrypted.success_time),
        attach: decrypted.attach,
        raw: decrypted,
      };
    } catch (error) {
      this.logger.error('WechatPay verifyNotification failed', error);
      return null;
    }
  }

  private async request<T = Record<string, string>>(method: string, url: string, body?: unknown): Promise<T> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(16).toString('hex');
    const signature = this.sign(method, url, timestamp, nonce, body);

    const { data } = await this.http.request({
      method,
      url,
      data: body,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `WECHATPAY2-SHA256-RSA2048 mchid="${this.config!.mchId}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${this.config!.serialNo}",signature="${signature}"`,
      },
    });

    return data as T;
  }

  private sign(method: string, url: string, timestamp: string, nonce: string, body?: unknown): string {
    const urlObj = new URL(url);
    const path = urlObj.pathname + urlObj.search;
    const bodyStr = body ? JSON.stringify(body) : '';
    const message = `${method}\n${path}\n${timestamp}\n${nonce}\n${bodyStr}\n`;

    const sign = crypto.createSign('RSA-SHA256');
    sign.update(message);
    return sign.sign(this.config!.privateKey, 'base64');
  }

  private buildPrepayData(prepayId: string, payType: WechatPayType): Record<string, string> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(16).toString('hex');

    let packageStr = `prepay_id=${prepayId}`;
    let signType = 'RSA';

    const message = `${this.config!.appId}\n${timestamp}\n${nonce}\n${packageStr}\n`;
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(message);
    const paySign = sign.sign(this.config!.privateKey, 'base64');

    return {
      appId: this.config!.appId,
      timeStamp: timestamp,
      nonceStr: nonce,
      package: packageStr,
      signType,
      paySign,
    };
  }

  private decryptResource(resource: { ciphertext: string; nonce: string; associated_data: string }): {
    out_trade_no: string;
    transaction_id: string;
    trade_state: string;
    amount: { total: number };
    success_time: string;
    attach?: string;
  } {
    const key = Buffer.from(this.config!.apiV3Key);
    const nonce = Buffer.from(resource.nonce);
    const associatedData = Buffer.from(resource.associated_data);
    const ciphertext = Buffer.from(resource.ciphertext, 'base64');

    const authTag = ciphertext.slice(-16);
    const data = ciphertext.slice(0, -16);

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAuthTag(authTag);
    decipher.setAAD(associatedData);

    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8'));
  }
}
