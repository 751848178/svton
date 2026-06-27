# 对象存储使用指南

本项目已集成 `@svton/nestjs-object-storage` 对象存储模块，支持七牛云和阿里云 OSS。

## 已安装的包

- `@svton/nestjs-object-storage` - 对象存储抽象层
- `@svton/nestjs-object-storage-qiniu-kodo` - 七牛云实现

## 配置文件

- `src/config/storage.config.ts` - 存储配置
- `.env` - 环境变量配置

## 示例代码位置

查看 `src/examples/storage/` 目录获取完整示例。

## 核心 API

### 上传文件

```typescript
const result = await this.storageService.upload(file, 'uploads/');
```

### 获取上传凭证

```typescript
const token = await this.storageService.getUploadToken();
```

### 删除文件

```typescript
await this.storageService.delete(key);
```

## 文档链接

- 官方文档：https://751848178.github.io/svton/packages/nestjs-object-storage
- 示例代码：`src/examples/storage/`
