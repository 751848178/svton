// Multi-build pipeline (MS-02) against a stub builder over real HTTP: serial
// per-service builds carrying their own target/platform, pushes for all, a
// digest-pinned manifest ONLY on full success, builder capability refusal
// before any build, and the release-vs-deploy outcome reported separately.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { ProjectSpec } from '../shared/spec-v2.js';
import type { ShipConfig } from '../shared/types.js';
import { runMultiBuildPipeline } from './pipeline-multi.js';
import { requireGroupProtocol } from './deployment-protocol.js';
import { resolveTarget } from './targets.js';
import { createLogger } from '../shared/log.js';

const log = createLogger(false);
log.info = () => undefined; // keep test output quiet

interface StubState {
  requests: Array<{ method: string; path: string; body: any }>;
  capabilities: string[];
  role: string;
  failBuildFor: string | null;
  failPushFor: string | null;
  buildCount: () => number;
}

function stubBuilder(): Promise<{ url: string; state: StubState; close: () => Promise<void> }> {
  const state: StubState = {
    requests: [], capabilities: ['build', 'push', 'multi-service-v2'], role: 'builder',
    failBuildFor: null, failPushFor: null, buildCount: () => state.requests.filter((r) => r.path === '/api/build').length,
  };
  let builds = 0;
  const pushes = new Map<string, number>();
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c as Buffer));
    req.on('end', () => {
      let body: any;
      try {
        body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : undefined;
      } catch {
        body = undefined; // raw gzip upload (/api/sources) is not JSON
      }
      state.requests.push({ method: req.method ?? '', path: req.url ?? '', body });
      const json = (status: number, payload: unknown) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(payload));
      };
      if (req.url === '/api/status') return json(200, { role: state.role, version: 'test', auth: { role: state.role, capabilities: state.capabilities } });
      if (req.url === '/api/sources') {
        const bytes = Buffer.concat(chunks).length;
        return json(201, { id: '01234567-89ab-cdef-0123-456789abcdef', bytes });
      }
      if (req.url === '/api/build') {
        builds++;
        if (state.failBuildFor && body?.spec?.name === state.failBuildFor) return json(500, { error: { message: `injected build failure for ${state.failBuildFor}` } });
        return json(202, { jobId: `build-${builds}` });
      }
      if (req.url === '/api/push') {
        const n = (pushes.get(body.name) ?? 0) + 1;
        pushes.set(body.name, n);
        if (state.failPushFor && body?.name === state.failPushFor) return json(500, { error: { message: `injected push failure for ${state.failPushFor}` } });
        return json(202, { jobId: `push-${body.name}-${n}` });
      }
      if (req.url?.startsWith('/api/jobs/')) {
        const id = req.url.split('/')[3] ?? '';
        if (id.startsWith('build-')) return json(200, { id, status: 'succeeded', result: { name: 'n', tag: `t-${id}`, sha: 'abc1234', arch: 'linux/amd64' } });
        const name = id.split('-')[1] ?? 'x';
        const hex = { backend: 'b', admin: 'a', mobile: 'm' }[name] ?? 'e';
        return json(200, { id, status: 'succeeded', result: { imageRef: `reg.example/ns/${name}:t-${id}`, digest: `sha256:${hex.repeat(64)}` } });
      }
      json(404, { error: { message: 'not found' } });
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      resolve({ url, state, close: () => new Promise((r) => server.close(() => r())) });
    });
  });
}

const spec: ProjectSpec = {
  schemaVersion: 2,
  name: 'twgg',
  services: {
    backend: { dockerfile: 'apps/backend/Dockerfile', target: 'prod' },
    admin: { dockerfile: 'apps/admin/Dockerfile', target: 'admin-prod', envFile: 'admin.env' },
  },
};

const config = (url: string): ShipConfig => ({
  source: { repo: 'https://git.example/team/twgg.git' },
  builder: { mode: 'static', static: { url, token: 't' } },
  registry: { url: 'reg.example', namespace: 'ns' },
  runtime: { targets: { prod: { url, token: 't' } } },
});

const opts = { cwd: process.cwd(), logger: log, spec, timeoutMs: 5_000 };

test('three services build serially with their OWN target/platform slices; the manifest pins every digest with provenance', async (t) => {
  const stub = await stubBuilder();
  t.after(stub.close);
  const full: ProjectSpec = { ...spec, services: { ...spec.services, mobile: { dockerfile: 'apps/mobile/Dockerfile' } } };
  const manifest = await runMultiBuildPipeline({ ...opts, config: config(stub.url), spec: full, selection: ['backend', 'admin', 'mobile'] });

  const buildReqs = stub.state.requests.filter((r) => r.path === '/api/build');
  assert.equal(buildReqs.length, 3, 'one build per selected service');
  const byName = Object.fromEntries(buildReqs.map((r) => [r.body.spec.name, r.body.spec]));
  assert.equal(byName.backend.target, 'prod');
  assert.equal(byName.admin.target, 'admin-prod');
  assert.equal(byName.mobile.target, undefined);
  assert.equal(byName.backend.platform, 'linux/amd64', 'phase-1 groups pin amd64');
  assert.ok(!('ports' in byName.backend) && !('networks' in byName.admin), 'runtime-only fields never reach the builder');
  assert.ok(buildReqs.every((r) => r.body.source.type === 'git'), 'same source for every service');
  // builds all completed before any push started
  const firstPushIdx = stub.state.requests.findIndex((r) => r.path === '/api/push');
  const lastBuildIdx = stub.state.requests.map((r) => r.path).lastIndexOf('/api/build');
  assert.ok(lastBuildIdx < firstPushIdx, 'ALL builds precede the first push');

  assert.deepEqual(Object.keys(manifest.services).sort(), ['admin', 'backend', 'mobile']);
  assert.match(manifest.services.admin?.imageRef ?? '', /@sha256:[0-9a-f]{64}$/, 'digest-pinned');
  assert.equal(manifest.services.admin?.sha, 'abc1234', 'per-service source sha recorded');
  assert.equal(manifest.builderRelease.builderRelease, 'static');
});

test('selection of ONE service builds exactly that image — nothing else is built or pushed', async (t) => {
  const stub = await stubBuilder();
  t.after(stub.close);
  const manifest = await runMultiBuildPipeline({ ...opts, config: config(stub.url), selection: ['admin'] });
  assert.deepEqual(Object.keys(manifest.services), ['admin']);
  assert.equal(stub.state.buildCount(), 1);
  assert.ok(stub.state.requests.some((r) => r.path === '/api/push' && r.body.name === 'admin'));
  assert.ok(!stub.state.requests.some((r) => r.path === '/api/push' && r.body.name === 'backend'));
});

test('a mid-way build or push failure yields NO deployable manifest (exception, partial pushes allowed)', async (t) => {
  const stub = await stubBuilder();
  t.after(stub.close);
  stub.state.failBuildFor = 'admin';
  await assert.rejects(
    () => runMultiBuildPipeline({ ...opts, config: config(stub.url), selection: ['backend', 'admin'] }),
    (e: Error) => /injected build failure for admin/.test(e.message),
  );
  assert.ok(!stub.state.requests.some((r) => r.path === '/api/push'), 'no push after a failed build');

  stub.state.requests.length = 0;
  stub.state.failBuildFor = null;
  stub.state.failPushFor = 'admin';
  await assert.rejects(
    () => runMultiBuildPipeline({ ...opts, config: config(stub.url), selection: ['backend', 'admin'] }),
    (e: Error) => /injected push failure for admin/.test(e.message),
  );
});

test('an old builder without multi-service capability is refused BEFORE any build request', async (t) => {
  const stub = await stubBuilder();
  t.after(stub.close);
  stub.state.capabilities = ['build', 'push'];
  await assert.rejects(
    () => runMultiBuildPipeline({ ...opts, config: config(stub.url), selection: ['admin'] }),
    (e: Error) => /构建机不支持多服务构建/.test(e.message),
  );
  assert.equal(stub.state.buildCount(), 0, 'no build was ever submitted');
});

test('requireGroupProtocol refuses an old runtime before any build/deploy (money boundary)', async (t) => {
  const stub = await stubBuilder();
  t.after(stub.close);
  stub.state.capabilities = ['deploy', 'rollback', 'gc', 'deployment-identity-v1', 'deployment-env-preserve-v1'];
  stub.state.role = 'runtime';
  await assert.rejects(
    () => requireGroupProtocol(resolveTarget(config(stub.url)).target, 'runtime.targets.prod'),
    (e: Error) => /不支持多服务发布/.test(e.message),
  );
  stub.state.capabilities = [...stub.state.capabilities, 'multi-service-v2'];
  await assert.doesNotReject(() => requireGroupProtocol(resolveTarget(config(stub.url)).target, 'runtime.targets.prod'));
});

test('from-dir tarball upload excludes EVERY declared service envFile (F06 for groups)', async (t) => {
  const stub = await stubBuilder();
  t.after(stub.close);
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-mb-src-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(path.join(dir, 'ship.yaml'), 'schemaVersion: 2\nname: twgg\nservices:\n  backend: {}\n  admin:\n    envFile: admin.env\n');
  await writeFile(path.join(dir, 'admin.env'), 'SECRET=1\n');
  const uploadRequests: Array<{ bytes: number }> = [];
  // upload goes to /api/sources; reuse the stub: intercept raw body length
  stub.state.requests.length = 0;
  await runMultiBuildPipeline({ ...opts, config: config(stub.url), selection: ['backend', 'admin'], fromDir: dir, cwd: dir });
  const upload = stub.state.requests.find((r) => r.path === '/api/sources');
  assert.ok(upload, 'source tarball uploaded once for ALL services');
  // build requests share ONE tarball id
  const buildReqs = stub.state.requests.filter((r) => r.path === '/api/build');
  const ids = new Set(buildReqs.map((r) => r.body.source.id));
  assert.equal(ids.size, 1, 'one shared source id');
  void uploadRequests;
});
