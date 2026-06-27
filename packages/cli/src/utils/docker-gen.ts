/**
 * svton 项目的生产级 Docker 产物生成器(吸收 twgg 生产范式)。
 *
 * 设计:build 全部在镜像内完成(单根多阶段 Dockerfile),所有 @svton/* 依赖为 workspace:*
 * 私有包,故以整个 monorepo 为构建上下文。
 *
 * 写死(观点默认):多阶段拓扑(base→deps→builder→deps-prod→<app>-prod)、--frozen-lockfile、
 * 非 root 用户、alpine+apk 集、Next standalone、backend 独立 prisma-cli + generate→migrate→start。
 * 可配:见 config/types.ts 的 SvtonDockerConfig(镜像版本、端口、db/redis 引擎与绑定、mobile、logging…)。
 * 密钥:绝不进 config,走 .env + compose ${VAR} 插值。
 */

import path from 'path';
import { SvtonProjectConfig, SvtonDockerConfig } from '../config/types';

export interface AppDockerTarget {
  name: string;
  dir: string;
  type: 'nest' | 'next' | 'node';
  port: number;
  /** 健康检查 HTTP 路径(容器内),如 '/api' 或 '/'。 */
  healthPath: string;
}

export interface ResolvedDockerContext {
  projectName: string;
  nodeVersion: string;
  pnpmVersion: string;
  apps: AppDockerTarget[];
  mobile?: { enabled: boolean; port: number };
  db: {
    engine: 'mysql' | 'postgres';
    version: string;
    bindHost: string;
    port: number;
    profile: string;
    enabled: boolean;
    commandArgs: string[];
    volumePath?: string;
  };
  redis: { version: string; bindHost: string; port: number; enabled: boolean; volumePath?: string };
  logging: { driver: string; maxSize: string; maxFile: number };
  restart: string;
  imageRegistry?: string;
}

const DEFAULT_MYSQL_ARGS = [
  '--performance-schema=OFF',
  '--innodb-buffer-pool-size=96M',
  '--innodb-log-buffer-size=16M',
  '--max-connections=60',
  '--table-open-cache=200',
];

/** 从 app.ready.http 推导健康检查路径;无则按类型默认。 */
function deriveHealthPath(readyHttp: string | undefined, type: string): string {
  if (readyHttp) {
    try {
      const u = new URL(readyHttp);
      return u.pathname.replace(/\/$/, '') || '/';
    } catch {
      /* fall through */
    }
  }
  return type === 'nest' ? '/api' : '/';
}

/** 把 manifest + docker 配置解析为生成器上下文(合并默认)。 */
export function resolveDockerContext(
  manifest: SvtonProjectConfig,
  projectName: string,
  pnpmVersion: string,
): ResolvedDockerContext {
  const d = manifest.docker ?? {};
  const image = d.image ?? {};
  const hasBackend = Object.values(manifest.apps).some((a) => a.type === 'nest');
  const dbEngine = d.db?.engine ?? (hasBackend ? 'mysql' : 'mysql');

  const apps: AppDockerTarget[] = Object.entries(manifest.apps)
    .filter(([, a]) => a.type === 'nest' || a.type === 'next' || a.type === 'node')
    .map(([name, a]) => {
      const override = d.apps?.[name];
      const port = override?.port ?? a.port ?? 3000;
      const readyHttp = override?.healthcheck?.path
        ? `http://x${override.healthcheck.path}`
        : a.ready?.http;
      return {
        name,
        dir: a.dir,
        type: a.type as AppDockerTarget['type'],
        port,
        healthPath: override?.healthcheck?.path ?? deriveHealthPath(readyHttp, a.type),
      };
    });

  const mobileApp = Object.values(manifest.apps).find((a) => a.type === 'taro');
  const mobile = mobileApp
    ? { enabled: d.mobile?.enabled ?? false, port: d.mobile?.port ?? (mobileApp.port ?? 10086) }
    : undefined;

  return {
    projectName,
    nodeVersion: image.nodeVersion ?? '20-alpine',
    pnpmVersion: image.pnpmVersion ?? pnpmVersion,
    apps,
    mobile,
    db: {
      engine: dbEngine,
      version: d.db?.version ?? (dbEngine === 'postgres' ? '16-alpine' : '8.0'),
      bindHost: d.db?.bindHost ?? '127.0.0.1',
      port: d.db?.port ?? (dbEngine === 'postgres' ? 5432 : 3306),
      profile: d.db?.profile ?? 'db',
      enabled: d.db?.enabled ?? hasBackend,
      commandArgs: d.db?.commandArgs ?? DEFAULT_MYSQL_ARGS,
      volumePath: d.db?.volumePath,
    },
    redis: {
      version: d.redis?.version ?? '7-alpine',
      bindHost: d.redis?.bindHost ?? '127.0.0.1',
      port: d.redis?.port ?? 6379,
      enabled: d.redis?.enabled ?? true,
      volumePath: d.redis?.volumePath,
    },
    logging: {
      driver: d.logging?.driver ?? 'json-file',
      maxSize: d.logging?.maxSize ?? '10m',
      maxFile: d.logging?.maxFile ?? 3,
    },
    restart: d.restart ?? 'unless-stopped',
    imageRegistry: image.registry,
  };
}

// ===================== 根多阶段 Dockerfile =====================

/** 单根多阶段 Dockerfile(twgg 模式):base/deps/builder/deps-prod + 每个 server app 的 <app>-prod + mobile-prod。 */
export function generateRootDockerfile(ctx: ResolvedDockerContext): string {
  const { nodeVersion, pnpmVersion, apps, mobile } = ctx;
  const lines: string[] = [
    '# syntax=docker/dockerfile:1',
    '# 由 @svton/cli 生成 —— 生产多阶段镜像。docker-compose 通过 build.target 选择 <app>-prod。',
    '# base:系统依赖 + pnpm',
    `FROM node:${nodeVersion} AS base`,
    'RUN apk add --no-cache libc6-compat openssl python3 make g++ wget \\',
    '  && corepack enable \\',
    `  && corepack prepare pnpm@${pnpmVersion} --activate`,
    '',
    '# deps:全量安装(builder 用)',
    'FROM base AS deps',
    'WORKDIR /app',
    'COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* .npmrc ./',
    'COPY packages ./packages',
    ...apps.map((a) => `COPY ${a.dir}/package.json ./${a.dir}/package.json`),
    'RUN pnpm install --frozen-lockfile',
    '',
    '# builder:拷源码、构建(types/dist + prisma client + 各 app 产物)',
    'FROM deps AS builder',
    'WORKDIR /app',
    'COPY packages ./packages',
    ...apps.map((a) => `COPY ${a.dir} ./${a.dir}`),
    'COPY turbo.json ./',
    ...apps.filter((a) => a.type === 'nest').map((a) => `RUN pnpm --filter ./${a.dir} exec prisma generate`),
    'RUN pnpm exec turbo run build',
    '',
    '# deps-prod:仅 prod 依赖(runner 用;剔除 devDeps)',
    'FROM base AS deps-prod',
    'WORKDIR /app',
    'COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* .npmrc ./',
    'COPY packages ./packages',
    ...apps.filter((a) => a.type === 'nest').map((a) => `COPY ${a.dir}/package.json ./${a.dir}/package.json`),
    '# types 需其构建产物(dist)才能被 workspace 链接',
    'COPY --from=builder /app/packages ./packages',
    'RUN pnpm install --prod --frozen-lockfile',
    '',
  ];

  // 每个 server app 的 <app>-prod target
  for (const app of apps) {
    lines.push(...generateAppTarget(app));
  }

  // mobile(taro h5)→ nginx 静态
  if (mobile?.enabled) {
    lines.push(
      '',
      '# mobile-prod:taro h5 静态,nginx 托管',
      'FROM base AS mobile-builder',
      'WORKDIR /app',
      'COPY --from=deps /app ./',
      'COPY packages ./packages',
      'COPY apps/mobile ./apps/mobile',
      'COPY turbo.json ./',
      'RUN pnpm --filter ./packages/types build && pnpm --filter ./apps/mobile build:h5',
      '',
      'FROM nginx:alpine AS mobile-prod',
      'COPY apps/mobile/nginx.conf /etc/nginx/conf.d/default.conf',
      'COPY --from=mobile-builder /app/apps/mobile/dist /usr/share/nginx/html',
      `EXPOSE ${mobile.port}`,
    );
  }

  return lines.join('\n') + '\n';
}

/** 单个 server app 的 <app>-prod target。 */
function generateAppTarget(app: AppDockerTarget): string[] {
  const user = `${app.name}js`;
  if (app.type === 'next') {
    return [
      '',
      `# ${app.name}-prod:next standalone,非 root`,
      `FROM node:20-alpine AS ${app.name}-prod`,
      'RUN apk add --no-cache wget',
      'WORKDIR /app',
      `ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=${app.port}`,
      `RUN addgroup -S nodejs && adduser -S ${user}`,
      `COPY --from=builder /app/${app.dir}/.next/standalone ./`,
      `COPY --from=builder /app/${app.dir}/.next/static ./${app.dir}/.next/static`,
      `COPY --from=builder /app/${app.dir}/public ./${app.dir}/public`,
      `RUN chown -R ${user}:nodejs /app`,
      `USER ${user}`,
      `EXPOSE ${app.port}`,
      `CMD ["node", "${app.dir}/server.js"]`,
    ];
  }
  // nest / node
  const distMain = app.type === 'nest' ? 'dist/src/main.js' : 'dist/main.js';
  const prismaBlock =
    app.type === 'nest'
      ? [
          '# 独立 prisma CLI(避开 workspace 协议):启动时 generate + migrate deploy',
          'RUN mkdir -p /app/prisma-cli && cd /app/prisma-cli && npm init -y >/dev/null && npm install --userconfig=/app/.npmrc prisma@5 >/dev/null',
          `ENV NODE_PATH=/app/${app.dir}/node_modules:/app/node_modules`,
          `CMD ["sh", "-c", "/app/prisma-cli/node_modules/.bin/prisma generate --schema=./${app.dir}/prisma/schema.prisma && /app/prisma-cli/node_modules/.bin/prisma migrate deploy --schema=./${app.dir}/prisma/schema.prisma && node ${app.dir}/${distMain}"]`,
        ]
      : [`CMD ["node", "${app.dir}/${distMain}"]`];
  return [
    '',
    `# ${app.name}-prod:prod 依赖 + dist${app.type === 'nest' ? ' + prisma' : ''},非 root`,
    `FROM node:20-alpine AS ${app.name}-prod`,
    'RUN apk add --no-cache libc6-compat openssl wget',
    'WORKDIR /app',
    'ENV NODE_ENV=production',
    `RUN addgroup -S nodejs && adduser -S ${user}`,
    '# 仅 prod 依赖(来自 deps-prod,无 pnpm/devDeps 残留)',
    'COPY --from=deps-prod /app/node_modules node_modules',
    `COPY --from=deps-prod /app/${app.dir}/node_modules ${app.dir}/node_modules`,
    'COPY --from=deps-prod /app/packages packages',
    `# 编译产物 + prisma schema(不含 src)`,
    `COPY --from=builder /app/${app.dir}/dist ${app.dir}/dist`,
    ...(app.type === 'nest' ? [`COPY --from=builder /app/${app.dir}/prisma ${app.dir}/prisma`] : []),
    `RUN chown -R ${user}:nodejs /app`,
    `USER ${user}`,
    `EXPOSE ${app.port}`,
    ...prismaBlock,
  ];
}

// ===================== 生产 docker-compose =====================

/** 生产 compose:anchors(logging/healthcheck)+ 各 app + mysql/redis(127.0.0.1 + ${VAR})+ mobile。 */
export function generateProdDockerCompose(ctx: ResolvedDockerContext): string {
  const { projectName, apps, db, redis, logging, restart, mobile } = ctx;
  const dbImage = `${db.engine}:${db.version}`;

  const services: string[] = [];
  const hasDb = db?.enabled;

  // mysql / redis(仅本机可达;密钥 ${VAR} 插值)
  if (hasDb) {
    services.push(
      `  mysql:
    image: ${dbImage}
    container_name: ${projectName}-mysql
    restart: ${restart}
    profiles: ['${db.profile}']
    logging: *default-logging${db.commandArgs.length ? `\n    command:\n${db.commandArgs.map((a) => `      - ${a}`).join('\n')}` : ''}
    environment:
      MYSQL_ROOT_PASSWORD: \${MYSQL_ROOT_PASSWORD:-root123456}
      MYSQL_DATABASE: \${MYSQL_DATABASE:-${projectName}}
    ports:
      - '${db.bindHost}:${db.port}:3306'
    volumes:
      - ${db.volumePath ? `'${db.volumePath}'` : 'mysql_data'}:/var/lib/mysql
    healthcheck:
      test: ['CMD-SHELL', 'mysqladmin ping -h 127.0.0.1 --silent']
      interval: 5s
      timeout: 5s
      retries: 20`,
    );
  }
  if (redis?.enabled) {
    services.push(
      `  redis:
    image: redis:${redis.version}
    container_name: ${projectName}-redis
    restart: ${restart}
    logging: *default-logging
    ports:
      - '${redis.bindHost}:${redis.port}:6379'
    volumes:
      - ${redis.volumePath ? `'${redis.volumePath}'` : 'redis_data'}:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 5s
      retries: 20`,
    );
  }

  // app 服务
  for (const app of apps) {
    const deps: string[] = [];
    if (app.type === 'nest') {
      if (hasDb) deps.push('mysql', 'redis');
    } else if (app.type === 'next') {
      const backend = apps.find((a) => a.type === 'nest');
      if (backend) deps.push(backend.name);
    }
    const envLines: string[] = [`PORT: ${app.port}`];
    if (app.type === 'nest') {
      envLines.push('NODE_ENV: production');
      envLines.push('DATABASE_URL: ${DATABASE_URL}');
      envLines.push('REDIS_URL: ${REDIS_URL}');
      envLines.push('JWT_SECRET: ${JWT_SECRET}');
    } else if (app.type === 'next') {
      envLines.push('NODE_ENV: production');
      envLines.push('NEXT_TELEMETRY_DISABLED: "1"');
    }
    const hc =
      app.type === 'nest' || app.type === 'next'
        ? `\n    healthcheck:\n      <<: *healthcheck-web\n      test: ['CMD-SHELL', 'wget -qO- http://127.0.0.1:${app.port}${app.healthPath}']`
        : '';
    const depBlock = deps.length
      ? `\n    depends_on:\n${deps.map((d) => `      ${d}:\n        condition: service_healthy`).join('\n')}`
      : '';
    services.push(
      `  ${app.name}:
    build:
      context: .
      dockerfile: Dockerfile
      target: ${app.name}-prod
    image: ${projectName}-${app.name}:prod
    container_name: ${projectName}-${app.name}
    restart: ${restart}
    logging: *default-logging
    ports:
      - '${app.port}:${app.port}'
    environment:
${envLines.map((l) => `      ${l}`).join('\n')}${hc}${depBlock}`,
    );
  }

  // mobile
  if (mobile?.enabled) {
    services.push(
      `  mobile:
    build:
      context: .
      dockerfile: Dockerfile
      target: mobile-prod
    image: ${projectName}-mobile:prod
    container_name: ${projectName}-mobile
    restart: ${restart}
    logging: *default-logging
    ports:
      - '${mobile.port}:${mobile.port}'
    healthcheck:
      <<: *healthcheck-web
      test: ['CMD-SHELL', 'wget -qO- http://127.0.0.1:${mobile.port}/']`,
    );
  }

  const volumes = [];
  if (hasDb && !db.volumePath) volumes.push('  mysql_data:');
  if (redis?.enabled && !redis.volumePath) volumes.push('  redis_data:');

  return `# 由 @svton/cli 生成 —— 生产编排(镜像内构建)
# 密钥从仓库根 .env 插值(复制 .env.example 为 .env 并填值)
x-logging: &default-logging
  driver: ${logging.driver}
  options:
    max-size: "${logging.maxSize}"
    max-file: "${logging.maxFile}"

x-healthcheck-web: &healthcheck-web
  interval: 15s
  timeout: 5s
  retries: 10
  start_period: 30s

services:
${services.join('\n\n')}

volumes:
${volumes.join('\n')}
`;
}

// ===================== mobile nginx + 宿主机 nginx 反代示例 =====================

/** mobile(taro h5)nginx 静态托管配置。 */
export function generateMobileNginxConf(port = 10086): string {
  return `# 由 @svton/cli 生成 —— mobile(taro h5)nginx 静态托管
server {
    listen ${port};
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript application/xml text/xml application/xml+rss text/javascript image/svg+xml;

    location /static/ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
`;
}

/** 宿主机 nginx 反向代理参考配置(单域名:/api→backend,/→admin)。 */
export function generateHostNginxExample(ctx: ResolvedDockerContext): string {
  const backend = ctx.apps.find((a) => a.type === 'nest');
  const admin = ctx.apps.find((a) => a.type === 'next');
  const bPort = backend?.port ?? 3100;
  const aPort = admin?.port ?? 3101;
  const mPort = ctx.mobile?.port ?? 10086;
  return `# 由 @svton/cli 生成 —— 宿主机 nginx 反向代理参考配置(非容器,部署到宿主 /etc/nginx/conf.d/)
# 模型:docker 容器端口映射到宿主机,本文件把域名请求转发到对应端口。
# 前端用同源相对 /api,由这里 /api 反代到 backend —— 镜像无需 build 时烘焙 API 地址。
# 复制后 nginx -s reload;按需启用 TLS。

server {
    listen 80;
    server_name ${ctx.projectName}.example.com;

    # admin 后台
    location / {
        proxy_pass http://127.0.0.1:${aPort};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API → backend
    location /api {
        proxy_pass http://127.0.0.1:${bPort};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Swagger(可选)
    location /api-docs {
        proxy_pass http://127.0.0.1:${bPort};
        proxy_set_header Host $host;
    }
}
`;
}

/** .env.example(docker 所需变量,占位值)。 */
export function generateDockerEnvExample(ctx: ResolvedDockerContext): string {
  const { projectName, db } = ctx;
  const lines = [
    `# 由 @svton/cli 生成 —— 复制为 .env 并填值(.env 已 gitignore)。docker-compose 自动读取。`,
    '',
    '# ---- MySQL ----',
    'MYSQL_ROOT_PASSWORD=change-me-root',
    `MYSQL_PASSWORD=change-me-${projectName}`,
    `MYSQL_DATABASE=${projectName}`,
    '',
    '# ---- Backend ----',
    `DATABASE_URL=mysql://${projectName}:change-me-${projectName}@mysql:3306/${projectName}`,
    'REDIS_URL=redis://redis:6379',
    'JWT_SECRET=change-me-to-a-long-random-secret',
    'JWT_EXPIRES_IN=7d',
  ];
  if (db?.engine === 'postgres') {
    lines.splice(3, 1, '# ---- PostgreSQL ----');
    lines[lines.findIndex((l) => l.startsWith('DATABASE_URL'))] = `DATABASE_URL=postgres://${projectName}:change-me-${projectName}@postgres:5432/${projectName}`;
  }
  return lines.join('\n') + '\n';
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
