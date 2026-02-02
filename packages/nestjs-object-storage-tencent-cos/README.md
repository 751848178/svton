# @svton/nestjs-object-storage-tencent-cos

腾讯云 COS 对象存储适配器，用于 `@svton/nestjs-object-storage`。

## 安装

```bash
pnpm add @svton/nestjs-object-storage @svton/nestjs-object-storage-tencent-cos
```

## 使用

### 基础配置

```typescript
import { Module } from '@nestjs/common';
import { ObjectStorageModule } from '@svton/nestjs-object-storage';
import { createCosAdapter } from '@svton/nestjs-object-storage-tencent-cos';

@Module({
  imports: [
    ObjectStorageModule.forRoot({
      adapter: createCosAdapter({
        secretId: process.env.COS_SECRET_ID!,
        secretKey: process.env.COS_SECRET_KEY!,
        bucket: process.env.COS_BUCKET!,
        region: process.env.COS_REGION!, // 例如: ap-guangzhou
      }),
    }),
  ],
})
export class AppModule {}
```

### 异步配置

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ObjectStorageModule } from '@svton/nestjs-object-storage';
import { createCosAdapter } from '@svton/nestjs-object-storage-tencent-cos';

@Module({
  imports: [
    ConfigModule.forRoot(),
    ObjectStorageModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        adapter: createCosAdapter({
          secretId: configService.get('COS_SECRET_ID')!,
          secretKey: configService.get('COS_SECRET_KEY')!,
          bucket: configService.get('COS_BUCKET')!,
          region: configService.get('COS_REGION')!,
          publicDomain: configService.get('COS_CDN_URL'), // 可选：CDN 域名
          useAccelerate: configService.get('COS_USE_ACCELERATE') === 'true', // 可选：使用全球加速
        }),
      }),
    }),
  ],
})
export class AppModule {}
```

### 使用示例

```typescript
import { Injectable } from '@nestjs/common';
import { InjectObjectStorage, ObjectStorageClient } from '@svton/nestjs-object-storage';

@Injectable()
export class UploadService {
  constructor(
    @InjectObjectStorage()
    private readonly storage: ObjectStorageClient,
  ) {}

  async uploadFile(file: Express.Multer.File) {
    const key = `uploads/${Date.now()}-${file.originalname}`;

    // 上传文件
    const result = await this.storage.putObject({
      key,
      body: file.buffer,
      contentType: file.mimetype,
    });

    // 获取公开访问 URL
    const url = this.storage.getPublicUrl({ key });

    return { key, url, etag: result.etag };
  }

  async getPresignedUploadUrl(key: string) {
    // 生成预签名上传 URL（客户端直传）
    return this.storage.presign({
      key,
      method: 'PUT',
      expiresIn: 3600, // 1 小时
    });
  }

  async getPresignedDownloadUrl(key: string) {
    // 生成预签名下载 URL（私有文件访问）
    return this.storage.presign({
      key,
      method: 'GET',
      expiresIn: 3600,
    });
  }
}
```

## 配置选项

### CosAdapterOptions

| 选项 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `secretId` | `string` | 是 | 腾讯云 SecretId |
| `secretKey` | `string` | 是 | 腾讯云 SecretKey |
| `bucket` | `string` | 是 | 存储桶名称 |
| `region` | `string` | 是 | 地域（如 ap-guangzhou、ap-shanghai） |
| `publicDomain` | `string` | 否 | 自定义 CDN 域名 |
| `useAccelerate` | `boolean` | 否 | 是否使用全球加速域名 |

## 环境变量

```bash
# 腾讯云 COS 配置
COS_SECRET_ID=your_secret_id
COS_SECRET_KEY=your_secret_key
COS_BUCKET=your-bucket-name
COS_REGION=ap-guangzhou
COS_CDN_URL=https://cdn.example.com  # 可选
COS_USE_ACCELERATE=false  # 可选
```

## 地域列表

常用地域代码：

- `ap-guangzhou` - 广州
- `ap-shanghai` - 上海
- `ap-beijing` - 北京
- `ap-chengdu` - 成都
- `ap-chongqing` - 重庆
- `ap-hongkong` - 香港
- `ap-singapore` - 新加坡
- `na-siliconvalley` - 硅谷
- `na-ashburn` - 弗吉尼亚

完整列表请参考：https://cloud.tencent.com/document/product/436/6224

## API 文档

完整 API 文档请参考 [@svton/nestjs-object-storage](https://github.com/751848178/svton/tree/master/packages/nestjs-object-storage)

## License

MIT
