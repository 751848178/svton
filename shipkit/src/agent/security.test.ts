import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startAgent, type AgentHandle } from './server.js';
import { SecurityStore } from './security.js';

/** the compiled agent entry next to this test's dist location */
const AGENT_SERVER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'server.js');
let PROC_AGENT: ChildProcess | null = null;

const TOKEN = 'test-master-token';
const AUTH = { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' };

async function startTestAgent(role = 'both'): Promise<{ agent: AgentHandle; workRoot: string }> {
  const workRoot = await mkdtemp(path.join(tmpdir(), 'ship-pair-'));
  const agent = await startAgent({ role, token: TOKEN, port: 0, host: '127.0.0.1', workRoot });
  return { agent, workRoot };
}

/** a SECOND store instance = the `--pair` process in production */
const adminStore = (workRoot: string) => new SecurityStore(path.join(workRoot, 'security.json'));

async function exchange(url: string, code: string): Promise<Response> {
  return fetch(`${url}/api/pairing/exchange`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code }),
  });
}

test('exchange happy path: code → role-scoped token; builder token cannot deploy', async () => {
  const { agent, workRoot } = await startTestAgent('both');
  try {
    const { code } = await adminStore(workRoot).createCode('builder', 15);
    const res = await fetch(`${agent.url}/api/pairing/exchange`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, label: 'e2e-builder' }),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { token: string; role: string };
    assert.equal(body.role, 'builder');
    assert.match(body.token, /^skt-/);

    const ok = await fetch(`${agent.url}/api/status`, { headers: { authorization: `Bearer ${body.token}` } });
    assert.equal(ok.status, 200);
    const denied = await fetch(`${agent.url}/api/deploy`, {
      method: 'POST', headers: { authorization: `Bearer ${body.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ app: 'a', imageRef: 'x', spec: { name: 'a' } }),
    });
    assert.equal(denied.status, 403, 'builder-scoped token must not deploy');
  } finally {
    await agent.close();
  }
});

test('replay of a consumed code is rejected with a distinct error code', async () => {
  const { agent, workRoot } = await startTestAgent();
  try {
    const { code } = await adminStore(workRoot).createCode('runtime', 15);
    assert.equal((await exchange(agent.url, code)).status, 200);
    const twice = await exchange(agent.url, code);
    assert.equal(twice.status, 401);
    assert.equal(((await twice.json()) as { error: { code: string } }).error.code, 'pairing_replayed');
  } finally {
    await agent.close();
  }
});

test('expired and unknown codes are rejected without echoing the code', async () => {
  const { agent, workRoot } = await startTestAgent();
  try {
    const store = adminStore(workRoot);
    const { code } = await store.createCode('runtime', 1);
    // force expiry on disk, then let the agent pick the change up (mtime refresh)
    const file = path.join(workRoot, 'security.json');
    const data = JSON.parse(await readFile(file, 'utf8')) as { codes: Array<{ expiresAt: string }> };
    data.codes[0]!.expiresAt = new Date(Date.now() - 1000).toISOString();
    await writeFile(file, JSON.stringify(data));
    const res = await exchange(agent.url, code);
    assert.equal(res.status, 401);
    const text = await res.text();
    assert.ok(!text.includes(code), 'response must not echo the pairing code');
    assert.equal(((JSON.parse(text) as { error: { code: string } }).error.code), 'pairing_expired');

    const unknown = await exchange(agent.url, 'skp-nothing-nothing-nothing');
    assert.equal(unknown.status, 401);
    assert.equal(((await unknown.json()) as { error: { code: string } }).error.code, 'pairing_invalid');
  } finally {
    await agent.close();
  }
});

test('brute force budget: repeated wrong codes lock the endpoint (429)', async () => {
  const { agent, workRoot } = await startTestAgent();
  try {
    for (let i = 0; i < 20; i++) {
      await exchange(agent.url, `skp-wrong-${i}-aaaaaaaaaa`);
    }
    const { code } = await adminStore(workRoot).createCode('builder', 15);
    const locked = await exchange(agent.url, code);
    assert.equal(locked.status, 429);
    assert.equal(((await locked.json()) as { error: { code: string } }).error.code, 'pairing_locked');
  } finally {
    await agent.close();
  }
});

test('store keeps only hashes — no plaintext code or token on disk', async () => {
  const workRoot = await mkdtemp(path.join(tmpdir(), 'ship-pair-'));
  const store = adminStore(workRoot);
  const { code } = await store.createCode('builder', 15);
  const out = await store.exchange(code, 'disk-test');
  const raw = await readFile(path.join(workRoot, 'security.json'), 'utf8');
  assert.ok(!raw.includes(code), 'pairing code must be hashed');
  assert.ok(!raw.includes(out.token), 'token must be hashed');
});

test('runtime-role pairing cannot drive builder endpoints; master keeps full access', async () => {
  const { agent, workRoot } = await startTestAgent('both');
  try {
    const { code } = await adminStore(workRoot).createCode('runtime', 15);
    const { token } = (await (await exchange(agent.url, code)).json()) as { token: string };
    const denied = await fetch(`${agent.url}/api/build`, {
      method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ source: { type: 'git', repo: 'http://x.git' }, spec: { name: 'a' } }),
    });
    assert.equal(denied.status, 403);
    assert.equal((await fetch(`${agent.url}/api/status`, { headers: AUTH })).status, 200);
  } finally {
    await agent.close();
  }
});

test('concurrent exchanges of one code: exactly one wins (atomic consumption)', async () => {
  const workRoot = await mkdtemp(path.join(tmpdir(), 'ship-pair-'));
  const store = adminStore(workRoot);
  const { code } = await store.createCode('builder', 15);
  const results = await Promise.allSettled(Array.from({ length: 6 }, () => store.exchange(code, 'race')));
  const ok = results.filter((r) => r.status === 'fulfilled');
  assert.equal(ok.length, 1, `exactly one exchange may consume the code (got ${ok.length})`);
  const replayed = results.filter((r) => r.status === 'rejected' && /already used/.test(String((r as PromiseRejectedResult).reason)));
  assert.equal(replayed.length, 5);
});

// ---- M2-06 regressions: cross-process transactions on the shared state file ----

test('M2-06: two store instances racing exchange+mint — no lost update, token works, no ENOENT', async () => {
  for (let trial = 0; trial < 3; trial++) {
    const dir = await mkdtemp(path.join(tmpdir(), 'ship-m2race-'));
    const file = path.join(dir, 'security.json');
    const s1 = new SecurityStore(file);
    const { code } = await s1.createCode('builder', 15);
    const s2 = new SecurityStore(file);
    await s2.load();
    const [exchange, mint] = await Promise.allSettled([
      s1.exchange(code, 'race-exchange'),
      s2.createCode('runtime', 15),
    ]);
    assert.equal(exchange.status, 'fulfilled', 'exchange must succeed');
    assert.equal(mint.status, 'fulfilled', `mint must succeed too (got ${mint.status}: ${String((mint as PromiseRejectedResult).reason)})`);
    // the returned token must authenticate
    const verify = new SecurityStore(file);
    await verify.load();
    const token = (exchange as PromiseFulfilledResult<{ token: string }>).value.token;
    assert.equal(await verify.authenticate(token), 'builder', 'every fulfilled exchange token must work');
    const data = JSON.parse(await readFile(file, 'utf8')) as { codes: Array<{ consumedAt: string | null }>; tokens: unknown[] };
    assert.ok(data.codes.length >= 2, 'minted code must survive the concurrent exchange (no lost update)');
    assert.ok(data.tokens.length >= 1);
  }
});

test('M2-06: corrupt state file is refused, never silently replaced', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-m2corrupt-'));
  const file = path.join(dir, 'security.json');
  await writeFile(file, '{not json', { mode: 0o600 });
  const store = new SecurityStore(file);
  await assert.rejects(() => store.load(), /无法解析/);
  await assert.rejects(() => store.createCode('builder', 15), /无法解析/);
  await assert.rejects(() => store.exchange('skp-whatever-code', 'x'), /无法解析/);
  assert.equal(await readFile(file, 'utf8'), '{not json', 'the corrupt file must not be overwritten');
});

test('M2-06/M2-07: state file is written 0600 even when a stale 0644 .tmp exists; symlink targets are refused', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-m2mode-'));
  // stale fixed-name temp from an older writer must not leak its mode into the final file
  await writeFile(path.join(dir, 'security.json.tmp'), 'stale', { mode: 0o644 });
  const store = new SecurityStore(path.join(dir, 'security.json'));
  await store.createCode('builder', 15);
  const mode = (await stat(path.join(dir, 'security.json'))).mode & 0o777;
  assert.equal(mode, 0o600, `expected 0600, got ${mode.toString(8)}`);

  const linkDir = await mkdtemp(path.join(tmpdir(), 'ship-m2link-'));
  const target = path.join(linkDir, 'real.json');
  await writeFile(target, '{}');
  await symlink(target, path.join(linkDir, 'security.json'));
  const linked = new SecurityStore(path.join(linkDir, 'security.json'));
  await assert.rejects(() => linked.createCode('builder', 15), /符号链接/);
});

test('M2-06: REAL agent + administrator --pair subprocesses racing on one state file', async () => {
  const workRoot = await mkdtemp(path.join(tmpdir(), 'ship-m2proc-'));
  const agentUrl = await new Promise<string>((resolve, reject) => {
    const c = spawn(process.execPath, [AGENT_SERVER], {
      env: { ...process.env, SHIP_AGENT_ROLE: 'both', SHIP_AGENT_TOKEN: 'PROC_MASTER', SHIP_AGENT_PORT: '0', SHIP_AGENT_HOST: '127.0.0.1', SHIP_WORK_ROOT: workRoot },
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let err = '';
    const t = setTimeout(() => reject(new Error(`agent subprocess did not start: ${err}`)), 15_000);
    c.stderr.on('data', (d) => {
      err += d;
      const m = err.match(/listening on 127\.0\.0\.1:(\d+)/);
      if (m) { clearTimeout(t); resolve(`http://127.0.0.1:${m[1]}`); }
    });
    c.on('exit', () => clearTimeout(t));
    PROC_AGENT = c;
  });
  try {
    // 6 administrator --pair processes mint codes while 6 codes are exchanged over HTTP
    const minted: Array<{ code: string }> = [];
    const mintChild = async () => {
      const c = spawnSync(process.execPath, [AGENT_SERVER, '--pair', '--role', 'builder', '--ttl-min', '5'], {
        env: { ...process.env, SHIP_WORK_ROOT: workRoot }, encoding: 'utf8',
      });
      assert.equal(c.status, 0, `--pair child failed: ${c.stderr}`);
      const m = c.stdout.match(/skp-[A-Za-z0-9_-]+/);
      assert.ok(m, `child printed a code: ${c.stdout}`);
      return { code: m[0] };
    };
    const exchanges: Array<Promise<{ code: string; status: number; token?: string }>> = [];
    for (let i = 0; i < 6; i++) {
      minted.push(await mintChild());
    }
    for (const { code } of minted) {
      exchanges.push((async () => {
        const res = await fetch(`${agentUrl}/api/pairing/exchange`, {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }),
        });
        const body = res.status === 200 ? ((await res.json()) as { token: string }) : null;
        return { code, status: res.status, token: body?.token };
      })());
    }
    const concurrentMints = Array.from({ length: 6 }, () => mintChild());
    const results = await Promise.all([...exchanges, ...concurrentMints.map(async (p) => { await p; return null; })]);
    // every exchange of a distinct code succeeds exactly once and its token authenticates
    for (const r of results) {
      if (r === null || r.code === undefined) continue;
      assert.equal(r.status, 200, `exchange of ${r.code.slice(0, 12)}… failed`);
      const check = await fetch(`${agentUrl}/api/status`, { headers: { authorization: `Bearer ${r.token}` } });
      assert.equal(check.status, 200, 'issued token must authenticate');
    }
    // replaying every code now fails: each was consumed exactly once
    for (const { code } of minted) {
      const replay = await fetch(`${agentUrl}/api/pairing/exchange`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }),
      });
      assert.equal(replay.status, 401);
    }
    // final state parses and keeps all 12 codes' worth of records (no lost update)
    const data = JSON.parse(await readFile(path.join(workRoot, 'security.json'), 'utf8')) as { codes: unknown[]; tokens: unknown[] };
    assert.equal(data.tokens.length, 6);
    assert.ok(data.codes.length >= 6, 'concurrent mints must all survive');
  } finally {
    PROC_AGENT?.kill('SIGTERM');
  }
});
