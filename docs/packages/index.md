# 包参考

> 所有 `@svton/*` 共享包与 NestJS 模块的 API 参考。

这些包既被 Svton 框架内部使用,也可独立安装到任意项目:

```bash
pnpm add @svton/api-client @svton/hooks @svton/types
```

> **CLI 工具 `@svton/cli`** 是项目运行入口,不在本参考列表 —— 见 [框架 → CLI](/framework/cli)。

## 通用包

| 包 | 说明 |
|----|------|
| [`@svton/types`](./types) | 前后端共享的类型定义(单一数据源) |
| [`@svton/api-client`](./api-client) | API 契约客户端,模块增强管理接口 |
| [`@svton/hooks`](./hooks) | 通用 React Hooks |
| [`@svton/logger`](./logger) | 通用日志 |
| [`@svton/service`](./service) | 服务层基类 |
| [`@svton/ui`](./ui) | Web 端 UI 组件库 |
| [`@svton/taro-ui`](./taro-ui) | Taro 端 UI 组件库 |
| [`@svton/dynamic-config`](./dynamic-config) | 动态配置 |
| [`@svton/authz`](./authz) | RBAC 权限核心 |

## NestJS 模块

`nestjs-authz` · `nestjs-cache` · `nestjs-config-schema` · `nestjs-http` · `nestjs-logger` · `nestjs-oauth` · `nestjs-payment` · `nestjs-queue` · `nestjs-rate-limit` · `nestjs-redis` · `nestjs-sms` · `nestjs-object-storage` · `nestjs-object-storage-qiniu-kodo` · `nestjs-object-storage-tencent-cos`

(各模块详情见左侧「NestJS 模块」分组。)
