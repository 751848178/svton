# Svton 功能示例代码

本目录包含所有 Svton 功能模块的完整示例代码。

## 📦 已完成的示例

### 1. Cache - 缓存 ✅

**目录**: `cache/`

**文件**:
- `user.service.ts` - 缓存装饰器使用示例
- `user.controller.ts` - Controller 层示例
- `README.md` - 详细使用文档

**核心功能**:
- @Cacheable - 缓存查询结果
- @CacheEvict - 清除缓存
- @CachePut - 更新缓存
- 支持 Key 表达式和通配符

### 2. Queue - 消息队列 ✅

**目录**: `queue/`

**文件**:
- `email.processor.ts` - 队列处理器示例
- `email.service.ts` - 服务层示例
- `email.controller.ts` - Controller 层示例
- `README.md` - 详细使用文档

**核心功能**:
- 添加任务到队列
- 定义任务处理器
- 延迟执行、重试策略
- 定时任务、优先级控制

### 3. Payment - 支付 ✅

**目录**: `payment/`

**文件**:
- `order.service.ts` - 订单服务示例
- `order.controller.ts` - 支付接口示例
- `webhook.controller.ts` - 支付回调处理示例
- `README.md` - 详细使用文档

**核心功能**:
- 微信支付（JSAPI、Native、APP、H5）
- 支付宝（PC、H5、APP）
- 订单查询、退款
- 支付回调处理

### 4. SMS - 短信 ✅

**目录**: `sms/`

**文件**:
- `sms.service.ts` - 短信服务示例
- `verification.controller.ts` - 验证码控制器示例
- `README.md` - 详细使用文档

**核心功能**:
- 发送验证码
- 发送通知短信
- 批量发送
- 验证码验证

### 5. OAuth - OAuth 登录 ✅

**目录**: `oauth/`

**文件**:
- `auth.service.ts` - 认证服务示例
- `auth.controller.ts` - 认证控制器示例
- `README.md` - 详细使用文档

**核心功能**:
- 微信开放平台登录（PC 扫码）
- 微信公众号登录（网页授权）
- 微信小程序登录
- 小程序获取手机号

### 6. Storage - 对象存储 ✅

**目录**: `storage/`

**文件**:
- `upload.service.ts` - 上传服务示例
- `upload.controller.ts` - 上传控制器示例
- `README.md` - 详细使用文档

**核心功能**:
- 服务端上传文件
- 客户端直传
- 图片处理（缩略图、裁剪）
- 文件删除、移动、复制
- 私有文件访问

### 7. Rate Limit - 限流 ✅

**目录**: `rate-limit/`

**文件**:
- `api.controller.ts` - API 控制器示例
- `README.md` - 详细使用文档

**核心功能**:
- 接口限流
- 多种限流策略
- 防暴力破解
- 验证码防刷
- 自定义限流 Key

### 8. Authz - 权限控制 ✅

**目录**: `authz/`

**文件**:
- `user.controller.ts` - 用户控制器示例
- `roles.guard.ts` - 角色守卫示例
- `README.md` - 详细使用文档

**核心功能**:
- 角色权限控制
- 细粒度权限控制
- 动态权限检查
- 资源级权限

## 🎯 示例特点

### 1. 可直接运行

所有示例代码都是完整的、可运行的，包含：
- 完整的 Service 层实现
- 完整的 Controller 层实现
- 详细的代码注释
- 实际的业务场景

### 2. 详细文档

每个示例都包含 README.md，包括：
- 功能说明
- 核心 API 使用方式
- 测试接口示例
- 环境变量配置
- 最佳实践
- 常见场景
- 官方文档链接

### 3. 最佳实践

展示推荐的使用方式：
- 错误处理
- 参数验证
- 安全性考虑
- 性能优化
- 代码组织

### 4. 测试友好

提供完整的测试命令：
- curl 命令示例
- 请求参数示例
- 响应格式示例

## 📚 使用方式

### 1. 查看示例

```bash
cd src/examples/cache
cat README.md
```

### 2. 运行示例

```bash
# 启动项目
pnpm dev

# 测试接口
curl http://localhost:3000/examples/users/1
```

### 3. 学习代码

每个示例都有详细的注释，可以直接阅读代码学习。

### 4. 复制使用

可以直接复制示例代码到你的项目中使用。

## 🔧 环境配置

所有示例都需要配置相应的环境变量，请参考 `.env.example` 文件。

### 必需配置

- **Redis**（cache, queue, rate-limit）
  ```env
  REDIS_HOST=localhost
  REDIS_PORT=6379
  REDIS_PASSWORD=
  ```

### 可选配置

根据使用的功能配置：

- **支付**（payment）
  ```env
  WECHAT_MCH_ID=
  WECHAT_PRIVATE_KEY=
  ALIPAY_APP_ID=
  ALIPAY_PRIVATE_KEY=
  ```

- **短信**（sms）
  ```env
  SMS_PROVIDER=aliyun
  SMS_ACCESS_KEY_ID=
  SMS_ACCESS_KEY_SECRET=
  ```

- **OAuth**（oauth）
  ```env
  WECHAT_OPEN_APP_ID=
  WECHAT_OPEN_APP_SECRET=
  ```

- **对象存储**（storage）
  ```env
  QINIU_ACCESS_KEY=
  QINIU_SECRET_KEY=
  QINIU_BUCKET=
  ```

## 📖 文档资源

- Svton 官方文档：https://751848178.github.io/svton
- GitHub：https://github.com/751848178/svton

## 💡 开发建议

1. **先看 README**：每个示例都有详细的 README，先阅读了解功能
2. **查看代码**：阅读示例代码，理解实现方式
3. **运行测试**：使用提供的 curl 命令测试接口
4. **修改尝试**：根据自己的需求修改示例代码
5. **查看文档**：遇到问题查看官方文档

## 🤝 贡献

如果你有更好的示例或发现问题，欢迎提交 PR 或 Issue。

## 📝 许可

MIT License
