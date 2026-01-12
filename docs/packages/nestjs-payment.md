# @svton/nestjs-payment

> NestJS 支付模块 - 微信支付 & 支付宝集成

---

## 📦 包信息

| 属性 | 值 |
|------|---|
| **包名** | `@svton/nestjs-payment` |
| **版本** | `1.1.0` |
| **入口** | `dist/index.js` (CJS) / `dist/index.mjs` (ESM) |
| **类型** | `dist/index.d.ts` |

---

## 🎯 设计原则

1. **双平台支持** - 微信支付 V3 API + 支付宝
2. **统一接口** - 不同支付方式使用相同的 API 风格
3. **安全可靠** - 内置签名验证和回调处理

---

## 🚀 快速开始

### 安装

```bash
pnpm add @svton/nestjs-payment
```

### 模块注册

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { PaymentModule } from '@svton/nestjs-payment';

@Module({
  imports: [
    PaymentModule.forRoot({
      wechat: {
        mchId: '商户号',
        privateKey: '商户 API 私钥',
        serialNo: '商户 API 证书序列号',
        apiV3Key: 'APIv3 密钥',
        appId: '关联的 AppID',
        notifyUrl: 'https://example.com/payment/wechat/notify',
        platformCert: '微信支付平台证书（可选，用于验签）',
      },
      alipay: {
        appId: '应用 ID',
        privateKey: '应用私钥',
        alipayPublicKey: '支付宝公钥',
        notifyUrl: 'https://example.com/payment/alipay/notify',
        returnUrl: 'https://example.com/payment/success',
        sandbox: false,
      },
    }),
  ],
})
export class AppModule {}
```

### 异步配置

```typescript
PaymentModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    wechat: {
      mchId: config.get('WECHAT_MCH_ID'),
      privateKey: config.get('WECHAT_PRIVATE_KEY'),
      serialNo: config.get('WECHAT_SERIAL_NO'),
      apiV3Key: config.get('WECHAT_API_V3_KEY'),
      appId: config.get('WECHAT_APP_ID'),
      notifyUrl: config.get('WECHAT_NOTIFY_URL'),
    },
    alipay: {
      appId: config.get('ALIPAY_APP_ID'),
      privateKey: config.get('ALIPAY_PRIVATE_KEY'),
      alipayPublicKey: config.get('ALIPAY_PUBLIC_KEY'),
      notifyUrl: config.get('ALIPAY_NOTIFY_URL'),
    },
  }),
});
```

---

## ⚙️ 配置选项

### WechatPayConfig

| 选项 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `mchId` | `string` | ✅ | 商户号 |
| `privateKey` | `string` | ✅ | 商户 API 私钥 |
| `serialNo` | `string` | ✅ | 商户 API 证书序列号 |
| `apiV3Key` | `string` | ✅ | APIv3 密钥 |
| `appId` | `string` | ✅ | 关联的 AppID |
| `notifyUrl` | `string` | - | 回调通知地址 |
| `platformCert` | `string` | - | 微信支付平台证书 |

### AlipayConfig

| 选项 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `appId` | `string` | ✅ | 应用 ID |
| `privateKey` | `string` | ✅ | 应用私钥 |
| `alipayPublicKey` | `string` | ✅ | 支付宝公钥 |
| `notifyUrl` | `string` | - | 回调通知地址 |
| `returnUrl` | `string` | - | 同步跳转地址 |
| `sandbox` | `boolean` | - | 是否沙箱环境 |

---

## 🔧 使用方法

### PaymentService

```typescript
import { Injectable } from '@nestjs/common';
import { PaymentService } from '@svton/nestjs-payment';

@Injectable()
export class OrderService {
  constructor(private paymentService: PaymentService) {}

  // 使用微信支付
  async payWithWechat(orderId: string, amount: number, openid: string) {
    const result = await this.paymentService.wechat.createOrder({
      outTradeNo: orderId,
      totalAmount: amount, // 单位：分
      description: '商品购买',
      userId: openid,
    }, 'jsapi');

    return result;
  }

  // 使用支付宝
  async payWithAlipay(orderId: string, amount: number) {
    const result = await this.paymentService.alipay.createOrder({
      outTradeNo: orderId,
      totalAmount: amount, // 单位：分
      description: '商品购买',
    }, 'page');

    return result;
  }
}
```

---

## 💳 微信支付

### 支付类型

| 类型 | 说明 | 返回值 |
|------|------|--------|
| `jsapi` | JSAPI 支付（公众号/小程序） | `prepayData` |
| `native` | Native 支付（扫码） | `codeUrl` |
| `app` | APP 支付 | `prepayData` |
| `h5` | H5 支付 | `h5Url` |
| `miniprogram` | 小程序支付 | `prepayData` |

### JSAPI 支付（公众号/小程序）

```typescript
@Controller('payment/wechat')
export class WechatPayController {
  constructor(private paymentService: PaymentService) {}

  @Post('jsapi')
  async createJsapiOrder(@Body() dto: CreateOrderDto, @User() user: UserEntity) {
    const result = await this.paymentService.wechat.createOrder({
      outTradeNo: dto.orderId,
      totalAmount: dto.amount,
      description: dto.description,
      userId: user.openid, // 用户 openid
    }, 'jsapi');

    if (!result.success) {
      throw new BadRequestException(result.error?.message);
    }

    // 返回给前端调起支付
    return result.prepayData;
  }
}
```

前端调起支付：

```typescript
// 小程序
wx.requestPayment({
  ...prepayData,
  success: () => console.log('支付成功'),
  fail: () => console.log('支付失败'),
});

// 公众号
WeixinJSBridge.invoke('getBrandWCPayRequest', prepayData, (res) => {
  if (res.err_msg === 'get_brand_wcpay_request:ok') {
    console.log('支付成功');
  }
});
```

### Native 支付（扫码）

```typescript
@Post('native')
async createNativeOrder(@Body() dto: CreateOrderDto) {
  const result = await this.paymentService.wechat.createOrder({
    outTradeNo: dto.orderId,
    totalAmount: dto.amount,
    description: dto.description,
  }, 'native');

  if (!result.success) {
    throw new BadRequestException(result.error?.message);
  }

  // 返回二维码链接
  return { codeUrl: result.codeUrl };
}
```

### H5 支付

```typescript
@Post('h5')
async createH5Order(@Body() dto: CreateOrderDto) {
  const result = await this.paymentService.wechat.createOrder({
    outTradeNo: dto.orderId,
    totalAmount: dto.amount,
    description: dto.description,
  }, 'h5');

  if (!result.success) {
    throw new BadRequestException(result.error?.message);
  }

  // 返回 H5 支付链接
  return { h5Url: result.h5Url };
}
```

### 查询订单

```typescript
async queryOrder(orderId: string) {
  const result = await this.paymentService.wechat.queryOrder(orderId);
  
  if (!result.success) {
    throw new BadRequestException(result.error?.message);
  }

  return {
    tradeState: result.tradeState,
    transactionId: result.transactionId,
    paidAt: result.paidAt,
  };
}
```

### 关闭订单

```typescript
async closeOrder(orderId: string) {
  const result = await this.paymentService.wechat.closeOrder(orderId);
  
  if (!result.success) {
    throw new BadRequestException(result.error?.message);
  }

  return { success: true };
}
```

### 申请退款

```typescript
async refund(orderId: string, refundNo: string, refundAmount: number, totalAmount: number) {
  const result = await this.paymentService.wechat.refund({
    outTradeNo: orderId,
    outRefundNo: refundNo,
    refundAmount,
    totalAmount,
    reason: '用户申请退款',
  });

  if (!result.success) {
    throw new BadRequestException(result.error?.message);
  }

  return { refundId: result.refundId };
}
```

### 处理回调通知

```typescript
@Post('notify')
async handleNotify(@Headers() headers: Record<string, string>, @Body() body: string) {
  const notification = this.paymentService.wechat.verifyNotification(headers, body);
  
  if (!notification) {
    throw new BadRequestException('Invalid notification');
  }

  // 处理支付成功
  await this.orderService.handlePaymentSuccess({
    orderId: notification.outTradeNo,
    transactionId: notification.transactionId,
    amount: notification.totalAmount,
    paidAt: notification.paidAt,
  });

  return { code: 'SUCCESS', message: '成功' };
}
```

---

## 💰 支付宝

### 支付类型

| 类型 | 说明 | 返回值 |
|------|------|--------|
| `page` | 电脑网站支付 | `formHtml` |
| `wap` | 手机网站支付 | `formHtml` |
| `app` | APP 支付 | `prepayData.orderStr` |

### 电脑网站支付

```typescript
@Post('page')
async createPageOrder(@Body() dto: CreateOrderDto) {
  const result = await this.paymentService.alipay.createOrder({
    outTradeNo: dto.orderId,
    totalAmount: dto.amount,
    description: dto.description,
  }, 'page');

  if (!result.success) {
    throw new BadRequestException(result.error?.message);
  }

  // 返回表单 HTML，前端直接渲染并提交
  return { formHtml: result.formHtml };
}
```

### 手机网站支付

```typescript
@Post('wap')
async createWapOrder(@Body() dto: CreateOrderDto) {
  const result = await this.paymentService.alipay.createOrder({
    outTradeNo: dto.orderId,
    totalAmount: dto.amount,
    description: dto.description,
  }, 'wap');

  return { formHtml: result.formHtml };
}
```

### APP 支付

```typescript
@Post('app')
async createAppOrder(@Body() dto: CreateOrderDto) {
  const result = await this.paymentService.alipay.createOrder({
    outTradeNo: dto.orderId,
    totalAmount: dto.amount,
    description: dto.description,
  }, 'app');

  // 返回签名后的参数字符串
  return { orderStr: result.prepayData?.orderStr };
}
```

### 处理回调通知

```typescript
@Post('notify')
async handleNotify(@Body() params: Record<string, string>) {
  const notification = this.paymentService.alipay.verifyNotification(params);
  
  if (!notification) {
    return 'fail';
  }

  // 处理支付成功
  await this.orderService.handlePaymentSuccess({
    orderId: notification.outTradeNo,
    transactionId: notification.transactionId,
    amount: notification.totalAmount,
    paidAt: notification.paidAt,
  });

  return 'success';
}
```

---

## 📋 类型定义

### CreateOrderParams

```typescript
interface CreateOrderParams {
  outTradeNo: string;      // 商户订单号
  totalAmount: number;     // 订单金额（分）
  description: string;     // 商品描述
  userId?: string;         // 用户标识（微信 openid）
  attach?: string;         // 附加数据
  expireTime?: Date;       // 订单过期时间
}
```

### CreateOrderResult

```typescript
interface CreateOrderResult {
  success: boolean;
  prepayData?: Record<string, string>;  // 调起支付参数
  codeUrl?: string;                     // 二维码链接
  h5Url?: string;                       // H5 支付链接
  formHtml?: string;                    // 支付宝表单 HTML
  error?: { code: string; message: string };
}
```

### PaymentNotification

```typescript
interface PaymentNotification {
  outTradeNo: string;      // 商户订单号
  transactionId: string;   // 第三方交易号
  tradeState: string;      // 交易状态
  totalAmount: number;     // 支付金额（分）
  paidAt: Date;            // 支付时间
  attach?: string;         // 附加数据
  raw: unknown;            // 原始数据
}
```

---

## ✅ 最佳实践

1. **订单号唯一性**
   ```typescript
   const orderId = `${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
   ```

2. **金额单位统一**
   ```typescript
   // 统一使用分作为单位
   const amount = Math.round(price * 100);
   ```

3. **回调幂等处理**
   ```typescript
   async handlePaymentSuccess(notification: PaymentNotification) {
     const order = await this.orderRepo.findOne({ orderId: notification.outTradeNo });
     if (order.status === 'paid') {
       return; // 已处理，直接返回
     }
     // 处理支付成功...
   }
   ```

4. **主动查询订单状态**
   ```typescript
   // 回调可能延迟，主动查询确认
   const result = await this.paymentService.wechat.queryOrder(orderId);
   ```

5. **安全存储密钥**
   ```typescript
   // 使用环境变量或密钥管理服务
   privateKey: process.env.WECHAT_PRIVATE_KEY,
   ```

---

**相关文档**: [@svton/nestjs-oauth](./nestjs-oauth.md) | [后端模块开发](../backend/modules.md)
