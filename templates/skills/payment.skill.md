# 支付功能使用指南

本项目已集成 `@svton/nestjs-payment` 支付模块，支持微信支付和支付宝。

## 已安装的包

- `@svton/nestjs-payment` - 支付模块（微信支付 V3 + 支付宝）

## 配置文件

- `src/config/payment.config.ts` - 支付配置
- `.env` - 环境变量配置（商户信息、密钥等）

## 示例代码位置

查看 `src/examples/payment/` 目录获取完整示例：
- `order.service.ts` - 订单创建服务
- `order.controller.ts` - 支付接口
- `webhook.controller.ts` - 支付回调处理
- `README.md` - 详细说明文档

## 支持的支付方式

### 微信支付
- JSAPI 支付（公众号/小程序）
- Native 支付（扫码支付）
- APP 支付
- H5 支付
- 小程序支付

### 支付宝
- 电脑网站支付（PC）
- 手机网站支付（H5）
- APP 支付

## 核心 API

### 创建微信订单

```typescript
const result = await this.paymentService.wechat.createOrder({
  outTradeNo: orderId,
  totalAmount: amount,
  description: '商品购买',
  userId: openid,
}, 'jsapi');
```

### 创建支付宝订单

```typescript
const result = await this.paymentService.alipay.createOrder({
  outTradeNo: orderId,
  totalAmount: amount,
  description: '商品购买',
}, 'page');
```

### 查询订单状态

```typescript
const status = await this.paymentService.wechat.queryOrder(outTradeNo);
```

### 申请退款

```typescript
const refund = await this.paymentService.wechat.refund({
  outTradeNo: orderId,
  outRefundNo: refundId,
  refundAmount: amount,
  totalAmount: totalAmount,
});
```

## 回调处理

### 微信支付回调

```typescript
@Post('webhook/wechat')
async wechatWebhook(@Req() req: Request) {
  const result = await this.paymentService.wechat.handleNotify(req);
  // 处理支付成功逻辑
  return { code: 'SUCCESS', message: '成功' };
}
```

### 支付宝回调

```typescript
@Post('webhook/alipay')
async alipayWebhook(@Body() body: any) {
  const result = await this.paymentService.alipay.handleNotify(body);
  // 处理支付成功逻辑
  return 'success';
}
```

## 最佳实践

1. **订单号唯一性**：确保 outTradeNo 全局唯一
2. **金额单位**：统一使用分为单位
3. **回调幂等性**：支付回调可能重复，需要幂等处理
4. **异步通知**：优先使用异步通知，不依赖同步返回
5. **安全验证**：验证回调签名，防止伪造

## 环境变量配置

```env
# 微信支付
WECHAT_MCH_ID=商户号
WECHAT_PRIVATE_KEY=./certs/apiclient_key.pem
WECHAT_SERIAL_NO=证书序列号
WECHAT_API_V3_KEY=APIv3密钥
WECHAT_APP_ID=关联的AppID

# 支付宝
ALIPAY_APP_ID=应用ID
ALIPAY_PRIVATE_KEY=./certs/alipay_private_key.pem
ALIPAY_PUBLIC_KEY=./certs/alipay_public_key.pem
```

## 文档链接

- 官方文档：https://751848178.github.io/svton/packages/nestjs-payment
- 示例代码：`src/examples/payment/`
- 微信支付文档：https://pay.weixin.qq.com/wiki/doc/apiv3/
- 支付宝文档：https://opendocs.alipay.com/
