// R09: SIGINT/SIGTERM on a live dynamic-builder lease runs a BOUNDED active
// release before exiting. Proven with a REAL child process: the child enters
// withBuilderLease with an injected dynamic provider and a never-resolving
// run; the parent signals it and asserts the release actually ran (and that a
// failing release is reported, not swallowed). Fully simulated — no cloud.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const CHILD_SCRIPT = `
import { withBuilderLease } from ${JSON.stringify(path.join(ROOT, 'dist/cli/builder-lease.js'))};
const events = [];
const provider = {
  kind: 'fake-dynamic',
  ensure: async () => { events.push('ensure'); console.log('ENSURED'); return { url: 'http://builder', token: 't' }; },
  release: async () => {
    events.push('release');
    if (process.env.CANCEL_RELEASE_FAILS === '1') { console.log('RELEASE-ATTEMPTED'); throw new Error('cloud api down'); }
    console.log('RELEASE-CALLED');
  },
  status: async () => ({ kind: 'fake-dynamic', active: true }),
};
// wrapped in a function + keepalive: an UNSETTLED top-level await would let
// Node force-exit on signals without running the guard (verified by probe);
// the real CLI's main() is promise-based, matching this shape
const keep = setInterval(() => {}, 3_600_000);
try {
  await withBuilderLease({
    config: { builder: { mode: 'dynamic' } },
    taskBudgetMs: 60_000,
    log: { info: () => {}, warn: (m, meta) => console.log('LOG', m, JSON.stringify(meta ?? {})) },
    providerFactory: async () => provider,
    run: () => new Promise(() => {}), // cancelled mid-run
  });
  console.log('DONE-NORMALLY');
} catch (e) {
  console.log('LEASE-ERROR', String(e.message));
} finally {
  clearInterval(keep);
}
`;

function runCancelChild(signal: 'SIGINT' | 'SIGTERM', env: Record<string, string> = {}): Promise<{ out: string; signal: string | null; code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', CHILD_SCRIPT], { env: { ...process.env, ...env } });
    let out = '';
    child.stdout.on('data', (d) => {
      out += d;
      if (out.includes('ENSURED')) child.kill(signal);
    });
    child.stderr.on('data', (d) => { out += d; });
    const timer = setTimeout(() => reject(new Error(`child did not exit in time; output: ${out}`)), 30_000);
    child.on('exit', (code, sig) => { clearTimeout(timer); resolve({ out, signal: sig, code }); });
    child.on('error', reject);
  });
}

test('R09: SIGINT during a dynamic lease calls provider.release before the process dies', async () => {
  const { out, signal } = await runCancelChild('SIGINT');
  assert.ok(out.includes('ENSURED'), `lease was active: ${out}`);
  assert.ok(out.includes('RELEASE-CALLED'), `release actually ran: ${out}`);
  assert.match(out, /received SIGINT — running bounded cleanup/);
  assert.equal(signal, 'SIGINT', `conventional signal exit, not exit 0 (got signal=${signal})`);
});

test('R09: SIGTERM works the same way', async () => {
  const { out, signal } = await runCancelChild('SIGTERM');
  assert.ok(out.includes('RELEASE-CALLED'), out);
  assert.equal(signal, 'SIGTERM');
});

test('R09: a failing release is reported (pending cleanup), never swallowed', async () => {
  const { out } = await runCancelChild('SIGINT', { CANCEL_RELEASE_FAILS: '1' });
  assert.ok(out.includes('RELEASE-ATTEMPTED'), `release was attempted: ${out}`);
  assert.match(out, /cleanup failed.*verify manually|cleanup failed/, `failure surfaced: ${out}`);
});

test('R09: static mode arms no cancellation (nothing to release)', async () => {
  const script = CHILD_SCRIPT.replace("mode: 'dynamic'", "mode: 'static'").replace("kind: 'fake-dynamic'", "kind: 'fake-static'");
  const res = await new Promise<{ out: string; signal: string | null }>((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', script], { env: process.env });
    let out = '';
    child.stdout.on('data', (d) => { out += d; if (out.includes('ENSURED')) child.kill('SIGINT'); });
    child.stderr.on('data', (d) => { out += d; });
    const timer = setTimeout(() => reject(new Error(`timeout: ${out}`)), 15_000);
    child.on('exit', (_c, sig) => { clearTimeout(timer); resolve({ out, signal: sig }); });
    child.on('error', reject);
  });
  assert.ok(res.out.includes('ENSURED'));
  assert.ok(!res.out.includes('RELEASE-CALLED'), 'static machines are not released on cancel');
  assert.ok(!res.out.includes('received SIGINT — running bounded cleanup'), 'no guard armed in static mode');
  assert.equal(res.signal, 'SIGINT');
});
