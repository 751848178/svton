// M2-03/M2-04/LEGACY-02 regressions against a REAL agent: composite registry
// actions gate on the caller's effective role (a runtime paired token on a
// both machine must not store push creds or start push verifications, and vice
// versa); /api/status reports the caller's permissions; raw source uploads
// stream instead of being parsed as JSON.

import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import path from 'node:path';
import type { AgentHandle } from './server.js';
import { SecurityStore, type PairRole } from './security.js';

const realExec = await import('../shared/exec.js');
mock.module('../shared/exec.js', { namedExports: {
  ...realExec,
  exec: async (cmd: string, args: string[], opts?: unknown) => {
    if (cmd !== 'docker') return realExec.exec(cmd, args, opts as never);
    if (args[0] !== 'version') throw new Error(`unexpected Docker operation in route test: ${args.join(' ')}`);
    return { code: 0, stdout: '24.0', stderr: '', truncated: false, timedOut: false };
  },
} });
const { startAgent } = await import('./server.js');

const MASTER = 'test-master-token';
const run = promisify(execFile);

async function startBoth(): Promise<{ agent: AgentHandle; workRoot: string; mint: (role: PairRole) => Promise<string> }> {
  const workRoot = await mkdtemp(path.join(tmpdir(), 'ship-rg-'));
  const agent = await startAgent({ role: 'both', token: MASTER, port: 0, host: '127.0.0.1', workRoot });
  const store = new SecurityStore(path.join(workRoot, 'security.json'));
  await store.load();
  return {
    agent,
    workRoot,
    mint: async (role) => {
      const { code } = await store.createCode(role, 15);
      const res = await fetch(`${agent.url}/api/pairing/exchange`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }),
      });
      assert.equal(res.status, 200);
      return ((await res.json()) as { token: string }).token;
    },
  };
}

const AUTH_JSON = (token: string) => ({ authorization: `Bearer ${token}`, 'content-type': 'application/json' });

// ---- M2-03: caller × action matrix on a both machine ----

test('M2-03: runtime token cannot store PUSH creds (403 before any file write)', async () => {
  const { agent, workRoot, mint } = await startBoth();
  try {
    const rt = await mint('runtime');
    const res = await fetch(`${agent.url}/api/registry-creds`, {
      method: 'PUT', headers: AUTH_JSON(rt), body: JSON.stringify({ kind: 'push', user: 'u', password: 'p' }),
    });
    assert.equal(res.status, 403);
    assert.equal(((await res.json()) as { error: { code: string } }).error.code, 'wrong_role');
    assert.equal(await readdir(workRoot).then((f) => f.includes('registry-creds.json')), false, 'rejection must precede the file write');
  } finally {
    await agent.close();
  }
});

test('M2-03: builder token cannot store PULL creds', async () => {
  const { agent, workRoot, mint } = await startBoth();
  try {
    const bt = await mint('builder');
    const res = await fetch(`${agent.url}/api/registry-creds`, {
      method: 'PUT', headers: AUTH_JSON(bt), body: JSON.stringify({ kind: 'pull', user: 'u', password: 'p' }),
    });
    assert.equal(res.status, 403);
    assert.equal(await readdir(workRoot).then((f) => f.includes('registry-creds.json')), false);
  } finally {
    await agent.close();
  }
});

test('M2-03: verify push/pull gates — runtime cannot push-verify, builder cannot pull-verify, no jobs created', async () => {
  const { agent, mint } = await startBoth();
  try {
    const rt = await mint('runtime');
    const bt = await mint('builder');
    const pushByRt = await fetch(`${agent.url}/api/verify/registry`, {
      method: 'POST', headers: AUTH_JSON(rt), body: JSON.stringify({ mode: 'push', registry: '127.0.0.1:59999', namespace: 'audit' }),
    });
    assert.equal(pushByRt.status, 403, 'runtime credential must not start push verifications');
    const pullByBt = await fetch(`${agent.url}/api/verify/registry`, {
      method: 'POST', headers: AUTH_JSON(bt), body: JSON.stringify({ mode: 'pull', registry: '127.0.0.1:59999', ref: '127.0.0.1:59999/x:y' }),
    });
    assert.equal(pullByBt.status, 403, 'builder credential must not start pull verifications');
    const jobs = (await (await fetch(`${agent.url}/api/jobs`, { headers: { authorization: `Bearer ${MASTER}` } })).json()) as { jobs: unknown[] };
    assert.equal(jobs.jobs.length, 0, 'rejection must precede job creation');
  } finally {
    await agent.close();
  }
});

test('M2-03: master and matching roles still pass the composite gates', async () => {
  const { agent, workRoot, mint } = await startBoth();
  try {
    const bt = await mint('builder');
    const push = await fetch(`${agent.url}/api/registry-creds`, {
      method: 'PUT', headers: AUTH_JSON(bt), body: JSON.stringify({ kind: 'push', user: 'push-u', password: 'push-p' }),
    });
    assert.equal(push.status, 200, 'builder credential stores push creds on a both machine');
    const mode = (await stat(path.join(workRoot, 'registry-creds.json'))).mode & 0o777;
    assert.equal(mode, 0o600);
    const rt = await mint('runtime');
    const pull = await fetch(`${agent.url}/api/registry-creds`, {
      method: 'PUT', headers: AUTH_JSON(rt), body: JSON.stringify({ kind: 'pull', user: 'pull-u', password: 'pull-p' }),
    });
    assert.equal(pull.status, 200);
    const stored = JSON.parse(await readFile(path.join(workRoot, 'registry-creds.json'), 'utf8')) as Record<string, unknown>;
    assert.ok(stored.push && stored.pull, 'read-modify-write keeps both kinds');
  } finally {
    await agent.close();
  }
});

test('M2-03: machine capability still applies — builder-only agent refuses pull creds even for its master token', async () => {
  const workRoot = await mkdtemp(path.join(tmpdir(), 'ship-rg-'));
  const agent = await startAgent({ role: 'builder', token: MASTER, port: 0, host: '127.0.0.1', workRoot });
  try {
    const res = await fetch(`${agent.url}/api/registry-creds`, {
      method: 'PUT', headers: AUTH_JSON(MASTER), body: JSON.stringify({ kind: 'pull', user: 'u', password: 'p' }),
    });
    assert.equal(res.status, 403);
  } finally {
    await agent.close();
  }
});

// ---- M2-04: /api/status reports the CALLER's effective permissions ----

test('M2-04: status.auth distinguishes master/builder/runtime callers on a both machine', async () => {
  const { agent, mint } = await startBoth();
  try {
    const bt = await mint('builder');
    const rt = await mint('runtime');
    const get = async (token: string) => (await (await fetch(`${agent.url}/api/status`, { headers: { authorization: `Bearer ${token}` } })).json()) as {
      role: string; auth?: { role: string; capabilities: string[] };
    };
    assert.deepEqual((await get(MASTER)).auth, { role: 'both', capabilities: ['build', 'push', 'deploy', 'rollback', 'gc', 'deployment-identity-v1', 'deployment-env-preserve-v1', 'multi-service-v2'] });
    assert.equal((await get(bt)).auth?.role, 'builder');
    assert.ok((await get(bt)).auth?.capabilities.includes('push') && !(await get(bt)).auth?.capabilities.includes('deploy'));
    assert.equal((await get(rt)).auth?.role, 'runtime');
    assert.equal((await get(rt)).role, 'both', 'machine role stays visible but is not a permission');
  } finally {
    await agent.close();
  }
});

// ---- LEGACY-02: raw source upload streams instead of JSON parsing ----

async function makeTarball(dir: string): Promise<Buffer> {
  const staging = path.join(dir, 'staged');
  await mkdir(staging, { recursive: true });
  await writeFile(path.join(staging, 'Dockerfile'), 'FROM scratch\nEXPOSE 3000\n');
  await run('tar', ['czf', path.join(dir, 'src.tgz'), '-C', staging, '.']);
  return readFile(path.join(dir, 'src.tgz'));
}

test('LEGACY-02: real tar.gz upload → 201 with a source id (was 400 bad_json)', async () => {
  const workRoot = await mkdtemp(path.join(tmpdir(), 'ship-rg-'));
  const agent = await startAgent({ role: 'builder', token: MASTER, port: 0, host: '127.0.0.1', workRoot });
  try {
    const tgz = await makeTarball(path.join(workRoot, 'up'));
    const res = await fetch(`${agent.url}/api/sources`, {
      method: 'POST', headers: { authorization: `Bearer ${MASTER}`, 'content-type': 'application/gzip' }, body: new Uint8Array(tgz),
    });
    assert.equal(res.status, 201, `expected 201, got ${res.status}`);
    const { id } = (await res.json()) as { id: string };
    const dirs = await readdir(path.join(workRoot, 'sources'));
    assert.ok(dirs.includes(`tar-${id}`), 'extracted source dir exists');
    assert.ok(!dirs.some((d) => d.endsWith('.incoming')), 'incoming temp is cleaned up');
  } finally {
    await agent.close();
  }
});

test('LEGACY-02: empty body → 400 bad_request; invalid gzip → 400 bad_tarball; neither leaves a dir behind', async () => {
  const workRoot = await mkdtemp(path.join(tmpdir(), 'ship-rg-'));
  const agent = await startAgent({ role: 'builder', token: MASTER, port: 0, host: '127.0.0.1', workRoot });
  try {
    const empty = await fetch(`${agent.url}/api/sources`, {
      method: 'POST', headers: { authorization: `Bearer ${MASTER}`, 'content-type': 'application/gzip' }, body: new Uint8Array(0),
    });
    assert.equal(empty.status, 400);
    assert.equal(((await empty.json()) as { error: { code: string } }).error.code, 'bad_request');

    const junk = await fetch(`${agent.url}/api/sources`, {
      method: 'POST', headers: { authorization: `Bearer ${MASTER}`, 'content-type': 'application/gzip' }, body: Buffer.from('definitely-not-gzip'.repeat(100)),
    });
    assert.equal(junk.status, 400);
    assert.equal(((await junk.json()) as { error: { code: string } }).error.code, 'bad_tarball');

    const sources = path.join(workRoot, 'sources');
    const dirs = await readdir(sources).catch(() => []);
    assert.equal(dirs.filter((d) => d.startsWith('tar-') || d.endsWith('.incoming')).length, 0, 'failed uploads must not leave partial state');
  } finally {
    await agent.close();
  }
});

test('LEGACY-02: uploads above the size cap are refused (413 payload_too_large)', async () => {
  const workRoot = await mkdtemp(path.join(tmpdir(), 'ship-rg-'));
  const agent = await startAgent({ role: 'builder', token: MASTER, port: 0, host: '127.0.0.1', workRoot });
  try {
    // stream >300MB without materializing it in memory
    const limit = 300 * 1024 * 1024;
    let sent = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        const chunk = new Uint8Array(16 * 1024 * 1024).fill(1);
        sent += chunk.length;
        if (sent > limit + chunk.length) controller.close();
        else controller.enqueue(chunk);
      },
    });
    let status: number | null = null;
    try {
      const res = await fetch(`${agent.url}/api/sources`, {
        method: 'POST', headers: { authorization: `Bearer ${MASTER}`, 'content-type': 'application/gzip' },
        body: body as unknown as ReadableStream<Uint8Array>,
        duplex: 'half',
      });
      status = res.status;
      await res.body?.cancel();
    } catch {
      status = null; // the agent destroys the socket on overflow — also a refusal
    }
    assert.notEqual(status, 201, 'an oversized upload must never succeed');
    assert.notEqual(status, 200, 'an oversized upload must never succeed');
    // the server cleans up asynchronously after destroying the socket — settle first
    await new Promise((r) => setTimeout(r, 400));
    const sources = path.join(workRoot, 'sources');
    const leftovers = (await readdir(sources).catch(() => [])).filter((f) => f.startsWith('tar-') || f.endsWith('.incoming'));
    assert.equal(leftovers.length, 0, 'refused upload leaves nothing behind');
  } finally {
    await agent.close();
  }
});

test('LEGACY-02 (unit): streamBodyToFile enforces the cap with 413 payload_too_large', async () => {
  const { streamBodyToFile } = await import('./body.js');
  const { Readable } = await import('node:stream');
  const limit = 1024;
  const big = Readable.from([Buffer.alloc(limit + 1).fill(7)] as Buffer[]);
  const target = path.join(await mkdtemp(path.join(tmpdir(), 'ship-cap-')), 'incoming');
  await assert.rejects(
    () => streamBodyToFile(big as never, limit, target),
    (e: unknown) => (e as { status?: number }).status === 413,
  );
});

test('LEGACY-02 end-to-end: the REAL CLI packer → apiUpload → streamed extract on the agent', async () => {
  const workRoot = await mkdtemp(path.join(tmpdir(), 'ship-rg-'));
  const agent = await startAgent({ role: 'builder', token: MASTER, port: 0, host: '127.0.0.1', workRoot });
  try {
    const { packSourceDir } = await import('../cli/pipeline.js');
    const { apiUpload } = await import('../shared/http.js');
    const src = path.join(workRoot, 'project');
    await mkdir(src, { recursive: true });
    await writeFile(path.join(src, 'Dockerfile'), 'FROM scratch\nEXPOSE 8080\n');
    await writeFile(path.join(src, 'app.py'), 'print("legacy-02")\n');
    await writeFile(path.join(src, 'ship.config.yaml'), 'builder:\n  mode: static\n'); // excluded by the packer (F06)
    const tgz = path.join(workRoot, 'packed.tgz');
    await packSourceDir(src, tgz);
    const { id } = await apiUpload(agent.url, MASTER, await readFile(tgz));
    const extracted = path.join(workRoot, 'sources', `tar-${id}`);
    assert.ok((await readFile(path.join(extracted, 'Dockerfile'), 'utf8')).includes('EXPOSE 8080'));
    assert.ok((await readFile(path.join(extracted, 'app.py'), 'utf8')).includes('legacy-02'));
    const { readdir } = await import('node:fs/promises');
    assert.ok(!(await readdir(extracted)).includes('ship.config.yaml'), 'the packer excludes controller config');
  } finally {
    await agent.close();
  }
});
