# @svton/nestjs-sms

NestJS 短信模块，支持多厂商适配器。

## 安装

```bash
pnpm add @svton/nestjs-sms
# 安装对应厂商 adapter
pnpm add @svton/nestjs-sms-aliyun
```

## 使用

### 模块注册

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SmsModule } from '@svton/nestjs-sms';
import { createAliyunSmsAdapter } from '@svton/nestjs-sms-aliyun';

@Module({
  imports: [
    SmsModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        defaultSignName: config.get('SMS_SIGN_NAME'),
        adapter: createAliyunSmsAdapter({
          accessKeyId: config.get('ALIYUN_ACCESS_KEY_ID'),
          accessKeySecret: config.get('ALIYUN_ACCESS_KEY_SECRET'),
          signName: config.get('SMS_SIGN_NAME'),
        }),
      }),
    }),
  ],
})
export class AppModule {}
```

### 服务注入

```typescript
import { Injectable } from '@nestjs/common';
import { InjectSms, SmsClient } from '@svton/nestjs-sms';

@Injectable()
export class AuthService {
  constructor(@InjectSms() private readonly sms: SmsClient) {}

  async sendVerificationCode(phone: string, code: string) {
    const result = await this.sms.send({
      phone,
      templateId: 'SMS_123456789',
      params: { code },
    });

    if (!result.success) {
      throw new Error(`Failed to send SMS: ${result.message}`);
    }

    return result;
  }
}
```

## API

### SmsClient

```typescript
interface SmsClient {
  send(input: SendSmsInput): Promise<SendSmsOutput>;
}

interface SendSmsInput {
  phone: string | string[];  // 支持批量发送
  templateId: string;
  params?: Record<string, string>;
  signName?: string;  // 可选，覆盖默认签名
}

interface SendSmsOutput {
  success: boolean;
  messageId?: string;
  code?: string;
  message?: string;
  raw?: unknown;
}
```

## 适配器

- `@svton/nestjs-sms-aliyun` - 阿里云短信
- `@svton/nestjs-sms-tencent` - 腾讯云短信
- `@svton/nestjs-sms-huawei` - 华为云短信

## 创建自定义适配器

```typescript
import { SmsAdapter, SmsClient, SendSmsInput, SendSmsOutput } from '@svton/nestjs-sms';

class MySmsClient implements SmsClient {
  async send(input: SendSmsInput): Promise<SendSmsOutput> {
    // 实现发送逻辑
    return { success: true, messageId: 'xxx' };
  }
}

class MySmsAdapter implements SmsAdapter {
  readonly name = 'my-sms';

  createClient(): SmsClient {
    return new MySmsClient();
  }
}

export function createMySmsAdapter(): SmsAdapter {
  return new MySmsAdapter();
}
```
