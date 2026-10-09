import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import type { ShipConfig } from '../shared/types.js';
import { createLogger } from '../shared/log.js';

const moduleMock = (mock as unknown as { module(url: URL, options: { namedExports: Record<string, unknown> }): unknown }).module.bind(mock);
const planned = 'a'.repeat(40), requests: string[] = [];
let reported: string | undefined = 'b'.repeat(40);
const handle = { url: 'https://builder.invalid', token: 'private-fixture-agent' };
const unused = () => { throw new Error('Unexpected boundary invocation'); };
moduleMock(new URL('../shared/http.js', import.meta.url), { namedExports: { ApiError: class extends Error {}, apiUpload: unused, waitForJob: unused, fetchLogTail: unused,
  api: async (_url: string, _token: string, method: string, route: string) => {
    requests.push(`${method} ${route}`);
    if (route === '/api/status') return { role: 'builder', auth: { capabilities: ['multi-service-v2'] } };
    if (route === '/api/build') return { jobId: 'build-fixture' };
    if (route === '/api/push') throw new Error('Push must never occur for an unproven SHA');
    throw new Error('Unexpected transport boundary');
  },
} });
moduleMock(new URL('./job-report.js', import.meta.url), { namedExports: { waitAndReport: async () => ({ status: 'succeeded', result: { sha: reported, tag: 'fixture', arch: 'linux/amd64' } }) } });
moduleMock(new URL('./builder-lease.js', import.meta.url), { namedExports: { withBuilderLease: async (options: { run(connection: typeof handle): Promise<unknown> }) => ({ value: await options.run(handle), release: { builderRelease: 'static' } }) } });
const { runMultiBuildPipeline } = await import('./pipeline-multi.js');
const config: ShipConfig = { source: { repo: 'https://github.com/owner/repo', ref: planned }, builder: { mode: 'static', static: handle },
  registry: { url: 'registry.invalid', namespace: 'fixture' }, runtime: { targets: {} } };

for (const returned of ['b'.repeat(40), undefined]) test(`planned Git SHA ${returned ? 'mismatch' : 'missing'} blocks every push before a manifest exists`, async () => {
  requests.length = 0; reported = returned;
  await assert.rejects(runMultiBuildPipeline({ config, cwd: '/repository/does-not-exist', expectedGitSha: planned, timeoutMs: 1000,
    logger: createLogger(false, () => {}), selection: ['api', 'web'], spec: { schemaVersion: 2, name: 'fixture', services: { api: {}, web: {} } } }), /planned Git SHA/);
  assert.equal(requests.filter(request => request.startsWith('POST')).length, 1);
  assert(requests.includes('POST /api/build')); assert(!requests.some(request => request.includes('/api/push')));
});
