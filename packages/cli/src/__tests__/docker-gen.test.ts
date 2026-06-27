import {
  resolveDockerContext,
  generateRootDockerfile,
  generateProdDockerCompose,
  generateMobileNginxConf,
  generateDockerEnvExample,
  generateDockerignore,
} from '../utils/docker-gen';
import { SvtonProjectConfig } from '../config/types';

const manifest: SvtonProjectConfig = {
  schema: 1,
  pm: 'pnpm',
  apps: {
    backend: { dir: 'apps/backend', type: 'nest', port: 3100, ready: { http: 'http://localhost:3100/api' } },
    admin: { dir: 'apps/admin', type: 'next', port: 3101, ready: { http: 'http://localhost:3101/' } },
    mobile: { dir: 'apps/mobile', type: 'taro', port: 10086 },
  },
  database: { orm: 'prisma', dir: 'apps/backend' },
};

const ctx = () => resolveDockerContext(manifest, 'twgg', '8.12.0');

describe('docker-gen (production-grade)', () => {
  it('resolveDockerContext: defaults (127.0.0.1 bind, mysql, mobile opt-in, healthcheck from ready)', () => {
    const c = ctx();
    expect(c.projectName).toBe('twgg');
    expect(c.nodeVersion).toBe('20-alpine');
    expect(c.apps.map((a) => a.name)).toEqual(['backend', 'admin']); // mobile excluded (taro)
    expect(c.apps[0].healthPath).toBe('/api'); // from ready.http
    expect(c.apps[1].healthPath).toBe('/');
    expect(c.db?.bindHost).toBe('127.0.0.1');
    expect(c.db?.enabled).toBe(true);
    expect(c.mobile?.enabled).toBe(false); // opt-in
    expect(c.redis?.bindHost).toBe('127.0.0.1');
  });

  it('root Dockerfile: multi-stage + twgg patterns', () => {
    const df = generateRootDockerfile(ctx());
    expect(df).toMatch(/FROM node:20-alpine AS base/);
    expect(df).toMatch(/corepack prepare pnpm@8\.12\.0 --activate/);
    expect(df).toMatch(/--frozen-lockfile/); // NOT --no-frozen
    expect(df).toMatch(/FROM base AS deps-prod/); // slim prod-deps stage
    expect(df).toMatch(/pnpm install --prod --frozen-lockfile/);
    expect(df).toMatch(/FROM node:20-alpine AS backend-prod/);
    expect(df).toMatch(/adduser -S backendjs/); // non-root
    expect(df).toMatch(/\/app\/prisma-cli/); // independent prisma CLI
    expect(df).toMatch(/npm install --userconfig=\/app\/\.npmrc prisma@5/); // uses generated registry
    expect(df).toMatch(/prisma generate.*migrate deploy.*node/); // startup ordering
    expect(df).toMatch(/FROM node:20-alpine AS admin-prod/);
    expect(df).toMatch(/\.next\/standalone/); // next standalone
    expect(df).toMatch(/adduser -S adminjs/);
  });

  it('prod compose: anchors + healthcheck + condition depends_on + 127.0.0.1 + ${VAR} + profile', () => {
    const compose = generateProdDockerCompose(ctx());
    expect(compose).toMatch(/x-logging: &default-logging/);
    expect(compose).toMatch(/x-healthcheck-web: &healthcheck-web/);
    expect(compose).toMatch(/max-size: "10m"/);
    // DB bound to loopback + profile
    expect(compose).toMatch(/'127\.0\.0\.1:3306:3306'/);
    expect(compose).toMatch(/profiles: \['db'\]/);
    // secrets via ${VAR} (NOT hardcoded password)
    expect(compose).toMatch(/MYSQL_ROOT_PASSWORD: \$\{MYSQL_ROOT_PASSWORD/);
    expect(compose).not.toMatch(/MYSQL_ROOT_PASSWORD: root123456/);
    // app healthcheck uses container port + derived path
    expect(compose).toMatch(/wget -qO- http:\/\/127\.0\.0\.1:3100\/api/);
    // depends_on with condition (not plain list)
    expect(compose).toMatch(/mysql:\n        condition: service_healthy/);
    // image names
    expect(compose).toMatch(/image: twgg-backend:prod/);
    // mobile omitted (opt-in, default off)
    expect(compose).not.toMatch(/container_name: twgg-mobile/);
  });

  it('mobile enabled → compose includes mobile service', () => {
    const m = { ...manifest, docker: { mobile: { enabled: true } } };
    const c = resolveDockerContext(m, 'twgg', '8.12.0');
    const compose = generateProdDockerCompose(c);
    expect(compose).toMatch(/container_name: twgg-mobile/);
    expect(generateRootDockerfile(c)).toMatch(/FROM nginx:alpine AS mobile-prod/);
  });

  it('postgres engine', () => {
    const m = { ...manifest, docker: { db: { engine: 'postgres' as const } } };
    const c = resolveDockerContext(m, 'twgg', '8.12.0');
    expect(c.db?.engine).toBe('postgres');
    expect(c.db?.version).toBe('16-alpine');
    expect(generateProdDockerCompose(c)).toMatch(/image: postgres:16-alpine/);
  });

  it('mobile nginx conf + env.example + dockerignore', () => {
    expect(generateMobileNginxConf(10086)).toMatch(/listen 10086/);
    expect(generateMobileNginxConf()).toMatch(/try_files \$uri \$uri\/ \/index\.html/);
    const env = generateDockerEnvExample(ctx());
    expect(env).toMatch(/MYSQL_ROOT_PASSWORD=change-me-root/);
    expect(env).toMatch(/DATABASE_URL=mysql:\/\/twgg/);
    expect(generateDockerignore()).toMatch(/\*\*\/node_modules/);
  });
});
