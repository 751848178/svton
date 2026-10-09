import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { ShipConfig } from '../shared/types.js';
import { createLogger } from '../shared/log.js';
import { JOB_OPERATION_CAPABILITY, JOB_EVENTS_CAPABILITY, JOB_LOG_CURSOR_CAPABILITY, JOB_CANCELLATION_CAPABILITY } from '../shared/job-protocol.js';
import { runMultiBuildPipeline } from './pipeline-multi.js';

const required = [JOB_OPERATION_CAPABILITY, JOB_EVENTS_CAPABILITY, JOB_LOG_CURSOR_CAPABILITY, JOB_CANCELLATION_CAPABILITY];
const base = ['build', 'push', 'multi-service-v2'];

async function fixture(capabilities: string[]) {
  const requests: Array<{ method: string; path: string }> = [];
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-managed-builder-'));
  await writeFile(path.join(dir, 'Dockerfile'), 'FROM scratch\n');
  const server = createServer((req, res) => {
    requests.push({ method: req.method!, path: req.url! });
    req.resume();
    req.on('end', () => {
      const json = (code: number, value: unknown) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(value)); };
      if (req.url === '/api/status') return json(200, { role: 'both', version: 'isolated-test', auth: { capabilities } });
      if (req.url === '/api/sources') return json(201, { id: '01234567-89ab-cdef-0123-456789abcdef', bytes: 1 });
      // No actual Docker or registry work: stop after proving preflight admission.
      return json(500, { error: { message: 'intentional build stop' } });
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const config: ShipConfig = { source: { repo: 'https://example.invalid/isolated.git' },
    builder: { mode: 'static', static: { url, token: 'isolated-test-token' } }, registry: { url: 'registry.invalid', namespace: 'test' },
    runtime: { targets: { isolated: { url, token: 'isolated-test-token' } } } };
  const logger = createLogger(false, () => undefined);
  const options = { config, cwd: dir, fromDir: '.', logger, selection: ['service'], timeoutMs: 1000,
    spec: { schemaVersion: 2 as const, name: 'isolated', services: { service: { dockerfile: 'Dockerfile' } } } };
  return { requests, options, cleanup: async () => {
    await new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve()));
    await rm(dir, { recursive: true, force: true });
  } };
}

for (const missing of required) {
  test(`managed builder refuses missing ${missing} before source/build/push POST`, async (t) => {
    const fx = await fixture([...base, ...required.filter((cap) => cap !== missing)]);
    t.after(fx.cleanup);
    await assert.rejects(runMultiBuildPipeline({ ...fx.options, managedCancellation: true }), (e: unknown) => e instanceof Error && e.message.includes(missing));
    assert.equal(fx.requests.filter((request) => request.method === 'POST').length, 0);
  });
}

test('both-role machine with runtime-only effective credential refuses before upload', async (t) => {
  const fx = await fixture(['multi-service-v2', ...required]);
  t.after(fx.cleanup);
  await assert.rejects(runMultiBuildPipeline({ ...fx.options, managedCancellation: true }), /build, push/);
  assert.equal(fx.requests.filter((request) => request.method === 'POST').length, 0);
});

test('fully capable managed builder admits upload only after all preflight GETs', async (t) => {
  const fx = await fixture([...base, ...required]);
  t.after(fx.cleanup);
  await assert.rejects(runMultiBuildPipeline({ ...fx.options, managedCancellation: true }), /intentional build stop/);
  const firstPost = fx.requests.findIndex((request) => request.method === 'POST');
  assert.ok(firstPost >= 2);
  assert.ok(fx.requests.slice(0, firstPost).every((request) => request.method === 'GET'));
  assert.deepEqual(fx.requests.slice(firstPost).map((request) => request.path), ['/api/sources', '/api/build']);
});

test('ordinary CLI preserves compatibility when managed cancellation is not requested', async (t) => {
  const fx = await fixture(base);
  t.after(fx.cleanup);
  await assert.rejects(runMultiBuildPipeline(fx.options), /intentional build stop/);
  assert.ok(fx.requests.some((request) => request.path === '/api/sources' && request.method === 'POST'));
});
