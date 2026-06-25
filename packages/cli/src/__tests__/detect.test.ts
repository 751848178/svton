import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import {
  detectProject,
  inferAppType,
  inferPortFromScript,
  readWorkspaceGlobs,
} from '../config/detect';

async function buildFakeWorkspace(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'svton-detect-'));
  await fs.writeJSON(path.join(root, 'package.json'), { name: 'fake', packageManager: 'pnpm@8.12.0' });
  await fs.writeFile(path.join(root, 'pnpm-workspace.yaml'), "packages:\n  - 'apps/*'\n  - 'packages/*'\n");

  // next app on port 3000
  await fs.ensureDir(path.join(root, 'apps', 'web'));
  await fs.writeJSON(path.join(root, 'apps', 'web', 'package.json'), {
    name: '@fake/web',
    scripts: { dev: 'next dev -p 3000', build: 'next build' },
    dependencies: { next: '*' },
  });

  // nest app on port 4000 with global prefix api + health controller + prisma
  await fs.ensureDir(path.join(root, 'apps', 'api', 'src'));
  await fs.ensureDir(path.join(root, 'apps', 'api', 'prisma'));
  await fs.writeJSON(path.join(root, 'apps', 'api', 'package.json'), {
    name: '@fake/api',
    scripts: { dev: 'nest start --watch' },
    dependencies: { '@nestjs/core': '*' },
  });
  await fs.writeFile(
    path.join(root, 'apps', 'api', 'src', 'main.ts'),
    "const port = process.env.PORT || 4000;\napp.setGlobalPrefix('api');\nawait app.listen(port);\n",
  );
  await fs.writeFile(path.join(root, 'apps', 'api', 'src', 'health.controller.ts'), 'export class HealthController {}');
  await fs.writeFile(path.join(root, 'apps', 'api', 'prisma', 'schema.prisma'), 'datasource db { provider = "mysql" }');

  return root;
}

describe('detect', () => {
  it('infers app type from dependencies', () => {
    expect(inferAppType({ dependencies: { '@nestjs/core': '*' } })).toBe('nest');
    expect(inferAppType({ dependencies: { next: '*' } })).toBe('next');
    expect(inferAppType({ dependencies: { '@tarojs/taro': '*' } })).toBe('taro');
    expect(inferAppType({ dependencies: { vite: '*' } })).toBe('node');
  });

  it('infers port from a next dev script', () => {
    expect(inferPortFromScript('next dev -p 3210')).toBe(3210);
    expect(inferPortFromScript('next dev')).toBeUndefined();
  });

  it('parses workspace globs from pnpm-workspace.yaml', async () => {
    const root = await buildFakeWorkspace();
    const globs = await readWorkspaceGlobs(root);
    expect(globs).toEqual(['apps/*', 'packages/*']);
  });

  it('detects the full project manifest from a workspace tree', async () => {
    const root = await buildFakeWorkspace();
    const manifest = await detectProject(root);

    expect(manifest.pm).toBe('pnpm');
    expect(Object.keys(manifest.apps).sort()).toEqual(['api', 'web']);

    const api = manifest.apps.api;
    expect(api.type).toBe('nest');
    expect(api.port).toBe(4000);
    expect(api.baseURL).toBe('http://localhost:4000/api');
    expect(api.ready?.http).toBe('http://localhost:4000/api/health');

    const web = manifest.apps.web;
    expect(web.type).toBe('next');
    expect(web.port).toBe(3000);

    expect(manifest.database).toEqual({ orm: 'prisma', dir: 'apps/api' });
  });
});
