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

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'test-fixtures');

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

function runChild(mode: 'cancel' | 'control', signal: 'SIGINT' | 'SIGTERM', home: string, logFile: string, agentPort: number,
  options: { trigger?: string; sdk?: Record<string, string> } = {}): Promise<ChildResult> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const child = spawn(process.execPath, [
      '--experimental-test-module-mocks',
      '--import', path.join(FIXTURES, 'cancel-ensure-mock-sdk.js'),
      path.join(FIXTURES, 'cancel-ensure-child.js'),
    ], {
      env: { ...process.env, CHILD_MODE: mode, CHILD_HOME: home, HOME: home, MOCK_SDK_LOG: logFile, CHILD_AGENT_PORT: String(agentPort), ...options.sdk },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let signalled = false;
    child.stdout.on('data', (d) => {
      out += d;
      // exactly ONE signal: a second one would legitimately force-quit the guard
      if (mode === 'cancel' && !signalled && out.includes(options.trigger ?? 'waiting for ship-agent')) {
        signalled = true;
        setTimeout(() => child.kill(signal), 300);
      }
    });
    child.stderr.on('data', (d) => { out += d; });
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error(`child did not exit in 45s; output: ${out.slice(0, 800)}`)); }, 45_000);
    child.on('exit', (code, sig) => { clearTimeout(timer); resolve({ out, code, signal: sig, elapsedMs: Date.now() - started }); });
    child.on('error', reject);
  });
}

async function ledgerFile(home: string): Promise<string | null> {
  const dir = path.join(home, '.ship', 'builders');
  const files = await readdir(dir).catch(() => [] as string[]);
  const ledgers = files.filter(file => file.endsWith('.json'));
  return ledgers.length ? path.join(dir, ledgers[0] ?? '') : null;
}

test.beforeEach(async () => {
  // ensure the fixtures are compiled into dist (fail fast with a clear reason)
  const probe = path.join(FIXTURES, 'cancel-ensure-child.js');
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

async function cancelScenario(t: import('node:test').TestContext, sdk: Record<string, string>, trigger: string) {
  const home = await mkdtemp(path.join(tmpdir(), 'ship-s06-edge-'));
  t.after(() => rm(home, { recursive: true, force: true }));
  const logFile = path.join(home, 'sdk-calls.jsonl');
  await writeFile(logFile, '');
  const result = await runChild('cancel', 'SIGTERM', home, logFile, await freePort(), { sdk, trigger });
  assert.equal(result.signal, 'SIGTERM');
  assert.ok(result.elapsedMs < 13_000, `cancel took ${result.elapsedMs}ms: ${result.out.slice(-500)}`);
  return { home, result, calls: await readCalls(logFile) };
}

test('S06: a cancel while RunInstances is pending compensates its eventual response', async (t) => {
  const { home, calls } = await cancelScenario(t, { MOCK_RUNINSTANCES_DELAY_MS: '1500' }, 'creating CVM');
  assert.deepEqual(calls.filter(c => c.method === 'TerminateInstances').flatMap(c => c.ids ?? []), ['ins-s06-cancel-1']);
  assert.equal(await ledgerFile(home), null);
});

test('S06: compensation failure after a cancelled RunInstances response retains the durable instance id', async (t) => {
  const { home, result, calls } = await cancelScenario(t, { MOCK_RUNINSTANCES_DELAY_MS: '1500', MOCK_TERMINATE_FAILURE: '1' }, 'creating CVM');
  assert.ok(calls.some(c => c.method === 'TerminateInstances'));
  const file = await ledgerFile(home);
  assert.ok(file, 'the failed compensation must leave a retryable ledger');
  assert.equal(JSON.parse(await readFile(file, 'utf8')).instanceId, 'ins-s06-cancel-1');
  assert.match(result.out, /cleanup failed|resource may still exist/);
});

test('S06: cancellation during a slow IP query does not spend another polling sleep before release', async (t) => {
  const { home, calls, result } = await cancelScenario(t, { MOCK_NO_PUBLIC_IP: '1', MOCK_DESCRIBE_DELAY_MS: '4300' }, 'creating CVM');
  assert.ok(calls.some(c => c.method === 'TerminateInstances'), result.out);
  assert.equal(await ledgerFile(home), null, result.out);
  assert.ok(result.elapsedMs < 10_000);
});

test('S06: accepted termination with a live instance retains state and reports an unconfirmed cleanup', async (t) => {
  const { home, result, calls } = await cancelScenario(t, { MOCK_TERMINATE_PENDING: '1' }, 'waiting for ship-agent');
  assert.ok(calls.some(c => c.method === 'TerminateInstances'));
  const file = await ledgerFile(home);
  assert.ok(file, 'accepted is not confirmed: keep the id');
  assert.equal(JSON.parse(await readFile(file, 'utf8')).instanceId, 'ins-s06-cancel-1');
  assert.match(result.out, /cleanup did not finish|not confirmed|resource may still exist/);
});

test('S06: RunInstances exceeding the settle budget reports uncertainty without claiming release', async (t) => {
  const { home, result, calls } = await cancelScenario(t, { MOCK_RUNINSTANCES_DELAY_MS: '12000' }, 'creating CVM');
  assert.equal(calls.filter(c => c.method === 'TerminateInstances').length, 0, 'the id has not returned yet');
  assert.equal(await ledgerFile(home), null);
  assert.match(result.out, /did not settle.*instance may still exist/);
  assert.doesNotMatch(result.out, /DONE-NORMALLY/);
});
