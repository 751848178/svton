# @svton/nestjs-object-storage-tencent-cos

腾讯云 COS（Cloud Object Storage）对象存储适配器，用于 `@svton/nestjs-object-storage`。

## 安装

```bash
pnpm add @svton/nestjs-object-storage @svton/nestjs-object-storage-tencent-cos
```

## 快速开始

### 1. 配置模块

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ObjectStorageModule } from '@svton/nestjs-object-storage';
import { createCosAdapter } from '@svton/nestjs-object-storage-tencent-cos';

@Module({
  imports: [
    ObjectStorageModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        defaultBucket: configService.get('COS_BUCKET'),
        publicBaseUrl: configService.get('COS_DOMAIN'),
        defaultExpiresInSeconds: 3600,
        adapter: createCosAdapter({
          secretId: configService.get('COS_SECRET_ID'),
          secretKey: configService.get('COS_SECRET_KEY'),
          bucket: configService.get('COS_BUCKET'),
          region: configService.get('COS_REGION', 'ap-guangzhou'),
          publicDomain: configService.get('COS_DOMAIN'),
          useAccelerate: configService.get('COS_USE_ACCELERATE') === 'true',
        }),
      }),
    }),
  ],
})
export class AppModule {}
```

### 2. 环境变量配置

在 `.env` 文件中添加：

```bash
# 腾讯云 COS 配置
COS_SECRET_ID=your_secret_id
COS_SECRET_KEY=your_secret_key
COS_BUCKET=your-bucket-name
COS_REGION=ap-guangzhou
COS_DOMAIN=https://your-domain.com
COS_USE_ACCELERATE=false
```

### 3. 使用服务

```typescript
import { Injectable } from '@nestjs/common';
import { ObjectStorageService } from '@svton/nestjs-object-storage';

@Injectable()
export class UploadService {
  constructor(private readonly storage: ObjectStorageService) {}

  async uploadFile(file: Express.Multer.File) {
    const key = `uploads/${Date.now()}-${file.originalname}`;
    
    const result = await this.storage.putObject({
      key,
      body: file.buffer,
      contentType: file.mimetype,
    });

    return {
      key: result.key,
      url: this.storage.getPublicUrl({ key: result.key }),
    };
  }

  async deleteFile(key: string) {
    await this.storage.deleteObject({ key });
  }

  async getPrivateUrl(key: string) {
    const result = await this.storage.presign({
      key,
      method: 'GET',
      expiresIn: 3600, // 1小时
    });
    return result.url;
  }
}
```

## 配置选项

### CosAdapterOptions

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `secretId` | `string` | 是 | 腾讯云 SecretId |
| `secretKey` | `string` | 是 | 腾讯云 SecretKey |
| `bucket` | `string` | 是 | 存储桶名称 |
| `region` | `string` | 是 | 地域，如 `ap-guangzhou` |
| `publicDomain` | `string` | 否 | 自定义域名（用于生成公开 URL） |
| `useAccelerate` | `boolean` | 否 | 是否使用全球加速域名，默认 `false` |

### 地域列表

常用地域代码：

- `ap-beijing` - 北京
- `ap-shanghai` - 上海
- `ap-guangzhou` - 广州
- `ap-chengdu` - 成都
- `ap-chongqing` - 重庆
- `ap-nanjing` - 南京
- `ap-hongkong` - 香港
- `ap-singapore` - 新加坡
- `na-siliconvalley` - 硅谷
- `na-ashburn` - 弗吉尼亚

完整地域列表请参考：[腾讯云 COS 地域列表](https://cloud.tencent.com/document/product/436/6224)

## API 方法

### putObject - 上传对象

```typescript
const result = await storage.putObject({
  key: 'path/to/file.jpg',
  body: buffer, // Buffer 或 Stream
  contentType: 'image/jpeg',
});
```

### deleteObject - 删除对象

```typescript
await storage.deleteObject({
  key: 'path/to/file.jpg',
});
```

### getPublicUrl - 获取公开访问 URL

```typescript
const url = storage.getPublicUrl({
  key: 'path/to/file.jpg',
});
```

### presign - 生成预签名 URL

```typescript
// 生成下载链接
const result = await storage.presign({
  key: 'path/to/file.jpg',
  method: 'GET',
  expiresIn: 3600, // 1小时
});

// 生成上传链接
const result = await storage.presign({
  key: 'path/to/file.jpg',
  method: 'PUT',
  expiresIn: 3600,
  contentType: 'image/jpeg',
});
```

## 完整示例

### 文件上传 Controller

```typescript
import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Get,
  Param,
  Delete,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ObjectStorageService } from '@svton/nestjs-object-storage';

@Controller('upload')
export class UploadController {
  constructor(private readonly storage: ObjectStorageService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file: Express.Multer.File) {
    const key = `uploads/${Date.now()}-${file.originalname}`;
    
    const result = await this.storage.putObject({
      key,
      body: file.buffer,
      contentType: file.mimetype,
    });

    return {
      key: result.key,
      url: this.storage.getPublicUrl({ key: result.key }),
    };
  }

  @Get('presign/:key')
  async getPresignedUrl(@Param('key') key: string) {
    const result = await this.storage.presign({
      key,
      method: 'GET',
      expiresIn: 3600,
    });

    return { url: result.url };
  }

  @Delete(':key')
  async delete(@Param('key') key: string) {
    await this.storage.deleteObject({ key });
    return { message: 'File deleted successfully' };
  }
}
```

## 与七牛云切换

如果你的项目需要在七牛云和腾讯云 COS 之间切换，可以使用环境变量控制：

```typescript
import { createQiniuAdapter } from '@svton/nestjs-object-storage-qiniu-kodo';
import { createCosAdapter } from '@svton/nestjs-object-storage-tencent-cos';

export const useStorageConfig = (configService: ConfigService) => {
  const provider = configService.get('STORAGE_PROVIDER', 'qiniu');

  if (provider === 'tencent-cos') {
    return {
      defaultBucket: configService.get('COS_BUCKET'),
      publicBaseUrl: configService.get('COS_DOMAIN'),
      defaultExpiresInSeconds: 3600,
      adapter: createCosAdapter({
        secretId: configService.get('COS_SECRET_ID'),
        secretKey: configService.get('COS_SECRET_KEY'),
        bucket: configService.get('COS_BUCKET'),
        region: configService.get('COS_REGION', 'ap-guangzhou'),
        publicDomain: configService.get('COS_DOMAIN'),
      }),
    };
  }

  // 默认使用七牛云
  return {
    defaultBucket: configService.get('QINIU_BUCKET'),
    publicBaseUrl: configService.get('QINIU_DOMAIN'),
    defaultExpiresInSeconds: 3600,
    adapter: createQiniuAdapter({
      accessKey: configService.get('QINIU_ACCESS_KEY'),
      secretKey: configService.get('QINIU_SECRET_KEY'),
      bucket: configService.get('QINIU_BUCKET'),
      region: configService.get('QINIU_REGION', 'z0'),
      publicDomain: configService.get('QINIU_DOMAIN'),
    }),
  };
};
```

## 注意事项

1. **存储桶权限**：确保存储桶已配置正确的访问权限
2. **CORS 配置**：如果需要浏览器直传，需要配置 CORS 规则
3. **自定义域名**：使用自定义域名需要先在腾讯云控制台绑定
4. **全球加速**：开启全球加速需要额外费用，请根据需求选择

## 相关链接

- [腾讯云 COS 官方文档](https://cloud.tencent.com/document/product/436)
- [COS Node.js SDK](https://cloud.tencent.com/document/product/436/8629)
- [@svton/nestjs-object-storage](./nestjs-object-storage.md)

## 许可证

MIT
