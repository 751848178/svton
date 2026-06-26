/**
 * svton 项目的 Docker 产物生成器(纯字符串,镜像 `compose.ts` 的风格)。
 *
 * 设计:build 全部在镜像内完成(多阶段)。所有 @svton/* 依赖都是 workspace:*
 * 私有包,因此 Dockerfile 必须以整个 monorepo 为构建上下文,COPY 全仓库后 `pnpm install`。
 *  - backend(NestJS+Prisma):用 `pnpm deploy` 把依赖扁平化到 /deploy,避开 pnpm
 *    symlink 跨阶段拷贝的坑;再在 /deploy 内 `prisma generate`。
 *  - admin(Next.js):用 `output: 'standalone'`,产物自包含,无需 deploy。
 */

export interface AppDockerTarget {
  name: string;
  /** 工作区相对目录,如 apps/backend */
  dir: string;
  type: 'nest' | 'next' | 'node';
  port?: number;
}

/** pnpm 版本(与根 packageManager 对齐)。 */
const PNPM_VERSION = '8.12.0';

/** backend(NestJS+Prisma)多阶段 Dockerfile。 */
export function generateBackendDockerfile(app: AppDockerTarget): string {
  const port = app.port ?? 3000;
  return `# 由 @svton/cli 生成 —— backend (NestJS + Prisma),镜像内构建
FROM node:18-alpine AS builder
RUN npm install -g pnpm@${PNPM_VERSION}
WORKDIR /repo
# 整个 monorepo 作为构建上下文(@svton/* 为 workspace 私有包)
COPY . .
RUN pnpm install --no-frozen-lockfile
# 先生成 prisma client —— 否则 build 时没有 Prisma 类型,noImplicitAny 会报错
RUN pnpm --filter ./${app.dir} exec prisma generate
# 用 turbo 构建(连带 workspace 依赖,如 @<org>/types —— 否则解析不到)
RUN pnpm exec turbo run build --filter=./${app.dir}...

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# 拷贝构建后的整个 workspace:node_modules(含 prisma client + CLI)、dist、packages 等。
# pnpm 的依赖符号链接都指向 node_modules/.pnpm(在 node_modules 内),跨阶段 COPY 仍可解析。
COPY --from=builder /repo /app
WORKDIR /app/${app.dir}
EXPOSE ${port}
# 启动前执行迁移(需要运行时注入 DATABASE_URL),再启动服务
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/main"]
`;
}

/** admin(Next.js standalone)多阶段 Dockerfile。需要 next.config 里 output:'standalone'。 */
export function generateAdminDockerfile(app: AppDockerTarget): string {
  const port = app.port ?? 3001;
  return `# 由 @svton/cli 生成 —— admin (Next.js standalone),镜像内构建
# 前置:next.config.{js,ts} 需设置 output: 'standalone'
FROM node:18-alpine AS builder
RUN npm install -g pnpm@${PNPM_VERSION}
WORKDIR /repo
COPY . .
RUN pnpm install --no-frozen-lockfile
RUN pnpm exec turbo run build --filter=./${app.dir}...

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# standalone 产物自包含(server.js + 所需 node_modules)
COPY --from=builder /repo/${app.dir}/.next/standalone ./
COPY --from=builder /repo/${app.dir}/.next/static ./.next/static
COPY --from=builder /repo/${app.dir}/public ./public
EXPOSE ${port}
ENV PORT=${port}
CMD ["node", "server.js"]
`;
}

/** node 型 app(如 agent-desktop)通用 Dockerfile —— 有 build/start 脚本即可。 */
export function generateNodeDockerfile(app: AppDockerTarget): string {
  const port = app.port ?? 3000;
  return `# 由 @svton/cli 生成 —— ${app.name},镜像内构建
FROM node:18-alpine AS builder
RUN npm install -g pnpm@${PNPM_VERSION}
WORKDIR /repo
COPY . .
RUN pnpm install --no-frozen-lockfile
RUN pnpm exec turbo run build --filter=./${app.dir}...
RUN pnpm deploy --filter=./${app.dir} --prod /deploy

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /deploy /app
EXPOSE ${port}
CMD ["node", "dist/main"]
`;
}

/** 按 app 类型选 Dockerfile 生成器。 */
export function generateAppDockerfile(app: AppDockerTarget): string {
  switch (app.type) {
    case 'next':
      return generateAdminDockerfile(app);
    case 'nest':
      return generateBackendDockerfile(app);
    default:
      return generateNodeDockerfile(app);
  }
}

export interface ProdComposeOptions {
  projectName: string;
  apps: AppDockerTarget[];
  /** 是否把 mysql+redis 一并放进 prod compose(默认 true,使 `svton docker up` 一条命令起整套)。 */
  db?: boolean;
}

/**
 * 生产 docker-compose —— 以 repo 根为构建上下文构建各 app 镜像并运行,
 * 可附带 mysql+redis,使 `svton docker up` 一次起整套。
 */
export function generateProdDockerCompose(options: ProdComposeOptions): string {
  const { projectName, apps, db = true } = options;
  const dbPass = 'root123456';
  const backend = apps.find((a) => a.type === 'nest');

  const services = apps.map((app) => {
    const port = app.port ?? 3000;
    const env: string[] = [`PORT: ${port}`];
    let depends: string[] = [];

    if (app.type === 'nest') {
      env.push(`DATABASE_URL: mysql://root:${dbPass}@mysql:3306/${projectName}`);
      env.push(`REDIS_URL: redis://redis:6379`);
      if (db) depends = ['mysql', 'redis'];
    } else if (app.type === 'next' && backend) {
      env.push(`NEXT_PUBLIC_API_URL: http://localhost:${backend.port ?? 3000}/api`);
      depends = ['backend'];
    }

    const envBlock = `\n    environment:\n${env.map((l) => `      ${l}`).join('\n')}`;
    const depBlock = depends.length ? `\n    depends_on:\n${depends.map((d) => `      - ${d}`).join('\n')}` : '';

    return `  ${app.name}:
    build:
      context: .
      dockerfile: ${app.dir}/Dockerfile
    container_name: ${projectName}-${app.name}
    restart: unless-stopped
    ports:
      - '${port}:${port}'${envBlock}${depBlock}`;
  });

  const dbBlock = db
    ? `\n  mysql:
    image: mysql:8.0
    container_name: ${projectName}-mysql
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: ${dbPass}
      MYSQL_DATABASE: ${projectName}
    ports:
      - '3306:3306'
    volumes:
      - mysql_data:/var/lib/mysql

  redis:
    image: redis:7-alpine
    container_name: ${projectName}-redis
    restart: unless-stopped
    ports:
      - '6379:6379'

volumes:
  mysql_data:`
    : '';

  return `# 由 @svton/cli 生成 —— 生产编排(镜像内构建)
services:
${services.join('\n\n')}
${dbBlock}`;
}

/** 根 .dockerignore —— 缩小构建上下文。 */
export function generateDockerignore(): string {
  return `# 依赖与构建产物(镜像内重新 install/build)
node_modules
**/node_modules
**/dist
**/.next
**/.turbo
**/build

# 版本控制 / 元数据
.git
.github
.idea
.vscode
*.log

# 文档(不入镜像)
docs
README.md
**/README.md

# 本地环境(运行时注入)
.env
.env.*
!.env.example

# svton 内部
.svton
`;
}
