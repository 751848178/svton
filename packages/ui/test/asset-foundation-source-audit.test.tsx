import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, resolve } from 'node:path';

const root = resolve(process.cwd(), '../..');
const iconBoundary = 'packages/ui/src/icons/index.ts';
const ownedActiveFiles = [
  iconBoundary,
  'packages/ui/src/components/Avatar/index.tsx',
  'packages/ui/src/components/Collapse/index.tsx',
  'packages/ui/src/components/Copyable/index.tsx',
  'packages/ui/src/components/ErrorState/index.tsx',
  'packages/ui/src/components/Notification/index.tsx',
  'packages/ui/src/components/PermissionState/index.tsx',
  'packages/ui/src/components/ProgressState/index.tsx',
  'packages/ui/src/components/Tag/index.tsx',
  'apps/agent-web/src/components/ErrorBoundary.tsx',
];
const sourceRoots = [
  'packages/ui/src',
  'packages/agent-ui/src',
  'packages/agent-app/src',
  'apps/agent-web/src',
  'apps/agent-desktop/src',
];

function sourceFiles(relativeDirectory: string): string[] {
  return readdirSync(resolve(root, relativeDirectory), { withFileTypes: true }).flatMap((entry) => {
    const relativePath = `${relativeDirectory}/${entry.name}`;
    if (entry.isDirectory()) return sourceFiles(relativePath);
    return ['.ts', '.tsx'].includes(extname(entry.name)) ? [relativePath] : [];
  });
}

describe('I08.3c-1 asset source ownership', () => {
  it('has no handcrafted SVG or asset glyph in the exact owned active source set', () => {
    for (const path of ownedActiveFiles) {
      const source = readFileSync(resolve(root, path), 'utf8');
      expect(source, path).not.toMatch(/<svg\b/);
      expect(source, path).not.toMatch(/[×✓✗●]/u);
    }
  });

  it('keeps every direct Lucide import at the shared icon boundary', () => {
    const imports = sourceRoots
      .flatMap(sourceFiles)
      .filter((path) => readFileSync(resolve(root, path), 'utf8').includes('lucide-react'));
    expect(imports).toEqual([iconBoundary]);
  });

  it('removes the zero-import parallel Web design files and references', () => {
    const deadFiles = [
      'apps/agent-web/src/components/icons.tsx',
      'apps/agent-web/src/components/ui/SettingsUI.tsx',
    ];
    expect(deadFiles.filter((path) => existsSync(resolve(root, path)))).toEqual([]);
    const staleImports = sourceFiles('apps/agent-web/src').filter((path) => {
      const source = readFileSync(resolve(root, path), 'utf8');
      return /from\s+['"](?:\.\/icons|@\/components\/icons|\.\.?\/ui\/SettingsUI|@\/components\/ui\/SettingsUI)['"]/.test(source);
    });
    expect(staleImports).toEqual([]);
  });
});
