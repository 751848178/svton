import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { loadManifest, isMissingCliError, cliDeclared } from '../config/loader';

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

  it('throws clearly when the config has a wrong schema version (does not silently swallow)', async () => {
    const root = await tmpRoot('bad');
    await fs.writeJSON(path.join(root, 'package.json'), { name: 'x', svton: { schema: 1 } });
    await fs.writeFile(
      path.join(root, 'svton.config.ts'),
      'export default { schema: 99, apps: {} };',
    );

    await expect(loadManifest(root)).rejects.toThrow(/schema is 99/);
  });

  it('throws with a fix hint when config imports @svton/cli but it is not a declared dependency', async () => {
    const root = await tmpRoot('unresolvable');
    await fs.writeJSON(path.join(root, 'package.json'), { name: 'x', svton: { schema: 1 } });
    await fs.writeFile(
      path.join(root, 'svton.config.ts'),
      "import { defineSvtonProject } from '@svton/cli';\nexport default defineSvtonProject({ schema: 1, apps: {} });",
    );

    // 未声明为依赖 → 不静默回退,而是给出"add -D @svton/cli"的明确指引
    await expect(loadManifest(root)).rejects.toThrow(/add -D @svton\/cli/);
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

  it('isMissingCliError matches @svton/cli resolution failures', () => {
    expect(isMissingCliError(new Error("Cannot find module '@svton/cli'"))).toBe(true);
    expect(isMissingCliError(new Error("Cannot resolve '@svton/cli'"))).toBe(true);
    expect(isMissingCliError(new Error('syntax error'))).toBe(false);
  });

  it('cliDeclared detects @svton/cli in dependencies or devDependencies', async () => {
    const dev = await tmpRoot('decl-dev');
    await fs.writeJSON(path.join(dev, 'package.json'), { name: 'x', devDependencies: { '@svton/cli': '^2.3.0' } });
    await expect(cliDeclared(dev)).resolves.toBe(true);

    const dep = await tmpRoot('decl-dep');
    await fs.writeJSON(path.join(dep, 'package.json'), { name: 'x', dependencies: { '@svton/cli': '^2.3.0' } });
    await expect(cliDeclared(dep)).resolves.toBe(true);

    const none = await tmpRoot('decl-none');
    await fs.writeJSON(path.join(none, 'package.json'), { name: 'x' });
    await expect(cliDeclared(none)).resolves.toBe(false);
  });
});
