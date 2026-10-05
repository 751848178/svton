// Prepare and verify the artifact used by the isolated package smoke.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const exec = promisify(execFile);
export async function prepareSmokeArtifact(repo) {
  await exec('npm', ['run', 'build'], { cwd: repo, timeout: 120_000 });
  await exec(process.execPath, [path.join(repo, 'scripts', 'pack.mjs')], { cwd: repo, timeout: 120_000 });
  console.log('artifact: rebuilt and repacked from current source');
}

/** Installation must contain the current bytes, even for the same version. */
export async function assertInstalledArtifact(repo, packageRoot) {
  let checked = 0;
  const walk = async (relative) => {
    for (const entry of await readdir(path.join(repo, 'dist', relative), { withFileTypes: true })) {
      const name = path.join(relative, entry.name);
      if (entry.isDirectory()) { await walk(name); continue; }
      if (!entry.isFile()) throw new Error(`unsupported compiled artifact entry: ${name}`);
      const expected = await readFile(path.join(repo, 'dist', name));
      const installed = await readFile(path.join(packageRoot, 'dist', name));
      if (!expected.equals(installed)) throw new Error(`installed artifact differs from current source: ${name}`);
      checked++;
    }
  };
  await walk('');
  if (!checked) throw new Error('no compiled files to verify');
  return checked;
}
