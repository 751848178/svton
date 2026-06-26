import {
  generateBackendDockerfile,
  generateAdminDockerfile,
  generateProdDockerCompose,
  generateDockerignore,
  generateAppDockerfile,
} from '../utils/docker-gen';

describe('docker-gen', () => {
  it('backend Dockerfile builds inside image (pnpm deploy + prisma generate + migrate)', () => {
    const df = generateBackendDockerfile({ name: 'backend', dir: 'apps/backend', type: 'nest', port: 3000 });
    expect(df).toMatch(/FROM node:18-alpine AS builder/);
    expect(df).toMatch(/npm install -g pnpm@/);
    expect(df).toMatch(/COPY \. \./); // whole workspace as context
    expect(df).toMatch(/turbo run build --filter=\.\/apps\/backend\.\.\./);
    expect(df).toMatch(/exec prisma generate/); // before build (Prisma types must exist)
    expect(df).toMatch(/FROM node:18-alpine AS runner/);
    expect(df).toMatch(/COPY --from=builder \/repo \/app/); // whole built workspace
    expect(df).toMatch(/EXPOSE 3000/);
    expect(df).toMatch(/prisma migrate deploy && node dist\/main/);
  });

  it('admin Dockerfile uses Next standalone', () => {
    const df = generateAdminDockerfile({ name: 'admin', dir: 'apps/admin', type: 'next', port: 3001 });
    expect(df).toMatch(/turbo run build --filter=\.\/apps\/admin\.\.\./);
    expect(df).toMatch(/\.next\/standalone/);
    expect(df).toMatch(/\.next\/static/);
    expect(df).toMatch(/public \.\/public/);
    expect(df).toMatch(/CMD \["node", "server\.js"\]/);
    expect(df).not.toMatch(/pnpm deploy/); // standalone is self-contained, no deploy
    expect(df).toMatch(/EXPOSE 3001/);
  });

  it('generateAppDockerfile dispatches by type', () => {
    expect(generateAppDockerfile({ name: 'b', dir: 'apps/b', type: 'nest' })).toMatch(/prisma generate/);
    expect(generateAppDockerfile({ name: 'a', dir: 'apps/a', type: 'next' })).toMatch(/standalone/);
    expect(generateAppDockerfile({ name: 'd', dir: 'apps/d', type: 'node' })).toMatch(/pnpm deploy/);
  });

  it('prod compose wires apps + db with ports, env, depends_on', () => {
    const compose = generateProdDockerCompose({
      projectName: 'demo',
      apps: [
        { name: 'backend', dir: 'apps/backend', type: 'nest', port: 3000 },
        { name: 'admin', dir: 'apps/admin', type: 'next', port: 3001 },
      ],
    });
    expect(compose).toMatch(/build:\s*\n\s*context: \.\s*\n\s*dockerfile: apps\/backend\/Dockerfile/);
    expect(compose).toMatch(/container_name: demo-backend/);
    expect(compose).toMatch(/'3000:3000'/);
    expect(compose).toMatch(/DATABASE_URL: mysql:\/\/root:root123456@mysql:3306\/demo/);
    expect(compose).toMatch(/depends_on:\s*\n\s*- mysql\s*\n\s*- redis/);
    expect(compose).toMatch(/NEXT_PUBLIC_API_URL: http:\/\/localhost:3000\/api/);
    expect(compose).toMatch(/image: mysql:8\.0/);
    expect(compose).toMatch(/image: redis:7-alpine/);
    expect(compose).toMatch(/volumes:\s*\n\s*mysql_data:/);
  });

  it('dockerignore excludes build artifacts & secrets', () => {
    const di = generateDockerignore();
    expect(di).toMatch(/\*\*\/node_modules/);
    expect(di).toMatch(/\*\*\/dist/);
    expect(di).toMatch(/\*\*\/\.next/);
    expect(di).toMatch(/\.git/);
    expect(di).toMatch(/\.env/);
    expect(di).toMatch(/!\.env\.example/);
  });
});
