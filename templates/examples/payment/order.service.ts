import { Injectable } from '@nestjs/common';
import { PaymentService } from '@svton/nestjs-payment';

@Injectable()
export class OrderService {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * 创建微信 JSAPI 支付订单（公众号/小程序）
   */
  async createWechatJsapiOrder(
    orderId: string,
    amount: number,
    openid: string,
  ) {
    const result = await this.paymentService.wechat.createOrder(
      {
        outTradeNo: orderId,
        totalAmount: amount,
        description: '商品购买',
        userId: openid,
      },
      'jsapi',
    );

    return {
      orderId,
      paymentData: result,
    };
  }

  /**
   * 创建微信 Native 支付订单（扫码支付）
   */
  async createWechatNativeOrder(orderId: string, amount: number) {
    const result = await this.paymentService.wechat.createOrder(
      {
        outTradeNo: orderId,
        totalAmount: amount,
        description: '商品购买',
      },
      'native',
    );

    return {
      orderId,
      qrCode: result.code_url, // 二维码链接
    };
  }

  /**
   * 创建支付宝电脑网站支付订单
   */
  async createAlipayPageOrder(orderId: string, amount: number) {
    const result = await this.paymentService.alipay.createOrder(
      {
        outTradeNo: orderId,
        totalAmount: amount,
        description: '商品购买',
      },
      'page',
    );

    return {
      orderId,
      paymentUrl: result, // 支付页面 URL
    };
  }

  /**
   * 查询订单状态
   */
  async queryOrderStatus(orderId: string) {
    try {
      // 先尝试查询微信支付
      const wechatStatus = await this.paymentService.wechat.queryOrder(orderId);
      return {
        orderId,
        provider: 'wechat',
        status: wechatStatus.trade_state,
        data: wechatStatus,
      };
    } catch (wechatError) {
      // 如果微信查询失败，尝试支付宝
      try {
        const alipayStatus = await this.paymentService.alipay.queryOrder(orderId);
        return {
          orderId,
          provider: 'alipay',
          status: alipayStatus.trade_status,
          data: alipayStatus,
        };
      } catch (alipayError) {
        // 两个都失败，返回详细错误信息
        throw new Error(
          `Failed to query order ${orderId}. ` +
          `Wechat error: ${wechatError instanceof Error ? wechatError.message : 'Unknown'}. ` +
          `Alipay error: ${alipayError instanceof Error ? alipayError.message : 'Unknown'}`,
        );
      }
    }
  }

  /**
   * 申请退款
   */
  async refundOrder(
    orderId: string,
    refundId: string,
    amount: number,
    reason?: string,
  ) {
    // TODO: 从数据库查询订单信息，确定支付方式和总金额
    const totalAmount = amount; // 实际应从数据库获取

    // 这里假设是微信支付，实际应根据订单信息判断
    const result = await this.paymentService.wechat.refund({
      outTradeNo: orderId,
      outRefundNo: refundId,
      refundAmount: amount,
      totalAmount: totalAmount,
      reason: reason || '用户申请退款',
    });

    return {
      orderId,
      refundId,
      status: result.status,
      data: result,
    };
  }
}
