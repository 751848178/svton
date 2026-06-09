# @svton/dynamic-config

动态配置管理系统，支持多层缓存、热更新、NestJS 集成和 React 组件。

## 特性

- 🚀 **动态配置** - 运行时修改配置，无需重启服务
- 💾 **多层缓存** - Redis 优先，内存兜底的分层缓存策略
- 🔧 **类型安全** - 完整的 TypeScript 类型支持
- 📦 **模块化** - 核心逻辑与框架集成分离
- 🎨 **React 组件** - 开箱即用的配置管理 UI 组件
- 🔌 **可扩展** - 支持自定义 Repository 和缓存策略

## 安装

```bash
pnpm add @svton/dynamic-config
```

## 子模块

| 模块 | 说明 | 导入路径 |
|------|------|----------|
| core | 核心逻辑（框架无关） | `@svton/dynamic-config/core` |
| nestjs | NestJS 集成 | `@svton/dynamic-config/nestjs` |
| prisma | Prisma 适配器 | `@svton/dynamic-config/prisma` |
| react | React 组件和 Hooks | `@svton/dynamic-config/react` |

## 快速开始

### 1. 添加 Prisma Schema

将 `src/prisma/schema.prisma.template` 中的模型添加到你的 `schema.prisma` 文件。

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
    const storageType = await this.configService.getString('storage.type', 'local');
    const maxSize = await this.configService.getNumber('upload.maxSize', 10485760);

    // ...
  }
}
```

### 4. 自定义 Controller（添加权限控制）

```typescript
import { Controller, UseGuards, Delete, Param } from '@nestjs/common';
import { BaseConfigController, DynamicConfigService } from '@svton/dynamic-config/nestjs';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { AuthzGuard, Public, Roles } from '@svton/nestjs-authz';

@Controller('config')
@UseGuards(JwtAuthGuard, AuthzGuard)
export class ConfigController extends BaseConfigController {
  constructor(configService: DynamicConfigService) {
    super(configService);
  }

  @Public()
  @Get('public')
  async getPublicConfigs() {
    return super.getPublicConfigs();
  }

  @Roles('admin')
  @Delete(':key')
  async delete(@Param('key') key: string) {
    return super.delete(key);
  }
}
```

### 5. React 组件

```tsx
import {
  DynamicConfigProvider,
  useConfigCategory,
  useConfigMutation,
  ConfigForm,
  initConfigFormValues,
} from '@svton/dynamic-config/react';

// 1. 实现 API 客户端
const configApi = {
  getPublicConfigs: () => fetch('/api/config/public').then(r => r.json()),
  getByCategory: (category) => fetch(`/api/config/category/${category}`).then(r => r.json()),
  batchUpdate: (configs) => fetch('/api/config/batch', {
    method: 'PUT',
    body: JSON.stringify({ configs }),
  }),
  // ... 其他方法
};

// 2. 包装 Provider
function App() {
  return (
    <DynamicConfigProvider configApi={configApi} dictionaryApi={dictionaryApi}>
      <ConfigPage />
    </DynamicConfigProvider>
  );
}

// 3. 使用 Hooks 和组件
function ConfigPage() {
  const { configs, loading, refetch } = useConfigCategory('storage');
  const { batchUpdate, loading: saving } = useConfigMutation();
  const [values, setValues] = useState({});

  useEffect(() => {
    if (configs.length > 0) {
      setValues(initConfigFormValues(configs));
    }
  }, [configs]);

  const handleSave = async () => {
    const updates = Object.entries(values).map(([key, value]) => ({ key, value }));
    await batchUpdate(updates);
    refetch();
  };

  return (
    <ConfigForm
      configs={configs}
      values={values}
      onChange={(key, value) => setValues(prev => ({ ...prev, [key]: value }))}
      onSave={handleSave}
      saving={saving}
      components={uiComponents} // 传入 shadcn/ui 组件
    />
  );
}
```

## API 文档

### Core

#### ConfigManager

```typescript
const manager = new ConfigManager({
  repository: configRepository,
  cache: cacheStrategy,
  preload: true,
  logger: customLogger,
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

// 获取系统配置（嵌套结构）
await manager.getSystemConfig();

// 重新加载
await manager.reload();
```

#### 缓存策略

```typescript
import { MemoryCache, RedisCache, TieredCache } from '@svton/dynamic-config/core';

// 内存缓存
const memoryCache = new MemoryCache({ prefix: 'config:', defaultTtl: 3600 });

// Redis 缓存
const redisCache = new RedisCache(redisClient, { prefix: 'config:', defaultTtl: 3600 });

// 分层缓存（Redis 优先，内存兜底）
const tieredCache = new TieredCache(redisCache, memoryCache);
```

### NestJS

#### DynamicConfigModule

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

// 异步配置
DynamicConfigModule.forRootAsync({
  imports: [PrismaModule],
  useFactory: (prisma) => ({
    configRepository: new PrismaConfigRepository(prisma),
    // ...
  }),
  inject: [PrismaService],
});
```

### React

#### Hooks

```typescript
// 获取单个配置
const { value, loading, error, update } = useConfig('storage.type', 'local');

// 获取分类配置
const { configs, loading, error, refetch } = useConfigCategory('storage');

// 获取公开配置
const { configs, loading, error } = usePublicConfigs();

// 获取系统配置
const { config, loading, error } = useSystemConfig();

// 配置修改
const { set, batchUpdate, remove, reload, loading } = useConfigMutation();

// 字典相关
const { items, loading, error } = useDictionaries();
const { items, loading, error } = useDictionaryByCode('storage_type');
const { tree, loading, error } = useDictionaryTree('category');
const { create, update, remove, loading } = useDictionaryMutation();
```

## 数据库 Schema

### Config 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 主键 |
| key | varchar(100) | 配置键（唯一） |
| value | text | 配置值（JSON 字符串） |
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

## License

MIT
