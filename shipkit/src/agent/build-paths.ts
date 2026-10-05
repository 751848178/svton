// Resolve build entry points within the materialized source before invoking Docker.
import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';

export async function resolveBuildPaths(repoDir: string, contextDir: string, dockerfileAbs: string) {
  const repo = await realpath(repoDir);
  const resolveInside = async (name: string, value: string, directory: boolean) => {
    const resolved = await realpath(value);
    const relative = path.relative(repo, resolved);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error(`${name} resolves outside the materialized source`);
    }
    const info = await stat(resolved);
    if (directory ? !info.isDirectory() : !info.isFile()) {
      throw new Error(`${name} must be a ${directory ? 'directory' : 'regular file'} inside the source`);
    }
    return resolved;
  };
  if (!(await stat(repo)).isDirectory()) throw new Error('source root must be a directory');
  return { repoDir: repo, contextDir: await resolveInside('build context', contextDir, true),
    dockerfileAbs: await resolveInside('Dockerfile', dockerfileAbs, false) };
}
