# @svton/nestjs-object-storage-qiniu-kodo

> 七牛云 Kodo 对象存储适配器 - @svton/nestjs-object-storage 插件

---

## 📦 包信息

| 属性 | 值 |
|------|---|
| **包名** | `@svton/nestjs-object-storage-qiniu-kodo` |
| **版本** | `2.0.0` |
| **入口** | `dist/index.js` (CJS) / `dist/index.mjs` (ESM) |
| **类型** | `dist/index.d.ts` |

---

## 🎯 设计原则

1. **适配器模式** - 实现 @svton/nestjs-object-storage 统一接口
2. **功能完整** - 支持上传、删除、预签名、回调验签
3. **多区域支持** - 支持七牛云所有存储区域

---

## 🚀 快速开始

### 安装

```bash
pnpm add @svton/nestjs-object-storage @svton/nestjs-object-storage-qiniu-kodo
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
      adapter: createQiniuAdapter({
        accessKey: 'your-access-key',
        secretKey: 'your-secret-key',
        bucket: 'your-bucket',
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
    adapter: createQiniuAdapter({
      accessKey: config.get('QINIU_ACCESS_KEY'),
      secretKey: config.get('QINIU_SECRET_KEY'),
      bucket: config.get('QINIU_BUCKET'),
      region: config.get('QINIU_REGION', 'z0'),
      publicDomain: config.get('QINIU_PUBLIC_DOMAIN'),
    }),
  }),
});
```

---

## ⚙️ 配置选项

| 选项 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `accessKey` | `string` | ✅ | Access Key |
| `secretKey` | `string` | ✅ | Secret Key |
| `bucket` | `string` | ✅ | 默认 Bucket |
| `region` | `string` | - | 区域（z0/z1/z2/na0/as0/cn-east-2） |
| `publicDomain` | `string` | - | 公开访问域名（CDN 域名） |
| `uploadDomain` | `string` | - | 上传域名（可选） |

### 区域说明

| 区域代码 | 说明 |
|----------|------|
| `z0` | 华东-浙江 |
| `z1` | 华北-河北 |
| `z2` | 华南-广东 |
| `na0` | 北美-洛杉矶 |
| `as0` | 亚太-新加坡 |
| `cn-east-2` | 华东-浙江2 |

---

## 🔧 使用方法

### 上传文件

```typescript
import { Injectable } from '@nestjs/common';
import { ObjectStorageService } from '@svton/nestjs-object-storage';

@Injectable()
export class UploadService {
  constructor(private storage: ObjectStorageService) {}

  // 上传 Buffer
  async uploadBuffer(key: string, buffer: Buffer, contentType: string) {
    const result = await this.storage.putObject({
      key,
      body: buffer,
      contentType,
    });

    return {
      key: result.key,
      etag: result.etag,
      url: result.url,
    };
  }

  // 上传 Stream
  async uploadStream(key: string, stream: Readable, contentType: string) {
    const result = await this.storage.putObject({
      key,
      body: stream,
      contentType,
    });

    return result;
  }
}
```

### 删除文件

```typescript
async deleteFile(key: string) {
  await this.storage.deleteObject({ key });
}
```

### 获取公开 URL

```typescript
async getPublicUrl(key: string) {
  return this.storage.getPublicUrl({ key });
}
```

### 生成预签名 URL

```typescript
// 生成上传凭证
async getUploadToken(key: string) {
  const result = await this.storage.presign({
    key,
    method: 'PUT',
    expiresIn: 3600, // 1 小时有效
    contentType: 'image/jpeg',
  });

  return {
    url: result.url,
    formFields: result.formFields, // 包含 token 和 key
  };
}

// 生成私有下载 URL
async getPrivateUrl(key: string) {
  const result = await this.storage.presign({
    key,
    method: 'GET',
    expiresIn: 3600,
  });

  return result.url;
}
```

### 带回调的上传

```typescript
async getUploadTokenWithCallback(key: string) {
  const result = await this.storage.presign({
    key,
    method: 'PUT',
    expiresIn: 3600,
    callback: {
      url: 'https://example.com/upload/callback',
      body: 'key=$(key)&hash=$(etag)&bucket=$(bucket)&fsize=$(fsize)',
      bodyType: 'application/x-www-form-urlencoded',
    },
  });

  return result;
}
```

### 验证回调

```typescript
@Post('callback')
async handleCallback(
  @Headers() headers: Record<string, string>,
  @Query() query: Record<string, string>,
  @Body() rawBody: Buffer,
  @Req() req: Request,
) {
  const result = await this.storage.verifyCallback({
    headers,
    query,
    rawBody,
    path: req.path,
  });

  if (!result.isValid) {
    throw new BadRequestException('Invalid callback');
  }

  // 处理上传成功
  await this.fileService.saveFile({
    key: result.key,
    etag: result.etag,
    size: result.size,
    bucket: result.bucket,
  });

  return { success: true };
}
```

---

## 📋 前端直传示例

### 获取上传凭证

```typescript
// 后端
@Get('upload-token')
async getUploadToken(@Query('filename') filename: string) {
  const key = `uploads/${Date.now()}-${filename}`;
  const result = await this.storage.presign({
    key,
    method: 'PUT',
    expiresIn: 3600,
    contentType: this.getMimeType(filename),
  });

  return {
    uploadUrl: result.url,
    token: result.formFields?.token,
    key: result.formFields?.key,
  };
}
```

### 前端上传

```typescript
// 前端
async function uploadFile(file: File) {
  // 1. 获取上传凭证
  const { uploadUrl, token, key } = await fetch(`/api/upload-token?filename=${file.name}`).then(r => r.json());

  // 2. 构建表单数据
  const formData = new FormData();
  formData.append('token', token);
  formData.append('key', key);
  formData.append('file', file);

  // 3. 上传到七牛云
  const response = await fetch(uploadUrl, {
    method: 'POST',
    body: formData,
  });

  return response.json();
}
```

---

## 📋 类型定义

### QiniuAdapterOptions

```typescript
interface QiniuAdapterOptions {
  accessKey: string;
  secretKey: string;
  bucket: string;
  region?: string;
  publicDomain?: string;
  uploadDomain?: string;
}
```

### QiniuCallbackBody

```typescript
interface QiniuCallbackBody {
  key?: string;
  hash?: string;
  bucket?: string;
  fsize?: number;
  fname?: string;
  mimeType?: string;
  endUser?: string;
  [key: string]: unknown;
}
```

---

## ✅ 最佳实践

1. **使用 CDN 域名**
   ```typescript
   publicDomain: 'https://cdn.example.com',
   ```

2. **合理设置上传凭证有效期**
   ```typescript
   expiresIn: 3600, // 1 小时，不要太长
   ```

3. **使用回调验证上传**
   ```typescript
   callback: {
     url: 'https://example.com/upload/callback',
     body: 'key=$(key)&hash=$(etag)&fsize=$(fsize)',
   },
   ```

4. **文件命名规范**
   ```typescript
   const key = `${type}/${userId}/${Date.now()}-${filename}`;
   ```

5. **私有空间使用预签名 URL**
   ```typescript
   const result = await storage.presign({ key, method: 'GET', expiresIn: 3600 });
   ```

---

**相关文档**: [@svton/nestjs-object-storage](./nestjs-object-storage.md) | [后端模块开发](../backend/modules.md)
