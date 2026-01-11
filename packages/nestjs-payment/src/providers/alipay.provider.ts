import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import type {
  AlipayConfig,
  AlipayType,
  CreateOrderParams,
  CreateOrderResult,
  QueryOrderResult,
  RefundParams,
  RefundResult,
  PaymentNotification,
} from '../interfaces';
import { ALIPAY_ENDPOINTS } from '../constants';

@Injectable()
export class AlipayProvider {
  private readonly logger = new Logger(AlipayProvider.name);
  private config?: AlipayConfig;

  setConfig(config: AlipayConfig): void {
    this.config = config;
  }

  /**
   * 创建订单
   */
  async createOrder(
    params: CreateOrderParams,
    payType: AlipayType = 'page',
  ): Promise<CreateOrderResult> {
    if (!this.config) {
      return { success: false, error: { code: 'NO_CONFIG', message: 'Alipay not configured' } };
    }

    try {
      const method = this.getMethod(payType);
      const bizContent = {
        out_trade_no: params.outTradeNo,
        total_amount: (params.totalAmount / 100).toFixed(2), // 转换为元
        subject: params.description,
        product_code: this.getProductCode(payType),
        ...(params.attach && { passback_params: encodeURIComponent(params.attach) }),
        ...(params.expireTime && { time_expire: this.formatTime(params.expireTime) }),
      };

      const formData = this.buildRequestParams(method, bizContent);

      if (payType === 'app') {
        // APP 支付返回签名后的参数字符串
        return { success: true, prepayData: { orderStr: this.buildQueryString(formData) } };
      }

      // 网页/H5 支付返回表单 HTML
      const gateway = this.config.sandbox ? ALIPAY_ENDPOINTS.GATEWAY_SANDBOX : ALIPAY_ENDPOINTS.GATEWAY;
      const formHtml = this.buildFormHtml(gateway, formData);
      return { success: true, formHtml };
    } catch (error) {
      this.logger.error('Alipay createOrder failed', error);
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
      return { success: false, error: { code: 'NO_CONFIG', message: 'Alipay not configured' } };
    }

    try {
      const bizContent = { out_trade_no: outTradeNo };
      const response = await this.execute<{
        trade_status: string;
        trade_no: string;
        send_pay_date?: string;
      }>('alipay.trade.query', bizContent);

      const tradeStatus = response.trade_status;
      let tradeState: QueryOrderResult['tradeState'];

      switch (tradeStatus) {
        case 'TRADE_SUCCESS':
        case 'TRADE_FINISHED':
          tradeState = 'SUCCESS';
          break;
        case 'WAIT_BUYER_PAY':
          tradeState = 'NOTPAY';
          break;
        case 'TRADE_CLOSED':
          tradeState = 'CLOSED';
          break;
        default:
          tradeState = 'NOTPAY';
      }

      return {
        success: true,
        tradeState,
        transactionId: response.trade_no,
        paidAt: response.send_pay_date ? new Date(response.send_pay_date) : undefined,
      };
    } catch (error) {
      this.logger.error('Alipay queryOrder failed', error);
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
      return { success: false, error: { code: 'NO_CONFIG', message: 'Alipay not configured' } };
    }

    try {
      const bizContent = { out_trade_no: outTradeNo };
      await this.execute('alipay.trade.close', bizContent);
      return { success: true };
    } catch (error) {
      this.logger.error('Alipay closeOrder failed', error);
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
      return { success: false, error: { code: 'NO_CONFIG', message: 'Alipay not configured' } };
    }

    try {
      const bizContent = {
        out_trade_no: params.outTradeNo,
        out_request_no: params.outRefundNo,
        refund_amount: (params.refundAmount / 100).toFixed(2),
        ...(params.reason && { refund_reason: params.reason }),
      };

      const response = await this.execute<{ trade_no: string }>('alipay.trade.refund', bizContent);
      return { success: true, refundId: response.trade_no };
    } catch (error) {
      this.logger.error('Alipay refund failed', error);
      return {
        success: false,
        error: { code: 'REFUND_FAILED', message: (error as Error).message },
      };
    }
  }

  /**
   * 验证回调通知
   */
  verifyNotification(params: Record<string, string>): PaymentNotification | null {
    if (!this.config) return null;

    try {
      const sign = params.sign;
      const signType = params.sign_type || 'RSA2';

      // 构建待验签字符串
      const sortedParams = Object.keys(params)
        .filter((key) => key !== 'sign' && key !== 'sign_type' && params[key])
        .sort()
        .map((key) => `${key}=${params[key]}`)
        .join('&');

      // 验证签名
      const verify = crypto.createVerify(signType === 'RSA2' ? 'RSA-SHA256' : 'RSA-SHA1');
      verify.update(sortedParams);
      const isValid = verify.verify(this.config.alipayPublicKey, sign, 'base64');

      if (!isValid) {
        this.logger.warn('Alipay notification signature invalid');
        return null;
      }

      return {
        outTradeNo: params.out_trade_no,
        transactionId: params.trade_no,
        tradeState: params.trade_status,
        totalAmount: Math.round(parseFloat(params.total_amount) * 100),
        paidAt: new Date(params.gmt_payment),
        attach: params.passback_params ? decodeURIComponent(params.passback_params) : undefined,
        raw: params,
      };
    } catch (error) {
      this.logger.error('Alipay verifyNotification failed', error);
      return null;
    }
  }

  private async execute<T = Record<string, string>>(method: string, bizContent: Record<string, unknown>): Promise<T> {
    const params = this.buildRequestParams(method, bizContent);
    const gateway = this.config!.sandbox ? ALIPAY_ENDPOINTS.GATEWAY_SANDBOX : ALIPAY_ENDPOINTS.GATEWAY;

    const response = await fetch(`${gateway}?${this.buildQueryString(params)}`);
    const data = await response.json() as Record<string, Record<string, unknown>>;

    const responseKey = method.replace(/\./g, '_') + '_response';
    const result = data[responseKey] as Record<string, unknown>;

    if (result.code !== '10000') {
      throw new Error(`${result.code}: ${result.msg} - ${result.sub_msg || ''}`);
    }

    return result as T;
  }

  private buildRequestParams(method: string, bizContent: Record<string, unknown>): Record<string, string> {
    const params: Record<string, string> = {
      app_id: this.config!.appId,
      method,
      format: 'JSON',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: this.formatTime(new Date()),
      version: '1.0',
      biz_content: JSON.stringify(bizContent),
    };

    if (this.config!.notifyUrl) {
      params.notify_url = this.config!.notifyUrl;
    }
    if (this.config!.returnUrl) {
      params.return_url = this.config!.returnUrl;
    }

    // 签名
    params.sign = this.sign(params);

    return params;
  }

  private sign(params: Record<string, string>): string {
    const sortedStr = Object.keys(params)
      .filter((key) => params[key])
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&');

    const sign = crypto.createSign('RSA-SHA256');
    sign.update(sortedStr);
    return sign.sign(this.config!.privateKey, 'base64');
  }

  private buildQueryString(params: Record<string, string>): string {
    return Object.keys(params)
      .map((key) => `${key}=${encodeURIComponent(params[key])}`)
      .join('&');
  }

  private buildFormHtml(gateway: string, params: Record<string, string>): string {
    const inputs = Object.keys(params)
      .map((key) => `<input type="hidden" name="${key}" value="${params[key].replace(/"/g, '&quot;')}" />`)
      .join('\n');

    return `
      <form id="alipay_form" action="${gateway}" method="POST">
        ${inputs}
      </form>
      <script>document.getElementById('alipay_form').submit();</script>
    `;
  }

  private getMethod(payType: AlipayType): string {
    switch (payType) {
      case 'page':
        return 'alipay.trade.page.pay';
      case 'wap':
        return 'alipay.trade.wap.pay';
      case 'app':
        return 'alipay.trade.app.pay';
      default:
        return 'alipay.trade.page.pay';
    }
  }

  private getProductCode(payType: AlipayType): string {
    switch (payType) {
      case 'page':
        return 'FAST_INSTANT_TRADE_PAY';
      case 'wap':
        return 'QUICK_WAP_WAY';
      case 'app':
        return 'QUICK_MSECURITY_PAY';
      default:
        return 'FAST_INSTANT_TRADE_PAY';
    }
  }

  private formatTime(date: Date): string {
    return date.toISOString().replace('T', ' ').substring(0, 19);
  }
}
