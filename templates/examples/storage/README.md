# 对象存储示例

本示例展示如何使用 `@svton/nestjs-object-storage` 模块实现文件上传。

## 文件说明

- `upload.service.ts` - 上传服务，封装存储操作
- `upload.controller.ts` - 上传控制器，提供上传接口

## 核心功能

### 服务端上传

```typescript
const result = await this.uploadService.uploadFile(file);
```

### 客户端直传

```typescript
// 1. 获取上传凭证
const token = await this.uploadService.getUploadToken();

// 2. 客户端使用凭证直接上传到七牛云
```

### 删除文件

```typescript
await this.uploadService.deleteFile(key);
```

### 获取私有文件 URL

```typescript
const url = await this.uploadService.getPrivateUrl(key, 3600);
```

## 测试接口

### 获取上传凭证

```bash
curl http://localhost:3000/examples/upload/token
```

### 服务端上传文件

```bash
curl -X POST http://localhost:3000/examples/upload/file \
  -F "file=@/path/to/file.jpg"
```

### 上传图片

```bash
curl -X POST http://localhost:3000/examples/upload/image \
  -F "file=@/path/to/image.jpg"
```

### 删除文件

```bash
curl -X DELETE http://localhost:3000/examples/upload/uploads/1234567890-abc.jpg
```

### 获取文件信息

```bash
curl http://localhost:3000/examples/upload/info/uploads/1234567890-abc.jpg
```

### 获取私有文件 URL

```bash
curl "http://localhost:3000/examples/upload/private-url?key=uploads/1234567890-abc.jpg&expires=3600"
```

## 环境变量配置

在 `.env` 文件中配置：

```env
STORAGE_PROVIDER=qiniu
QINIU_ACCESS_KEY=your_access_key
QINIU_SECRET_KEY=your_secret_key
QINIU_BUCKET=your_bucket_name
QINIU_DOMAIN=https://cdn.example.com
```

## 客户端直传示例

### Web 端（使用 qiniu-js）

```javascript
// 1. 获取上传凭证
const { token, uploadUrl, domain } = await fetch('/examples/upload/token').then(r => r.json());

// 2. 使用 qiniu-js 上传
import * as qiniu from 'qiniu-js';

const observable = qiniu.upload(file, key, token, {}, {
  useCdnDomain: true,
});

observable.subscribe({
  next: (result) => {
    console.log('Progress:', result.total.percent);
  },
  error: (err) => {
    console.error('Upload failed:', err);
  },
  complete: (result) => {
    console.log('Upload complete:', result);
    const fileUrl = `${domain}/${result.key}`;
  },
});
```

### 小程序端

```javascript
// 1. 获取上传凭证
const { token, uploadUrl } = await wx.request({
  url: 'https://api.example.com/examples/upload/token',
});

// 2. 使用 wx.uploadFile 上传
wx.chooseImage({
  success: (res) => {
    wx.uploadFile({
      url: uploadUrl,
      filePath: res.tempFilePaths[0],
      name: 'file',
      formData: {
        token: token,
        key: `uploads/${Date.now()}.jpg`,
      },
      success: (uploadRes) => {
        console.log('Upload success:', uploadRes);
      },
    });
  },
});
```

## 图片处理

七牛云支持强大的图片处理功能：

### 缩略图

```
https://cdn.example.com/image.jpg?imageView2/1/w/200/h/200
```

### 裁剪

```
https://cdn.example.com/image.jpg?imageMogr2/crop/!300x300a0a0
```

### 水印

```
https://cdn.example.com/image.jpg?watermark/2/text/SGVsbG8gV29ybGQ=
```

### 格式转换

```
https://cdn.example.com/image.jpg?imageMogr2/format/webp
```

## 最佳实践

1. **文件命名**：使用时间戳 + 随机字符串，避免重名
2. **目录结构**：按类型或日期分目录存储
3. **客户端直传**：大文件使用客户端直传，减轻服务器压力
4. **CDN 加速**：配置 CDN 域名，加速文件访问
5. **安全性**：私有文件使用签名 URL，设置合理的过期时间
6. **文件验证**：上传前验证文件类型和大小
7. **错误处理**：妥善处理上传失败、网络异常等情况

## 常见场景

### 用户头像上传

```typescript
// 1. 上传图片
const result = await this.uploadService.uploadImage(file);

// 2. 更新用户头像
await this.userService.updateAvatar(userId, result.url);

// 3. 删除旧头像
if (oldAvatarKey) {
  await this.uploadService.deleteFile(oldAvatarKey);
}
```

### 文章图片上传

```typescript
// 富文本编辑器上传图片
const result = await this.uploadService.uploadImage(file);

// 返回图片 URL 给编辑器
return { url: result.url };
```

### 文件下载

```typescript
// 生成临时下载链接
const url = await this.uploadService.getPrivateUrl(key, 3600);

// 重定向到下载链接
return { url };
```

## 更多信息

查看官方文档：https://751848178.github.io/svton/packages/nestjs-object-storage
