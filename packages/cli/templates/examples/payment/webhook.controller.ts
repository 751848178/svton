import { Controller, Post, Req, Body, HttpCode } from '@nestjs/common';
import { Request } from 'express';
import { PaymentService } from '@svton/nestjs-payment';

@Controller('examples/webhooks')
export class WebhookController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * 微信支付回调
   */
  @Post('wechat')
  @HttpCode(200)
  async wechatWebhook(@Req() req: Request) {
    try {
      const result = await this.paymentService.wechat.handleNotify(req);

      console.log('Wechat payment notification:', result);

      // TODO: 处理支付成功逻辑
      // 1. 验证订单状态
      // 2. 更新订单状态
      // 3. 发送通知给用户
      // 4. 触发后续业务流程

      const { out_trade_no, transaction_id, trade_state } = result;

      if (trade_state === 'SUCCESS') {
        console.log(`Order ${out_trade_no} paid successfully`);
        // await this.orderService.markAsPaid(out_trade_no, transaction_id);
      }

      // 返回成功响应
      return {
        code: 'SUCCESS',
        message: '成功',
      };
    } catch (error) {
      console.error('Wechat webhook error:', error);
      return {
        code: 'FAIL',
        message: error.message,
      };
    }
  }

  /**
   * 支付宝支付回调
   */
  @Post('alipay')
  @HttpCode(200)
  async alipayWebhook(@Body() body: any) {
    try {
      const result = await this.paymentService.alipay.handleNotify(body);

      console.log('Alipay payment notification:', result);

      // TODO: 处理支付成功逻辑
      const { out_trade_no, trade_no, trade_status } = result;

      if (trade_status === 'TRADE_SUCCESS') {
        console.log(`Order ${out_trade_no} paid successfully`);
        // await this.orderService.markAsPaid(out_trade_no, trade_no);
      }

      // 返回成功响应（支付宝要求返回 success 字符串）
      return 'success';
    } catch (error) {
      console.error('Alipay webhook error:', error);
      return 'fail';
    }
  }
}
