# @svton/nestjs-object-storage-qiniu-kodo

七牛云 Kodo 对象存储适配器，用于 `@svton/nestjs-object-storage`。

## 安装

```bash
pnpm add @svton/nestjs-object-storage @svton/nestjs-object-storage-qiniu-kodo
```

## 使用

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ObjectStorageModule } from '@svton/nestjs-object-storage';
import { createQiniuAdapter } from '@svton/nestjs-object-storage-qiniu-kodo';

@Module({
  imports: [
    ObjectStorageModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        defaultBucket: config.get('QINIU_BUCKET'),
        publicBaseUrl: config.get('QINIU_CDN_URL'),
        adapter: createQiniuAdapter({
          accessKey: config.get('QINIU_ACCESS_KEY'),
          secretKey: config.get('QINIU_SECRET_KEY'),
          bucket: config.get('QINIU_BUCKET'),
          region: config.get('QINIU_REGION'), // z0/z1/z2/na0/as0/cn-east-2
          publicDomain: config.get('QINIU_CDN_URL'),
        }),
      }),
    }),
  ],
})
export class AppModule {}
```

## 配置选项

| 选项 | 类型 | 必填 | 说明 |
|------|------|------|------|
| accessKey | string | ✅ | 七牛 Access Key |
| secretKey | string | ✅ | 七牛 Secret Key |
| bucket | string | ✅ | 默认 Bucket |
| region | string | ❌ | 区域（z0/z1/z2/na0/as0/cn-east-2） |
| publicDomain | string | ❌ | CDN 域名（用于生成公开 URL） |
| uploadDomain | string | ❌ | 上传域名（默认使用区域配置） |

## 回调验签

```typescript
@Controller('object-storage')
export class ObjectStorageCallbackController {
  constructor(
    @InjectObjectStorage() private readonly storage: ObjectStorageClient,
  ) {}

  @Post('callback')
  async handleCallback(@Req() req: RawBodyRequest<Request>) {
    const result = await this.storage.verifyCallback({
      method: req.method,
      path: req.path,
      query: req.query as Record<string, string | string[]>,
      headers: req.headers as Record<string, string | string[]>,
      rawBody: req.rawBody!,
    });

    if (!result.isValid) {
      throw new UnauthorizedException('Invalid callback signature');
    }

    // 处理业务逻辑
    return { success: true, key: result.key };
  }
}
```
