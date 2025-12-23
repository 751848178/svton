# 环境配置指南

> 完整的环境变量配置说明

---

## 📁 配置文件

### 后端环境变量

| 文件 | 环境 | 说明 |
|------|------|------|
| `.env` | 默认 | 基础配置 |
| `.env.development` | 开发 | 本地开发配置 |
| `.env.staging` | 预发布 | 测试环境配置 |
| `.env.production` | 生产 | 生产环境配置 |

---

## 🔧 后端配置项

### 基础配置

```env
# 应用配置
NODE_ENV=development          # 环境: development | staging | production
PORT=3000                     # 服务端口
API_PREFIX=api                # API 前缀
```

### 数据库配置

```env
# MySQL 连接
DATABASE_URL="mysql://用户名:密码@主机:端口/数据库名"

# 示例
DATABASE_URL="mysql://root:password@localhost:3306/community_helper"
```

### JWT 配置

```env
# JWT 密钥（生产环境务必更换）
JWT_SECRET=your-super-secret-key-change-me

# Token 有效期
JWT_ACCESS_EXPIRES_IN=2h      # 访问令牌有效期
JWT_REFRESH_EXPIRES_IN=7d     # 刷新令牌有效期
```

### Redis 配置

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=               # 无密码则留空
REDIS_DB=0
```

### 微信小程序配置

```env
WECHAT_APPID=wx1234567890
WECHAT_SECRET=your-wechat-secret
```

### 腾讯云配置

```env
# API 凭证
TENCENT_SECRET_ID=your-secret-id
TENCENT_SECRET_KEY=your-secret-key

# 短信服务
SMS_APP_ID=your-sms-app-id
SMS_SIGN_NAME=社区助手
SMS_TEMPLATE_ID=123456
SMS_CODE_EXPIRE_MINUTES=5
SMS_DAILY_LIMIT=10
SMS_REGION=ap-guangzhou
```

### 存储配置

```env
# 存储类型: local | cos | oss
STORAGE_TYPE=local

# 上传模式: auto | direct | proxy
UPLOAD_MODE=auto

# 本地存储
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880         # 5MB
API_BASE_URL=http://localhost:3000

# 腾讯云 COS（当 STORAGE_TYPE=cos）
COS_SECRET_ID=your-secret-id
COS_SECRET_KEY=your-secret-key
COS_BUCKET=bucket-name
COS_REGION=ap-guangzhou
COS_DOMAIN=http://cdn.example.com
COS_PREFIX=community/uploads
```

### CORS 配置

```env
# 允许的源（多个用逗号分隔）
CORS_ORIGIN=http://localhost:3001,http://localhost:3000
```

### 功能开关

```env
FEATURE_COMMENT=true          # 评论功能
FEATURE_LIKE=true             # 点赞功能
FEATURE_FAVORITE=true         # 收藏功能
FEATURE_SHARE=true            # 分享功能
FEATURE_SEARCH=true           # 搜索功能
FEATURE_NOTIFICATION=true     # 通知功能
FEATURE_CONTENT_REVIEW=false  # 内容审核
```

### 内容配置

```env
CONTENT_MAX_TITLE_LENGTH=100
CONTENT_MAX_CONTENT_LENGTH=5000
CONTENT_MAX_IMAGE_COUNT=9
CONTENT_MAX_IMAGE_SIZE=5      # MB
CONTENT_NEED_REVIEW=false
```

---

## 💻 管理后台配置

### .env.local

```env
# API 地址
NEXT_PUBLIC_API_URL=http://localhost:3000
```

---

## 📱 移动端配置

### .env

```env
# API 地址
TARO_APP_API_URL=http://localhost:3000
```

### project.config.json

```json
{
  "appid": "wxXXXXXXXXXXXXXXXX",
  "projectname": "community-helper",
  "setting": {
    "urlCheck": false
  }
}
```

---

## 🚀 环境切换

### 后端

```bash
# 开发环境
NODE_ENV=development pnpm dev

# 预发布环境
NODE_ENV=staging pnpm dev

# 生产环境
NODE_ENV=production pnpm start
```

### 自动加载规则

NestJS ConfigModule 按以下顺序加载：

1. `.env.${NODE_ENV}` (如 `.env.development`)
2. `.env` (默认配置)

后加载的配置会覆盖先加载的。

---

## 🔐 安全建议

### 生产环境必须修改

- [ ] `JWT_SECRET` - 使用强随机字符串
- [ ] `DATABASE_URL` - 使用独立数据库账号
- [ ] `REDIS_PASSWORD` - 设置 Redis 密码
- [ ] 所有云服务密钥

### 密钥生成

```bash
# 生成随机密钥
openssl rand -hex 32
# 输出: a1b2c3d4e5f6...
```

### 敏感信息管理

```bash
# 不要提交敏感配置到 Git
# .gitignore 已包含:
.env
.env.local
.env.development.local
.env.production.local
```

---

## 📋 配置模板

### 完整的 .env.example

```env
# ==================== 基础配置 ====================
NODE_ENV=development
PORT=3000
API_PREFIX=api

# ==================== 数据库 ====================
DATABASE_URL="mysql://root:password@localhost:3306/community_helper"

# ==================== JWT ====================
JWT_SECRET=change-me-in-production
JWT_ACCESS_EXPIRES_IN=2h
JWT_REFRESH_EXPIRES_IN=7d

# ==================== Redis ====================
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# ==================== 微信 ====================
WECHAT_APPID=wxXXXXXXXXXXXXXXXX
WECHAT_SECRET=your-wechat-secret

# ==================== 腾讯云 ====================
TENCENT_SECRET_ID=your-secret-id
TENCENT_SECRET_KEY=your-secret-key

# ==================== 短信 ====================
SMS_APP_ID=your-sms-app-id
SMS_SIGN_NAME=社区助手
SMS_TEMPLATE_ID=123456

# ==================== 存储 ====================
STORAGE_TYPE=local
UPLOAD_MODE=auto
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880
API_BASE_URL=http://localhost:3000

# ==================== COS (可选) ====================
# COS_SECRET_ID=
# COS_SECRET_KEY=
# COS_BUCKET=
# COS_REGION=
# COS_DOMAIN=
# COS_PREFIX=

# ==================== CORS ====================
CORS_ORIGIN=http://localhost:3001

# ==================== 租户 ====================
DEFAULT_TENANT_ID=default
```

---

**下一步**: [Docker 部署](./docker.md)
