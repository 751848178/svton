// Isolated LONG-GC integration over a real local HTTP agent (acceptance §B).
// Docker is faked at the gc-docker seam; deploy's compose/health are faked at module level.
// Scenarios: >20s execution with prompt jobId + pollable result; client disconnect does not
// lose the outcome; GC/deploy interlock through the real route layer; docker failures are
// never reported as success. No real images are touched.

import test from 'node:test';
import { mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

type GcCall = { at: number; args: string[] };

const gcCalls: GcCall[] = [];
let inspectDelayMs = 0;
let inspectResult: 'ok' | 'daemon-down' | 'not-found' = 'ok';
let rmiDelayMs = 0;

mock.module('./gc-docker.js', {
  namedExports: {
    gcDockerRun: async (args: string[]): Promise<{ code: number; stdout: string; stderr: string; truncated: boolean; timedOut: boolean }> => {
      gcCalls.push({ at: Date.now(), args });
      if (args[0] === 'image') {
        await new Promise((r) => setTimeout(r, inspectDelayMs));
        if (inspectResult === 'daemon-down') {
          return { code: 1, stdout: '', stderr: 'Cannot connect to the Docker daemon at unix:///var/run/docker.sock', truncated: false, timedOut: false };
        }
        if (inspectResult === 'not-found') {
          return { code: 1, stdout: '', stderr: 'Error: No such image: whatever', truncated: false, timedOut: false };
        }
        return { code: 0, stdout: 'sha256:f', stderr: '', truncated: false, timedOut: false };
      }
      await new Promise((r) => setTimeout(r, rmiDelayMs));
      return { code: 0, stdout: '', stderr: '', truncated: false, timedOut: false };
    },
  },
});

const composeCalls: Array<{ at: number; app: string; args: string[] }> = [];
mock.module('./docker.js', {
  namedExports: {
    dockerAvailable: async () => true,
    requireEnv: (name: string) => `env:${name}`,
    dockerBuild: async () => 'sha256:build',
    dockerPushAsImageRef: async () => ({ digest: 'sha256:push' }),
    imageExists: async () => false,
    pullAuthCtx: async () => null,
    compose: async (o: { app: string; args: string[] }) => {
      composeCalls.push({ at: Date.now(), app: o.app, args: o.args });
    },
    composePort: async () => null,
  },
});
mock.module('./healthcheck.js', {
  namedExports: {
    waitHealthy: async () => ({ healthy: true, skipped: false, attempts: 1 }),
  },
});

const { startAgent } = await import('./server.js');
const { ReleaseStore } = await import('./release.js');
const { ImageLedger } = await import('./image-ledger.js');
const { ledgerFileFor } = await import('./gc.js');
const { validateSpec } = await import('../shared/spec-schema.js');

const SPEC = () => validateSpec({ name: 'app', ports: ['3000:3000'], healthcheck: { path: '/', hostPort: 3000 } });

async function seed(root: string, protectedRefs: string[], staleRefs: string[]): Promise<void> {
  const apps = path.join(root, 'apps');
  await mkdir(apps, { recursive: true });
  const store = new ReleaseStore(apps);
  for (const ref of protectedRefs) {
    const rel = await store.saveRelease('app', ref, SPEC());
    await store.shift('app', rel.id, 'deploy');
  }
  const ledger = new ImageLedger(ledgerFileFor(apps));
  for (const ref of [...protectedRefs, ...staleRefs]) await ledger.record(ref, 'app');
}

function auth(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}

async function waitJob(url: string, token: string, jobId: string, timeoutMs: number): Promise<Record<string, unknown>> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const job = (await (await fetch(`${url}/api/jobs/${jobId}`, { headers: auth(token) })).json()) as Record<string, unknown>;
    if (job.status === 'succeeded' || job.status === 'failed') return job;
    if (Date.now() > deadline) throw new Error(`job ${jobId} still ${job.status} after ${timeoutMs}ms`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

test('B: >20s GC returns jobId promptly, survives client disconnect, result+log pollable', async () => {
  gcCalls.length = 0;
  inspectDelayMs = 2_600; // 10 candidates × (inspect 2.6s + rmi fast) > 20s request window
  rmiDelayMs = 20;
  inspectResult = 'ok';
  const root = await mkdtemp(path.join(tmpdir(), 'ship-gci-'));
  const agent = await startAgent({ role: 'runtime', token: 't', port: 0, host: '127.0.0.1', workRoot: root });
  try {
    await seed(root, ['reg/app:cur', 'reg/app:prev'], Array.from({ length: 10 }, (_, i) => `reg/app:old${i}`));
    const submittedAt = Date.now();
    // abort the client as soon as response HEADERS arrive (body unread = walked-away client)
    const ac = new AbortController();
    const res = await fetch(`${agent.url}/api/gc`, { method: 'POST', headers: auth('t'), body: '{"dryRun":false}', signal: ac.signal });
    const { jobId } = (await res.json()) as { jobId: string };
    ac.abort();
    assert.ok(Date.now() - submittedAt < 3_000, 'jobId must return in seconds, not the GC duration');
    const job = await waitJob(agent.url, 't', jobId, 60_000);
    assert.equal(job.status, 'succeeded');
    const result = job.result as { mode: string; removed: string[]; missing: string[] };
    assert.equal(result.removed.length, 10);
    const log = await (await fetch(`${agent.url}/api/jobs/${jobId}/log?tail=50`, { headers: auth('t') })).text();
    assert.match(log, /removed: reg\/app:old9/);
  } finally {
    await agent.close();
  }
});

test('B: deploy interleaved with a running GC waits for it and its image is never deleted', async () => {
  gcCalls.length = 0;
  composeCalls.length = 0;
  inspectDelayMs = 700; // 4 stale × 0.7s ≈ 3s GC — enough to interleave, keeps the suite fast
  rmiDelayMs = 30;
  inspectResult = 'ok';
  const root = await mkdtemp(path.join(tmpdir(), 'ship-gci-'));
  const agent = await startAgent({ role: 'runtime', token: 't', port: 0, host: '127.0.0.1', workRoot: root });
  try {
    await seed(root, ['reg/app:cur'], ['reg/app:o0', 'reg/app:o1', 'reg/app:o2', 'reg/app:o3']);
    const gcRes = await fetch(`${agent.url}/api/gc`, { method: 'POST', headers: auth('t'), body: '{"dryRun":false}' });
    const { jobId: gcJob } = (await gcRes.json()) as { jobId: string };
    await new Promise((r) => setTimeout(r, 300)); // GC now inside its writer slot
    const depRes = await fetch(`${agent.url}/api/deploy`, {
      method: 'POST', headers: auth('t'),
      body: JSON.stringify({ app: 'app', imageRef: 'reg/app:new', spec: { name: 'app', ports: ['3000:3000'], healthcheck: { path: '/', hostPort: 3000 } } }),
    });
    assert.equal(depRes.status, 202);
    const { jobId: depJob } = (await depRes.json()) as { jobId: string };
    const [gc, dep] = await Promise.all([waitJob(agent.url, 't', gcJob, 30_000), waitJob(agent.url, 't', depJob, 30_000)]);
    const lastRmi = Math.max(...gcCalls.filter((c) => c.args[0] === 'rmi').map((c) => c.at));
    const firstComposeUp = composeCalls.find((c) => c.args.includes('up'))?.at ?? Infinity;
    assert.ok(firstComposeUp > lastRmi, 'deploy activation must start only after the GC finished deleting');
    assert.equal(gc.status, 'succeeded');
    assert.equal(dep.status, 'succeeded');
    const deleted = (gc.result as { removed: string[] }).removed;
    assert.ok(!deleted.includes('reg/app:new'), 'image published behind the GC is never a victim');
  } finally {
    await agent.close();
  }
});

test('B: docker daemon failures are surfaced, never reported as clean success', async () => {
  gcCalls.length = 0;
  inspectDelayMs = 0;
  inspectResult = 'daemon-down';
  const root = await mkdtemp(path.join(tmpdir(), 'ship-gci-'));
  const agent = await startAgent({ role: 'runtime', token: 't', port: 0, host: '127.0.0.1', workRoot: root });
  try {
    await seed(root, ['reg/app:cur'], ['reg/app:bad']);
    const res = await fetch(`${agent.url}/api/gc`, { method: 'POST', headers: auth('t'), body: '{"dryRun":false}' });
    const { jobId } = (await res.json()) as { jobId: string };
    const job = await waitJob(agent.url, 't', jobId, 15_000);
    assert.equal(job.status, 'succeeded'); // the job completed; the RESULT reports the failure honestly
    const result = job.result as { failed: Array<{ imageRef: string }>; removed: string[]; missing: string[] };
    assert.equal(result.failed.length, 1);
    assert.equal(result.removed.length, 0);
    assert.equal(result.missing.length, 0);
    inspectResult = 'ok';
  } finally {
    await agent.close();
  }
});
