# @svton/dynamic-config

> 动态配置管理系统 - 支持多层缓存、热更新、NestJS 集成和 React 组件

---

## 📦 包信息

| 属性 | 值 |
|------|---|
| **包名** | `@svton/dynamic-config` |
| **版本** | `0.2.0` |
| **入口** | `dist/index.js` (CJS) / `dist/index.mjs` (ESM) |
| **类型** | `dist/index.d.ts` |

---

## 🎯 设计原则

1. **动态配置** - 运行时修改配置，无需重启服务
2. **多层缓存** - Redis 优先，内存兜底的分层缓存策略
3. **模块化** - 核心逻辑与框架集成分离，按需引入
4. **类型安全** - 完整的 TypeScript 类型支持

---

## 📁 子模块

| 模块 | 说明 | 导入路径 |
|------|------|----------|
| core | 核心逻辑（框架无关） | `@svton/dynamic-config/core` |
| nestjs | NestJS 集成 | `@svton/dynamic-config/nestjs` |
| prisma | Prisma 适配器 | `@svton/dynamic-config/prisma` |
| react | React 组件和 Hooks | `@svton/dynamic-config/react` |

---

## 🚀 快速开始

### 安装

```bash
pnpm add @svton/dynamic-config
```

### 1. 添加 Prisma Schema

```prisma
// schema.prisma
model Config {
  id           Int      @id @default(autoincrement())
  key          String   @unique @db.VarChar(100)
  value        String   @db.Text
  type         String   @db.VarChar(20)
  category     String   @db.VarChar(50)
  label        String   @db.VarChar(100)
  description  String?  @db.VarChar(500)
  isPublic     Boolean  @default(false)
  isRequired   Boolean  @default(false)
  defaultValue String?  @db.Text
  options      String?  @db.Text
  sort         Int      @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model Dictionary {
  id          Int      @id @default(autoincrement())
  code        String   @db.VarChar(50)
  parentId    Int?
  label       String   @db.VarChar(100)
  value       String   @db.VarChar(200)
  type        String   @db.VarChar(20)
  sort        Int      @default(0)
  isEnabled   Boolean  @default(true)
  description String?  @db.VarChar(500)
  extra       String?  @db.Text
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([code])
}
```

### 2. NestJS 集成

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { DynamicConfigModule } from '@svton/dynamic-config/nestjs';
import { PrismaConfigRepository, PrismaDictionaryRepository } from '@svton/dynamic-config/prisma';
import { TieredCache, RedisCache, MemoryCache } from '@svton/dynamic-config/core';

@Module({
  imports: [
    DynamicConfigModule.forRootAsync({
      imports: [PrismaModule, RedisModule],
      useFactory: (prisma, redis) => ({
        configRepository: new PrismaConfigRepository(prisma),
        dictionaryRepository: new PrismaDictionaryRepository(prisma),
        cache: new TieredCache(
          new RedisCache(redis, { prefix: 'config:' }),
          new MemoryCache({ prefix: 'config:' }),
        ),
        isGlobal: true,
      }),
      inject: [PrismaService, RedisService],
    }),
  ],
})
export class AppModule {}
```

### 3. 使用配置服务

```typescript
import { Injectable } from '@nestjs/common';
import { DynamicConfigService } from '@svton/dynamic-config/nestjs';

@Injectable()
export class UploadService {
  constructor(private configService: DynamicConfigService) {}

  async upload(file: File) {
    // 获取配置
    const storageType = await this.configService.getString('storage.type', 'local');
    const maxSize = await this.configService.getNumber('upload.maxSize', 10485760);
    const allowedTypes = await this.configService.getJson<string[]>('upload.allowedTypes', []);

    // 使用配置...
  }
}
```

---

## 🔧 Core 模块

### ConfigManager

核心配置管理器，提供配置的读取、写入、缓存管理。

```typescript
import { ConfigManager, MemoryCache } from '@svton/dynamic-config/core';

const manager = new ConfigManager({
  repository: configRepository,
  cache: new MemoryCache({ prefix: 'config:' }),
  preload: true,
});

// 获取配置
await manager.get<string>('storage.type', 'local');
await manager.getString('storage.type', 'local');
await manager.getNumber('upload.maxSize', 10485760);
await manager.getBoolean('features.enableComment', true);
await manager.getJson<string[]>('upload.allowedTypes', []);

// 设置配置
await manager.set('storage.type', 'cos');

// 批量更新
await manager.batchUpdate([
  { key: 'storage.type', value: 'cos' },
  { key: 'upload.maxSize', value: 20971520 },
]);

// 获取分类配置
await manager.getByCategory('storage');

// 获取公开配置
await manager.getPublicConfigs();

// 重新加载
await manager.reload();
```

### 缓存策略

```typescript
import { MemoryCache, RedisCache, TieredCache } from '@svton/dynamic-config/core';

// 内存缓存
const memoryCache = new MemoryCache({
  prefix: 'config:',
  defaultTtl: 3600, // 秒
});

// Redis 缓存
const redisCache = new RedisCache(redisClient, {
  prefix: 'config:',
  defaultTtl: 3600,
});

// 分层缓存（推荐）
// Redis 优先，内存兜底，Redis 故障时自动降级
const tieredCache = new TieredCache(redisCache, memoryCache);
```

### DictionaryManager

字典管理器，支持树形结构。

```typescript
import { DictionaryManager } from '@svton/dynamic-config/core';

const manager = new DictionaryManager({
  repository: dictionaryRepository,
  cache: memoryCache,
  cacheTtl: 3600,
});

// 获取字典
await manager.findAll();
await manager.findByCode('storage_type');
await manager.getTree('category'); // 树形结构

// 创建字典
await manager.create({
  code: 'storage_type',
  label: '本地存储',
  value: 'local',
  type: 'enum',
});
```

---

## 🏗️ NestJS 模块

### DynamicConfigModule

```typescript
// 同步配置
DynamicConfigModule.forRoot({
  configRepository: new PrismaConfigRepository(prisma),
  dictionaryRepository: new PrismaDictionaryRepository(prisma),
  cache: new MemoryCache(),
  registerController: true,  // 是否注册默认 Controller
  isGlobal: false,           // 是否全局模块
  preload: true,             // 是否预加载配置
});

// 异步配置（推荐）
DynamicConfigModule.forRootAsync({
  imports: [PrismaModule, RedisModule],
  useFactory: (prisma, redis) => ({
    configRepository: new PrismaConfigRepository(prisma),
    dictionaryRepository: new PrismaDictionaryRepository(prisma),
    cache: new TieredCache(
      new RedisCache(redis),
      new MemoryCache(),
    ),
  }),
  inject: [PrismaService, RedisService],
});
```

### DynamicConfigService

```typescript
import { DynamicConfigService } from '@svton/dynamic-config/nestjs';

@Injectable()
export class MyService {
  constructor(private configService: DynamicConfigService) {}

  async example() {
    // 类型化获取
    const str = await this.configService.getString('key', 'default');
    const num = await this.configService.getNumber('key', 0);
    const bool = await this.configService.getBoolean('key', false);
    const json = await this.configService.getJson<MyType>('key', {});

    // 设置配置
    await this.configService.set('key', 'value');

    // 批量更新
    await this.configService.batchUpdate([
      { key: 'key1', value: 'value1' },
      { key: 'key2', value: 'value2' },
    ]);

    // 获取分类配置
    const storageConfigs = await this.configService.getByCategory('storage');

    // 获取公开配置（前端可访问）
    const publicConfigs = await this.configService.getPublicConfigs();

    // 重新加载缓存
    await this.configService.reload();
  }
}
```

### 自定义 Controller（添加权限控制）

```typescript
import { Controller, UseGuards, Get, Put, Delete, Param, Body } from '@nestjs/common';
import { BaseConfigController, DynamicConfigService } from '@svton/dynamic-config/nestjs';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { Roles } from './auth/decorators/roles.decorator';
import { Public } from './auth/decorators/public.decorator';

@Controller('config')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConfigController extends BaseConfigController {
  constructor(configService: DynamicConfigService) {
    super(configService);
  }

  // 公开接口，无需认证
  @Public()
  @Get('public')
  async getPublicConfigs() {
    return super.getPublicConfigs();
  }

  // 需要 admin 角色
  @Roles('admin')
  @Put('batch')
  async batchUpdate(@Body() body: { configs: Array<{ key: string; value: any }> }) {
    return super.batchUpdate(body);
  }

  @Roles('admin')
  @Delete(':key')
  async delete(@Param('key') key: string) {
    return super.delete(key);
  }
}
```

---

## ⚛️ React 模块

### Provider 配置

```tsx
import { DynamicConfigProvider } from '@svton/dynamic-config/react';

// 实现 API 客户端
const configApi = {
  get: (key) => fetch(`/api/config/${key}`).then(r => r.json()),
  set: (key, value) => fetch(`/api/config/${key}`, {
    method: 'PUT',
    body: JSON.stringify({ value }),
  }),
  getByCategory: (category) => fetch(`/api/config/category/${category}`).then(r => r.json()),
  getPublicConfigs: () => fetch('/api/config/public').then(r => r.json()),
  getSystemConfig: () => fetch('/api/config/system').then(r => r.json()),
  batchUpdate: (configs) => fetch('/api/config/batch', {
    method: 'PUT',
    body: JSON.stringify({ configs }),
  }),
  delete: (key) => fetch(`/api/config/${key}`, { method: 'DELETE' }),
  reload: () => fetch('/api/config/reload', { method: 'POST' }),
};

const dictionaryApi = {
  findAll: () => fetch('/api/dictionary').then(r => r.json()),
  findByCode: (code) => fetch(`/api/dictionary/code/${code}`).then(r => r.json()),
  getTree: (code) => fetch(`/api/dictionary/tree/${code}`).then(r => r.json()),
  create: (data) => fetch('/api/dictionary', {
    method: 'POST',
    body: JSON.stringify(data),
  }).then(r => r.json()),
  update: (id, data) => fetch(`/api/dictionary/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }).then(r => r.json()),
  delete: (id) => fetch(`/api/dictionary/${id}`, { method: 'DELETE' }),
};

function App() {
  return (
    <DynamicConfigProvider configApi={configApi} dictionaryApi={dictionaryApi}>
      <ConfigPage />
    </DynamicConfigProvider>
  );
}
```

### Config Hooks

```typescript
import {
  useConfig,
  useConfigCategory,
  usePublicConfigs,
  useSystemConfig,
  useConfigMutation,
} from '@svton/dynamic-config/react';

// 获取单个配置
function StorageTypeSelect() {
  const { value, loading, update } = useConfig('storage.type', 'local');

  if (loading) return <Spinner />;

  return (
    <Select
      value={value}
      onChange={(v) => update(v)}
    />
  );
}

// 获取分类配置
function StorageSettings() {
  const { configs, loading, refetch } = useConfigCategory('storage');
  const { batchUpdate, loading: saving } = useConfigMutation();

  const handleSave = async (values) => {
    const updates = Object.entries(values).map(([key, value]) => ({ key, value }));
    await batchUpdate(updates);
    refetch();
  };

  // ...
}

// 获取公开配置
function PublicConfigDisplay() {
  const { configs, loading } = usePublicConfigs();
  // configs: Record<string, any>
}

// 获取系统配置（嵌套结构）
function SystemConfigDisplay() {
  const { config, loading } = useSystemConfig();
  // config: { storage: { type: 'local', ... }, upload: { ... } }
}

// 配置修改
function ConfigActions() {
  const { set, batchUpdate, remove, reload, loading } = useConfigMutation();

  const handleSet = () => set('key', 'value');
  const handleBatch = () => batchUpdate([{ key: 'k1', value: 'v1' }]);
  const handleRemove = () => remove('key');
  const handleReload = () => reload();
}
```

### Dictionary Hooks

```typescript
import {
  useDictionaries,
  useDictionaryByCode,
  useDictionaryTree,
  useDictionaryMutation,
} from '@svton/dynamic-config/react';

// 获取所有字典
const { items, loading, refetch } = useDictionaries();

// 根据编码获取字典
const { items, loading } = useDictionaryByCode('storage_type');

// 获取字典树
const { tree, loading } = useDictionaryTree('category');

// 字典修改
const { create, update, remove, loading } = useDictionaryMutation();

await create({ code: 'type', label: '类型', value: 'value', type: 'enum' });
await update(1, { label: '新名称' });
await remove(1);
```

---

## 📊 配置值类型

| 类型 | 说明 | 示例值 |
|------|------|--------|
| `string` | 字符串 | `"hello"` |
| `number` | 数字 | `123` |
| `boolean` | 布尔值 | `true` |
| `json` | JSON 对象 | `{"key": "value"}` |
| `array` | 数组 | `["a", "b", "c"]` |
| `password` | 密码（加密存储） | `"***"` |
| `enum` | 枚举值 | `"local"` |

---

## 🗄️ 数据库表结构

### Config 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 主键 |
| key | varchar(100) | 配置键（唯一） |
| value | text | 配置值 |
| type | varchar(20) | 值类型 |
| category | varchar(50) | 分类 |
| label | varchar(100) | 显示名称 |
| description | varchar(500) | 说明 |
| isPublic | boolean | 是否公开 |
| isRequired | boolean | 是否必填 |
| defaultValue | text | 默认值 |
| options | text | 可选项（enum 类型） |
| sort | int | 排序 |

### Dictionary 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 主键 |
| code | varchar(50) | 字典编码 |
| parentId | int | 父级 ID |
| label | varchar(100) | 显示名称 |
| value | varchar(200) | 字典值 |
| type | varchar(20) | 类型（enum/tree/list） |
| sort | int | 排序 |
| isEnabled | boolean | 是否启用 |
| description | varchar(500) | 说明 |
| extra | text | 扩展字段 |

---

## ✅ 最佳实践

### 配置键命名规范

```typescript
// ✅ 推荐：使用点分隔的层级结构
'storage.type'
'storage.cos.secretId'
'upload.maxSize'
'upload.allowedTypes'

// ❌ 不推荐
'storageType'
'STORAGE_TYPE'
```

### 缓存策略选择

```typescript
// 开发环境：使用内存缓存
const cache = new MemoryCache({ prefix: 'config:' });

// 生产环境：使用分层缓存
const cache = new TieredCache(
  new RedisCache(redis, { prefix: 'config:', defaultTtl: 3600 }),
  new MemoryCache({ prefix: 'config:', defaultTtl: 300 }),
);
```

### 配置分类建议

| 分类 | 说明 | 示例配置 |
|------|------|----------|
| `storage` | 存储配置 | `storage.type`, `storage.cos.secretId` |
| `upload` | 上传配置 | `upload.maxSize`, `upload.allowedTypes` |
| `sms` | 短信配置 | `sms.provider`, `sms.signName` |
| `email` | 邮件配置 | `email.smtp.host`, `email.from` |
| `site` | 站点配置 | `site.name`, `site.logo` |
| `features` | 功能开关 | `features.enableComment` |

---

**相关文档**: [@svton/nestjs-redis](./nestjs-redis.md) | [后端模块开发](../backend/modules.md)
