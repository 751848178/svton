// Real CLI/spec/pipeline seams with only external transport, leases and storage
// replaced. Invalid local input must fail before a paid builder exists.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import type { ShipConfig } from '../shared/types.js';

const config: ShipConfig = {
  source: { repo: 'https://source.example/team/audit.git', ref: 'a'.repeat(40) },
  builder: { mode: 'static', static: { url: 'http://builder.invalid', token: 'mock' } },
  registry: { url: 'registry.invalid', namespace: 'ns' },
  runtime: { targets: { prod: { url: 'http://runtime.invalid', token: 'mock' } } },
};
const logEntries: Array<{ event: string; meta?: unknown }> = [];
const log = { info(event: string, meta?: unknown) { logEntries.push({ event, meta }); }, warn() {}, error() {} };
type Request = { route: string; body: any };
let leases = 0;
let pinned: 'none' | 'same' | 'different' = 'none';
let state: any;
let beforeBuild: (() => Promise<void>) | undefined;
const requests: Request[] = [];
const payloads: any[] = [];
const jobs = new Map<string, any>();
const digest = 'sha256:' + 'a'.repeat(64);
mock.module('../shared/config.js', { namedExports: { loadConfig: () => config, ConfigError: class extends Error {} } });
mock.module('../shared/git.js', { namedExports: { gitRemote: async () => null, gitHeadSha: async () => 'a'.repeat(40) } });
mock.module('./output.js', { namedExports: { createEmitter: () => ({ json: true, log, payload: (p: unknown) => payloads.push(p) }) } });
mock.module('./local-state.js', { namedExports: { readLastBuild: async () => null, saveLastBuild: async () => {} } });
mock.module('./builder-lease.js', { namedExports: { withBuilderLease: async (o: any) => {
  leases++;
  return { value: await o.run({ url: 'http://builder.invalid', token: 'mock' }), release: { builderRelease: 'static' } };
} } });
mock.module('../shared/http.js', { namedExports: {
  api: async (url: string, _token: string, _method: string, route: string, body: any) => {
    requests.push({ route, body });
    if (route === '/api/status') return { role: url.includes('builder') ? 'builder' : 'runtime', auth: { capabilities: ['deployment-identity-v1', 'multi-service-v2'] } };
    if (route.startsWith('/api/group-state')) return state;
    const jobId = String(requests.length);
    if (route === '/api/build') {
      await beforeBuild?.();
      jobs.set(jobId, { status: 'succeeded', result: { tag: body.tag ?? 'default-tag', arch: body.spec.platform ?? 'linux/amd64' } });
    } else if (route === '/api/push') {
      const ref = `registry.invalid/ns/${body.name}`;
      const imageRef = pinned === 'none' ? `${ref}:${body.tag}` : `${ref}@${pinned === 'same' ? digest : 'sha256:' + 'b'.repeat(64)}`;
      jobs.set(jobId, { status: 'succeeded', result: { imageRef, digest } });
    } else jobs.set(jobId, { status: 'succeeded', result: { app: body.app, releaseId: 'new-release', changedServices: Object.keys(body.changed ?? {}) } });
    return { jobId };
  },
  apiUpload: async () => ({ id: '11111111-1111-1111-1111-111111111111' }),
  waitForJob: async (_url: string, _token: string, id: string) => jobs.get(id),
  fetchLogTail: async () => '',
} });
const { cmdBuild } = await import('./cmd-build.js');
const { cmdRelease } = await import('./cmd-release.js');
const { runMultiBuildPipeline } = await import('./pipeline-multi.js');
const { resolveGitSource } = await import('./pipeline.js');
const spec = { schemaVersion: 2, name: 'audit', services: { api: {} } };

async function fixture(t: any, input: unknown = spec): Promise<string> {
  leases = 0; pinned = 'none'; beforeBuild = undefined;
  config.source = { repo: 'https://source.example/team/audit.git', ref: 'a'.repeat(40) };
  logEntries.length = 0;
  requests.length = 0; payloads.length = 0; jobs.clear();
  state = { schemaVersion: 2, app: 'audit', current: null, services: {} };
  const cwd = process.cwd();
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-cli-contract-'));
  await writeFile(path.join(dir, 'ship.json'), JSON.stringify(input));
  process.chdir(dir);
  t.after(async () => { process.chdir(cwd); await rm(dir, { recursive: true, force: true }); });
  return dir;
}
function noBuildCost(): void {
  assert.equal(leases, 0);
  assert.equal(requests.filter((r) => ['/api/build', '/api/push'].includes(r.route)).length, 0);
  assert.equal(payloads.length, 0);
}

test('CLI refuses undeclared constructor before any lease/build/push', async (t) => {
  await fixture(t);
  await assert.rejects(() => cmdBuild(['--services', 'constructor', '--json']), /unknown service/);
  noBuildCost();
});
test('direct multi-build entry also refuses a prototype selection before any lease', async (t) => {
  const cwd = await fixture(t);
  await assert.rejects(() => runMultiBuildPipeline({ config, cwd, logger: log, spec: { schemaVersion: 2, name: 'audit', services: { api: {} } }, selection: ['constructor'], timeoutMs: 1_000 }), /unknown service/);
  noBuildCost();
});
test('CLI can build an explicitly declared constructor service', async (t) => {
  await fixture(t, { ...spec, services: { constructor: {} } });
  await cmdBuild(['--services', 'constructor', '--json']);
  assert.equal(requests.find((r) => r.route === '/api/build')?.body.spec.name, 'constructor');
  assert.equal(payloads[0].services.constructor.imageRef, 'registry.invalid/ns/constructor@' + digest);
});
test('CLI v1 build refuses --services before any lease/build/push', async (t) => {
  await fixture(t, { name: 'audit' });
  await assert.rejects(() => cmdBuild(['--services', 'api', '--json']), /--services.*schemaVersion: 2/);
  noBuildCost();
});
test('CLI v2 build applies --tag to build, push and the result', async (t) => {
  await fixture(t);
  await cmdBuild(['--tag', 'requested-tag', '--json']);
  assert.equal(requests.find((r) => r.route === '/api/build')?.body.tag, 'requested-tag');
  assert.equal(requests.find((r) => r.route === '/api/push')?.body.tag, 'requested-tag');
  assert.equal(payloads[0].services.api.tag, 'requested-tag');
});
test('CLI v2 release applies --tag to each selected service', async (t) => {
  await fixture(t, { ...spec, services: { api: {}, web: {} } });
  await cmdRelease(['--tag', 'requested-tag', '--json']);
  assert.equal(requests.filter((r) => r.route === '/api/build').length, 2);
  assert.ok(requests.filter((r) => r.route === '/api/build').every((r) => r.body.tag === 'requested-tag'));
  assert.ok(requests.filter((r) => r.route === '/api/push').every((r) => r.body.tag === 'requested-tag'));
});
test('CLI release refuses a missing declared envFile before any lease/build/push', async (t) => {
  await fixture(t, { ...spec, services: { api: { envFile: 'missing.env' } } });
  await assert.rejects(() => cmdRelease(['--json']), /services.api.envFile.*not found/);
  noBuildCost();
});
test('CLI release freezes runtime env before building and delivers that snapshot', async (t) => {
  const dir = await fixture(t, { ...spec, services: { api: { envFile: 'runtime.env' } } });
  await writeFile(path.join(dir, 'runtime.env'), 'MOCK_RUNTIME=before');
  beforeBuild = () => writeFile(path.join(dir, 'runtime.env'), 'MOCK_RUNTIME=after');
  await cmdRelease(['--json']);
  assert.equal(requests.find((r) => r.route === '/api/deploy-group')?.body.changed.api.envFileContent, 'MOCK_RUNTIME=before');
});
test('CLI keep-env can release an existing envless service without reading a missing declared file', async (t) => {
  await fixture(t, { ...spec, services: { api: { envFile: 'missing.env' }, web: {} } });
  state = { schemaVersion: 2, app: 'audit', current: 'old-release', services: {
    api: { imageRef: 'registry.invalid/api@' + digest, hasEnv: true, spec: { envFile: 'missing.env' } },
    web: { imageRef: 'registry.invalid/web@' + digest, hasEnv: false, spec: {} },
  } };
  await cmdRelease(['--keep-env', '--json']);
  const changed = requests.find((r) => r.route === '/api/deploy-group')?.body.changed;
  assert.equal(changed.api.keepEnv, true);
  assert.equal(changed.web.keepEnv, true);
  assert.equal(changed.api.envFileContent, undefined);
});
test('CLI accepts an already pinned matching digest without duplicating it', async (t) => {
  await fixture(t); pinned = 'same';
  await cmdBuild(['--json']);
  assert.equal(payloads[0].services.api.imageRef, 'registry.invalid/ns/api@' + digest);
});
test('CLI refuses an already pinned different digest without a complete manifest', async (t) => {
  await fixture(t); pinned = 'different';
  await assert.rejects(() => cmdBuild(['--json']), /disagrees with the reported digest/);
  assert.equal(payloads.length, 0);
});

test('A12: CLI source log strips embedded credentials but transport retains authentication', async (t) => {
  const cwd = await fixture(t);
  const repo = 'https://mock-user:MOCK%2Fpassword@git.example/team/audit.git';
  config.source = { repo, token: 'MOCK_SEPARATE_TOKEN', ref: 'main' };
  const source = await resolveGitSource(cwd, config, log);
  assert.deepEqual(source, { type: 'git', repo, token: 'MOCK_SEPARATE_TOKEN', ref: 'main' });
  assert.deepEqual(logEntries[0], { event: 'build source', meta: { repo: 'https://git.example/team/audit.git', ref: 'main', auth: 'token' } });
});
test('A12: multi-build manifest records a credential-free repo while the build request retains it', async (t) => {
  const cwd = await fixture(t);
  const repo = 'https://mock-user:MOCK%2Fpassword@git.example/team/audit.git';
  config.source = { repo, ref: 'main' };
  const manifest = await runMultiBuildPipeline({ config, cwd, logger: log, spec: { schemaVersion: 2, name: 'audit', services: { api: {} } }, selection: ['api'], timeoutMs: 1_000 });
  assert.equal(requests.find((r) => r.route === '/api/build')?.body.source.repo, repo);
  assert.equal(manifest.services.api?.source.repo, 'https://git.example/team/audit.git');
  assert.ok(!JSON.stringify(manifest).includes('MOCK%2Fpassword'));
});
