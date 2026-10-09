import { spawn } from 'node:child_process';
import { open, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { readFixture, repo } from './platform-e2e-fixture.mjs';

const f = await readFixture();
const status = await fetch('http://127.0.0.1:19741/api/status', { headers: { authorization: `Bearer ${f.token}` } }).then((r) => r.json()).catch(() => null);
if (status?.activeJobs) throw new Error('Refusing to restart an active test Agent');
if (status) process.kill(f.agentPid, 'SIGTERM');
await new Promise((resolve) => setTimeout(resolve, 500));
const log = await open(f.agentLog, 'a', 0o600);
const child = spawn(process.execPath, [path.join(repo, 'shipkit/dist/agent/server.js')], { cwd: repo, stdio: ['ignore', log.fd, log.fd],
  env: { ...process.env, ...f.env, SHIP_AGENT_TOKEN: f.token, SHIP_AGENT_PORT: '19741', SHIP_AGENT_HOST: '127.0.0.1', SHIP_WORK_ROOT: f.workRoot } });
child.once('exit', (code) => { void log.close(); process.exitCode = code ?? 1; });
process.once('SIGTERM', () => child.kill('SIGTERM'));
f.agentPid = child.pid;
await writeFile('/tmp/codex-tool-runs/svton/platform-fixture.json', JSON.stringify(f), { mode: 0o600 });
console.log('Restarted owned test Agent with current build');
