# 用户注册流程图

```mermaid
flowchart TD
    Start([用户访问注册页面]) --> Input[填写注册信息<br/>手机号/邮箱/密码]
    
    Input --> Validate{前端验证}
    Validate -->|验证失败| ShowError1[显示错误提示]
    ShowError1 --> Input
    
    Validate -->|验证通过| SendCode[点击发送验证码]
    SendCode --> RateLimit{后端限流检查<br/>@svton/nestjs-rate-limit}
    
    RateLimit -->|超过限制| ShowError2[提示请求过于频繁]
    ShowError2 --> Input
    
    RateLimit -->|通过| CheckExists{检查手机号/邮箱<br/>是否已注册}
    CheckExists -->|已存在| ShowError3[提示账号已存在]
    ShowError3 --> Input
    
    CheckExists -->|不存在| SendSMS[发送验证码<br/>@svton/nestjs-sms]
    SendSMS --> Queue[加入队列<br/>@svton/nestjs-queue]
    Queue --> Cache[缓存验证码<br/>@svton/nestjs-cache<br/>TTL: 5分钟]
    
    Cache --> InputCode[用户输入验证码]
    InputCode --> VerifyCode{验证码校验}
    
    VerifyCode -->|错误| ShowError4[提示验证码错误]
    ShowError4 --> InputCode
    
    VerifyCode -->|正确| Submit[提交注册<br/>useLockFn 防重复提交]
    Submit --> CreateUser[创建用户记录<br/>密码加密存储]
    
    CreateUser --> Log[记录日志<br/>@svton/nestjs-logger]
    Log --> ClearCache[清除验证码缓存<br/>@CacheEvict]
    
    ClearCache --> GenToken[生成 JWT Token]
    GenToken --> Success([注册成功<br/>跳转到首页])
    
    style Start fill:#e1f5e1
    style Success fill:#e1f5e1
    style ShowError1 fill:#ffe1e1
    style ShowError2 fill:#ffe1e1
    style ShowError3 fill:#ffe1e1
    style ShowError4 fill:#ffe1e1
    style Submit fill:#e1e5ff
    style Queue fill:#fff4e1
    style Cache fill:#fff4e1
    style Log fill:#fff4e1
```

## 流程说明

### 前端部分（使用 @svton/hooks + @svton/ui）

1. **表单状态管理**
   - 使用 `useBoolean` 管理加载状态
   - 使用 `useCountdown` 实现验证码倒计时
   - 使用 `useLockFn` 防止重复提交

2. **用户体验优化**
   - 使用 `useDebounce` 对手机号/邮箱进行防抖验证
   - 使用 `RequestBoundary` 统一处理加载/错误状态
   - 使用 `@svton/ui` 的 Toast 组件显示提示

### 后端部分（使用 NestJS 模块）

1. **限流保护**
   - `@svton/nestjs-rate-limit` 防止恶意请求

2. **验证码发送**
   - `@svton/nestjs-sms` 发送短信验证码
   - `@svton/nestjs-queue` 异步处理发送任务

3. **缓存管理**
   - `@svton/nestjs-cache` 缓存验证码（5分钟有效期）
   - 注册成功后使用 `@CacheEvict` 清除缓存

4. **日志追踪**
   - `@svton/nestjs-logger` 记录注册行为
   - 包含 userId、手机号、IP 等信息

## 关键技术点

- **防重复提交**: 前端 `useLockFn` + 后端幂等性设计
- **验证码安全**: 5分钟过期 + 限流保护
- **异步处理**: 短信发送使用队列，避免阻塞主流程
- **日志追踪**: 完整记录注册流程，便于问题排查
