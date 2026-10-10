import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { withAgentRegistration } from './lifecycle.js';
import { identityFixture, initialStatus } from './identity-fixture.js';
import { withRegistrationIdentity } from './identity-store.js';
import { startAgent } from '../server.js';

const status = async () => initialStatus;
const pausedClient: NonNullable<Parameters<typeof withAgentRegistration>[0]['client']> = async options => {
  if (!options.signal.aborted) await new Promise<void>(resolve => options.signal.addEventListener('abort', () => resolve(), { once: true }));
};
test('disabled registration starts direct HTTP without identity or status work', async t => {
  const f = await identityFixture(); t.after(f.cleanup);
  let probes = 0;
  const handle = { port: 1, close: async () => undefined };
  assert.equal(await withAgentRegistration({ workRoot: f.root, config: { mode: 'disabled' },
    status: async () => { probes++; return initialStatus; }, start: async () => handle }), handle);
  assert.equal(probes, 0);
  await assert.rejects(readFile(path.join(f.root, 'registration-anchor.json')), { code: 'ENOENT' });
});
test('HTTP start failure releases ownership and preserves the exact pending enrollment', async t => {
  const f = await identityFixture(); t.after(f.cleanup);
  await assert.rejects(withAgentRegistration({ workRoot: f.root, config: f.config, status,
    start: async () => { throw new Error('HTTP_START_FAILED'); }, client: pausedClient }), /HTTP_START_FAILED/);
  const file = path.join(f.root, 'registration', 'identity.json'), before = await readFile(file, 'utf8');
  await withRegistrationIdentity(f.root, f.config, {}, async store => {
    assert.equal(store.current().state, 'pending');
    assert.equal(await readFile(file, 'utf8'), before);
  });
});
test('shutdown closes admission immediately and keeps ownership until HTTP and client drain', async t => {
  const f = await identityFixture(); t.after(f.cleanup);
  let release!: () => void, stopSignal = false, closes = 0;
  const drained = new Promise<void>(resolve => { release = resolve; });
  const handle = await withAgentRegistration({ workRoot: f.root, config: f.config, status,
    start: async () => ({ close: async () => { closes++; assert.equal(stopSignal, true); await drained; } }),
    client: async options => {
      if (options.signal.aborted) stopSignal = true;
      else options.signal.addEventListener('abort', () => { stopSignal = true; }, { once: true });
      await pausedClient(options);
    } });
  const closing = handle.close();
  try {
    await assert.rejects(withRegistrationIdentity(f.root, f.config, { lockTimeoutMs: 100 }, async () => undefined));
    assert.equal(closes, 1);
  } finally { release(); await closing; }
  await handle.close(); assert.equal(closes, 1);
  await withRegistrationIdentity(f.root, f.config, {}, async store => { assert.equal(store.current().state, 'pending'); });
});
test('a delayed client stop cannot admit late HTTP work or release identity ownership', async t => {
  const f = await identityFixture(); t.after(f.cleanup);
  let releaseClient!: () => void, admissions = 0;
  const clientStopped = new Promise<void>(resolve => { releaseClient = resolve; });
  const http = createServer((_req, res) => { admissions++; res.end('accepted'); });
  const handle = await withAgentRegistration({ workRoot: f.root, config: f.config, status,
    client: async () => clientStopped,
    start: async () => {
      await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve));
      return { close: () => new Promise<void>(resolve => http.close(() => resolve())) };
    } });
  const url = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
  await (await fetch(url)).text(); assert.equal(admissions, 1);
  const closing = handle.close();
  try {
    await assert.rejects(fetch(url)); assert.equal(admissions, 1);
    await assert.rejects(withRegistrationIdentity(f.root, f.config, { lockTimeoutMs: 100 }, async () => undefined));
  } finally { releaseClient(); await closing; }
  await withRegistrationIdentity(f.root, f.config, {}, async () => undefined);
});
test('a close rejection still drains client before ownership is released', async t => {
  const f = await identityFixture(); t.after(f.cleanup);
  let releaseClient!: () => void;
  const clientStopped = new Promise<void>(resolve => { releaseClient = resolve; });
  const handle = await withAgentRegistration({ workRoot: f.root, config: f.config, status,
    client: async () => clientStopped, start: async () => ({ close: async () => { throw new Error('HTTP_CLOSE_FAILED'); } }) });
  const closing = handle.close(); const rejected = assert.rejects(closing, /HTTP_CLOSE_FAILED/);
  try { await assert.rejects(withRegistrationIdentity(f.root, f.config, { lockTimeoutMs: 100 }, async () => undefined)); }
  finally { releaseClient(); await rejected; }
  await withRegistrationIdentity(f.root, f.config, {}, async () => undefined);
});
test('invalid durable identity fails before Job recovery writes an interrupted ledger', async t => {
  const f = await identityFixture(); t.after(f.cleanup);
  await withRegistrationIdentity(f.root, f.config, { initialStatus }, async () => undefined);
  const id = randomUUID(), directory = path.join(f.root, 'jobs', id), file = path.join(directory, 'job.json');
  await mkdir(directory, { recursive: true });
  const bytes = JSON.stringify({ id, type: 'build', status: 'running', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  await writeFile(file, bytes);
  await unlink(path.join(f.root, 'registration', 'identity.json'));
  await assert.rejects(startAgent({ token: 'test-direct-token', role: 'runtime', host: '127.0.0.1', port: 0,
    workRoot: f.root, registration: f.config }));
  assert.equal(await readFile(file, 'utf8'), bytes);
});
test('offline registration preserves direct diagnostics and closes its background retries', async t => {
  const f = await identityFixture(); t.after(f.cleanup);
  const agent = await startAgent({ token: 'test-direct-token', role: 'runtime', host: '127.0.0.1', port: 0,
    workRoot: f.root, registration: { ...f.config, serverOrigin: 'https://127.0.0.1:9' } });
  try {
    assert.equal((await fetch(`${agent.url}/health`)).status, 200);
    assert.equal((await fetch(`${agent.url}/api/status`)).status, 401);
    assert.equal((await fetch(`${agent.url}/api/status`, { headers: { authorization: 'Bearer test-direct-token' } })).status, 200);
  } finally { await agent.close(); }
  await withRegistrationIdentity(f.root, { ...f.config, serverOrigin: 'https://127.0.0.1:9' }, {}, async store => {
    assert.equal(store.current().state, 'pending');
  });
});
