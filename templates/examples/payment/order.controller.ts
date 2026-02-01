import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { OrderService } from './order.service';

@Controller('examples/orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post('wechat/jsapi')
  async createWechatJsapiOrder(
    @Body() data: { orderId: string; amount: number; openid: string },
  ) {
    return this.orderService.createWechatJsapiOrder(
      data.orderId,
      data.amount,
      data.openid,
    );
  }

  @Post('wechat/native')
  async createWechatNativeOrder(
    @Body() data: { orderId: string; amount: number },
  ) {
    return this.orderService.createWechatNativeOrder(
      data.orderId,
      data.amount,
    );
  }

  @Post('alipay/page')
  async createAlipayPageOrder(
    @Body() data: { orderId: string; amount: number },
  ) {
    return this.orderService.createAlipayPageOrder(
      data.orderId,
      data.amount,
    );
  }

  @Get(':orderId/status')
  async queryOrderStatus(@Param('orderId') orderId: string) {
    return this.orderService.queryOrderStatus(orderId);
  }

  @Post(':orderId/refund')
  async refundOrder(
    @Param('orderId') orderId: string,
    @Body() data: { refundId: string; amount: number; reason?: string },
  ) {
    return this.orderService.refundOrder(
      orderId,
      data.refundId,
      data.amount,
      data.reason,
    );
  }
}
