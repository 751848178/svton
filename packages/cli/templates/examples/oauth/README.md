# OAuth 登录示例

本示例展示如何使用 `@svton/nestjs-oauth` 模块实现微信登录。

## 文件说明

- `auth.service.ts` - 认证服务，处理 OAuth 流程
- `auth.controller.ts` - 认证控制器，提供登录接口

## 支持的登录方式

### 1. 微信开放平台（PC 扫码登录）

适用于网站应用，用户扫码登录。

### 2. 微信公众号（网页授权）

适用于公众号内网页，静默授权或用户授权。

### 3. 微信小程序

适用于小程序，使用 wx.login() 获取 code。

## 使用方式

### PC 扫码登录

```typescript
// 1. 获取授权 URL
const url = this.authService.getWechatOpenAuthUrl('/dashboard');

// 2. 重定向到微信授权页面
// 用户扫码授权后，微信会回调到 callback 接口

// 3. 处理回调
const userInfo = await this.authService.handleWechatOpenCallback(code);
```

### 公众号网页授权

```typescript
// 1. 获取授权 URL
const url = this.authService.getWechatMpAuthUrl('/profile');

// 2. 重定向到微信授权页面
// 用户授权后，微信会回调到 callback 接口

// 3. 处理回调
const userInfo = await this.authService.handleWechatMpCallback(code);
```

### 小程序登录

```typescript
// 小程序端
wx.login({
  success: (res) => {
    // 将 code 发送到后端
    wx.request({
      url: 'https://api.example.com/examples/auth/wechat/miniprogram/login',
      method: 'POST',
      data: { code: res.code },
    });
  },
});

// 后端处理
const result = await this.authService.miniprogramLogin(code);
```

### 小程序获取手机号

```typescript
// 小程序端
<button open-type="getPhoneNumber" @getphonenumber="getPhoneNumber">
  获取手机号
</button>

// 获取到 code 后发送到后端
const result = await this.authService.getMiniprogramPhoneNumber(code);
```

## 测试接口

### PC 扫码登录

```bash
# 1. 访问登录页面（会重定向到微信）
curl http://localhost:3000/examples/auth/wechat/open/login

# 2. 扫码授权后，微信会回调到：
# http://localhost:3000/examples/auth/wechat/open/callback?code=xxx&state=/
```

### 小程序登录

```bash
curl -X POST http://localhost:3000/examples/auth/wechat/miniprogram/login \
  -H "Content-Type: application/json" \
  -d '{"code":"081234567890abcdef"}'
```

### 小程序获取手机号

```bash
curl -X POST http://localhost:3000/examples/auth/wechat/miniprogram/phone \
  -H "Content-Type: application/json" \
  -d '{"code":"081234567890abcdef"}'
```

## 环境变量配置

在 `.env` 文件中配置：

```env
# 微信开放平台
WECHAT_OPEN_APP_ID=wx1234567890abcdef
WECHAT_OPEN_APP_SECRET=1234567890abcdef1234567890abcdef
WECHAT_OPEN_CALLBACK_URL=https://yourdomain.com/examples/auth/wechat/open/callback

# 微信公众号
WECHAT_MP_APP_ID=wx1234567890abcdef
WECHAT_MP_APP_SECRET=1234567890abcdef1234567890abcdef

# 微信小程序
WECHAT_MINI_APP_ID=wx1234567890abcdef
WECHAT_MINI_APP_SECRET=1234567890abcdef1234567890abcdef
```

## 配置回调地址

需要在微信后台配置回调地址：

### 开放平台
1. 登录微信开放平台
2. 进入网站应用详情
3. 配置授权回调域：`yourdomain.com`

### 公众号
1. 登录微信公众平台
2. 设置与开发 -> 接口权限 -> 网页授权
3. 配置授权回调域：`yourdomain.com`

### 小程序
1. 登录微信小程序后台
2. 开发 -> 开发管理 -> 开发设置
3. 配置服务器域名：`https://yourdomain.com`

## 最佳实践

1. **UnionID 机制**：使用 unionid 关联同一用户在不同应用的身份
2. **Token 管理**：使用 JWT 生成 token，设置合理的过期时间
3. **刷新机制**：实现 refresh_token 机制，避免频繁授权
4. **错误处理**：妥善处理授权失败、token 过期等异常情况
5. **安全性**：验证 state 参数，防止 CSRF 攻击

## 常见场景

### 网站登录

```typescript
// 1. 用户点击"微信登录"
// 2. 重定向到微信授权页面
// 3. 用户扫码授权
// 4. 微信回调到后端
// 5. 后端获取用户信息，生成 token
// 6. 重定向到前端，携带 token
```

### 小程序登录

```typescript
// 1. 小程序调用 wx.login() 获取 code
// 2. 将 code 发送到后端
// 3. 后端调用 code2Session 获取 openid
// 4. 查询或创建用户
// 5. 返回 token 给小程序
```

### 绑定手机号

```typescript
// 1. 用户点击"获取手机号"按钮
// 2. 小程序获取到 code
// 3. 将 code 发送到后端
// 4. 后端调用接口获取手机号
// 5. 绑定手机号到用户账号
```

## 更多信息

查看官方文档：https://751848178.github.io/svton/packages/nestjs-oauth
