# 短信功能示例

本示例展示如何使用 `@svton/nestjs-sms` 模块发送短信。

## 文件说明

- `sms.service.ts` - 短信服务，封装发送逻辑
- `verification.controller.ts` - 验证码控制器，提供发送和验证接口

## 核心功能

### 发送验证码

```typescript
await this.smsService.sendVerificationCode('13800138000', '123456');
```

### 发送通知短信

```typescript
await this.smsService.sendNotification('13800138000', {
  message: '您的订单已发货',
});
```

### 批量发送

```typescript
await this.smsService.sendBatch(
  ['13800138000', '13800138001'],
  'SMS_123456',
  { code: '123456' },
);
```

## 测试接口

```bash
# 发送验证码
curl -X POST http://localhost:3000/examples/verification/send-code \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"13800138000"}'

# 验证验证码
curl -X POST http://localhost:3000/examples/verification/verify-code \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber":"13800138000",
    "code":"123456"
  }'

# 发送通知短信
curl -X POST http://localhost:3000/examples/verification/send-notification \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber":"13800138000",
    "message":"您的订单已发货"
  }'
```

## 环境变量配置

在 `.env` 文件中配置：

```env
SMS_PROVIDER=aliyun
SMS_ACCESS_KEY_ID=your_access_key_id
SMS_ACCESS_KEY_SECRET=your_access_key_secret
SMS_SIGN_NAME=your_sign_name
```

## 短信模板配置

需要在阿里云/腾讯云后台配置短信模板：

1. 登录短信服务控制台
2. 创建短信模板
3. 等待审核通过
4. 将模板 ID 替换到代码中的 `SMS_123456`

## 最佳实践

1. **频率限制**：同一手机号 1 分钟内只能发送一次
2. **验证码有效期**：建议 5 分钟
3. **使用 Redis**：生产环境使用 Redis 存储验证码
4. **防刷机制**：添加图形验证码或滑块验证
5. **日志记录**：记录发送日志，便于排查问题

## 常见场景

### 注册验证

```typescript
// 1. 发送验证码
await this.smsService.sendVerificationCode(phoneNumber, code);

// 2. 用户输入验证码
// 3. 验证通过后创建账号
```

### 登录验证

```typescript
// 1. 发送验证码
await this.smsService.sendVerificationCode(phoneNumber, code);

// 2. 验证码验证通过后生成 token
```

### 订单通知

```typescript
await this.smsService.sendNotification(phoneNumber, {
  orderNo: 'ORDER_001',
  status: '已发货',
});
```

## 更多信息

查看官方文档：https://751848178.github.io/svton/packages/nestjs-sms
