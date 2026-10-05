// S06: SIGINT/SIGTERM DURING builder provisioning (RunInstances done, agent
// health wait running) must cooperatively cancel ensure() and ACTIVELY
// terminate the instance this run persisted — release() is not deadlocked on
// the create lock, the ledger is cleared, and the exit stays a conventional
// signal exit. Proven with the REAL TencentBuilderProvider + real signal
// guard in child processes; only the cloud SDK is scripted (no cloud access).

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

interface Call { method: string; ids?: string[] }

async function readCalls(logFile: string): Promise<Call[]> {
  try {
    return (await readFile(logFile, 'utf8')).split('\n').filter(Boolean).map((l) => JSON.parse(l) as Call);
  } catch {
    return [];
  }
}

async function freePort(): Promise<number> {
  const srv = createServer();
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
  const port = (srv.address() as AddressInfo).port;
  await new Promise<void>((r) => srv.close(() => r()));
  return port;
}

interface ChildResult { out: string; code: number | null; signal: string | null; elapsedMs: number }

function runChild(mode: 'cancel' | 'control', signal: 'SIGINT' | 'SIGTERM', home: string, logFile: string, agentPort: number): Promise<ChildResult> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const child = spawn(process.execPath, [
      '--experimental-test-module-mocks',
      '--import', path.join(ROOT, 'dist/providers/test-fixtures/cancel-ensure-mock-sdk.js'),
      path.join(ROOT, 'dist/providers/test-fixtures/cancel-ensure-child.js'),
    ], {
      env: { ...process.env, CHILD_MODE: mode, CHILD_HOME: home, HOME: home, MOCK_SDK_LOG: logFile, CHILD_AGENT_PORT: String(agentPort) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let signalled = false;
    child.stdout.on('data', (d) => {
      out += d;
      // exactly ONE signal: a second one would legitimately force-quit the guard
      if (mode === 'cancel' && !signalled && out.includes('waiting for ship-agent')) {
        signalled = true;
        setTimeout(() => child.kill(signal), 300);
      }
    });
    child.stderr.on('data', (d) => { out += d; });
    const timer = setTimeout(() => reject(new Error(`child did not exit in 45s; output: ${out.slice(0, 800)}`)), 45_000);
    child.on('exit', (code, sig) => { clearTimeout(timer); resolve({ out, code, signal: sig, elapsedMs: Date.now() - started }); });
    child.on('error', reject);
  });
}

async function ledgerFile(home: string): Promise<string | null> {
  const dir = path.join(home, '.ship', 'builders');
  const files = await readdir(dir).catch(() => [] as string[]);
  return files.length ? path.join(dir, files[0] ?? '') : null;
}

test.beforeEach(async () => {
  // ensure the fixtures are compiled into dist (fail fast with a clear reason)
  const probe = path.join(ROOT, 'dist/providers/test-fixtures/cancel-ensure-child.js');
  await readFile(probe).catch(() => { throw new Error('fixtures not compiled — run `npm run build` first'); });
});

test('S06: SIGINT during provisioning terminates the persisted instance, clears the ledger, bounded, conventional exit', async (t) => {
  const home = await mkdtemp(path.join(tmpdir(), 'ship-s06-home-'));
  const logFile = path.join(home, 'sdk-calls.jsonl');
  await writeFile(logFile, '');
  t.after(() => rm(home, { recursive: true, force: true }));
  const port = await freePort();
  const res = await runChild('cancel', 'SIGINT', home, logFile, port);
  const calls = await readCalls(logFile);

  assert.ok(calls.some((c) => c.method === 'RunInstances'), 'an instance was created and persisted');
  const terminates = calls.filter((c) => c.method === 'TerminateInstances');
  assert.ok(terminates.length >= 1, `ACTIVE release proven: TerminateInstances called ${terminates.length}x (log: ${JSON.stringify(calls)})`);
  assert.deepEqual(terminates.flatMap((c) => c.ids ?? []), ['ins-s06-cancel-1'], 'only OUR instance is terminated');
  assert.equal(await ledgerFile(home), null, 'builder ledger cleared after compensation');
  assert.equal(res.signal, 'SIGINT', `conventional signal exit (got code=${res.code} signal=${res.signal})`);
  assert.ok(res.elapsedMs < 30_000, `bounded cancel (took ${res.elapsedMs}ms)`);
  assert.match(res.out, /received SIGINT — running bounded cleanup/, 'the guard logged the bounded cleanup');
});

test('S06: SIGTERM behaves identically during provisioning', async (t) => {
  const home = await mkdtemp(path.join(tmpdir(), 'ship-s06-home-'));
  const logFile = path.join(home, 'sdk-calls.jsonl');
  await writeFile(logFile, '');
  t.after(() => rm(home, { recursive: true, force: true }));
  const res = await runChild('cancel', 'SIGTERM', home, logFile, await freePort());
  const calls = await readCalls(logFile);
  assert.ok(calls.some((c) => c.method === 'TerminateInstances'), `terminate ran: ${JSON.stringify(calls)}`);
  assert.equal(await ledgerFile(home), null);
  assert.equal(res.signal, 'SIGTERM');
});

test('S06 (control): normal provisioning completes, the task runs, and completion releases the machine exactly once', async (t) => {
  const home = await mkdtemp(path.join(tmpdir(), 'ship-s06-home-'));
  const logFile = path.join(home, 'sdk-calls.jsonl');
  await writeFile(logFile, '');
  t.after(() => rm(home, { recursive: true, force: true }));
  const res = await runChild('control', 'SIGINT', home, logFile, await freePort());
  assert.equal(res.code, 0, `normal exit (out: ${res.out.slice(-400)})`);
  assert.match(res.out, /RUN-REACHED/);
  assert.match(res.out, /DONE-NORMALLY/);
  const calls = await readCalls(logFile);
  const terminates = calls.filter((c) => c.method === 'TerminateInstances');
  assert.equal(terminates.length, 1, `exactly one release at completion: ${JSON.stringify(calls)}`);
  assert.equal(await ledgerFile(home), null, 'ledger cleared');
});
