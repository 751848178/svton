# @svton/nestjs-oauth

> NestJS OAuth 模块 - 微信登录集成

---

## 📦 包信息

| 属性 | 值 |
|------|---|
| **包名** | `@svton/nestjs-oauth` |
| **版本** | `1.1.0` |
| **入口** | `dist/index.js` (CJS) / `dist/index.mjs` (ESM) |
| **类型** | `dist/index.d.ts` |

---

## 🎯 设计原则

1. **多平台支持** - 开放平台、公众号、小程序
2. **统一接口** - 不同平台使用相同的 API 风格
3. **类型安全** - 完整的 TypeScript 类型定义

---

## 🚀 快速开始

### 安装

```bash
pnpm add @svton/nestjs-oauth
```

### 模块注册

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { OAuthModule } from '@svton/nestjs-oauth';

@Module({
  imports: [
    OAuthModule.forRoot({
      wechat: [
        // 开放平台（PC 扫码登录）
        {
          platform: 'open',
          appId: 'wx_open_app_id',
          appSecret: 'wx_open_app_secret',
          callbackUrl: 'https://example.com/auth/wechat/callback',
        },
        // 公众号（H5 授权登录）
        {
          platform: 'mp',
          appId: 'wx_mp_app_id',
          appSecret: 'wx_mp_app_secret',
          callbackUrl: 'https://example.com/auth/wechat/mp/callback',
          scope: 'snsapi_userinfo',
        },
        // 小程序
        {
          platform: 'miniprogram',
          appId: 'wx_mini_app_id',
          appSecret: 'wx_mini_app_secret',
        },
      ],
    }),
  ],
})
export class AppModule {}
```

### 异步配置

```typescript
OAuthModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    wechat: [
      {
        platform: 'open',
        appId: config.get('WECHAT_OPEN_APP_ID'),
        appSecret: config.get('WECHAT_OPEN_APP_SECRET'),
        callbackUrl: config.get('WECHAT_OPEN_CALLBACK_URL'),
      },
      {
        platform: 'miniprogram',
        appId: config.get('WECHAT_MINI_APP_ID'),
        appSecret: config.get('WECHAT_MINI_APP_SECRET'),
      },
    ],
  }),
});
```

---

## ⚙️ 配置选项

### WechatProviderConfig

| 选项 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `platform` | `'open' \| 'mp' \| 'miniprogram'` | ✅ | 平台类型 |
| `appId` | `string` | ✅ | AppID |
| `appSecret` | `string` | ✅ | AppSecret |
| `callbackUrl` | `string` | - | 回调地址（open/mp 需要） |
| `scope` | `string` | - | 授权作用域 |

### OAuthModuleOptions

| 选项 | 类型 | 说明 |
|------|------|------|
| `wechat` | `WechatProviderConfig \| WechatProviderConfig[]` | 微信配置 |
| `stateGenerator` | `() => string \| Promise<string>` | State 生成器 |
| `stateValidator` | `(state: string) => boolean \| Promise<boolean>` | State 验证器 |

---

## 🔧 使用方法

### 开放平台（PC 扫码登录）

```typescript
import { Controller, Get, Query, Res } from '@nestjs/common';
import { OAuthService } from '@svton/nestjs-oauth';
import type { Response } from 'express';

@Controller('auth/wechat')
export class WechatAuthController {
  constructor(private oauthService: OAuthService) {}

  // 生成授权 URL
  @Get('login')
  async login(@Res() res: Response) {
    const state = await this.oauthService.generateState();
    // 存储 state 到 session 或 Redis
    
    const url = this.oauthService.wechat.getAuthorizationUrl('open', state);
    res.redirect(url);
  }

  // 处理回调
  @Get('callback')
  async callback(@Query('code') code: string, @Query('state') state: string) {
    // 验证 state
    const isValid = await this.oauthService.validateState(state);
    if (!isValid) {
      throw new UnauthorizedException('Invalid state');
    }

    // 获取 access_token
    const tokenResult = await this.oauthService.wechat.getAccessToken('open', code);
    if (!tokenResult.success) {
      throw new UnauthorizedException(tokenResult.error?.message);
    }

    // 获取用户信息
    const userResult = await this.oauthService.wechat.getUserInfo(
      tokenResult.data!.access_token,
      tokenResult.data!.openid,
    );
    if (!userResult.success) {
      throw new UnauthorizedException(userResult.error?.message);
    }

    // 处理用户登录/注册
    const user = await this.usersService.findOrCreateByWechat({
      openid: tokenResult.data!.openid,
      unionid: tokenResult.data!.unionid,
      nickname: userResult.data!.nickname,
      avatar: userResult.data!.headimgurl,
    });

    return { user, token: this.authService.generateToken(user) };
  }
}
```

### 公众号（H5 授权登录）

```typescript
@Controller('auth/wechat/mp')
export class WechatMpAuthController {
  constructor(private oauthService: OAuthService) {}

  @Get('login')
  async login(@Res() res: Response) {
    const state = await this.oauthService.generateState();
    const url = this.oauthService.wechat.getAuthorizationUrl('mp', state);
    res.redirect(url);
  }

  @Get('callback')
  async callback(@Query('code') code: string, @Query('state') state: string) {
    const tokenResult = await this.oauthService.wechat.getAccessToken('mp', code);
    if (!tokenResult.success) {
      throw new UnauthorizedException(tokenResult.error?.message);
    }

    const userResult = await this.oauthService.wechat.getUserInfo(
      tokenResult.data!.access_token,
      tokenResult.data!.openid,
    );

    // 处理用户登录...
  }
}
```

### 小程序登录

```typescript
@Controller('auth/wechat/mini')
export class WechatMiniAuthController {
  constructor(private oauthService: OAuthService) {}

  // 小程序 code 换取 session
  @Post('login')
  async login(@Body('code') code: string) {
    const result = await this.oauthService.wechat.code2Session(code);
    if (!result.success) {
      throw new UnauthorizedException(result.error?.message);
    }

    // 查找或创建用户
    const user = await this.usersService.findOrCreateByWechat({
      openid: result.data!.openid,
      unionid: result.data!.unionid,
    });

    return {
      user,
      token: this.authService.generateToken(user),
      sessionKey: result.data!.session_key, // 用于解密用户信息
    };
  }

  // 获取手机号
  @Post('phone')
  async getPhone(
    @Body('code') code: string,
    @Body('accessToken') accessToken: string,
  ) {
    const result = await this.oauthService.wechat.getPhoneNumber(code, accessToken);
    if (!result.success) {
      throw new BadRequestException(result.error?.message);
    }

    return {
      phoneNumber: result.data!.phoneNumber,
      purePhoneNumber: result.data!.purePhoneNumber,
      countryCode: result.data!.countryCode,
    };
  }
}
```

---

## 📋 WechatProvider API

```typescript
// 生成授权 URL
wechat.getAuthorizationUrl(
  platform: 'open' | 'mp',
  state: string,
  appId?: string
): string

// 获取 access_token
await wechat.getAccessToken(
  platform: 'open' | 'mp',
  code: string,
  appId?: string
): Promise<OAuthResult<WechatAccessTokenResponse>>

// 刷新 access_token
await wechat.refreshAccessToken(
  platform: 'open' | 'mp',
  refreshToken: string,
  appId?: string
): Promise<OAuthResult<WechatAccessTokenResponse>>

// 获取用户信息
await wechat.getUserInfo(
  accessToken: string,
  openid: string
): Promise<OAuthResult<WechatUserInfo>>

// 小程序 code2session
await wechat.code2Session(
  code: string,
  appId?: string
): Promise<OAuthResult<WechatMiniProgramSession>>

// 小程序获取手机号
await wechat.getPhoneNumber(
  code: string,
  accessToken: string
): Promise<OAuthResult<WechatPhoneInfo>>
```

---

## 📋 类型定义

### WechatAccessTokenResponse

```typescript
interface WechatAccessTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  openid: string;
  scope: string;
  unionid?: string;
}
```

### WechatUserInfo

```typescript
interface WechatUserInfo {
  openid: string;
  nickname: string;
  sex: number;
  province: string;
  city: string;
  country: string;
  headimgurl: string;
  privilege: string[];
  unionid?: string;
}
```

### WechatMiniProgramSession

```typescript
interface WechatMiniProgramSession {
  openid: string;
  session_key: string;
  unionid?: string;
}
```

### WechatPhoneInfo

```typescript
interface WechatPhoneInfo {
  phoneNumber: string;
  purePhoneNumber: string;
  countryCode: string;
  watermark: {
    timestamp: number;
    appid: string;
  };
}
```

---

## ✅ 最佳实践

1. **使用 State 防止 CSRF**
   ```typescript
   OAuthModule.forRoot({
     stateGenerator: async () => {
       const state = crypto.randomBytes(16).toString('hex');
       await redis.set(`oauth:state:${state}`, '1', 'EX', 300);
       return state;
     },
     stateValidator: async (state) => {
       const exists = await redis.get(`oauth:state:${state}`);
       if (exists) {
         await redis.del(`oauth:state:${state}`);
         return true;
       }
       return false;
     },
   });
   ```

2. **统一用户标识**
   ```typescript
   // 使用 unionid 关联多平台账号
   const user = await this.usersService.findByUnionId(unionid);
   ```

3. **处理 Token 过期**
   ```typescript
   // 定期刷新 access_token
   const result = await wechat.refreshAccessToken('open', refreshToken);
   ```

4. **错误处理**
   ```typescript
   const result = await wechat.getAccessToken('open', code);
   if (!result.success) {
     this.logger.error(`OAuth failed: ${result.error?.code} - ${result.error?.message}`);
     throw new UnauthorizedException('登录失败，请重试');
   }
   ```

---

**相关文档**: [@svton/nestjs-authz](./nestjs-authz.md) | [后端模块开发](../framework/backend/modules.md)
