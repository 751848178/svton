import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const cliRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(cliRoot, '..', '..');
const sourceDir = path.join(repoRoot, 'templates');
const targetDir = path.join(cliRoot, 'templates');

async function exists(dir) {
  try {
    await fs.access(dir);
    return true;
  } catch {
    return false;
  }
}

if (!(await exists(sourceDir))) {
  if (await exists(targetDir)) {
    console.log(`templates source not found; keeping existing ${path.relative(process.cwd(), targetDir)}`);
    process.exit(0);
  }

  throw new Error(`templates source not found: ${sourceDir}`);
}

await fs.rm(targetDir, { recursive: true, force: true });
await fs.cp(sourceDir, targetDir, {
  recursive: true,
  filter: (src) => !src.includes(`${path.sep}node_modules${path.sep}`) && !src.includes(`${path.sep}dist${path.sep}`),
});

console.log(`synced templates to ${path.relative(process.cwd(), targetDir)}`);
