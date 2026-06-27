# @svton/cli

## 2.5.6

### Patch Changes

- fix: **内存不足时自动串行构建** —— 不再需要手动加 `--serial`。检测 `/proc/meminfo`(`MemAvailable < 3GB` + `SwapTotal < 2GB`)→ 自动启用串行(一个一个 build,防 OOM);内存充足的大机器仍然并行(快)。可用 `--no-serial` 覆盖或 `docker.serial:true` 固化。

## 2.5.5

### Patch Changes

- feat: `svton docker check` + 自动预检 —— `up`/`build`/`restart` 前自动检查项目状态,问题不再变成 mysql 崩溃等哑错。检测项:
  - **错误(阻断)**:.env 缺失/变量空、pnpm-lock.yaml 缺失(--frozen-lockfile 会失败)。
  - **警告(交互式确认)**:.npmrc 无镜像源(build 慢)、prisma migrations 不存在、backend 无健康端点、DATABASE_URL 用了 localhost(容器连不到)、内存/swap 太低(可能 OOM)。
  - TTY 下警告会交互式问 y/N;非 TTY 直接放行。
  - 新增 `svton docker check` 命令单独跑预检(不需 Docker/compose)。

## 2.5.4

### Patch Changes

- feat: `svton docker restart` —— 新增重启命令。默认快速重启(不重建,= `docker compose restart`);`--build` 则重新构建镜像并重建容器(走 up 的 build+recreate,串行/并行与 `up` 一致)。支持 `--service <name>` 重启单个 app。

## 2.5.3

### Patch Changes

- fix:`svton docker up/down` 起飞前检查 `.env` —— compose 用 `${VAR}` 插值,`.env` 缺失或缺关键变量(MYSQL_ROOT_PASSWORD/DATABASE_URL/JWT_SECRET)时,直接报「`cp .env.example .env` 并填值」,不再让 mysql 崩成 `password option is not specified` 的哑错。占位值(change-me-…)非空、可用于首跑,放行。

## 2.5.2

### Patch Changes

- fix: `svton docker build/up --serial` —— 串行构建各 app 镜像(一次只 build 一个),避免 BuildKit 并行构建(next+taro+nest 同时跑)在小内存服务器上打爆内存导致 SSH 断开/OOM。`docker.serial` 可作项目默认(小服务器建议开);`--profile` 默认改为读 `config.docker.db.profile`(此前写死 `db`)。

## 2.5.1

### Patch Changes

- fix: `svton create` 默认使用 `https://registry.npmmirror.com` 写入生成项目 `.npmrc`,并在自动安装依赖时透传 registry;支持 `--registry` 与 `SVTON_NPM_REGISTRY` 覆盖。
- fix: 发布包优先携带并读取内置 `templates`,正常创建项目不再依赖 GitHub 模板下载;远程模板回退支持 `SVTON_TEMPLATE_ARCHIVE_URL` / `SVTON_TEMPLATE_REPO` / `SVTON_TEMPLATE_BRANCH` 配置。
- fix: Docker 生成的 Prisma helper 安装改为读取项目 `.npmrc`,避免构建阶段绕过镜像源。

## 2.5.0

### Minor Changes

- feat:`svton docker` 升级到**生产级**(吸收 twgg 生产最佳实践),成为生态基建默认。
  - **单根多阶段 Dockerfile**(base→deps→builder→deps-prod→`<app>-prod`):非 root 用户、`--frozen-lockfile`、deps-prod 精简 prod 依赖、backend 独立 prisma-cli(避开 workspace 协议)、Next standalone、mobile→nginx 静态、apk 安全集。
  - **生产 compose**:x-logging/x-healthcheck anchors、每服务 healthcheck(路径从 `app.ready.http` 自动推)、`depends_on: condition: service_healthy`、MySQL/Redis 仅绑 `127.0.0.1`、MySQL 调参、**密钥全部 `${VAR}` 插值**(不再硬编码)、db 用 compose `profile: db` 门控、image tag。
  - **明确「可配 / flag / 写死」边界**(详见文档):`svton.config.ts` 的 `docker:` 段管形状(image 版本/db 引擎与绑定/mobile/logging…),CLI flags 管操作(`--db`/`--mobile`/`--no-cache`/`--build-arg`/`--push`/`--profile`/`--rmi`/`--tail`…),多阶段拓扑/安全默认/prisma 流程写死。密钥走 `.env`(生成 `.env.example`)。
  - 新增:mobile nginx 静态配置、宿主机 nginx 反代示例(`nginx/<project>.conf.example`)。
  - 修复回归:`--no-frozen`→`--frozen`、硬编码 db 密码→`${VAR}`、`depends_on` 列表→condition、taro 无条件过滤→看 `docker.mobile.enabled`。

## 2.4.0

### Minor Changes

- feat:`svton docker` —— 给 svton 架构项目生成「镜像内构建」的 Docker,生产部署一条命令搞定(`svton docker up` = 构建镜像 + 起容器,无需手动 `svton build`)。
  - **`svton docker init`**:为 nest/next app 生成多阶段 Dockerfile(backend 用 `pnpm deploy`+`prisma generate` 扁平化依赖;admin 用 Next **standalone** 自包含)、根 `docker-compose.prod.yml`(apps + mysql + redis,环境变量接好)、`.dockerignore`;给 next app 自动补 `output:'standalone'`。
  - **`svton docker build|up|down|logs`**:委托 `docker compose` 构建与编排。
  - **`svton create`** 现在自带这些 Dockerfile + prod compose(新项目开箱可 `svton docker up`)。
  - manifest 新增 `docker?: { prodCompose }` 字段(schema 不变)。
  - 关键修正:`prisma generate` 必须在 `nest build` **之前**跑(否则无 Prisma 类型,noImplicitAny 报错)。

## 2.3.5

### Patch Changes

- fix:`svton start` 在项目未构建时报的 next/nest 原始错误(`Cannot find module 'dist/main'`、`Could not find a production build in '.next'`)很费解。现在 `start` 会先检测各 app 的构建产物(next 看 `.next/BUILD_ID`,其余看 `dist/`),缺失时给出明确指引:`Run build first, or use svton dev`。(`start` 本就是生产模式,语义上需要先 build;开发请用 `svton dev`。)

## 2.3.4

### Patch Changes

- fix(根因,取代 2.3.3 的 alias 做法):`svton.config.ts` 里 `import '@svton/cli'` 在项目未本地安装时报 `Cannot find module '@svton/cli'`。`@svton/cli` 是项目的**正式依赖**,正确做法是用项目的包管理器装上,而不是别名绕过。现在 loader 在检测到该 import 解析失败、且 `@svton/cli` 已在 package.json 声明时,**自动 `<pm> install` 后重试**;未声明则给出 `add -D @svton/cli` 的明确报错(不静默吞掉)。新增项目生成的 config 本就是零依赖纯对象,不会触发此问题。

## 2.3.3

### Patch Changes

- (已被 2.3.4 取代)曾用 jiti `alias` 把 config 里的 `@svton/cli` 指向运行中的 CLI;改为更正规的「用包管理器安装」。

## 2.3.2

### Patch Changes

- fix: `svton start`(无参数)从"报错要求 --all"改为**并行启动所有含 start 脚本的 app**(与 `svton dev` 行为一致);并修复了原先 `--all` 串行执行时第一个 server 永久阻塞、后续 app 起不来的 bug。新增 `spawnParallel`(逐行前缀日志 + 信号转发)。

## 2.3.1

### Patch Changes

- fix: `svton` 命令在项目未 `pnpm install` 时崩溃(`Cannot find module '@svton/cli'`)。
  - 根因:生成的 `svton.config.ts` 里 `import { defineSvtonProject } from '@svton/cli'`,而该包未装进项目本地(只在全局),jiti 从项目目录解析失败。
  - 修复 1(loader 容错):`svton.config.ts` 加载失败时不再崩溃,改为告警并回退自动探测 —— 任何 `svton` 命令都能继续跑。
  - 修复 2(生成器零依赖):`svton create` 生成的 `svton.config.ts` 改为纯对象(无 import),未安装也能被加载;想要类型提示可手动加 import。
  - 顺带修了 jest 下 chalk shim 对 `chalk_1.default.x` 的解析。

## 2.3.0

### Minor Changes

- feat: 新增「项目生命周期 + Svton 架构规范」,让 `svton` 不仅能创建项目,还能运行与操作项目。
  - **生命周期命令**(委托 turbo/pnpm):`svton dev/build/start/lint/typecheck/test/clean [target]`,支持单 app 过滤;`typecheck` 自动映射 turbo 任务 `type-check`。
  - **统一 manifest(混合方案)**:类型安全的 `svton.config.ts`(`defineSvtonProject`)+ 根 `package.json` 的 `"svton": { "schema": 1 }` 标记。**无 manifest 也能用** —— 自动检测 apps/端口/全局前缀/健康探针/prisma 目录/包管理器。
  - **新增命令**:`info [--json]`(打印解析后的清单)、`doctor`(环境体检:Node/pnpm/turbo/脚本契约/env/端口/Docker)、`env check/pull`(env 与 .env.example 比对)、`db <generate|migrate|migrate:deploy|studio|seed|init>`(prisma 生命周期)、`services <init|up|down|status>`(docker compose)、`generate|g <module|app|package|api-contract>`(脚手架生成器,`module` 已实现并自动接线进 app.module.ts)。
  - **`svton create` 升级**:生成的项目根自动带 `svton.config.ts`(apps 按所选模板生成)+ `"svton"` 标记 + `@svton/cli` devDep;`docker-compose.yml` 生成逻辑抽到 `utils/compose.ts`,与 `services init` 共用。
  - 新增依赖:`jiti`(运行时加载 `svton.config.ts`)、`cross-spawn`(可靠的子进程 spawn)。

## 2.2.0

### Minor Changes

- feat: 添加腾讯云 COS 对象存储支持
  - 新增 @svton/nestjs-object-storage-tencent-cos 包
  - 支持腾讯云 COS 对象存储服务
  - 实现上传、删除、获取公开 URL、生成预签名 URL 等功能
  - CLI 支持选择腾讯云 COS 作为对象存储提供商

## 2.1.0

### Minor Changes

- 9cc5a69: 添加数据库类型选择功能

  **新功能**：
  - 在创建项目时可以选择数据库类型（MySQL、PostgreSQL、SQLite）
  - 默认使用 MySQL 数据库
  - 根据选择的数据库类型自动生成对应的 Prisma schema
  - 根据数据库类型生成正确的 DATABASE_URL 配置

  **数据库支持**：
  - **MySQL**: `mysql://root:root123456@localhost:3306/project_name`
  - **PostgreSQL**: `postgresql://postgres:postgres@localhost:5432/project_name`
  - **SQLite**: `file:./dev.db`

  **使用方式**：

  交互式创建项目时，会提示选择数据库类型：

  ```bash
  pnpm create svton-app my-project
  # 选择模板后会提示选择数据库
  ```

  非交互式模式默认使用 MySQL：

  ```bash
  pnpm create svton-app my-project --yes
  ```

## 2.0.1

### Patch Changes

- 修复剩余的模板问题并改进项目初始化流程

  **修复内容**：
  1. **OAuth Controller** - 修复小程序获取手机号接口，添加缺失的 accessToken 参数
  2. **Storage Controller** - 修复文件上传控制器，使用正确的 presigned URL 方法替代不存在的方法
  3. **Prisma 自动生成** - 在安装依赖后自动运行 `prisma:generate`，无需手动执行

  **改进**：
  - 小程序获取手机号现在需要传入 `code` 和 `accessToken` 两个参数
  - 文件上传示例使用 `getPresignedUploadUrl` 和 `getPresignedDownloadUrl` 方法
  - 项目创建后自动生成 Prisma 客户端，提升开发体验

## 2.0.0

### Major Changes

- 9c7222f: 重大修复：修复所有模板文件的类型错误和 API 使用问题

  这是一个重大版本更新，修复了生成项目中的所有 TypeScript 错误，确保生成的项目可以直接编译运行。

  **修复清单**：
  1. ✅ **authz.config.ts** - 移除不存在的 roles 配置
  2. ✅ **cache.config.ts** - 移除 redis 配置（Redis 通过 RedisModule 单独配置）
  3. ✅ **storage.config.ts** - 使用 adapter 模式配置（createQiniuAdapter）
  4. ✅ **oauth.config.ts** - 修复函数命名（useOAuthConfig）
  5. ✅ **authz/user.controller.ts** - 移除不存在的 Permissions 装饰器
  6. ✅ **cache/user.service.ts** - 将 pattern 改为 allEntries
  7. ✅ **storage/upload.service.ts** - 使用 ObjectStorageClient 和 @InjectObjectStorage()
  8. ✅ **oauth/auth.service.ts** - 修复 OAuth API 使用（正确处理 OAuthResult 包装类型）
  9. ✅ **storage/upload.controller.ts** - 添加 @types/multer 依赖说明
  10. ✅ **backend/package.json.tpl** - 添加 zod 和 @types/multer 依赖
  11. ✅ **ast-helper.ts** - 修复重复导入问题（检查已存在的 import）
  12. ✅ **Prisma 模板** - 创建 schema.prisma.tpl 和 seed.ts.tpl
  13. ✅ **features.ts** - 添加 copyPrismaTemplates 函数自动复制 Prisma 模板
  14. ✅ **create.ts** - 在创建后端项目时自动复制 Prisma 模板

  **主要改进**：
  - **OAuth API 修复**：所有 OAuth 方法现在正确返回 `OAuthResult<T>` 类型，需要检查 `success` 和访问 `data` 属性
  - **对象存储修复**：使用 adapter 模式配置，通过 `@InjectObjectStorage()` 注入客户端
  - **缓存装饰器修复**：使用 `allEntries: true` 替代不存在的 `pattern` 选项
  - **AST 注入改进**：避免重复导入相同的模块
  - **Prisma 支持**：自动生成 Prisma schema 和 seed 文件
  - **依赖完整性**：添加所有缺失的依赖（zod, @types/multer）

  **破坏性变更**：
  - OAuth API 调用方式已更改（需要处理 OAuthResult 包装类型）
  - 对象存储配置结构已更改（使用 adapter 模式）
  - 缓存装饰器选项已更改（pattern → allEntries）

  **迁移指南**：
  使用新版本创建的项目将自动包含所有修复，无需手动迁移。

## 1.4.1

### Patch Changes

- 修复配置文件类型错误和命名问题

  **修复内容**：
  - 修复 OAuth 配置函数命名：`useOauthConfig` → `useOAuthConfig`
  - 修复 storage.config.ts 中的 provider 类型
  - 修复 cache.config.ts 中的 redis 配置类型
  - 修复 oauth.config.ts 中的 platform 类型（使用 `as const`）
  - 所有 configService.get() 调用添加默认值或类型断言

  **改进**：
  - 确保生成的配置文件类型安全
  - 避免 TypeScript 类型错误
  - 提供更好的类型提示

## 1.4.0

### Minor Changes

- 重大功能：自动注入功能模块到 app.module.ts

  **新功能**：
  - 使用 AST 操作安全地修改 `app.module.ts` 文件
  - 自动添加模块导入语句
  - 自动注册功能模块到 imports 数组
  - 自动导入配置文件函数
  - 如果自动注入失败，生成手动集成说明文档作为备选方案

  **技术实现**：
  - 使用 `@babel/parser` 解析 TypeScript 代码
  - 使用 `@babel/traverse` 遍历 AST
  - 使用 `@babel/generator` 生成新代码
  - 确保代码格式正确，不破坏原有结构

  **用户体验**：
  - 创建项目后可以直接运行，无需手动配置
  - 所有功能模块自动集成完成
  - 配置文件、示例代码、环境变量全部就绪

## 1.3.0

### Minor Changes

- 重大改进：修复模板代码问题并优化功能集成流程

  **破坏性变更**：
  - 不再自动修改 `app.module.ts`，改为生成集成说明文档 `FEATURE_INTEGRATION.md`

  **功能改进**：
  - 生成完整的 `.env.example` 文件，包含所有功能的环境变量配置
  - 环境变量按功能分组，添加详细注释和说明
  - 生成 `FEATURE_INTEGRATION.md` 文档，提供清晰的模块集成步骤

  **模板修复**：
  - 删除冗余的 `authz/roles.guard.ts`，统一使用 `@svton/nestjs-authz` 包中的实现
  - 修复所有示例代码的导入和类型问题
  - 确保所有配置文件正确导出类型

  **文档改进**：
  - 添加详细的功能集成说明
  - 提供配置文件路径索引
  - 添加环境变量配置指南

## 1.2.5

### Patch Changes

- 修复功能集成时的文件路径，将文件放到正确的项目目录中
  - 修复配置文件路径：从 `src/config/` 改为 `apps/backend/src/config/`
  - 修复示例代码路径：从 `src/examples/` 改为 `apps/backend/src/examples/`
  - 修复环境变量文件路径：从 `.env.example` 改为 `apps/backend/.env.example`
  - 修复 package.json 路径：从根目录改为 `apps/backend/package.json`
  - 修复 app.module.ts 路径：从 `src/app.module.ts` 改为 `apps/backend/src/app.module.ts`
  - 更新能力索引文档中的示例代码路径说明

## 1.2.4

### Patch Changes

- 修复功能集成时的模板路径解析错误
  - 修复 `copyConfigFiles`、`copyExampleFiles`、`copySkillFiles` 函数中硬编码的 `templates/` 路径
  - 统一使用 `templateDir` 参数，支持从本地开发环境或 GitHub 下载的模板
  - 添加文件不存在时的警告日志
  - 添加模板目录清理逻辑，避免临时文件残留

## 1.2.3

### Patch Changes

- refactor: use GitHub templates instead of bundling in package
  - Remove templates from npm package to reduce package size
  - Always download templates from GitHub repository
  - Ensures users always get the latest templates
  - Reduces npm package size significantly

## 1.2.2

### Patch Changes

- fix: bundle templates directory in npm package
  - Add templates directory to npm package files
  - Create prebuild script to copy templates from project root
  - Update template path resolution to check packaged templates first
  - Ensure CLI works correctly when installed globally via npm

## 1.2.1

### Patch Changes

- fix: include features.json in npm package and fix path resolution
  - Add features.json to package files
  - Fix features.json path resolution for published package
  - Support both development and production environments

## 1.2.0

### Minor Changes

- d9bee61: feat: 添加功能集成系统，支持按需选择功能模块
  - 新增功能配置系统 (features.json)
  - 支持 8 个功能模块的按需安装（缓存、队列、支付、短信、OAuth、存储、限流、权限）
  - 自动生成配置文件和示例代码
  - 自动生成 AI Skill 文档
  - 自动注入模块到 app.module.ts
  - 生成 .env.example 环境变量模板
  - 完整的示例代码（24 个文件）
  - 详细的 README 文档（9 个）
  - 修复配置文件类型转换问题
  - 改进错误处理和文件读取安全性

## 1.1.0

### Minor Changes

- feat: 发布所有包的新版本

  ### 前端包
  - `@svton/ui`: React UI 组件库更新
  - `@svton/taro-ui`: Taro 小程序 UI 组件库更新
  - `@svton/hooks`: React Hooks 工具库更新

  ### 工具包
  - `@svton/logger`: 日志工具库更新
  - `@svton/service`: 服务层工具库更新
  - `@svton/dynamic-config`: 动态配置库更新
  - `@svton/api-client`: API 客户端更新
  - `@svton/cli`: CLI 工具更新

  ### NestJS 模块
  - `@svton/nestjs-authz`: 授权模块更新
  - `@svton/nestjs-cache`: 缓存模块更新
  - `@svton/nestjs-config-schema`: 配置 Schema 模块更新
  - `@svton/nestjs-http`: HTTP 模块更新
  - `@svton/nestjs-logger`: 日志模块更新
  - `@svton/nestjs-oauth`: OAuth 模块更新
  - `@svton/nestjs-object-storage`: 对象存储模块更新
  - `@svton/nestjs-object-storage-qiniu-kodo`: 七牛云存储模块更新
  - `@svton/nestjs-payment`: 支付模块更新
  - `@svton/nestjs-queue`: 队列模块更新
  - `@svton/nestjs-rate-limit`: 限流模块更新
  - `@svton/nestjs-redis`: Redis 模块更新
  - `@svton/nestjs-sms`: 短信模块更新
