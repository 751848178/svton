import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { loadManifest } from '../config/loader';

async function tmpRoot(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), `svton-load-${prefix}-`));
}

describe('loader', () => {
  it('loads a svton.config.ts via jiti and uses it authoritatively', async () => {
    const root = await tmpRoot('ts');
    await fs.writeJSON(path.join(root, 'package.json'), { name: 'x', svton: { schema: 1 } });
    await fs.writeFile(
      path.join(root, 'svton.config.ts'),
      [
        'const config = {',
        '  schema: 1,',
        '  apps: { api: { dir: "apps/api", type: "nest" as const, port: 5555 } },',
        '};',
        'export default config;',
      ].join('\n'),
    );

    const manifest = await loadManifest(root);
    expect(manifest.apps.api.port).toBe(5555);
    expect(Object.keys(manifest.apps)).toEqual(['api']);
  });

  it('rejects a manifest with the wrong schema version', async () => {
    const root = await tmpRoot('bad');
    await fs.writeJSON(path.join(root, 'package.json'), { name: 'x', svton: { schema: 1 } });
    await fs.writeFile(
      path.join(root, 'svton.config.ts'),
      'export default { schema: 99, apps: {} };',
    );

    await expect(loadManifest(root)).rejects.toThrow(/schema is 99/);
  });

  it('falls back to detection when only the package.json marker is present', async () => {
    const root = await tmpRoot('marker');
    await fs.writeJSON(path.join(root, 'package.json'), { name: 'x', packageManager: 'pnpm@8.12.0', svton: { schema: 1 } });
    await fs.writeFile(path.join(root, 'turbo.json'), '{}');
    await fs.writeFile(path.join(root, 'pnpm-workspace.yaml'), "packages:\n  - 'apps/*'\n");
    await fs.ensureDir(path.join(root, 'apps', 'web'));
    await fs.writeJSON(path.join(root, 'apps', 'web', 'package.json'), {
      name: '@x/web',
      scripts: { dev: 'next dev -p 8080' },
      dependencies: { next: '*' },
    });

    const manifest = await loadManifest(root);
    expect(manifest.apps.web.port).toBe(8080);
    expect(manifest.pm).toBe('pnpm');
  });
});
