# @svton/nestjs-sms

> NestJS 短信模块 - 多厂商适配器支持

---

## 📦 包信息

| 属性 | 值 |
|------|---|
| **包名** | `@svton/nestjs-sms` |
| **版本** | `1.2.0` |
| **入口** | `dist/index.js` (CJS) / `dist/index.mjs` (ESM) |
| **类型** | `dist/index.d.ts` |

---

## 🎯 设计原则

1. **适配器模式** - 统一接口，支持多厂商切换
2. **类型安全** - 完整的 TypeScript 类型定义
3. **易于扩展** - 简单实现自定义适配器

---

## 🚀 快速开始

### 安装

```bash
pnpm add @svton/nestjs-sms
# 安装对应厂商适配器（如有）
```

### 模块注册

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { SmsModule } from '@svton/nestjs-sms';
import { AliyunSmsAdapter } from './adapters/aliyun-sms.adapter';

@Module({
  imports: [
    SmsModule.forRoot({
      defaultSignName: '我的应用',
      adapter: new AliyunSmsAdapter({
        accessKeyId: 'your-access-key',
        accessKeySecret: 'your-secret',
        signName: '我的应用',
      }),
    }),
  ],
})
export class AppModule {}
```

### 异步配置

```typescript
SmsModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    defaultSignName: config.get('SMS_SIGN_NAME'),
    adapter: new AliyunSmsAdapter({
      accessKeyId: config.get('ALIYUN_ACCESS_KEY'),
      accessKeySecret: config.get('ALIYUN_SECRET'),
      signName: config.get('SMS_SIGN_NAME'),
    }),
  }),
});
```

---

## 🔧 使用方法

### 注入 SmsClient

```typescript
import { Injectable } from '@nestjs/common';
import { InjectSms, SmsClient } from '@svton/nestjs-sms';

@Injectable()
export class AuthService {
  constructor(@InjectSms() private sms: SmsClient) {}

  async sendVerificationCode(phone: string, code: string) {
    const result = await this.sms.send({
      phone,
      templateId: 'SMS_123456789',
      params: { code },
    });

    if (!result.success) {
      throw new Error(`SMS failed: ${result.message}`);
    }

    return result;
  }
}
```

### 批量发送

```typescript
async sendBatch(phones: string[], content: string) {
  const result = await this.sms.send({
    phone: phones,  // 支持数组
    templateId: 'SMS_NOTIFICATION',
    params: { content },
  });
  
  return result;
}
```

---

## 📋 接口定义

### SendSmsInput

```typescript
interface SendSmsInput {
  /** 手机号（支持单个或多个） */
  phone: string | string[];
  /** 模板 ID */
  templateId: string;
  /** 模板参数 */
  params?: Record<string, string>;
  /** 签名（可选，使用默认签名时不传） */
  signName?: string;
}
```

### SendSmsOutput

```typescript
interface SendSmsOutput {
  /** 是否成功 */
  success: boolean;
  /** 消息 ID（厂商返回） */
  messageId?: string;
  /** 错误码 */
  code?: string;
  /** 错误消息 */
  message?: string;
  /** 原始响应 */
  raw?: unknown;
}
```

---

## 🔌 实现自定义适配器

### 适配器接口

```typescript
interface SmsAdapter {
  readonly name: string;
  createClient(): SmsClient | Promise<SmsClient>;
}

interface SmsClient {
  send(input: SendSmsInput): Promise<SendSmsOutput>;
}
```

### 阿里云适配器示例

```typescript
// adapters/aliyun-sms.adapter.ts
import Dysmsapi from '@alicloud/dysmsapi20170525';
import * as OpenApi from '@alicloud/openapi-client';
import { SmsAdapter, SmsClient, SendSmsInput, SendSmsOutput } from '@svton/nestjs-sms';

interface AliyunSmsOptions {
  accessKeyId: string;
  accessKeySecret: string;
  signName: string;
  endpoint?: string;
}

export class AliyunSmsAdapter implements SmsAdapter {
  readonly name = 'aliyun';
  private options: AliyunSmsOptions;

  constructor(options: AliyunSmsOptions) {
    this.options = options;
  }

  createClient(): SmsClient {
    const config = new OpenApi.Config({
      accessKeyId: this.options.accessKeyId,
      accessKeySecret: this.options.accessKeySecret,
      endpoint: this.options.endpoint || 'dysmsapi.aliyuncs.com',
    });

    const client = new Dysmsapi(config);

    return {
      send: async (input: SendSmsInput): Promise<SendSmsOutput> => {
        try {
          const phones = Array.isArray(input.phone) 
            ? input.phone.join(',') 
            : input.phone;

          const response = await client.sendSms({
            phoneNumbers: phones,
            signName: input.signName || this.options.signName,
            templateCode: input.templateId,
            templateParam: input.params ? JSON.stringify(input.params) : undefined,
          });

          const body = response.body;
          return {
            success: body.code === 'OK',
            messageId: body.bizId,
            code: body.code,
            message: body.message,
            raw: body,
          };
        } catch (error) {
          return {
            success: false,
            code: 'ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
            raw: error,
          };
        }
      },
    };
  }
}
```

### 腾讯云适配器示例

```typescript
// adapters/tencent-sms.adapter.ts
import * as tencentcloud from 'tencentcloud-sdk-nodejs';
import { SmsAdapter, SmsClient, SendSmsInput, SendSmsOutput } from '@svton/nestjs-sms';

interface TencentSmsOptions {
  secretId: string;
  secretKey: string;
  sdkAppId: string;
  signName: string;
  region?: string;
}

export class TencentSmsAdapter implements SmsAdapter {
  readonly name = 'tencent';
  private options: TencentSmsOptions;

  constructor(options: TencentSmsOptions) {
    this.options = options;
  }

  createClient(): SmsClient {
    const SmsClient = tencentcloud.sms.v20210111.Client;
    
    const client = new SmsClient({
      credential: {
        secretId: this.options.secretId,
        secretKey: this.options.secretKey,
      },
      region: this.options.region || 'ap-guangzhou',
    });

    return {
      send: async (input: SendSmsInput): Promise<SendSmsOutput> => {
        try {
          const phones = Array.isArray(input.phone) ? input.phone : [input.phone];
          const formattedPhones = phones.map(p => p.startsWith('+86') ? p : `+86${p}`);

          const response = await client.SendSms({
            SmsSdkAppId: this.options.sdkAppId,
            SignName: input.signName || this.options.signName,
            TemplateId: input.templateId,
            PhoneNumberSet: formattedPhones,
            TemplateParamSet: input.params ? Object.values(input.params) : undefined,
          });

          const status = response.SendStatusSet?.[0];
          return {
            success: status?.Code === 'Ok',
            messageId: status?.SerialNo,
            code: status?.Code,
            message: status?.Message,
            raw: response,
          };
        } catch (error) {
          return {
            success: false,
            code: 'ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
            raw: error,
          };
        }
      },
    };
  }
}
```

---

## 📋 常用场景

### 验证码发送

```typescript
@Injectable()
export class VerificationService {
  constructor(
    @InjectSms() private sms: SmsClient,
    private cache: CacheService,
  ) {}

  async sendCode(phone: string) {
    // 生成验证码
    const code = Math.random().toString().slice(2, 8);
    
    // 发送短信
    const result = await this.sms.send({
      phone,
      templateId: 'SMS_VERIFY_CODE',
      params: { code },
    });

    if (!result.success) {
      throw new BadRequestException('Failed to send SMS');
    }

    // 缓存验证码
    await this.cache.set(`verify:${phone}`, code, 300);

    return { success: true };
  }

  async verifyCode(phone: string, code: string) {
    const cached = await this.cache.get<string>(`verify:${phone}`);
    
    if (!cached || cached !== code) {
      throw new BadRequestException('Invalid verification code');
    }

    await this.cache.del(`verify:${phone}`);
    return { verified: true };
  }
}
```

### 通知发送

```typescript
@Injectable()
export class NotificationService {
  constructor(@InjectSms() private sms: SmsClient) {}

  async sendOrderNotification(phone: string, orderNo: string) {
    return this.sms.send({
      phone,
      templateId: 'SMS_ORDER_CREATED',
      params: { orderNo },
    });
  }

  async sendBatchNotification(phones: string[], message: string) {
    return this.sms.send({
      phone: phones,
      templateId: 'SMS_NOTIFICATION',
      params: { message },
    });
  }
}
```

---

## ✅ 最佳实践

1. **使用环境变量配置**
   ```typescript
   SmsModule.forRootAsync({
     useFactory: (config) => ({
       adapter: new AliyunSmsAdapter({
         accessKeyId: config.get('SMS_ACCESS_KEY'),
         accessKeySecret: config.get('SMS_SECRET'),
       }),
     }),
   });
   ```

2. **错误处理**
   ```typescript
   const result = await this.sms.send(input);
   if (!result.success) {
     this.logger.error({ result }, 'SMS send failed');
     throw new ServiceUnavailableException('SMS service unavailable');
   }
   ```

3. **限流保护**
   ```typescript
   async sendCode(phone: string) {
     const key = `sms:limit:${phone}`;
     const count = await this.cache.incr(key);
     if (count === 1) await this.cache.expire(key, 3600);
     if (count > 5) throw new TooManyRequestsException();
     // ...
   }
   ```

---

**相关文档**: [@svton/nestjs-redis](./nestjs-redis.md) | [后端模块开发](../backend/modules.md)
