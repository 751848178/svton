# @svton/nestjs-http

> NestJS HTTP 响应标准化模块 - 统一响应格式和异常处理

---

## 📦 包信息

| 属性 | 值 |
|------|---|
| **包名** | `@svton/nestjs-http` |
| **版本** | `1.1.0` |
| **入口** | `dist/index.js` (CJS) / `dist/index.mjs` (ESM) |
| **类型** | `dist/index.d.ts` |

---

## 🎯 设计原则

1. **统一响应** - 所有接口返回统一的 JSON 结构
2. **异常处理** - 全局捕获异常，返回友好错误信息
3. **Prisma 集成** - 自动映射 Prisma 错误到 HTTP 状态码

---

## 🚀 快速开始

### 安装

```bash
pnpm add @svton/nestjs-http
```

### 模块注册

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@svton/nestjs-http';

@Module({
  imports: [
    HttpModule.forRoot({
      successCode: 0,
      successMessage: 'success',
      includeTimestamp: true,
    }),
  ],
})
export class AppModule {}
```

---

## 📋 响应格式

### 成功响应

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "name": "John"
  },
  "traceId": "abc-123",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 错误响应

```json
{
  "code": 404,
  "message": "User not found",
  "data": null,
  "traceId": "abc-123",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 分页响应

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [...],
    "total": 100,
    "page": 1,
    "pageSize": 10,
    "totalPages": 10
  }
}
```

---

## ⚙️ 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enableExceptionFilter` | `boolean` | `true` | 启用全局异常过滤器 |
| `enableResponseInterceptor` | `boolean` | `true` | 启用响应拦截器 |
| `successCode` | `number` | `0` | 成功响应的 code 值 |
| `successMessage` | `string` | `'success'` | 成功响应的 message |
| `includeTimestamp` | `boolean` | `true` | 是否包含时间戳 |
| `getTraceId` | `(req) => string` | - | 自定义获取 traceId |
| `excludePaths` | `(string \| RegExp)[]` | `[]` | 排除的路径 |

### 异步配置

```typescript
HttpModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    successCode: 0,
    includeTimestamp: config.get('NODE_ENV') !== 'production',
    getTraceId: (req) => req.headers['x-request-id'],
    excludePaths: ['/health', '/metrics'],
  }),
});
```

---

## 🔧 异常处理

### 内置异常映射

| 异常类型 | HTTP 状态码 | 说明 |
|----------|-------------|------|
| `BadRequestException` | 400 | 请求参数错误 |
| `UnauthorizedException` | 401 | 未认证 |
| `ForbiddenException` | 403 | 无权限 |
| `NotFoundException` | 404 | 资源不存在 |
| `ConflictException` | 409 | 资源冲突 |
| `InternalServerErrorException` | 500 | 服务器错误 |

### 抛出异常

```typescript
import { NotFoundException, BadRequestException } from '@nestjs/common';

@Injectable()
export class UsersService {
  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async create(dto: CreateUserDto) {
    if (!dto.email) {
      throw new BadRequestException('Email is required');
    }
    // ...
  }
}
```

---

## 🗄️ Prisma 错误映射

自动将 Prisma 错误转换为友好的 HTTP 响应：

| Prisma 错误码 | HTTP 状态码 | 说明 |
|---------------|-------------|------|
| `P2002` | 409 Conflict | 唯一约束冲突 |
| `P2001`, `P2025` | 404 Not Found | 记录不存在 |
| `P2003` | 400 Bad Request | 外键约束失败 |
| `P2011` | 400 Bad Request | 必填字段缺失 |
| `P1001-P1003` | 503 Service Unavailable | 数据库连接错误 |

### 示例

```typescript
// 唯一约束冲突时自动返回
{
  "code": 40901,
  "message": "Unique constraint violation on email",
  "data": null
}

// 记录不存在时自动返回
{
  "code": 40401,
  "message": "Record not found",
  "data": null
}
```

### 手动使用

```typescript
import { isPrismaError, mapPrismaError } from '@svton/nestjs-http';

try {
  await this.prisma.user.create({ data });
} catch (error) {
  if (isPrismaError(error)) {
    const mapped = mapPrismaError(error);
    // { status: 409, code: 40901, message: 'Unique constraint violation on email' }
  }
}
```

---

## 🚫 排除路径

某些路径不需要统一响应格式：

```typescript
HttpModule.forRoot({
  excludePaths: [
    '/health',           // 精确匹配
    '/metrics',          // 精确匹配
    /^\/swagger/,        // 正则匹配
    '/api/webhook',      // Webhook 回调
  ],
});
```

---

## 🔗 与 Logger 集成

配合 `@svton/nestjs-logger` 使用 traceId：

```typescript
HttpModule.forRoot({
  getTraceId: (req) => req.id,  // nestjs-pino 自动生成的 request id
});
```

---

## 📝 类型定义

```typescript
// 统一响应结构
interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
  traceId?: string;
  timestamp?: string;
}

// 分页数据
interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// 分页响应
type PaginatedResponse<T> = ApiResponse<PaginatedData<T>>;
```

### 在 Controller 中使用类型

```typescript
import { ApiResponse, PaginatedResponse } from '@svton/nestjs-http';

@Controller('users')
export class UsersController {
  @Get()
  async findAll(): Promise<PaginatedResponse<User>> {
    // ResponseInterceptor 会自动包装
    return {
      items: users,
      total: 100,
      page: 1,
      pageSize: 10,
      totalPages: 10,
    };
  }
}
```

---

## ✅ 最佳实践

1. **统一使用 NestJS 内置异常**
   ```typescript
   throw new NotFoundException('User not found');
   throw new BadRequestException('Invalid email format');
   ```

2. **业务错误码规范**
   ```typescript
   // 4xxxx - 客户端错误
   // 40001 - 参数错误
   // 40101 - 未登录
   // 40301 - 无权限
   // 40401 - 资源不存在
   // 40901 - 资源冲突
   
   // 5xxxx - 服务端错误
   // 50001 - 数据库错误
   // 50301 - 服务不可用
   ```

3. **不要在 Controller 中手动包装响应**
   ```typescript
   // ❌ 不推荐
   @Get()
   findAll() {
     return { code: 0, message: 'success', data: users };
   }

   // ✅ 推荐 - 直接返回数据
   @Get()
   findAll() {
     return users;
   }
   ```

---

**相关文档**: [@svton/nestjs-logger](./nestjs-logger.md) | [@svton/nestjs-authz](./nestjs-authz.md)
