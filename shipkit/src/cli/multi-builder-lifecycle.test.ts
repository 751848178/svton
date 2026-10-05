// MS-05 (locally verifiable part): the multi-service build pipeline under a
// DYNAMIC builder provider — the full task budget covers every selected
// service, the machine is released on success AND failure, and a FAILED
// release is reported separately (build succeeded; cleanup pending) instead
// of failing the release or being swallowed.

import test from 'node:test';
import { mock } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { ProjectSpec } from '../shared/spec-v2.js';
import type { ShipConfig } from '../shared/types.js';
import { createLogger } from '../shared/log.js';

const log = createLogger(false);
log.info = () => undefined;

const FX = { ensureBudgets: [] as Array<number | undefined>, released: 0, releaseError: null as null | Error, ensured: 0, builderUrl: '', capFail: false };
const realRegistry = await import('../providers/registry.js');
mock.module('../providers/registry.js', {
  namedExports: {
    ...realRegistry,
    createBuilderProvider: async () => ({
      kind: 'dynamic-mock',
      ensure: async (_l: unknown, budgetMs?: number) => {
        FX.ensured++;
        FX.ensureBudgets.push(budgetMs);
        return { url: FX.builderUrl, token: 't' };
      },
      release: async () => {
        FX.released++;
        if (FX.releaseError) throw FX.releaseError;
      },
      status: async () => ({ kind: 'dynamic-mock', active: true }),
    }),
  },
});

// minimal builder stub shared by all cases
let builds = 0;
const stubServer = createServer((req, res) => {
  const chunks: Buffer[] = [];
  req.on('data', (c) => chunks.push(c as Buffer));
  req.on('end', () => {
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : undefined;
    const json = (status: number, payload: unknown) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(payload)); };
    if (req.url === '/api/status') return json(200, { role: 'builder', auth: { role: 'builder', capabilities: FX.capFail ? ['build', 'push'] : ['build', 'push', 'multi-service-v2'] } });
    if (req.url === '/api/build') { builds++; return json(202, { jobId: `b${builds}` }); }
    if (req.url === '/api/push') return json(202, { jobId: `p-${body.name}` });
    if (req.url?.startsWith('/api/jobs/')) {
      const id = req.url.split('/')[3] ?? '';
      if (id.startsWith('b')) return json(200, { id, status: 'succeeded', result: { name: 'n', tag: `t${id}`, arch: 'linux/amd64' } });
      const name = id.slice(2) || 'x';
      return json(200, { id, status: 'succeeded', result: { imageRef: `reg.example/ns/${name}:t`, digest: `sha256:${name[0]?.repeat(64)}` } });
    }
    json(404, {});
  });
});
const started = new Promise<void>((resolve) => stubServer.listen(0, '127.0.0.1', resolve));
await started;
const stubUrl = `http://127.0.0.1:${(stubServer.address() as AddressInfo).port}`;
FX.builderUrl = stubUrl;

const { runMultiBuildPipeline } = await import('./pipeline-multi.js');

const spec: ProjectSpec = {
  schemaVersion: 2, name: 'twgg',
  services: { backend: { target: 'prod' }, admin: {}, mobile: {} },
};
const config = (url: string): ShipConfig => ({
  source: { repo: 'https://git.example/t.git' },
  builder: { mode: 'dynamic', dynamic: { provider: 'tencent', keepMinutes: 0 } },
  registry: { url: 'reg.example', namespace: 'ns' },
  runtime: { targets: { prod: { url, token: 't' } } },
});
const opts = { cwd: process.cwd(), logger: log, spec, timeoutMs: 5_000 };

test.after(() => new Promise<void>((r) => stubServer.close(() => r())));

test('dynamic builder: budget covers every selected service; released after success', async () => {
  FX.ensured = 0; FX.released = 0; FX.releaseError = null; FX.ensureBudgets = [];
  const manifest = await runMultiBuildPipeline({ ...opts, config: config(stubUrl), selection: ['backend', 'admin', 'mobile'] });
  assert.equal(FX.ensured, 1, 'one machine for the whole multi-service build');
  assert.equal(FX.ensureBudgets[0], 5_000 * 3 * 2 + 15 * 60_000, 'RA03 budget covers build+push per selected service');
  assert.deepEqual(manifest.builderRelease, { builderRelease: 'released' });
  assert.equal(FX.released, 1);
});

test('release failure is reported separately — the build result still stands, cleanup is pending', async () => {
  FX.ensured = 0; FX.released = 0; FX.releaseError = new Error('cloud api down');
  const manifest = await runMultiBuildPipeline({ ...opts, config: config(stubUrl), selection: ['admin'] });
  assert.deepEqual(Object.keys(manifest.services), ['admin'], 'the manifest itself is complete');
  assert.equal(manifest.builderRelease.builderRelease, 'failed');
  assert.match((manifest.builderRelease as { error: string }).error, /cloud api down/);
});

test('a failed build still releases the machine, and the error propagates (no false success)', async () => {
  FX.ensured = 0; FX.released = 0; FX.releaseError = null; FX.capFail = true;
  try {
    await assert.rejects(
      () => runMultiBuildPipeline({ ...opts, config: config(stubUrl), selection: ['admin'] }),
      /构建机不支持多服务构建/,
    );
    assert.equal(FX.released, 1, 'the machine was released on the failure path');
  } finally {
    FX.capFail = false;
  }
});

test('keepMinutes reuse window keeps the machine and says so', async () => {
  FX.ensured = 0; FX.released = 0; FX.releaseError = null;
  const cfg = config(stubUrl);
  cfg.builder = { mode: 'dynamic', dynamic: { provider: 'tencent', keepMinutes: 10 } };
  const manifest = await runMultiBuildPipeline({ ...opts, config: cfg, selection: ['admin'] });
  assert.deepEqual(manifest.builderRelease, { builderRelease: 'kept' });
  assert.equal(FX.released, 0);
});
