import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireProcessLock } from '../../scripts/platform-process-lock.mjs';
import { spawnPlatformProcess, waitPlatformProcess } from '../../scripts/platform-process-tree.mjs';
import { platformSupervisorLifecycle } from '../../scripts/platform-supervisor-lifecycle.mjs';

// Offline initialization shares the same exclusive lease as the supervisor.
const repo = fileURLToPath(new URL('../../../', import.meta.url));
const app = path.join(repo, 'apps/shipkit-api');
const dataRoot = process.env.SHIPKIT_DATA_DIR;
const [action, ...args] = process.argv.slice(2);
if (!dataRoot || !path.isAbsolute(dataRoot) || !['migrate', 'key:init', 'admin'].includes(action)) {
  throw new Error('Usage: SHIPKIT_DATA_DIR=/absolute/data node shipkit/ops/container/bootstrap.mjs migrate | key:init | admin [--username NAME]');
}
await mkdir(dataRoot, { recursive: true, mode: 0o700 });
const lifecycle = platformSupervisorLifecycle();
let child;
process.once('SIGINT', () => void lifecycle.stop());
process.once('SIGTERM', () => void lifecycle.stop());
async function run(script, scriptArgs = []) {
  child = await lifecycle.launch(async () => ({ close: async () => {} }), () =>
    spawnPlatformProcess(process.execPath, [script, ...scriptArgs], { cwd: app, env: process.env, stdio: 'inherit' }));
  const { code } = await waitPlatformProcess(child);
  lifecycle.completed(child);
  if (code !== 0 || lifecycle.stopping) throw new Error(`Bootstrap ${action} failed (${code})`);
}
try {
  await lifecycle.acquire(() => acquireProcessLock(dataRoot, 'bootstrap'));
  await run('scripts/migrate.mjs');
  if (action === 'key:init') await run('dist/secrets/key-init.cli.js', ['init']);
  if (action === 'admin') await run('dist/auth/admin-cli.js', args);
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally {
  if (!await lifecycle.stop()) { console.error('Bootstrap descendants could not be stopped; maintenance lock retained'); process.exitCode = 1; }
}
