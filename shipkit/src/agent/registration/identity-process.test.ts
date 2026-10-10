import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { once } from 'node:events';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { withRegistrationIdentity } from './identity-store.js';
import { identityFixture, initialStatus, enrollmentReceipt } from './identity-fixture.js';
import { RegistrationIdentityError } from './identity-error.js';
import { readPrivateRegistrationJson } from './identity-read.js';
import { writeRegistrationIdentityJson } from './identity-write.js';

const storeUrl = new URL('./identity-store.js', import.meta.url).href;
const writerUrl = new URL('./identity-write.js', import.meta.url).href;
function waitFor(child: ChildProcessWithoutNullStreams, marker: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let text = '';
    const timer = setTimeout(() => finish(new Error('owned-child-timeout')), 20000);
    const finish = (error?: Error) => { clearTimeout(timer); child.stdout.off('data', data); child.off('exit', ended); error ? reject(error) : resolve(); };
    const data = (chunk: Buffer) => { text += chunk.toString(); if (text.includes(marker)) finish(); };
    const ended = () => finish(new Error('owned-child-ended'));
    child.stdout.on('data', data); child.once('exit', ended);
  });
}
async function killOwned(child: ChildProcessWithoutNullStreams | undefined) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const finished = once(child, 'exit'); child.kill('SIGKILL'); await finished;
}
test('a second process cannot use identity while owner lives; process death releases lock with original attempt intact', async () => {
  const fixture = await identityFixture(); let child: ChildProcessWithoutNullStreams | undefined;
  try {
    const runner = path.join(fixture.directory, 'owner.mjs');
    await writeFile(runner, `import {withRegistrationIdentity} from ${JSON.stringify(storeUrl)};
try { await withRegistrationIdentity(process.argv[2], JSON.parse(process.argv[3]), {initialStatus:JSON.parse(process.argv[4])}, async store=>{
console.log('OWNED'); await new Promise(resolve=>process.stdin.once('data',resolve));
}); } catch(error) { console.error(error?.code ?? 'owned-child-failure'); process.exitCode=2; }\n`, { mode: 0o600 });
    child = spawn(process.execPath, [runner, fixture.root, JSON.stringify(fixture.config), JSON.stringify(initialStatus)], { stdio: 'pipe' });
    await waitFor(child, 'OWNED');
    const pending = await readPrivateRegistrationJson(path.join(fixture.root, 'registration', 'identity.json'));
    let entered = false;
    await assert.rejects(() => withRegistrationIdentity(fixture.root, fixture.config, { initialStatus, lockTimeoutMs: 150 }, async () => { entered = true; }),
      (error: unknown) => error instanceof RegistrationIdentityError && error.code === 'REGISTRATION_ALREADY_RUNNING');
    assert.equal(entered, false);
    await killOwned(child);
    await withRegistrationIdentity(fixture.root, fixture.config, {}, async store => assert.deepEqual(store.current(), pending));
  } finally { await killOwned(child); await fixture.cleanup(); }
});
test('callback failure releases ownership and invalidates escaped store', async () => {
  const fixture = await identityFixture();
  try {
    let current: (() => unknown) | undefined;
    await assert.rejects(() => withRegistrationIdentity(fixture.root, fixture.config, { initialStatus }, async store => {
      current = () => store.current(); throw new Error('owned-callback-fault');
    }), /owned-callback-fault/);
    assert.throws(() => current!(), RegistrationIdentityError);
    await withRegistrationIdentity(fixture.root, fixture.config, {}, async store => assert.equal(store.current().state, 'pending'));
  } finally { await fixture.cleanup(); }
});
test('lifecycle exit waits for an accepted identity write before releasing ownership', async () => {
  const fixture = await identityFixture();
  try {
    let settled = false;
    await withRegistrationIdentity(fixture.root, fixture.config, { initialStatus }, async store => {
      const pending = store.current(); if (pending.state !== 'pending') throw new Error('expected pending');
      void store.complete(enrollmentReceipt(pending)).then(() => { settled = true; });
    });
    assert.equal(settled, true);
    await withRegistrationIdentity(fixture.root, fixture.config, {}, async store => assert.equal(store.current().state, 'registered'));
  } finally { await fixture.cleanup(); }
});
test('real process termination before/after rename preserves old/new whole file and cleanup stays inside owned fixture', async () => {
  for (const stage of ['file-synced', 'renamed']) {
    const fixture = await identityFixture(); let child: ChildProcessWithoutNullStreams | undefined;
    try {
      const target = path.join(fixture.directory, 'crash.json'), runner = path.join(fixture.directory, 'crash.mjs');
      await writeRegistrationIdentityJson(target, { old: true });
      await writeFile(runner, `import {writeRegistrationIdentityJson} from ${JSON.stringify(writerUrl)};
await writeRegistrationIdentityJson(process.argv[2],{next:true},{stage:value=>{if(value===process.argv[3])process.kill(process.pid,'SIGKILL')}});\n`, { mode: 0o600 });
      child = spawn(process.execPath, [runner, target, stage], { stdio: 'pipe' });
      const [code, signal] = await once(child, 'exit'); assert.equal(code, null); assert.equal(signal, 'SIGKILL');
      assert.deepEqual(await readPrivateRegistrationJson(target), stage === 'renamed' ? { next: true } : { old: true });
      const temps = (await readdir(fixture.directory)).filter(name => name.endsWith('.tmp'));
      assert.equal(temps.length, stage === 'file-synced' ? 1 : 0);
      if (temps.length) assert.equal(await readFile(path.join(fixture.directory, temps[0]!), 'utf8'), '{"next":true}\n');
    } finally { await killOwned(child); await fixture.cleanup(); }
  }
});
