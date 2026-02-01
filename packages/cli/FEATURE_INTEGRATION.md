# 功能集成方案

本文档说明 Svton CLI 的功能集成方案，允许用户在创建项目时选择需要的功能模块。

## 架构设计

### 1. 配置驱动

所有功能配置集中在 `features.json` 文件中，包括：
- 功能名称和描述
- 依赖包列表
- 环境变量配置
- 配置文件模板
- 模块导入和注册信息
- 示例代码位置
- Skill 文档位置

### 2. 模板文件结构

```
templates/
├── configs/              # 配置文件模板
│   ├── cache.config.ts
│   ├── queue.config.ts
│   ├── payment.config.ts
│   └── ...
├── examples/             # 示例代码模板
│   ├── cache/
│   │   ├── user.service.ts
│   │   ├── user.controller.ts
│   │   └── README.md
│   ├── queue/
│   ├── payment/
│   └── ...
└── skills/               # Skill 文档模板
    ├── base.skill.md
    ├── cache.skill.md
    ├── queue.skill.md
    └── ...
```

### 3. 生成流程

1. **用户交互**：通过 inquirer 让用户选择需要的功能
2. **依赖收集**：根据选择的功能收集所有依赖包
3. **文件生成**：
   - 更新 `package.json` 添加依赖
   - 复制配置文件到 `src/config/`
   - 复制示例代码到 `src/examples/`
   - 复制 Skill 文档到 `.kiro/skills/`
   - 生成 `.env.example` 文件
4. **模块注入**：自动更新 `app.module.ts` 注册功能模块
5. **文档生成**：生成功能索引文档

## 支持的功能

### 后端功能

- **缓存** (`cache`)：基于 Redis 的声明式缓存
- **消息队列** (`queue`)：基于 BullMQ 的异步任务处理
- **支付** (`payment`)：微信支付 + 支付宝
- **OAuth 登录** (`oauth`)：微信登录（开放平台/公众号/小程序）
- **短信** (`sms`)：阿里云/腾讯云短信发送
- **对象存储** (`storage`)：七牛云/阿里云 OSS
- **限流** (`rateLimit`)：接口访问频率限制
- **权限控制** (`authz`)：RBAC 权限管理

## 使用方式

### 创建项目时选择功能

```bash
npx @svton/cli create my-project
```

CLI 会提示选择功能：

```
? Select features to include (use space to select, enter to confirm):
❯◯ 缓存 - 基于 Redis 的声明式缓存
 ◯ 消息队列 - 基于 BullMQ 的异步任务处理
 ◯ 支付 - 微信支付 + 支付宝
 ◯ OAuth 登录 - 微信登录（开放平台/公众号/小程序）
 ◯ 短信 - 阿里云/腾讯云短信发送
 ◯ 对象存储 - 七牛云/阿里云 OSS
 ◯ 限流 - 接口访问频率限制
 ◯ 权限控制 - RBAC 权限管理
```

### 生成的项目结构

```
my-project/
├── src/
│   ├── config/              # 功能配置文件
│   │   ├── cache.config.ts
│   │   ├── queue.config.ts
│   │   └── ...
│   ├── examples/            # 功能示例代码（可直接运行）
│   │   ├── cache/
│   │   ├── queue/
│   │   └── ...
│   └── app.module.ts        # 已注入功能模块
├── .kiro/
│   └── skills/              # AI 助手 Skill 文档
│       ├── project-capabilities.md
│       ├── cache.md
│       ├── queue.md
│       └── ...
├── .env.example             # 环境变量模板
└── package.json             # 已添加功能依赖
```

## 示例代码特点

1. **可直接运行**：所有示例代码都是完整的、可运行的
2. **包含注释**：详细的代码注释说明用法
3. **最佳实践**：展示推荐的使用方式
4. **README 文档**：每个功能都有详细的 README

## Skill 文档

每个功能都会生成对应的 Skill 文档，让 AI 助手了解项目能力：

- 功能说明
- 配置文件位置
- 示例代码位置
- 核心 API 使用方式
- 最佳实践
- 文档链接

## 添加新功能

### 1. 更新 features.json

```json
{
  "features": {
    "newFeature": {
      "name": "新功能",
      "description": "功能描述",
      "category": "backend",
      "packages": {
        "dependencies": {
          "@svton/new-package": "latest"
        }
      },
      "envVars": [...],
      "configFiles": [...],
      "moduleImports": [...],
      "moduleRegistration": {...},
      "exampleFiles": {...},
      "skillFile": {...}
    }
  }
}
```

### 2. 创建配置模板

在 `templates/configs/` 创建配置文件模板。

### 3. 创建示例代码

在 `templates/examples/` 创建示例代码目录。

### 4. 创建 Skill 文档

在 `templates/skills/` 创建 Skill 文档模板。

## 技术实现

### 核心文件

- `features.json`：功能配置中心
- `src/utils/features.ts`：功能集成工具函数
- `src/commands/create.ts`：创建命令（已集成功能选择）

### 关键函数

- `loadFeaturesConfig()`：加载功能配置
- `getFeatureChoices()`：获取功能选择列表
- `collectDependencies()`：收集依赖包
- `collectEnvVars()`：收集环境变量
- `copyConfigFiles()`：复制配置文件
- `copyExampleFiles()`：复制示例代码
- `copySkillFiles()`：复制 Skill 文档
- `updatePackageJson()`：更新 package.json
- `updateAppModule()`：更新 app.module.ts

## 优势

1. **按需安装**：只安装用户选择的功能，减小项目体积
2. **开箱即用**：生成的项目包含完整的配置和示例
3. **AI 友好**：Skill 文档让 AI 助手了解项目能力
4. **易于扩展**：添加新功能只需更新配置文件
5. **配置驱动**：所有逻辑基于配置，无需修改代码

## 未来计划

- [ ] 支持前端功能选择
- [ ] 支持功能依赖关系
- [ ] 支持功能版本管理
- [ ] 支持自定义功能模板
- [ ] 支持功能热更新
