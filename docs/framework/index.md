# Svton 框架

> 基于 NestJS + Next.js + Taro 的全栈 Monorepo 脚手架与规范。

Svton 框架提供:统一的 Monorepo 架构、`@svton/cli` 命令行(脚手架 + 项目运行)、后端开发规范与一键部署。用 `svton create` 生成的项目天然符合这套规范。

## 章节导航

- **[整体架构](./architecture/overview)** / **[Monorepo 结构](./architecture/monorepo)** — 技术选型与目录约定
- **[CLI (@svton/cli)](./cli)** — `svton create` 脚手架 + `dev/build/doctor/db/services/generate` 运行命令 + `svton.config.ts` 清单规范
- **[后端开发](./backend/modules)** — NestJS 模块开发
- **[部署运维](./deployment/environment)** — 环境配置 / [Docker 部署](./deployment/docker)
- **[编码规范](./coding-standards)**

## 设计原则

1. **单一数据源** — 共享类型集中在 `@<org>/types`,前后端复用
2. **API 契约优先** — 通过 `@svton/api-client` 的模块增强集中管理
3. **代码复用** — 共享逻辑抽取到 `packages/*`(见 [包参考](/packages/))
4. **关注点分离** — Controller → Service → Repository(Prisma)→ DTO/VO

想要运行一个已有项目?直接在项目根执行 `svton dev`(无 `svton.config.ts` 也会自动检测)。
