#!/usr/bin/env node
// Builds and supervises the local control plane; only its two child apps are stopped.
import { spawn } from 'node:child_process';
import { mkdir, open, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireProcessLock } from './platform-process-lock.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dataRoot = path.resolve(process.env.SHIPKIT_DATA_DIR ?? path.join(repo, 'shipkit/.platform'));
const logRoot = path.join(dataRoot, 'process-logs');
const production = process.argv.includes('--production');
const reuseBuild = process.argv.includes('--reuse-build');
await mkdir(logRoot, { recursive: true, mode: 0o700 });
const env = { ...process.env, SHIPKIT_DATA_DIR: dataRoot, DATABASE_URL: process.env.DATABASE_URL ?? `file:${path.join(dataRoot, 'platform.db')}` };
if (env.DATABASE_URL === `file:${path.join(dataRoot, 'platform.db')}`) {
  const db = await open(path.join(dataRoot, 'platform.db'), 'a', 0o600);
  await db.close();
}
let stopping = false;
const children = [];
const running = new Set();

async function launch(name, cmd, args, cwd = repo) {
  if (stopping) throw new Error('Shipkit startup was stopped');
  const file = await open(path.join(logRoot, `${name}.log`), 'a', 0o600);
  const child = spawn(cmd, args, { cwd, env, stdio: ['ignore', file.fd, file.fd] });
  running.add(child);
  child.once('close', () => running.delete(child));
  child.once('exit', () => void file.close());
  child.once('error', () => void file.close());
  return child;
}
async function run(name, args) {
  const child = await launch(name, 'pnpm', args);
  await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`${name} failed (${code}); see ${path.join(logRoot, `${name}.log`)}`)));
  });
}
function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of running) child.kill('SIGTERM');
}
async function ready(url) {
  for (let i = 0; i < 60; i++) {
    if (stopping) throw new Error('A platform process exited during startup');
    try { const response = await fetch(url); if (response.ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Platform did not become ready at ${url}; see ${logRoot}`);
}
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
try {
  const releaseLock = await acquireProcessLock(dataRoot);
  process.once('exit', releaseLock);
  if (!reuseBuild) {
    await run('shipkit-build', ['--filter', 'shipkit', 'build']);
    await run('workspace-build', ['--filter', '@svton/api-client', '--filter', '@svton/hooks', '--filter', '@svton/ui', '--filter', '@svton/authz', '--filter', '@svton/nestjs-http', 'build']);
    await run('prisma-generate', ['--filter', '@svton/shipkit-api', 'prisma:generate']);
  }
  await run('prisma-migrate', ['--filter', '@svton/shipkit-api', 'prisma:migrate']);
  if (!reuseBuild) await run('api-build', ['--filter', '@svton/shipkit-api', 'build']);
  if (production && !reuseBuild) await run('web-build', ['--filter', '@svton/shipkit-web', 'build']);
  children.push(await launch('api', process.execPath, ['dist/main.js'], path.join(repo, 'apps/shipkit-api')));
  children.push(await launch('web', process.execPath, ['node_modules/next/dist/bin/next', production ? 'start' : 'dev', '-H', '127.0.0.1', '-p', '8769'], path.join(repo, 'apps/shipkit-web')));
  for (const child of children) child.once('exit', (code) => { if (!stopping) { process.exitCode = code || 1; stop(); } });
  await writeFile(path.join(dataRoot, 'runtime.json'), JSON.stringify({ supervisorPid: process.pid, apiPid: children[0].pid, webPid: children[1].pid, startedAt: new Date().toISOString(), production }), { mode: 0o600 });
  await ready('http://127.0.0.1:8770/api/health');
  await ready('http://127.0.0.1:8769');
  console.log('Shipkit: http://127.0.0.1:8769 (API 127.0.0.1:8770)');
  console.log(`Database and archived logs: ${dataRoot}`);
  console.log(`Process logs: ${logRoot}`);
} catch (e) { console.error(e.message); process.exitCode = 1; stop(); }
