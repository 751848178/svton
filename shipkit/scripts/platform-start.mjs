#!/usr/bin/env node
// Builds and supervises the local control plane; only its two child apps are stopped.
import { mkdir, open, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireProcessLock } from './platform-process-lock.mjs';
import { platformStartSettings } from './platform-start-settings.mjs';
import { platformRuntimeContext } from './platform-runtime-context.mjs';
import { spawnPlatformProcess, waitPlatformProcess } from './platform-process-tree.mjs';
import { platformSupervisorLifecycle } from './platform-supervisor-lifecycle.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const production = process.argv.includes('--production');
const reuseBuild = process.argv.includes('--reuse-build');
const { dataRoot, logRoot, webHost } = await platformStartSettings(repo, process.env, production);
await mkdir(logRoot, { recursive: true, mode: 0o700 });
const env = { ...process.env, SHIPKIT_DATA_DIR: dataRoot, DATABASE_URL: process.env.DATABASE_URL ?? `file:${path.join(dataRoot, 'platform.db')}` };
if (env.DATABASE_URL === `file:${path.join(dataRoot, 'platform.db')}`) {
  const db = await open(path.join(dataRoot, 'platform.db'), 'a', 0o600);
  await db.close();
}
const lifecycle = platformSupervisorLifecycle();
const children = [];

async function launch(name, cmd, args, cwd = repo) {
  return lifecycle.launch(
    () => open(path.join(logRoot, `${name}.log`), 'a', 0o600),
    (file) => spawnPlatformProcess(cmd, args, { cwd, env, stdio: ['ignore', file.fd, file.fd] }),
  );
}
async function run(name, args) {
  const child = await launch(name, 'pnpm', args);
  const { code } = await waitPlatformProcess(child);
  lifecycle.completed(child);
  if (code !== 0) throw new Error(`${name} failed (${code}); see ${path.join(logRoot, `${name}.log`)}`);
}
async function stop() {
  if (!await lifecycle.stop()) { console.error('Platform descendants could not be stopped; maintenance lock retained'); process.exitCode = 1; }
}
async function ready(url) {
  for (let i = 0; i < 60; i++) {
    if (lifecycle.stopping) throw new Error('A platform process exited during startup');
    try { const response = await fetch(url); if (response.ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Platform did not become ready at ${url}; see ${logRoot}`);
}
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
try {
  await lifecycle.acquire(() => acquireProcessLock(dataRoot));
  if (!reuseBuild) {
    await run('shipkit-build', ['--filter', 'shipkit', 'build']);
    await run('workspace-build', ['--filter', '@svton/api-client', '--filter', '@svton/hooks', '--filter', '@svton/ui', '--filter', '@svton/authz', '--filter', '@svton/nestjs-http', 'build']);
    await run('prisma-generate', ['--filter', '@svton/shipkit-api', 'prisma:generate']);
  }
  await run('prisma-migrate', ['--filter', '@svton/shipkit-api', 'prisma:migrate']);
  if (!reuseBuild) await run('api-build', ['--filter', '@svton/shipkit-api', 'build']);
  if (production && !reuseBuild) await run('web-build', ['--filter', '@svton/shipkit-web', 'build']);
  children.push(await launch('api', process.execPath, ['dist/main.js'], path.join(repo, 'apps/shipkit-api')));
  children.push(await launch('web', process.execPath, ['node_modules/next/dist/bin/next', production ? 'start' : 'dev', '-H', webHost, '-p', '8769'], path.join(repo, 'apps/shipkit-web')));
  for (const child of children) child.once('exit', (code) => { if (!lifecycle.stopping) { process.exitCode = code || 1; void stop(); } });
  await writeFile(path.join(dataRoot, 'runtime.json'), JSON.stringify({ supervisorPid: process.pid, apiPid: children[0].pid, webPid: children[1].pid, startedAt: new Date().toISOString(), production, ...await platformRuntimeContext(dataRoot) }), { mode: 0o600 });
  await ready('http://127.0.0.1:8770/api/health');
  await ready('http://127.0.0.1:8769');
  console.log('Shipkit: http://127.0.0.1:8769 (API 127.0.0.1:8770)');
  console.log(`Database and archived logs: ${dataRoot}`);
  console.log(`Process logs: ${logRoot}`);
} catch (e) { console.error(e.message); process.exitCode = 1; await stop(); }
