# @svton/nestjs-payment

NestJS 支付模块，支持微信支付和支付宝。

## 安装

```bash
pnpm add @svton/nestjs-payment
```

## 使用

### 模块注册

```typescript
import { Module } from '@nestjs/common';
import { PaymentModule } from '@svton/nestjs-payment';

@Module({
  imports: [
    PaymentModule.forRoot({
      wechat: {
        appId: 'wx...',
        mchId: '商户号',
        privateKey: '-----BEGIN PRIVATE KEY-----\n...',
        serialNo: '证书序列号',
        apiV3Key: 'APIv3密钥',
        notifyUrl: 'https://your-domain.com/pay/wechat/notify',
      },
      alipay: {
        appId: '支付宝应用ID',
        privateKey: '-----BEGIN PRIVATE KEY-----\n...',
        alipayPublicKey: '-----BEGIN PUBLIC KEY-----\n...',
        notifyUrl: 'https://your-domain.com/pay/alipay/notify',
      },
    }),
  ],
})
export class AppModule {}
```

### 微信支付

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { PaymentService } from '@svton/nestjs-payment';

@Controller('pay')
export class PayController {
  constructor(private readonly paymentService: PaymentService) {}

  // JSAPI 支付 (小程序/公众号)
  @Post('wechat/jsapi')
  async wechatJsapi(@Body() body: { orderId: string; openid: string }) {
    const result = await this.paymentService.wechat.createOrder({
      outTradeNo: body.orderId,
      totalAmount: 100, // 1 元 = 100 分
      description: '商品描述',
      userId: body.openid,
    }, 'jsapi');

    return result.prepayData; // 返回给前端调起支付
  }

  // Native 支付 (扫码)
  @Post('wechat/native')
  async wechatNative(@Body() body: { orderId: string }) {
    const result = await this.paymentService.wechat.createOrder({
      outTradeNo: body.orderId,
      totalAmount: 100,
      description: '商品描述',
    }, 'native');

    return { codeUrl: result.codeUrl }; // 生成二维码
  }
}
```

### 支付宝

```typescript
@Controller('pay')
export class PayController {
  // 电脑网站支付
  @Post('alipay/page')
  async alipayPage(@Body() body: { orderId: string }) {
    const result = await this.paymentService.alipay.createOrder({
      outTradeNo: body.orderId,
      totalAmount: 100,
      description: '商品描述',
    }, 'page');

    return { formHtml: result.formHtml }; // 返回表单 HTML
  }
}
```

### 回调通知

```typescript
@Controller('pay')
export class PayController {
  @Post('wechat/notify')
  async wechatNotify(@Headers() headers: any, @Body() body: string) {
    const notification = this.paymentService.wechat.verifyNotification(headers, body);
    if (!notification) {
      return { code: 'FAIL', message: '签名验证失败' };
    }

    // 处理支付成功逻辑
    await this.orderService.handlePaid(notification.outTradeNo);

    return { code: 'SUCCESS' };
  }

  @Post('alipay/notify')
  async alipayNotify(@Body() body: Record<string, string>) {
    const notification = this.paymentService.alipay.verifyNotification(body);
    if (!notification) {
      return 'fail';
    }

    await this.orderService.handlePaid(notification.outTradeNo);
    return 'success';
  }
}
```

## 支付类型

### 微信支付

| 类型 | 说明 |
|------|------|
| `jsapi` | JSAPI 支付 (公众号/小程序) |
| `native` | Native 支付 (扫码) |
| `app` | APP 支付 |
| `h5` | H5 支付 |

### 支付宝

| 类型 | 说明 |
|------|------|
| `page` | 电脑网站支付 |
| `wap` | 手机网站支付 |
| `app` | APP 支付 |

## License

MIT
