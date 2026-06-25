import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { findProjectRoot, isSvtonProject, NotASvtonProjectError } from '../utils/project-root';

async function tmpDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `svton-pr-${prefix}-`));
  return dir;
}

describe('project-root', () => {
  it('detects a dir containing svton.config.ts', async () => {
    const dir = await tmpDir('cfg');
    await fs.writeFile(path.join(dir, 'svton.config.ts'), 'export default {}');
    await expect(findProjectRoot(dir)).resolves.toBe(dir);
  });

  it('detects a package.json with the "svton" marker', async () => {
    const dir = await tmpDir('marker');
    await fs.writeJSON(path.join(dir, 'package.json'), { name: 'x', svton: { schema: 1 } });
    await expect(findProjectRoot(dir)).resolves.toBe(dir);
  });

  it('detects the turbo+workspace+apps heuristic', async () => {
    const dir = await tmpDir('heur');
    await fs.writeJSON(path.join(dir, 'turbo.json'), { pipeline: {} });
    await fs.writeFile(path.join(dir, 'pnpm-workspace.yaml'), "packages:\n  - 'apps/*'\n");
    await fs.ensureDir(path.join(dir, 'apps'));
    await expect(findProjectRoot(dir)).resolves.toBe(dir);
  });

  it('walks up from a subdirectory to the project root', async () => {
    const dir = await tmpDir('walk');
    await fs.writeFile(path.join(dir, 'svton.config.ts'), 'export default {}');
    const sub = path.join(dir, 'apps', 'web', 'src');
    await fs.ensureDir(sub);
    await expect(findProjectRoot(sub)).resolves.toBe(dir);
  });

  it('throws NotASvtonProjectError when nothing matches', async () => {
    const dir = await tmpDir('none');
    await expect(findProjectRoot(dir)).rejects.toBeInstanceOf(NotASvtonProjectError);
    await expect(isSvtonProject(dir)).resolves.toBe(false);
  });
});
