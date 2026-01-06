# @svton/nestjs-object-storage

NestJS 对象存储模块，支持多云厂商适配器。

## 安装

```bash
pnpm add @svton/nestjs-object-storage
# 安装对应厂商 adapter
pnpm add @svton/nestjs-object-storage-qiniu-kodo
```

## 使用

### 模块注册

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
          region: config.get('QINIU_REGION'),
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
import { InjectObjectStorage, ObjectStorageClient } from '@svton/nestjs-object-storage';

@Injectable()
export class UploadService {
  constructor(
    @InjectObjectStorage() private readonly storage: ObjectStorageClient,
  ) {}

  async getUploadUrl(key: string) {
    return this.storage.presign({
      key,
      method: 'PUT',
      expiresIn: 3600,
    });
  }

  async verifyCallback(input: VerifyCallbackInput) {
    return this.storage.verifyCallback(input);
  }
}
```

## API

### ObjectStorageClient

- `putObject(input)` - 上传对象
- `deleteObject(input)` - 删除对象
- `getPublicUrl(input)` - 获取公开访问 URL
- `presign(input)` - 生成预签名 URL
- `verifyCallback(input)` - 验证回调签名

## 适配器

- `@svton/nestjs-object-storage-qiniu-kodo` - 七牛云
- `@svton/nestjs-object-storage-aliyun-oss` - 阿里云 OSS
- `@svton/nestjs-object-storage-tencent-cos` - 腾讯云 COS
- `@svton/nestjs-object-storage-s3` - AWS S3
