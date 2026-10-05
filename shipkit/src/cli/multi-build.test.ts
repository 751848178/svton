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
  /** when set, push jobs SUCCEED but report this digest instead of a real one (R07) */
  pushDigestOverride?: string | null;
  /** arch reported by build jobs (R11) */
  buildArch: string;
  buildCount: () => number;
}

function stubBuilder(): Promise<{ url: string; state: StubState; close: () => Promise<void> }> {
  const state: StubState = {
    requests: [], capabilities: ['build', 'push', 'multi-service-v2'], role: 'builder',
    failBuildFor: null, failPushFor: null, buildArch: 'linux/amd64',
    buildCount: () => state.requests.filter((r) => r.path === '/api/build').length,
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
        if (id.startsWith('build-')) return json(200, { id, status: 'succeeded', result: { name: 'n', tag: `t-${id}`, sha: 'abc1234', arch: state.buildArch } });
        const name = id.split('-')[1] ?? 'x';
        const hex = { backend: 'b', admin: 'a', mobile: 'c' }[name] ?? 'f';
        if (state.pushDigestOverride !== undefined) {
          const d = state.pushDigestOverride === 'none' ? undefined : state.pushDigestOverride;
          return json(200, { id, status: 'succeeded', result: { imageRef: `reg.example/ns/${name}:t-${id}`, digest: d } });
        }
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

test('R07: a successful push WITHOUT a valid digest is refused — no deployable manifest on a mutable tag', async (t) => {
  const stub = await stubBuilder();
  t.after(stub.close);
  stub.state.pushDigestOverride = 'none';
  await assert.rejects(
    () => runMultiBuildPipeline({ ...opts, config: config(stub.url), selection: ['admin'] }),
    (e: Error) => /push:admin returned no valid digest.*refusing a deployable manifest/.test(e.message),
  );
  stub.state.pushDigestOverride = 'sha256:zz-not-hex';
  await assert.rejects(
    () => runMultiBuildPipeline({ ...opts, config: config(stub.url), selection: ['admin'] }),
    /push:admin returned no valid digest/,
  );
  stub.state.pushDigestOverride = undefined;
});

test('R11: manifest records the EFFECTIVE per-service platform and refuses a contradicting actual arch', async (t) => {
  const stub = await stubBuilder();
  t.after(stub.close);
  const armSpec: ProjectSpec = { ...spec, services: { ...spec.services, mobile: { platform: 'linux/arm64' } } };
  // builder actually produces amd64 while the service pins arm64 → refuse
  stub.state.buildArch = 'linux/amd64';
  await assert.rejects(
    () => runMultiBuildPipeline({ ...opts, config: config(stub.url), spec: armSpec, selection: ['mobile'] }),
    (e: Error) => /build:mobile produced linux\/amd64 but the effective platform is linux\/arm64/.test(e.message),
  );
  // honest build → recorded platform is the OVERRIDE, not the group default
  stub.state.buildArch = 'linux/arm64';
  const manifest = await runMultiBuildPipeline({ ...opts, config: config(stub.url), spec: armSpec, selection: ['mobile'] });
  assert.equal(manifest.services.mobile?.platform, 'linux/arm64');
  assert.equal(manifest.services.mobile?.arch, 'linux/arm64');
  assert.equal(manifest.services.mobile?.archVerified, true);
  // an UNKNOWN arch is recorded unverified — never claimed as checked
  stub.state.buildArch = '';
  const m2 = await runMultiBuildPipeline({ ...opts, config: config(stub.url), spec: armSpec, selection: ['mobile'] });
  assert.equal(m2.services.mobile?.archVerified, false);
  assert.equal(m2.services.mobile?.arch, undefined);
});

test('R10: from-dir manifest carries a deterministic contentDigest, never a fabricated git sha', async (t) => {
  const stub = await stubBuilder();
  t.after(stub.close);
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-mb-prov-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(path.join(dir, 'ship.yaml'), 'schemaVersion: 2\nname: twgg\nservices:\n  backend: {}\n');
  await writeFile(path.join(dir, 'app.js'), 'console.log(1)\n');
  const m1 = await runMultiBuildPipeline({ ...opts, config: config(stub.url), selection: ['backend'], fromDir: dir, cwd: dir });
  const src = m1.services.backend?.source;
  assert.equal(src?.type, 'tarball');
  assert.match(src?.contentDigest ?? '', /^sha256:[0-9a-f]{64}$/, 'verifiable content digest recorded');
  assert.equal(src?.sha, undefined, 'no fabricated git sha');
  // deterministic: same tree → same digest; changed content → different digest
  const m2 = await runMultiBuildPipeline({ ...opts, config: config(stub.url), selection: ['backend'], fromDir: dir, cwd: dir });
  assert.equal(m2.services.backend?.source.contentDigest, src?.contentDigest, 'same tree, same digest');
  await writeFile(path.join(dir, 'app.js'), 'console.log(2)\n');
  const m3 = await runMultiBuildPipeline({ ...opts, config: config(stub.url), selection: ['backend'], fromDir: dir, cwd: dir });
  assert.notEqual(m3.services.backend?.source.contentDigest, src?.contentDigest, 'content change changes the digest');
});

test('from-dir tarball upload excludes EVERY declared service envFile (F06 for groups)', async (t) => {
  const stub = await stubBuilder();
  t.after(stub.close);
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-mb-src-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(path.join(dir, 'ship.yaml'), 'schemaVersion: 2\nname: twgg\nservices:\n  backend: {}\n  admin:\n    envFile: admin.env\n');
  await writeFile(path.join(dir, 'admin.env'), 'SECRET=1\n');
  // pack the SAME tree the pipeline would upload and inspect the archive: the
  // declared envFiles must not be inside (F06), and the build requests share
  // ONE uploaded source id
  const { spawnSync } = await import('node:child_process');
  const { freezeSourceDir } = await import('./source-freeze.js');
  const frozen = await freezeSourceDir(dir, ['admin.env']);
  const list = spawnSync('tar', ['-tzf', frozen.tarball], { encoding: 'utf8' });
  await frozen.cleanup();
  assert.equal(list.status, 0, list.stderr);
  const names = list.stdout.split('\n').filter(Boolean).map((l) => l.replace(/^\.\//, ''));
  assert.ok(!names.some((n) => n.includes('admin.env')), `admin.env must never enter the uploaded archive: ${names.join(',')}`);
  assert.ok(!names.some((n) => n === 'ship.yaml' ? false : n.endsWith('.pem')), 'secret patterns excluded');

  stub.state.requests.length = 0;
  await runMultiBuildPipeline({ ...opts, config: config(stub.url), selection: ['backend', 'admin'], fromDir: dir, cwd: dir });
  const upload = stub.state.requests.find((r) => r.path === '/api/sources');
  assert.ok(upload, 'source tarball uploaded once for ALL services');
  const buildReqs = stub.state.requests.filter((r) => r.path === '/api/build');
  const ids = new Set(buildReqs.map((r) => r.body.source.id));
  assert.equal(ids.size, 1, 'one shared source id');
});
