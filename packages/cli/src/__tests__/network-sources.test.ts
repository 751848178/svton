import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { createNpmrc, DEFAULT_NPM_REGISTRY, resolveNpmRegistry } from '../utils/registry';
import { getInstallCommand } from '../utils/install';
import { findLocalTemplateDir, getTemplateDirCandidates } from '../utils/template-source';
import { resolveTemplateArchiveUrl } from '../utils/github-template';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('domestic network source defaults', () => {
  it('uses npmmirror by default and supports explicit registry overrides', () => {
    expect(resolveNpmRegistry()).toBe(DEFAULT_NPM_REGISTRY);

    process.env.SVTON_NPM_REGISTRY = 'https://mirror.example.com/';
    expect(resolveNpmRegistry()).toBe('https://mirror.example.com');
    expect(resolveNpmRegistry('https://registry.internal/')).toBe('https://registry.internal');

    expect(createNpmrc('https://registry.internal/')).toBe(
      [
        'registry=https://registry.internal',
        'auto-install-peers=true',
        'strict-peer-dependencies=false',
        '',
      ].join('\n'),
    );
  });

  it('passes the resolved registry through package-manager install commands', () => {
    expect(getInstallCommand('pnpm', 'https://registry.npmmirror.com')).toEqual({
      command: 'pnpm',
      args: ['install', '--registry=https://registry.npmmirror.com'],
    });
    expect(getInstallCommand('npm')).toEqual({ command: 'npm', args: ['install'] });
    expect(() => getInstallCommand('unknown')).toThrow(/Unsupported package manager/);
  });

  it('prefers package-local templates before workspace templates', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'svton-template-source-'));
    const baseDir = path.join(root, 'packages', 'cli', 'dist');
    const packagedTemplates = path.join(root, 'packages', 'cli', 'templates');
    const workspaceTemplates = path.join(root, 'templates');

    await fs.ensureDir(path.join(baseDir));
    await fs.ensureDir(path.join(packagedTemplates, 'apps'));
    await fs.ensureDir(path.join(packagedTemplates, 'packages'));
    await fs.ensureDir(path.join(workspaceTemplates, 'apps'));
    await fs.ensureDir(path.join(workspaceTemplates, 'packages'));

    expect(getTemplateDirCandidates(baseDir)[0]).toEqual({
      templateDir: packagedTemplates,
      source: 'packaged',
    });

    const resolved = await findLocalTemplateDir(baseDir);
    expect(resolved).toMatchObject({
      templateDir: packagedTemplates,
      source: 'packaged',
      cleanup: false,
    });
  });

  it('allows remote template archive or repo mirrors to override GitHub defaults', () => {
    process.env.SVTON_TEMPLATE_ARCHIVE_URL = 'https://mirror.example.com/svton.tar.gz';
    expect(resolveTemplateArchiveUrl()).toBe('https://mirror.example.com/svton.tar.gz');

    delete process.env.SVTON_TEMPLATE_ARCHIVE_URL;
    process.env.SVTON_TEMPLATE_REPO = 'mirror/svton';
    process.env.SVTON_TEMPLATE_BRANCH = 'main';
    expect(resolveTemplateArchiveUrl()).toBe('https://github.com/mirror/svton/archive/refs/heads/main.tar.gz');
  });
});
