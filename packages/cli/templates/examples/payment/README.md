# 支付功能示例

本示例展示如何使用 `@svton/nestjs-payment` 模块集成微信支付和支付宝。

## 文件说明

- `order.service.ts` - 订单服务，创建支付订单
- `order.controller.ts` - 订单控制器，提供支付接口
- `webhook.controller.ts` - 支付回调处理

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

## 使用方式

### 1. 创建支付订单

```typescript
// 微信 JSAPI 支付
const result = await this.paymentService.wechat.createOrder({
  outTradeNo: orderId,
  totalAmount: amount,
  description: '商品购买',
  userId: openid,
}, 'jsapi');

// 支付宝电脑网站支付
const result = await this.paymentService.alipay.createOrder({
  outTradeNo: orderId,
  totalAmount: amount,
  description: '商品购买',
}, 'page');
```

### 2. 查询订单状态

```typescript
const status = await this.paymentService.wechat.queryOrder(outTradeNo);
```

### 3. 申请退款

```typescript
const refund = await this.paymentService.wechat.refund({
  outTradeNo: orderId,
  outRefundNo: refundId,
  refundAmount: amount,
  totalAmount: totalAmount,
});
```

### 4. 处理支付回调

```typescript
@Post('webhook/wechat')
async wechatWebhook(@Req() req: Request) {
  const result = await this.paymentService.wechat.handleNotify(req);
  // 处理支付成功逻辑
  return { code: 'SUCCESS', message: '成功' };
}
```

## 测试接口

```bash
# 创建微信 JSAPI 支付订单
curl -X POST http://localhost:3000/examples/orders/wechat/jsapi \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORDER_001",
    "amount": 100,
    "openid": "oUpF8uMuAJO_M2pxb1Q9zNjWeS6o"
  }'

# 创建微信 Native 支付订单（扫码支付）
curl -X POST http://localhost:3000/examples/orders/wechat/native \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORDER_002",
    "amount": 100
  }'

# 创建支付宝电脑网站支付订单
curl -X POST http://localhost:3000/examples/orders/alipay/page \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORDER_003",
    "amount": 100
  }'

# 查询订单状态
curl http://localhost:3000/examples/orders/ORDER_001/status

# 申请退款
curl -X POST http://localhost:3000/examples/orders/ORDER_001/refund \
  -H "Content-Type: application/json" \
  -d '{
    "refundId": "REFUND_001",
    "amount": 100,
    "reason": "用户申请退款"
  }'
```

## 环境变量配置

在 `.env` 文件中配置：

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

## 最佳实践

1. **订单号唯一性**：确保 outTradeNo 全局唯一
2. **金额单位**：统一使用分为单位
3. **回调幂等性**：支付回调可能重复，需要幂等处理
4. **异步通知**：优先使用异步通知，不依赖同步返回
5. **安全验证**：验证回调签名，防止伪造
6. **错误处理**：妥善处理支付失败、超时等异常情况

## 回调地址配置

需要在微信支付和支付宝后台配置回调地址：

- 微信支付：`https://yourdomain.com/examples/webhooks/wechat`
- 支付宝：`https://yourdomain.com/examples/webhooks/alipay`

## 更多信息

查看官方文档：https://751848178.github.io/svton/packages/nestjs-payment
