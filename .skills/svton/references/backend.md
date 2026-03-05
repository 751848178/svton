# Backend Development

## Common NestJS Patterns

### Module Configuration

```typescript
@Module({
  imports: [
    ConfigModule.forRoot(),
    RedisModule.forRoot({ /* redis config */ }),
  ],
  providers: [MyService],
  controllers: [MyController],
})
export class MyModule {}
```

### Use Factory for Async Config

```typescript
RedisModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    host: config.get('REDIS_HOST'),
    port: config.get('REDIS_PORT'),
  }),
})
```

## @svton/nestjs-cache

```typescript
import { Cacheable, CacheEvict, CachePut } from '@svton/nestjs-cache';

@Injectable()
export class UserService {
  @Cacheable({ key: 'user:#id', ttl: 3600 })
  async findById(id: number) { /* ... */ }

  @CacheEvict({ key: 'user:#id' })
  async update(id: number, data: any) { /* ... */ }

  @CacheEvict({ key: 'user:*', allEntries: true })
  async clearAll() { /* ... */ }
}
```

## @svton/nestjs-queue

```typescript
import { Processor, Process } from '@svton/nestjs-queue';

@Processor({ name: 'email' })
@Injectable()
export class EmailProcessor {
  @Process('send')
  async handleSend(job: Job<{ to: string; subject: string }>) {
    // Process email
  }
}

// Add job
await queueService.addJob('email', 'send', { to, subject });
```

## @svton/nestjs-rate-limit

```typescript
import { RateLimit } from '@svton/nestjs-rate-limit';

@RateLimit({ windowSec: 60, limit: 10 })
@Post('submit')
async submit() { /* ... */ }

// Skip rate limit
@SkipRateLimit()
@Get('health')
async health() { return { status: 'ok' }; }
```

## @svton/nestjs-authz

```typescript
import { Roles } from '@svton/nestjs-authz';
import { RolesGuard } from './guards/roles.guard';

@Controller('admin')
@UseGuards(RolesGuard)
export class AdminController {
  @Roles('admin')
  @Get()
  async getData() { /* ... */ }
}
```

## @svton/nestjs-oauth

```typescript
import { WechatService } from '@svton/nestjs-oauth';

@Injectable()
export class AuthService {
  constructor(private wechat: WechatService) {}

  async getOauthUrl() {
    return this.wechat.getOauthUrl({
      appId: 'wx...',
      redirectUri: 'https://...',
      scope: 'snsapi_userinfo',
    });
  }
}
```

## @svton/nestjs-payment

```typescript
@Injectable()
export class PaymentService {
  constructor(private payment: PaymentService) {}

  async createOrder(amount: number, openid: string) {
    return await this.payment.wechat.createOrder({
      outTradeNo: orderNo,
      totalAmount: amount,
      description: 'Order',
      userId: openid,
    }, 'jsapi');
  }
}
```

## @svton/nestjs-sms

```typescript
import { InjectSms } from '@svton/nestjs-sms';

@Injectable()
export class SmsService {
  constructor(@InjectSms() private sms: SmsClient) {}

  async sendCode(phone: string, code: string) {
    const result = await this.sms.send({
      phone,
      templateId: 'SMS_CODE',
      params: { code },
    });

    if (!result.success) {
      throw new BadRequestException(result.message);
    }
  }
}
```

## @svton/nestjs-object-storage

```typescript
import { InjectObjectStorage } from '@svton/nestjs-object-storage';

@Injectable()
export class UploadService {
  constructor(@InjectObjectStorage() private storage: ObjectStorageClient) {}

  async getUploadToken(filename: string) {
    return this.storage.presign({
      key: `uploads/${Date.now()}-${filename}`,
      method: 'PUT',
      expiresIn: 3600,
    });
  }
}
```
