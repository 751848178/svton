# @svton/nestjs-object-storage

> NestJS 对象存储模块 - 多云厂商适配器支持

---

## 📦 包信息

| 属性 | 值 |
|------|---|
| **包名** | `@svton/nestjs-object-storage` |
| **版本** | `1.1.0` |
| **入口** | `dist/index.js` (CJS) / `dist/index.mjs` (ESM) |
| **类型** | `dist/index.d.ts` |

---

## 🎯 设计原则

1. **适配器模式** - 统一接口，支持多云厂商切换
2. **预签名上传** - 客户端直传，减轻服务器压力
3. **回调验签** - 安全验证上传回调

---

## 🚀 快速开始

### 安装

```bash
pnpm add @svton/nestjs-object-storage
# 安装对应厂商适配器
pnpm add @svton/nestjs-object-storage-qiniu-kodo
```

### 模块注册

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ObjectStorageModule } from '@svton/nestjs-object-storage';
import { createQiniuAdapter } from '@svton/nestjs-object-storage-qiniu-kodo';

@Module({
  imports: [
    ObjectStorageModule.forRoot({
      defaultBucket: 'my-bucket',
      publicBaseUrl: 'https://cdn.example.com',
      adapter: createQiniuAdapter({
        accessKey: 'your-access-key',
        secretKey: 'your-secret-key',
        bucket: 'my-bucket',
        region: 'z0',
        publicDomain: 'https://cdn.example.com',
      }),
    }),
  ],
})
export class AppModule {}
```

### 异步配置

```typescript
ObjectStorageModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    defaultBucket: config.get('STORAGE_BUCKET'),
    publicBaseUrl: config.get('STORAGE_CDN_URL'),
    adapter: createQiniuAdapter({
      accessKey: config.get('QINIU_ACCESS_KEY'),
      secretKey: config.get('QINIU_SECRET_KEY'),
      bucket: config.get('QINIU_BUCKET'),
      region: config.get('QINIU_REGION'),
      publicDomain: config.get('QINIU_CDN_URL'),
    }),
  }),
});
```

---

## 🔧 使用方法

### 注入 ObjectStorageClient

```typescript
import { Injectable } from '@nestjs/common';
import { InjectObjectStorage, ObjectStorageClient } from '@svton/nestjs-object-storage';

@Injectable()
export class UploadService {
  constructor(
    @InjectObjectStorage() private storage: ObjectStorageClient,
  ) {}

  // 获取上传凭证
  async getUploadToken(filename: string) {
    const key = `uploads/${Date.now()}-${filename}`;
    
    return this.storage.presign({
      key,
      method: 'PUT',
      expiresIn: 3600,
      contentType: 'image/jpeg',
    });
  }

  // 获取公开 URL
  getPublicUrl(key: string) {
    return this.storage.getPublicUrl({ key });
  }

  // 删除文件
  async deleteFile(key: string) {
    await this.storage.deleteObject({ key });
  }
}
```

---

## 📋 API 接口

### ObjectStorageClient

```typescript
interface ObjectStorageClient {
  // 上传对象
  putObject(input: PutObjectInput): Promise<PutObjectOutput>;
  
  // 删除对象
  deleteObject(input: DeleteObjectInput): Promise<void>;
  
  // 获取公开 URL
  getPublicUrl(input: GetPublicUrlInput): string;
  
  // 生成预签名 URL
  presign(input: PresignInput): Promise<PresignOutput>;
  
  // 验证回调签名
  verifyCallback(input: VerifyCallbackInput): Promise<VerifyCallbackOutput>;
}
```

### 预签名上传

```typescript
interface PresignInput {
  bucket?: string;
  key: string;
  method: 'GET' | 'PUT';
  expiresIn?: number;
  contentType?: string;
  callback?: PresignCallbackConfig;
}

interface PresignOutput {
  url: string;
  method: 'GET' | 'PUT';
  headers?: Record<string, string>;
  formFields?: Record<string, string>;  // 表单上传字段
}
```

### 回调配置

```typescript
interface PresignCallbackConfig {
  url: string;
  body?: string;
  bodyType?: 'application/json' | 'application/x-www-form-urlencoded';
  customVars?: Record<string, string>;
}
```

---

## 📤 客户端直传

### 获取上传凭证

```typescript
// upload.controller.ts
@Controller('upload')
export class UploadController {
  constructor(private uploadService: UploadService) {}

  @Post('token')
  async getUploadToken(@Body() dto: GetTokenDto) {
    const key = `${dto.folder}/${Date.now()}-${dto.filename}`;
    
    const presign = await this.uploadService.getPresignUrl(key, {
      contentType: dto.contentType,
      callback: {
        url: 'https://api.example.com/upload/callback',
        body: 'key=$(key)&hash=$(etag)&size=$(fsize)',
      },
    });

    return {
      key,
      ...presign,
    };
  }
}
```

### 前端上传

```typescript
// 获取上传凭证
const { url, formFields, key } = await api.getUploadToken({
  filename: file.name,
  contentType: file.type,
});

// 构建表单数据
const formData = new FormData();
Object.entries(formFields).forEach(([k, v]) => formData.append(k, v));
formData.append('file', file);

// 上传文件
await fetch(url, {
  method: 'POST',
  body: formData,
});
```

---

## 🔐 回调验签

### 回调 Controller

```typescript
// upload.controller.ts
import { Controller, Post, Req, RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';

@Controller('upload')
export class UploadController {
  constructor(
    @InjectObjectStorage() private storage: ObjectStorageClient,
  ) {}

  @Post('callback')
  async handleCallback(@Req() req: RawBodyRequest<Request>) {
    // 验证回调签名
    const result = await this.storage.verifyCallback({
      method: req.method,
      path: req.path,
      query: req.query as Record<string, string>,
      headers: req.headers as Record<string, string>,
      rawBody: req.rawBody!,
    });

    if (!result.isValid) {
      throw new UnauthorizedException('Invalid callback signature');
    }

    // 处理上传成功
    await this.uploadService.onUploadComplete({
      key: result.key!,
      size: result.size!,
      etag: result.etag!,
    });

    return { success: true };
  }
}
```

### 启用 Raw Body

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,  // 启用 rawBody
  });
  
  await app.listen(3000);
}
```

---

## 🔌 可用适配器

| 适配器 | 包名 | 厂商 |
|--------|------|------|
| 七牛云 | `@svton/nestjs-object-storage-qiniu-kodo` | Qiniu Kodo |
| 阿里云 | `@svton/nestjs-object-storage-aliyun-oss` | Aliyun OSS |
| 腾讯云 | `@svton/nestjs-object-storage-tencent-cos` | Tencent COS |
| AWS | `@svton/nestjs-object-storage-s3` | AWS S3 |

### 七牛云配置

```typescript
import { createQiniuAdapter } from '@svton/nestjs-object-storage-qiniu-kodo';

createQiniuAdapter({
  accessKey: 'your-access-key',
  secretKey: 'your-secret-key',
  bucket: 'my-bucket',
  region: 'z0',  // z0/z1/z2/na0/as0/cn-east-2
  publicDomain: 'https://cdn.example.com',
});
```

---

## 🛠️ 实现自定义适配器

```typescript
import {
  ObjectStorageAdapter,
  ObjectStorageClient,
  PutObjectInput,
  PutObjectOutput,
  // ...
} from '@svton/nestjs-object-storage';

export class MyStorageAdapter implements ObjectStorageAdapter {
  readonly name = 'my-storage';

  constructor(private options: MyStorageOptions) {}

  createClient(): ObjectStorageClient {
    return {
      putObject: async (input) => {
        // 实现上传逻辑
      },
      deleteObject: async (input) => {
        // 实现删除逻辑
      },
      getPublicUrl: (input) => {
        // 返回公开 URL
      },
      presign: async (input) => {
        // 生成预签名 URL
      },
      verifyCallback: async (input) => {
        // 验证回调签名
      },
    };
  }
}
```

---

## 📋 常用场景

### 图片上传

```typescript
@Injectable()
export class ImageService {
  constructor(@InjectObjectStorage() private storage: ObjectStorageClient) {}

  async getUploadUrl(userId: number, filename: string) {
    const ext = filename.split('.').pop();
    const key = `images/${userId}/${Date.now()}.${ext}`;

    return this.storage.presign({
      key,
      method: 'PUT',
      expiresIn: 600,
      contentType: `image/${ext}`,
    });
  }
}
```

### 私有文件下载

```typescript
async getDownloadUrl(key: string) {
  return this.storage.presign({
    key,
    method: 'GET',
    expiresIn: 3600,
  });
}
```

### 服务端上传

```typescript
async uploadFromBuffer(buffer: Buffer, filename: string) {
  const key = `uploads/${Date.now()}-${filename}`;
  
  const result = await this.storage.putObject({
    key,
    body: buffer,
    contentType: 'application/octet-stream',
  });

  return result.url;
}
```

---

## ✅ 最佳实践

1. **使用 CDN 域名**
   ```typescript
   publicBaseUrl: 'https://cdn.example.com',
   ```

2. **设置合理的过期时间**
   ```typescript
   // 上传凭证：较短
   expiresIn: 600,  // 10 分钟
   
   // 下载链接：按需
   expiresIn: 3600, // 1 小时
   ```

3. **文件路径规范**
   ```typescript
   // 按类型和日期组织
   `images/${userId}/${YYYY-MM}/${filename}`
   `documents/${projectId}/${filename}`
   ```

4. **启用回调验签**
   ```typescript
   callback: {
     url: 'https://api.example.com/callback',
   },
   ```

---

**相关文档**: [@svton/nestjs-redis](./nestjs-redis.md) | [后端模块开发](../backend/modules.md)
