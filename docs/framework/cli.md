# @svton/cli

> SVTON CLI脚手架工具 - 快速创建SVTON项目

---

## 📦 包信息

| 属性 | 值 |
|------|---|
| **包名** | `@svton/cli` |
| **版本** | `2.3.0` |
| **命令** | `svton` |
| **入口** | `bin/svton.js` |

---

## 🎯 设计原则

1. **简单易用** - `svton create [project-name]` 一键创建项目
2. **模板丰富** - 支持 full-stack、admin-only、backend-only、mobile-only 四种模板
3. **配置灵活** - 支持自定义组织名、跳过安装等选项
4. **即开即用** - 无需全局安装，使用npx直接运行
5. **运行 & 操作** - 不仅能创建项目,还能用 `svton dev/doctor/db/services/generate` 运行与操作项目

---

## 🛠️ 命令用法

### 创建项目

```bash
# 全局安装
npm install -g @svton/cli

# 创建完整项目(默认 full-stack)
svton create my-app

# 创建特定模板
svton create my-app -t admin-only     # 仅管理后台
svton create my-app -t backend-only   # 仅后端 API
svton create my-app -t mobile-only    # 仅移动端

# 自定义配置
svton create my-app -o my-company --skip-install

# 非交互式模式（跳过所有提示）
svton create my-app -y

# 查看帮助
svton create --help

# 使用 npx 运行（无需全局安装）
npx @svton/cli create my-app
```

### 运行项目 & Svton 清单

`svton create` 生成的项目(及任何符合 Svton 架构的 monorepo)可直接用以下命令运行与操作。**零配置可用** —— CLI 自动检测工作区结构、各 app 端口、prisma 目录、包管理器。

```bash
# 生命周期(委托 turbo / 包管理器)
svton dev [app]                      # 启动开发服务器;带 app 名只跑该 app
svton build [app]                    # 构建
svton start [app] [--all]            # 生产启动(各 app 的 start 脚本)
svton lint [app] [--fix]             # Lint
svton typecheck [app]                # 类型检查(→ turbo 任务 type-check)
svton test [app]                     # 测试
svton clean [--keep-deps]            # 清理构建产物

# 体检与配置
svton info [--json]                  # 打印解析出的项目清单
svton doctor [--fix]                 # 环境 & 项目体检
svton env check [app] [--fix]        # 比对 .env 与 .env.example

# 项目操作
svton db <generate|migrate|migrate:deploy|studio|seed|init>   # Prisma 生命周期
svton services <init|up|down|status>                           # 本地 MySQL/Redis(docker compose)
svton generate <module|app|package|api-contract> [name]        # 代码生成(别名 g;module 自动接线 app.module.ts)

# 容器化生产(镜像内构建,无需手动 build)
svton docker init        # 生成 Dockerfile + docker-compose.prod.yml + .dockerignore(给 next 补 standalone)
svton docker build [app] # 构建镜像
svton docker up [app]    # 构建并起整套(apps + mysql + redis)
svton docker down        # 停止(--volumes 连带数据卷)
svton docker logs [app]  # 跟踪日志
```

> 生产部署首选 `svton docker up`(详见 [Docker 部署](./deployment/docker))。`svton start` 是本地裸跑已构建产物,需先 `svton build`;`svton dev` 是开发热重载。已有自定义 Dockerfile/compose 的项目(如自带 nginx 方案)可不用 `svton docker`,直接用自己的 compose。

#### Svton 清单(混合 manifest)

用混合方式声明一个 Svton 项目:

- **主配置 `svton.config.ts`**(类型安全):用 `defineSvtonProject` 包裹 `{ schema, apps, database, services, ... }`。
- **根 `package.json` 标记**(快速检测):`{ "svton": { "schema": 1 } }`。

```ts
import { defineSvtonProject } from '@svton/cli';

export default defineSvtonProject({
  schema: 1,
  apps: {
    api: { dir: 'apps/backend', type: 'nest', port: 4000, ready: { http: 'http://localhost:4000/api/health' } },
    web: { dir: 'apps/admin', type: 'next', port: 3000 },
  },
  database: { orm: 'prisma', dir: 'apps/backend' },
});
```

没有 manifest 时 CLI 会自动推断等价清单,旧项目零改造即可 `svton dev`。详见 [CLI README](https://github.com/svton/svton/tree/master/packages/cli)。

---

### 支持的模板

| 模板 | 说明 | 包含内容 |
|------|------|--------|
| **full-stack** | 完整项目(默认) | Admin + Backend + Mobile + Types |
| **admin-only** | 管理后台 | Next.js + @svton/api-client + SWR |
| **backend-only** | 后端API | NestJS + Prisma + JWT Auth |
| **mobile-only** | 移动端 | Taro + @svton/taro-ui |

---

## 📁 目录结构

```
packages/cli/
├── bin/
│   └── svton.js              # CLI入口文件
├── src/
│   ├── commands/             # 命令实现
│   │   └── create.ts         # create 命令
│   ├── utils/                # 工具函数
│   └── index.ts              # 主入口
├── dist/                     # 构建输出
├── package.json              # CLI包配置
└── README.md                 # 使用文档
```

---

## ⚙️ 模板变量替换

CLI使用模板变量系统来自定义生成的项目：

| 变量 | 描述 | 示例 |
|------|------|------|
| `{{PROJECT_NAME}}` | 项目名称 | `my-app` |
| `{{ORG_NAME}}` | 组织名 | `my-org` |

### 包命名规则

**公共包**（发布到 npm，使用固定 @svton 组织名）：

```json
{
  "dependencies": {
    "@svton/api-client": "^1.0.0",
    "@svton/hooks": "^1.0.0",
    "@svton/taro-ui": "^1.0.0"
  }
}
```

**私有包**（项目内部使用，使用项目组织名）：

```json
{
  "dependencies": {
    "@my-project/types": "workspace:*"
  }
}
```

> **注意**: `types` 包是项目私有包，使用 `{{ORG_NAME}}/types` 模板变量，创建后会替换为项目组织名。

---

## 🔧 模板处理逻辑

### 1. 文件复制和重命名

```javascript
// 模板文件后缀处理
'file.tpl' → 'file'           // 移除.tpl后缀
'gitignore.tpl' → '.gitignore' // 特殊文件重命名
```

### 2. 变量替换

```javascript
const replaceVariables = (content, vars) => {
  return content
    .replace(/\{\{PROJECT_NAME\}\}/g, vars.projectName)
    .replace(/\{\{ORG_NAME\}\}/g, vars.orgName);
};
```

### 3. 条件文件包含

根据模板类型决定包含哪些文件：

```javascript
const templateFiles = {
  'full-stack': ['admin', 'backend', 'mobile', 'types'],
  'admin-only': ['admin', 'types'],
  'backend-only': ['backend', 'types'], 
  'mobile-only': ['mobile', 'types']
};
```

---

## 🚀 开发工作流

### 本地开发测试

```bash
# 进入CLI包目录
cd packages/cli

# 构建
pnpm build

# 本地链接
npm link

# 测试命令  
svton create test-project

# 取消链接
npm unlink -g @svton/cli
```

### 发布测试

```bash
# 测试新版本
svton create test-app -t admin-only -y
```

---

## 📋 发布清单

发布前检查：

- [ ] 版本号已更新
- [ ] 所有模板文件完整
- [ ] 共享包使用固定@svton命名
- [ ] CLI命令测试通过
- [ ] README文档已更新

```bash
# 发布到npm
cd packages/cli
npm publish --access public
```

---

## 🔗 相关文档

- [快速开始](../start/quick-start.md) - 使用CLI创建项目
- [项目模板](./architecture/monorepo.md) - 了解项目结构
- [包管理](../packages/types.md) - 共享类型包

---

**最后更新**: 2026-06-25
**维护者**: SVTON CLI团队
