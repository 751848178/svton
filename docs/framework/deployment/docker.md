# Docker 部署

> 用 `svton docker` 把 svton 项目容器化 —— **build 在镜像内完成**,一条命令构建并运行整套生产环境。

---

## 为什么用 `svton docker`

生产部署不需要手动 `svton build` 再本地 `start`。`svton docker` 在**镜像内**完成 install + build,产出可移植的运行时镜像,并由 docker compose 编排 app + 数据库。

- 后端(NestJS+Prisma):多阶段 → `pnpm deploy` 扁平化依赖 + `prisma generate`,启动时自动 `prisma migrate deploy`。
- 前端(Next.js):用 `output: 'standalone'` 产出自包含镜像。
- 数据库:compose 内带 MySQL + Redis,`svton docker up` 一次起整套。

---

## 快速开始

在任意 svton 项目根目录:

```bash
# 1) 生成 Dockerfile + 生产 compose + .dockerignore(新项目由 svton create 自动生成)
svton docker init

# 2) 构建并运行整套(backend + admin + mysql + redis)
svton docker up

# 查看日志 / 停止
svton docker logs
svton docker down
```

`svton docker up` 等价于 `docker compose -f docker-compose.prod.yml up -d --build`。

---

## 命令一览

| 命令 | 作用 |
|------|------|
| `svton docker init` | 为 nest/next app 生成多阶段 Dockerfile + `docker-compose.prod.yml` + `.dockerignore`;给 next app 自动补 `output:'standalone'`(`--force` 覆盖) |
| `svton docker build [service]` | 构建镜像(可指定单个 app) |
| `svton docker up [service]` | 构建并后台启动(`--build`) |
| `svton docker down` | 停止并移除容器(`--volumes` 连带数据卷) |
| `svton docker logs [service]` | 跟踪日志 |

---

## 生成的产物

`svton docker init` / `svton create` 会产出:

- `apps/<app>/Dockerfile` —— 多阶段(builder 内 `pnpm install` + `turbo run build --filter=./apps/<app>...` 连带 workspace 依赖;runtime 精简)。
- `docker-compose.prod.yml` —— 各 app 的 `build:` 服务 + mysql + redis,端口/环境变量/`depends_on` 已接好。
- `.dockerignore` —— 排除 `node_modules`/`dist`/`.next`/`.git`/`docs` 等,缩小构建上下文。

> manifest 可配置生产 compose 路径:`svton.config.ts` 里 `docker: { prodCompose: 'docker-compose.prod.yml' }`。

---

## Next.js standalone

`svton docker init` 会确保前端 app 的 `next.config.{js,ts}` 含 `output: 'standalone'`(缺失则自动补),这样 `next build` 产出 `.next/standalone/`(自包含 server + 所需 node_modules),runtime 镜像因此非常小。

---

## 环境变量

生产 compose 默认注入:

- 后端:`DATABASE_URL=mysql://root:root123456@mysql:3306/<project>`、`REDIS_URL=redis://redis:6379`、`PORT`。
- 前端:`NEXT_PUBLIC_API_URL=http://localhost:<backendPort>/api`、`PORT`。

> 生产环境请改 `MYSQL_ROOT_PASSWORD` 等敏感值(编辑 `docker-compose.prod.yml` 或用 `.env` + `env_file`)。

---

## 相关

- [环境配置](./environment) —— 各环境变量说明
- [CLI](../cli) —— `svton` 命令全貌
