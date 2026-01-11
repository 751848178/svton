# @svton/nestjs-oauth

NestJS OAuth 模块，支持微信登录（开放平台、公众号、小程序）。

## 安装

```bash
pnpm add @svton/nestjs-oauth
```

## 快速开始

### 模块注册

```typescript
import { Module } from '@nestjs/common';
import { OAuthModule } from '@svton/nestjs-oauth';

@Module({
  imports: [
    OAuthModule.forRoot({
      wechat: [
        // 微信开放平台 (网站扫码登录)
        {
          platform: 'open',
          appId: 'your-open-app-id',
          appSecret: 'your-open-app-secret',
          callbackUrl: 'https://your-domain.com/auth/wechat/callback',
          scope: 'snsapi_login',
        },
        // 微信公众号 (网页授权)
        {
          platform: 'mp',
          appId: 'your-mp-app-id',
          appSecret: 'your-mp-app-secret',
          callbackUrl: 'https://your-domain.com/auth/wechat-mp/callback',
          scope: 'snsapi_userinfo',
        },
        // 微信小程序
        {
          platform: 'miniprogram',
          appId: 'your-miniprogram-app-id',
          appSecret: 'your-miniprogram-app-secret',
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
  useFactory: (config: ConfigService) => ({
    wechat: {
      platform: 'miniprogram',
      appId: config.get('WECHAT_MINIPROGRAM_APPID'),
      appSecret: config.get('WECHAT_MINIPROGRAM_SECRET'),
    },
  }),
  inject: [ConfigService],
});
```

## 使用示例

### 微信开放平台/公众号登录

```typescript
import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { OAuthService } from '@svton/nestjs-oauth';

@Controller('auth')
export class AuthController {
  constructor(private readonly oauthService: OAuthService) {}

  // 发起授权
  @Get('wechat')
  async wechatAuth(@Res() res: Response) {
    const state = await this.oauthService.generateState();
    // TODO: 存储 state 到 session/redis
    const url = this.oauthService.wechat.getAuthorizationUrl('open', state);
    res.redirect(url);
  }

  // 授权回调
  @Get('wechat/callback')
  async wechatCallback(@Query('code') code: string, @Query('state') state: string) {
    // TODO: 验证 state
    
    // 获取 access_token
    const tokenResult = await this.oauthService.wechat.getAccessToken('open', code);
    if (!tokenResult.success) {
      throw new Error(tokenResult.error?.message);
    }

    // 获取用户信息
    const userResult = await this.oauthService.wechat.getUserInfo(
      tokenResult.data!.access_token,
      tokenResult.data!.openid,
    );

    return userResult.data;
  }
}
```

### 微信小程序登录

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { OAuthService } from '@svton/nestjs-oauth';

@Controller('auth')
export class AuthController {
  constructor(private readonly oauthService: OAuthService) {}

  @Post('miniprogram/login')
  async miniprogramLogin(@Body('code') code: string) {
    const result = await this.oauthService.wechat.code2Session(code);
    
    if (!result.success) {
      throw new Error(result.error?.message);
    }

    // result.data 包含 openid, session_key, unionid
    return {
      openid: result.data!.openid,
      unionid: result.data!.unionid,
    };
  }

  @Post('miniprogram/phone')
  async getPhoneNumber(
    @Body('code') code: string,
    @Body('accessToken') accessToken: string,
  ) {
    const result = await this.oauthService.wechat.getPhoneNumber(code, accessToken);
    
    if (!result.success) {
      throw new Error(result.error?.message);
    }

    return result.data;
  }
}
```

## API 参考

### OAuthService

| 方法 | 说明 |
|------|------|
| `wechat` | 获取 WechatProvider 实例 |
| `generateState()` | 生成随机 state |
| `validateState(state)` | 验证 state |

### WechatProvider

| 方法 | 说明 |
|------|------|
| `getAuthorizationUrl(platform, state, appId?)` | 生成授权 URL |
| `getAccessToken(platform, code, appId?)` | 获取 access_token |
| `refreshAccessToken(platform, refreshToken, appId?)` | 刷新 access_token |
| `getUserInfo(accessToken, openid)` | 获取用户信息 |
| `code2Session(code, appId?)` | 小程序 code 换 session |
| `getPhoneNumber(code, accessToken)` | 小程序获取手机号 |

## 微信平台说明

| 平台 | platform | 说明 |
|------|----------|------|
| 开放平台 | `open` | 网站应用扫码登录 |
| 公众号 | `mp` | 微信内网页授权 |
| 小程序 | `miniprogram` | 小程序登录 |

## License

MIT
