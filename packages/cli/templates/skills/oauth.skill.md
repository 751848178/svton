# OAuth 登录使用指南

本项目已集成 `@svton/nestjs-oauth` OAuth 登录模块，支持微信登录。

## 已安装的包

- `@svton/nestjs-oauth` - OAuth 登录模块

## 配置文件

- `src/config/oauth.config.ts` - OAuth 配置
- `.env` - 环境变量配置

## 示例代码位置

查看 `src/examples/oauth/` 目录获取完整示例。

## 支持的登录方式

- 微信开放平台（PC 扫码登录）
- 微信公众号（网页授权）
- 微信小程序（code2Session）

## 核心 API

### 获取授权 URL

```typescript
const url = this.oauthService.wechat.getAuthorizationUrl('open', state);
```

### 小程序登录

```typescript
const result = await this.oauthService.wechat.code2Session(code);
```

## 文档链接

- 官方文档：https://751848178.github.io/svton/packages/nestjs-oauth
- 示例代码：`src/examples/oauth/`
