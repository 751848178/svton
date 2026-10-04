import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { checkAgent, checkRegistry } from './checks.js';

interface StubAgent {
  server: Server;
  url: string;
}

async function stubAgent(opts: { statusRole?: string; authOk?: boolean; docker?: boolean; noAuth?: boolean } = {}): Promise<StubAgent> {
  const server = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, role: 'both', version: '0.3.0', docker: opts.docker ?? true }));
      return;
    }
    if (req.url === '/api/status') {
      if (opts.authOk === false || req.headers.authorization !== 'Bearer good-token') {
        res.writeHead(401, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: { code: 'unauthorized', message: 'bad token' } }));
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      // M2-04 contract: role = machine role, auth.role = the CALLER's effective role
      res.end(JSON.stringify({
        role: 'both', version: '0.3.0', docker: opts.docker ?? true, workRoot: '/tmp',
        ...(opts.noAuth ? {} : { auth: { role: opts.statusRole ?? 'both', capabilities: [] } }),
      }));
    }
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  return { server, url: `http://127.0.0.1:${(server.address() as { port: number }).port}` };
}

function close(s: Server): Promise<void> {
  return new Promise((r) => s.close(() => r()));
}

test('healthy agent: reachable + authenticated + role + docker all pass', async () => {
  const a = await stubAgent({});
  try {
    const c = await checkAgent('builder', a.url, 'good-token');
    assert.equal(c.passed, true);
    assert.equal(c.reachable, true);
    assert.equal(c.authenticated, true);
    assert.ok(c.detail.includes('角色'));
  } finally {
    await close(a.server);
  }
});

test('bad token: reachable but NOT authenticated — levels stay distinct', async () => {
  const a = await stubAgent({});
  try {
    const c = await checkAgent('runtime', a.url, 'wrong-token');
    assert.equal(c.passed, false);
    assert.equal(c.reachable, true);
    assert.equal(c.authenticated, false);
    assert.ok(c.detail.includes('token 无效'), c.detail);
  } finally {
    await close(a.server);
  }
});

test('wrong role / missing docker fail the check even when authenticated', async () => {
  const a = await stubAgent({ statusRole: 'builder', docker: false });
  try {
    const c = await checkAgent('runtime', a.url, 'good-token');
    assert.equal(c.authenticated, true);
    assert.equal(c.roleOk, false, 'builder role must not satisfy a runtime need');
    assert.equal(c.dockerOk, false);
    assert.equal(c.passed, false);
  } finally {
    await close(a.server);
  }
});

test('unreachable agent fails at the first level with the reason', async () => {
  const c = await checkAgent('builder', 'http://127.0.0.1:1', 'any');
  assert.equal(c.reachable, false);
  assert.equal(c.passed, false);
  assert.ok(c.detail.includes('入口不可达'));
});

test('registry check: reachable via http, notes that push/pull stays unverified', async () => {
  const server = createServer((req, res) => {
    res.writeHead(req.url === '/v2/' ? 401 : 404, { 'content-type': 'application/json' });
    res.end('{}');
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const url = `127.0.0.1:${(server.address() as { port: number }).port}`;
  try {
    const c = await checkRegistry(url);
    assert.equal(c.reachable, true);
    assert.equal(c.scheme, 'http');
    assert.equal(c.httpStatus, 401);
    assert.ok(c.detail.includes('不在控制器侧验证'));
  } finally {
    await close(server);
  }
});

test('registry check: unreachable is a warning, never a hard failure', async () => {
  const c = await checkRegistry('127.0.0.1:1');
  assert.equal(c.reachable, false);
  assert.ok(c.detail.includes('不影响保存配置'));
});

// ---- M2-04 regressions: the machine role is never a credential permission ----

test('M2-04: agent without auth report does not pass the role level (machine role=both is not a permission)', async () => {
  const a = await stubAgent({ noAuth: true });
  try {
    const c = await checkAgent('builder', a.url, 'good-token');
    assert.equal(c.authenticated, true);
    assert.equal(c.roleOk, false, 'legacy agents cannot prove the caller\'s permissions');
    assert.equal(c.passed, false);
    assert.ok(c.detail.includes('未上报'), c.detail);
  } finally {
    await close(a.server);
  }
});

test('M2-04: builder credential on a both machine fails a runtime need (auth.role decides)', async () => {
  const a = await stubAgent({ statusRole: 'builder' });
  try {
    const c = await checkAgent('runtime', a.url, 'good-token');
    assert.equal(c.authenticated, true);
    assert.equal(c.roleOk, false, 'the effective role builder must not satisfy runtime');
    assert.ok(c.detail.includes('凭据有效角色是 builder'), c.detail);
  } finally {
    await close(a.server);
  }
});
