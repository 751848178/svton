// M2-R2 fault-path regressions (REG-03/WAIT-01, 2026-10-04 review): registry
// enumeration failures are conservative (never an empty queue — a permission
// fault must fail the acquisition, leave the live mapping untouched and admit
// legal progress once restored); a publication-mutex cleanup failure still
// settles the in-process gate, and a later call recovers exactly its own
// leaked slot (never another live call's); an expired publication cleans its
// temp on every exit; a rename that lands after the caller's timeout does so
// before the bakery slot is released — no other publisher interleave — and
// later acquirers converge to that mapping. Children wrap ONLY fs paths
// (registry → a private dir; real EACCES via chmod) or add a scheduling gate
// around the original syscall; no syscall result is faked.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chmod, mkdtemp, mkdir, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { withPublishMutex } from './lock-pubmutex.js';

const MODULE = new URL('./file-lock.js', import.meta.url).href;

interface Kid {
  send(m: string): void;
  messages: Array<{ event: string; [k: string]: unknown }>;
  wait(event: string, ms?: number): Promise<{ event: string; [k: string]: unknown } | null>;
  exited: Promise<void>;
}

function kid(prelude: string, body: string): Kid {
  const code = `
import { mock } from 'node:test';
${prelude}
${body}
`;
  const c = spawn(process.execPath, ['--experimental-test-module-mocks', '--input-type=module', '-e', code], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
  c.on('error', () => { /* send after natural exit — harmless */ });
  const messages: Kid['messages'] = [];
  c.on('message', (m: { event: string }) => messages.push(m));
  return {
    send: (m: string) => { try { c.send(m); } catch { /* already exited */ } },
    messages,
    wait: (event, ms = 6000) => new Promise((resolve) => {
      const end = Date.now() + ms;
      const t = setInterval(() => {
        const found = messages.find((m) => m.event === event);
        if (found || Date.now() > end) { clearInterval(t); resolve(found ?? null); }
      }, 10);
    }),
    exited: new Promise((r) => c.on('exit', () => r())),
  };
}

/** child prelude: redirect the fixed registry root to a PRIVATE dir (path
 *  rewrite only — every fs call and result stays real) */
const redirect = (root: string) => `
const real = await import('node:fs/promises');
const REG = '/var/tmp/shipkit-lock-ports';
const map = (p) => { const s = String(p); return s.startsWith(REG) ? ${JSON.stringify(root)} + s.slice(REG.length) : s; };
mock.module('node:fs/promises', { namedExports: { ...real,
  mkdir: (p, ...r) => real.mkdir(map(p), ...r), readdir: (p, ...r) => real.readdir(map(p), ...r),
  readFile: (p, ...r) => real.readFile(map(p), ...r), writeFile: (p, ...r) => real.writeFile(map(p), ...r),
  rename: (s, d, ...r) => real.rename(map(s), map(d), ...r), rm: (p, ...r) => real.rm(map(p), ...r),
  access: (p, ...r) => real.access(map(p), ...r) } });
`;

const body = (file: string, opts: { timeoutMs?: number; hold?: boolean; claimPath?: string } = {}) => `
let release;
process.on('message', (m) => { if (m === 'resume') resume?.(); if (m === 'release') release?.(); if (m === 'exit') process.exit(0); });
let resume;
const { withFileLock } = await import(${JSON.stringify(MODULE)});
let ran = false; const t0 = Date.now();
try {
  await withFileLock(${JSON.stringify(file)}, async () => {
    ran = true;
    const { readFile, writeFile } = await import('node:fs/promises');
    const old = Number(await readFile(${JSON.stringify(file)}, 'utf8'));
    ${opts.claimPath ? `const claim = JSON.parse(await readFile(${JSON.stringify(opts.claimPath)}, 'utf8'));` : 'const claim = {};'}
    process.send({ event: 'entered', old, port: claim.port });
    ${opts.hold ? 'await new Promise((r) => (release = r));' : ''}
    await writeFile(${JSON.stringify(file)}, String(old + 1));
  }, { timeoutMs: ${opts.timeoutMs ?? 15000} });
  process.send({ event: 'finished', ran, elapsed: Date.now() - t0 });
} catch (e) { process.send({ event: 'error', message: String(e.message), ran, elapsed: Date.now() - t0 }); }
`;

async function freshFile(prefix: string): Promise<string> {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), `${prefix}-${randomBytes(3).toString('hex')}-`)));
  const file = path.join(dir, 'state.json');
  await writeFile(file, '0');
  return file;
}

test('REG-03: registry enumeration EACCES — the acquisition fails closed, the live mapping stays untouched, restored permissions admit legal progress', async () => {
  const reg = await realpath(await mkdtemp(path.join(tmpdir(), 'ship-faults-reg-')));
  const file1 = await freshFile('ship-fl-a');
  const file2 = await freshFile('ship-fl-b');
  const claimOf = (f: string) => path.join(reg, `${createHash('sha256').update(f).digest('hex').slice(0, 20)}.json`);
  const a = kid(redirect(reg), body(file1, { hold: true }));
  try {
    const aIn = await a.wait('entered');
    assert.ok(aIn, 'A (published claim) holds the section');
    const claim1 = JSON.parse(await readFile(claimOf(file1), 'utf8')) as { port: number };
    await chmod(reg, 0o333); // keep w+x, drop enumeration (real EACCES on readdir)
    const b = kid(redirect(reg), body(file2, { timeoutMs: 2000 }));
    try {
      const err = await b.wait('error', 4000);
      assert.ok(err, 'the faulted publisher fails (never publishes blind)');
      assert.match(String(err.message), /不可枚举|不可读|保守失败|超时/, 'fail-closed (conservative enumeration error or the deadline race)');
      assert.equal(err.ran, false, 'fn never runs during the fault');
      assert.ok(Number(err.elapsed) < 2600, `bounded failure, took ${err.elapsed}ms`);
    } finally { b.send('exit'); await b.exited.catch(() => undefined); }
    await chmod(reg, 0o755);
    assert.deepEqual(JSON.parse(await readFile(claimOf(file1), 'utf8')), claim1, 'live mapping not rewritten by the faulted attempt');
    await assert.rejects(() => readdir(claimOf(file2)), (e: NodeJS.ErrnoException) => e.code === 'ENOENT', 'nothing was published for the fresh key during the fault');
    // restored permissions: both keys make legal progress on stable mappings
    const c = kid(redirect(reg), body(file2, {}));
    const d = kid(redirect(reg), body(file1, {}));
    try {
      await c.wait('finished');
      assert.equal(Number(await readFile(file2, 'utf8')), 1, 'the fresh key acquires after the fault clears');
      assert.equal((JSON.parse(await readFile(claimOf(file2), 'utf8')) as { port: number }).port > 0, true, 'its claim published');
      a.send('release');
      await a.wait('finished');
      const dIn = await d.wait('entered');
      assert.ok(dIn && dIn.old === 1, 'key1 waits for the holder and sees its increment');
      await d.wait('finished');
      assert.equal((JSON.parse(await readFile(claimOf(file1), 'utf8')) as { port: number }).port, claim1.port, 'same mapping after release');
      assert.equal(Number(await readFile(file1, 'utf8')), 2, 'two increments land as 2');
    } finally { c.send('exit'); d.send('exit'); await Promise.all([c.exited, d.exited]).catch(() => undefined); }
  } finally {
    await chmod(reg, 0o755).catch(() => {});
    a.send('exit');
    await a.exited.catch(() => undefined);
    for (const f of [file1, file2]) await rm(claimOf(f), { force: true }).catch(() => {});
    await rm(path.dirname(file1), { recursive: true, force: true }).catch(() => {});
    await rm(path.dirname(file2), { recursive: true, force: true }).catch(() => {});
    await rm(reg, { recursive: true, force: true }).catch(() => {});
  }
});

test('WAIT-01: expired publication drops its temp on every exit; a rename landing after the caller timeout converges safely', async () => {
  const reg = await realpath(await mkdtemp(path.join(tmpdir(), 'ship-fl-pub-')));
  const claimName = (file: string) => `${createHash('sha256').update(file).digest('hex').slice(0, 20)}.json`;
  const leftovers = async (file: string): Promise<string[]> =>
    (await readdir(reg).catch(() => [])).filter((f) => f.startsWith(`.${claimName(file)}.`) || f.startsWith(`${claimName(file)}.pub`));
  // mode 'write': the real temp write completes, then the child's scheduling
  // gate parks the pipeline until well past timeoutMs — the expiry path must
  // still clean THIS key's temp; mode 'rename': parked before the original
  // rename — the late landing happens before our bakery slot is released, so
  // it is the ONE mapping and later acquirers converge to it
  for (const mode of ['write', 'rename'] as const) {
    const file = await freshFile(`ship-fl-${mode}`);
    const claimPath = path.join(reg, claimName(file));
    const pre = `
const realfs = await import('node:fs/promises');
const REG2 = '/var/tmp/shipkit-lock-ports';
const map = (p) => { const s = String(p); return s.startsWith(REG2) ? ${JSON.stringify(reg)} + s.slice(REG2.length) : s; };
let parkGate; let gated = false;
process.on('message', (m) => { if (m === 'resume') parkGate?.(); });
mock.module('node:fs/promises', { namedExports: { ...realfs,
  writeFile: async (p, ...r) => { const res = await realfs.writeFile(map(p), ...r); ${mode === 'write' ? `if (String(p).endsWith('.tmp') && !gated) { gated = true; process.send({ event: 'parked' }); await new Promise((g) => (parkGate = g)); }` : ''} return res; },
  rename: async (s2, d2, ...r) => { ${mode === 'rename' ? `if (String(d2).endsWith('.json') && String(s2).endsWith('.tmp') && !gated) { gated = true; process.send({ event: 'parked' }); await new Promise((g) => (parkGate = g)); }` : ''} return realfs.rename(map(s2), map(d2), ...r); },
  mkdir: (p, ...r) => realfs.mkdir(map(p), ...r), readdir: (p, ...r) => realfs.readdir(map(p), ...r),
  readFile: (p, ...r) => realfs.readFile(map(p), ...r), rm: (p, ...r) => realfs.rm(map(p), ...r),
  access: (p, ...r) => realfs.access(map(p), ...r) } });
`;
    const c = kid(pre, body(file, { timeoutMs: 100 }));
    try {
      assert.ok(await c.wait('parked'), `(${mode}) pipeline parked mid-publication`);
      const err = await c.wait('error', 3000);
      assert.ok(err && err.ran === false && Number(err.elapsed) < 400, `(${mode}) bounded timeout, fn never runs`);
      await new Promise((r) => setTimeout(r, 120));
      c.send('resume');
      // drain window for the background step (the child holds its IPC channel
      // ref via the message handler, so we reap it in the finally instead)
      await new Promise((r) => setTimeout(r, 300));
      assert.deepEqual(await leftovers(file), [], `(${mode}) no temp/marker residue after the background step settles`);
      if (mode === 'write') {
        await assert.rejects(() => readFile(claimPath), (e: NodeJS.ErrnoException) => e.code === 'ENOENT', '(write) nothing was published after expiry');
      } else {
        const landed = JSON.parse(await readFile(claimPath, 'utf8')) as { port: number };
        assert.ok(Number.isInteger(landed.port), '(rename) the late rename landed as the single mapping');
      }
      // legal progress afterwards converges to whatever the registry holds
      const d = kid(redirect(reg), body(file, { claimPath }));
      try {
        const dIn = await d.wait('entered');
        assert.ok(dIn && dIn.old === 0, `(${mode}) a later acquisition proceeds legally`);
        await d.wait('finished');
        if (mode === 'rename') {
          assert.equal((JSON.parse(await readFile(claimPath, 'utf8')) as { port: number }).port, dIn.port, '(rename) it converged to the landed mapping — no remap');
        }
        assert.equal(Number(await readFile(file, 'utf8')), 1, `(${mode}) exactly one increment (the timed-out side never ran)`);
      } finally { d.send('exit'); await d.exited.catch(() => undefined); }
    } finally {
      c.send('exit');
      await c.exited.catch(() => undefined);
      await rm(claimPath, { force: true }).catch(() => {});
      for (const f of await leftovers(file)) await rm(path.join(reg, f), { recursive: true, force: true }).catch(() => {});
      await rm(path.dirname(file), { recursive: true, force: true }).catch(() => {});
    }
  }
  await rm(reg, { recursive: true, force: true }).catch(() => {});
});

test('REG-03: publication-mutex cleanup failure settles the gate; a later call recovers ITS OWN leaked slot and never deletes a foreign live slot', async () => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'ship-fl-clean-')));
  const claim = path.join(root, 'claim.json');
  try {
    // first call: fn itself removes directory writability → cleanup EACCES
    const first = await withPublishMutex(claim, claim, () => false, async () => {
      await chmod(root, 0o555);
      return 'first';
    });
    assert.equal(first, 'first', 'the protected work resolves even when cleanup fails');
    await chmod(root, 0o755);
    // the leaked slot would block forever; recovery must make the next call fast
    let ran = false;
    const deadline = Date.now() + 400;
    const t0 = Date.now();
    const value = await withPublishMutex(claim, claim, () => Date.now() >= deadline, async () => {
      ran = true;
      return 'recovered';
    });
    assert.equal(value, 'recovered');
    assert.equal(ran, true, 'the later call proceeds (no permanent in-process block)');
    assert.ok(Date.now() - t0 < 350, `recovery is prompt, took ${Date.now() - t0}ms`);
    assert.deepEqual((await readdir(root)).filter((f) => f.startsWith('claim.json.pub')), [], 'the leaked slot was recovered');
    // foreign slot: a queue name NOT created by this process's calls is never
    // deleted by our recovery (simulates another live caller's slot)
    const root2 = await realpath(await mkdtemp(path.join(tmpdir(), 'ship-fl-foreign-')));
    try {
      const foreign = path.join(root2, 'claim.json.pubq-000000000001-1-foreign');
      await mkdir(foreign);
      let failed: unknown = null;
      const foreignDeadline = Date.now() + 150;
      await withPublishMutex(path.join(root2, 'claim.json'), 'k2', () => Date.now() >= foreignDeadline, async () => 'nope').catch((e) => { failed = e; });
      assert.ok(failed instanceof Error, 'a live foreign earlier slot blocks conservatively (bounded)');
      assert.equal((await readdir(root2)).includes(path.basename(foreign)), true, 'the foreign slot was NOT deleted');
    } finally {
      await rm(root2, { recursive: true, force: true }).catch(() => {});
    }
  } finally {
    await chmod(root, 0o755).catch(() => {});
    await rm(root, { recursive: true, force: true }).catch(() => {});
  }
});

test('REG-03: a failed CHOOSING-marker cleanup is recovered by name — same process, same key, no manual removal', async () => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'ship-fl-choosing-')));
  const claim = path.join(root, 'claim.json');
  const PUBMOD = new URL('./lock-pubmutex.js', import.meta.url).href;
  // the fault lands between phase 2 (queue commit) and phase 3 (marker
  // removal): the wrapper performs the REAL queue mkdir, then revokes the
  // directory write permission — the marker removal then really gets EACCES
  const pre = `
const realfs = await import('node:fs/promises');
let faulted = false;
let go2;
process.on('message', (m) => { if (m === 'go2') go2?.(); if (m === 'exit') process.exit(0); });
mock.module('node:fs/promises', { namedExports: { ...realfs,
  mkdir: async (p, ...r) => { const res = await realfs.mkdir(p, ...r);
    if (!faulted && String(p).startsWith(${JSON.stringify(root)}) && String(p).includes('.pubq-')) { faulted = true; await realfs.chmod(${JSON.stringify(root)}, 0o555); }
    return res; } } });
`;
  const body = `
const { withPublishMutex } = await import(${JSON.stringify(PUBMOD)});
let ran1 = false; let firstError = '';
try { await withPublishMutex(${JSON.stringify(claim)}, 'k', () => false, async () => { ran1 = true; }); }
catch (e) { firstError = String(e.message) + '/' + (e.code ?? ''); }
process.send({ event: 'first', ran: ran1, error: firstError });
await new Promise((g) => (go2 = g)); // parent restored permissions and checked the leftovers
let ran2 = false; const t0 = Date.now(); let value; let secondError = '';
try { value = await withPublishMutex(${JSON.stringify(claim)}, 'k', () => Date.now() - t0 >= 400, async () => { ran2 = true; return 'recovered'; }); }
catch (e) { secondError = String(e.message); }
process.send({ event: 'second', ran: ran2, value, elapsed: Date.now() - t0, error: secondError });
`;
  const c = kid(pre, body);
  try {
    const first = await c.wait('first');
    assert.ok(first, 'the faulted first call reports');
    assert.equal(first.ran, false, 'the first callback NEVER runs (fail closed)');
    assert.match(String(first.error), /EACCES|permission/i, `the choosing-marker removal really failed, got ${first.error}`);
    const leftovers = (await readdir(root)).filter((f) => f.startsWith('claim.json.pub'));
    assert.equal(leftovers.length, 2, 'both this call\'s markers are on disk after the fault');
    assert.ok(leftovers.some((f) => f.includes('.pubc-')) && leftovers.some((f) => f.includes('.pubq-')), 'one pubc and one pubq');
    await chmod(root, 0o755); // fault cleared — NO manual marker removal
    c.send('go2');
    const second = await c.wait('second', 4000);
    assert.ok(second, 'the second call reports');
    assert.equal(second.ran, true, 'the same process re-acquires WITHOUT manual cleanup');
    assert.equal(second.value, 'recovered');
    assert.ok(Number(second.elapsed) < 350, `prompt recovery within the 400ms budget, took ${second.elapsed}ms`);
    assert.deepEqual((await readdir(root)).filter((f) => f.startsWith('claim.json.pub')), [], 'pubc and pubq are BOTH cleared');
  } finally {
    await chmod(root, 0o755).catch(() => {});
    c.send('exit');
    await c.exited.catch(() => undefined);
    await rm(root, { recursive: true, force: true }).catch(() => {});
  }
});
