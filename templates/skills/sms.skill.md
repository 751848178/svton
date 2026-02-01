# 短信功能使用指南

本项目已集成 `@svton/nestjs-sms` 短信模块，支持阿里云和腾讯云。

## 已安装的包

- `@svton/nestjs-sms` - 短信发送模块

## 配置文件

- `src/config/sms.config.ts` - 短信配置
- `.env` - 环境变量配置

## 示例代码位置

查看 `src/examples/sms/` 目录获取完整示例。

## 核心 API

### 发送短信

```typescript
await this.smsService.send({
  phoneNumber: '13800138000',
  templateCode: 'SMS_123456',
  templateParams: { code: '123456' },
});
```

### 发送验证码

```typescript
await this.smsService.sendVerificationCode('13800138000', '123456');
```

## 文档链接

- 官方文档：https://751848178.github.io/svton/packages/nestjs-sms
- 示例代码：`src/examples/sms/`
