// M2-10 regression: `ship pair --ca-file` pins a CA with the credential; the
// SHARED transport then trusts the same entry in doctor/init/business calls.
// Real local HTTPS reverse proxy (self-signed CA, SAN 127.0.0.1) fronts a real
// agent; TLS verification is never disabled anywhere in this test.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createHttpsServer } from 'node:https';
import { request as httpRequest } from 'node:http';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startAgent, type AgentHandle } from '../agent/server.js';
import { SecurityStore } from '../agent/security.js';
import { cmdPair } from '../cli/cmd-pair.js';
import { cmdDoctor } from '../cli/cmd-doctor.js';
import { api, ApiError } from './http.js';

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'e2e', 'fixtures', 'tls');
const CA_A = path.join(FIXTURES, 'ca-a.pem');
const CA_B = path.join(FIXTURES, 'ca-b.pem');
const SERVER_CERT = path.join(FIXTURES, 'server.pem');
const SERVER_KEY = path.join(FIXTURES, 'server.key');

const realHome = process.env.HOME;
test.afterEach(() => { process.env.HOME = realHome; });

test('M2-10: pair --ca-file → doctor → business calls all trust the pinned CA; wrong CA is refused', async () => {
  const workRoot = await mkdtemp(path.join(tmpdir(), 'ship-ca-'));
  const home = await mkdtemp(path.join(tmpdir(), 'ship-ca-home-'));
  process.env.HOME = home;
  const project = await mkdtemp(path.join(tmpdir(), 'ship-ca-project-'));

  const agent: AgentHandle = await startAgent({ role: 'both', token: 'CA_MASTER', port: 0, host: '127.0.0.1', workRoot });
  const proxy = createHttpsServer(
    { key: await readFile(SERVER_KEY), cert: await readFile(SERVER_CERT) },
    (req, res) => {
      const upstream = httpRequest(`${agent.url}${req.url}`, { method: req.method, headers: req.headers }, (r) => {
        res.writeHead(r.statusCode ?? 502, r.headers);
        r.pipe(res);
      });
      upstream.on('error', () => { res.writeHead(502); res.end(); });
      req.pipe(upstream);
    },
  );
  await new Promise<void>((r) => proxy.listen(0, '127.0.0.1', r));
  const url = `https://127.0.0.1:${(proxy.address() as { port: number }).port}`;
  try {
    // without any pinned CA the certificate is (correctly) NOT trusted
    await assert.rejects(
      () => api(url, 'CA_MASTER', 'GET', '/api/status'),
      (e: unknown) => e instanceof ApiError && e.status === 0,
    );
    // a WRONG pinned CA must also fail — verification is never skipped
    await assert.rejects(
      () => api(url, 'CA_MASTER', 'GET', '/api/status', undefined, 8000, { caFile: CA_B }),
      (e: unknown) => e instanceof ApiError && e.status === 0,
    );

    // pair through the proxy with the trusted CA (both roles, like a real project)
    const store = new SecurityStore(path.join(workRoot, 'security.json'));
    await store.load();
    const { code: builderCode } = await store.createCode('builder', 15);
    assert.equal(await cmdPair([url, '--name', 'builder', '--code', builderCode, '--ca-file', CA_A, '--json']), 0);
    const { code: runtimeCode } = await store.createCode('runtime', 15);
    assert.equal(await cmdPair([url, '--name', 'staging', '--code', runtimeCode, '--ca-file', CA_A, '--json']), 0);

    // doctor: tokenRef + pinned CA → the same entry must now be fully trusted
    const status = await api<{ auth?: { role: string } }>(url, 'CA_MASTER', 'GET', '/api/status', undefined, 8000, { caFile: CA_A });
    assert.equal(status.auth?.role, 'both');
    await writeFile(path.join(project, 'ship.config.json'), JSON.stringify({
      builder: { mode: 'static', static: { url, tokenRef: 'builder' } },
      registry: { url: '127.0.0.1:5001', namespace: 'caudit' },
      runtime: { targets: { staging: { url, tokenRef: 'staging' } } },
    }, null, 2));
    const doctorRc = await cmdDoctor(['--config', path.join(project, 'ship.config.json'), '--json']);
    assert.equal(doctorRc, 0, 'doctor must pass end-to-end through the CA-pinned entry');

    // the credential entry carries the CA path so future calls find it
    const stored = JSON.parse(await readFile(path.join(home, '.ship', 'credentials.json'), 'utf8')) as { builder: { caFile: string } };
    assert.equal(stored.builder.caFile, CA_A);
  } finally {
    proxy.closeAllConnections();
    await new Promise<void>((r) => proxy.close(() => r()));
    await agent.close();
    await rm(home, { recursive: true, force: true }).catch(() => {});
    await rm(project, { recursive: true, force: true }).catch(() => {});
  }
});

// ---- M2-R3: a CA pinned by RELATIVE path must not depend on later cwds ----

test('M2-R3: pair with a relative --ca-file stores an absolute reference usable from any cwd', async () => {
  const { copyFile, mkdir } = await import('node:fs/promises');
  const workRoot = await mkdtemp(path.join(tmpdir(), 'ship-ca3-'));
  const home = await mkdtemp(path.join(tmpdir(), 'ship-ca3-home-'));
  const dirA = await mkdtemp(path.join(tmpdir(), 'ship-ca3-a-'));
  const dirB = await mkdtemp(path.join(tmpdir(), 'ship-ca3-b-'));
  const project = await mkdtemp(path.join(tmpdir(), 'ship-ca3-proj-'));
  const prevCwd = process.cwd();
  const prevHome = process.env.HOME;
  process.env.HOME = home;
  const agent: AgentHandle = await startAgent({ role: 'both', token: 'CA3_MASTER', port: 0, host: '127.0.0.1', workRoot });
  const proxy = createHttpsServer(
    { key: await readFile(SERVER_KEY), cert: await readFile(SERVER_CERT) },
    (req, res) => {
      const upstream = httpRequest(`${agent.url}${req.url}`, { method: req.method, headers: req.headers }, (r) => {
        res.writeHead(r.statusCode ?? 502, r.headers);
        r.pipe(res);
      });
      upstream.on('error', () => { res.writeHead(502); res.end(); });
      req.pipe(upstream);
    },
  );
  await new Promise<void>((r) => proxy.listen(0, '127.0.0.1', r));
  const url = `https://127.0.0.1:${(proxy.address() as { port: number }).port}`;
  try {
    // 1. pair from dirA with a RELATIVE ca path
    await copyFile(CA_A, path.join(dirA, 'ca-a.pem'));
    const store = new SecurityStore(path.join(workRoot, 'security.json'));
    await store.load();
    const { code: builderCode } = await store.createCode('builder', 15);
    const { code: runtimeCode } = await store.createCode('runtime', 15);
    process.chdir(dirA);
    assert.equal(await cmdPair([url, '--name', 'builder', '--code', builderCode, '--ca-file', './ca-a.pem', '--json']), 0);
    assert.equal(await cmdPair([url, '--name', 'staging', '--code', runtimeCode, '--ca-file', 'ca-a.pem', '--json']), 0);
    const stored = JSON.parse(await readFile(path.join(home, '.ship', 'credentials.json'), 'utf8')) as Record<string, { caFile: string }>;
    assert.ok(path.isAbsolute(stored.builder!.caFile), `stored reference must be absolute, got '${stored.builder!.caFile}'`);
    // macOS tmp is symlinked (/tmp → /private/tmp): compare against the real path
    const { realpath } = await import('node:fs/promises');
    assert.equal(stored.builder!.caFile, await realpath(path.join(dirA, 'ca-a.pem')));

    // 2. from dirB (no ca-a.pem there): doctor, business call and init all work
    process.chdir(dirB);
    const cfgPath = path.join(project, 'ship.config.json');
    await writeFile(cfgPath, JSON.stringify({
      builder: { mode: 'static', static: { url, tokenRef: 'builder' } },
      registry: { url: '127.0.0.1:5001', namespace: 'caudit' },
      runtime: { targets: { staging: { url, tokenRef: 'staging' } } },
    }, null, 2));
    assert.equal(await cmdDoctor(['--config', cfgPath, '--json']), 0, 'doctor must work from another cwd');
    const status = await api<{ auth?: { role: string } }>(url, 'CA3_MASTER', 'GET', '/api/status', undefined, 8000, { caFile: stored.builder!.caFile });
    assert.equal(status.auth?.role, 'both', 'business calls use the pinned absolute CA');
    // init rerun (non-interactive) — its live checks reuse the credential's CA
    const { runWizard } = await import('../cli/init/wizard.js');
    const { createPrompter } = await import('../cli/init/prompt.js');
    await writeFile(path.join(project, 'Dockerfile'), 'FROM scratch\nEXPOSE 3000\n');
    await writeFile(path.join(project, 'ship.yaml'), 'name: ca-audit\nports:\n  - 3000:3000\n');
    const initResult = await runWizard({ cwd: project, prompter: createPrompter(false), log: { info() {}, warn() {}, error() {} } });
    assert.equal(initResult.ok, true, `init rerun succeeds from a different cwd: ${JSON.stringify(initResult).slice(0, 300)}`);

    // 3. dirB now contains a DIFFERENT file with the same name — it must NOT be trusted
    await copyFile(CA_B, path.join(dirB, 'ca-a.pem'));
    assert.equal(await cmdDoctor(['--config', cfgPath, '--json']), 0, 'the pinned absolute CA keeps winning over a same-name file in cwd');

    // 4. removing the ORIGINAL CA fails loudly, naming the absolute reference
    await rm(path.join(dirA, 'ca-a.pem'));
    const doctorRc = await cmdDoctor(['--config', cfgPath, '--json']);
    assert.equal(doctorRc, 1, 'entry is unusable when the pinned CA file is gone');
    process.chdir(prevCwd); // doctor prints via emitter to stdout; capture separately below

    // 5. a HISTORICAL relative record gets accurate guidance, never a cwd guess
    await copyFile(CA_A, path.join(dirA, 'ca-a.pem'));
    await writeFile(path.join(home, '.ship', 'credentials.json'), JSON.stringify({
      builder: { url, token: 'x', role: 'builder', caFile: 'ca-a.pem' },
    }));
    const { resolveTargetToken } = await import('./credentials.js');
    const { ConfigError } = await import('./config.js');
    await assert.rejects(
      () => resolveTargetToken({ url, tokenRef: 'builder' }),
      (e: unknown) => e instanceof ConfigError && /相对路径/.test(e.message) && /--ca-file \/绝对/.test(e.message) && /同名/.test(e.message),
    );
    // and the transport layer refuses relative CAs the same way (no cwd guessing)
    const { TransportError, requestBuffered } = await import('./http-transport.js');
    await assert.rejects(
      () => requestBuffered(url, { caFile: 'ca-a.pem', timeoutMs: 3000 }),
      (e: unknown) => e instanceof TransportError && /相对路径/.test(e.message),
    );
  } finally {
    process.chdir(prevCwd);
    if (prevHome === undefined) delete process.env.HOME; else process.env.HOME = prevHome;
    proxy.closeAllConnections();
    await new Promise<void>((r) => proxy.close(() => r()));
    await agent.close();
    await rm(home, { recursive: true, force: true }).catch(() => {});
    await rm(project, { recursive: true, force: true }).catch(() => {});
    await rm(dirA, { recursive: true, force: true }).catch(() => {});
    await rm(dirB, { recursive: true, force: true }).catch(() => {});
  }
});

test('M2-R3: a hostname the certificate does not cover is rejected even with the right CA', async () => {
  const workRoot = await mkdtemp(path.join(tmpdir(), 'ship-ca4-'));
  const agent: AgentHandle = await startAgent({ role: 'both', token: 'CA4_MASTER', port: 0, host: '127.0.0.1', workRoot });
  const proxy = createHttpsServer(
    { key: await readFile(SERVER_KEY), cert: await readFile(SERVER_CERT) }, // SAN: IP:127.0.0.1, DNS:localhost
    (req, res) => {
      const upstream = httpRequest(`${agent.url}${req.url}`, { method: req.method, headers: req.headers }, (r) => {
        res.writeHead(r.statusCode ?? 502, r.headers);
        r.pipe(res);
      });
      upstream.on('error', () => { res.writeHead(502); res.end(); });
      req.pipe(upstream);
    },
  );
  // ::1 is NOT in the SAN set (only IP:127.0.0.1 and DNS:localhost) —
  // verification must fail on hostname, never be bypassed by the pinned CA
  const bound = await new Promise<boolean>((resolve) => {
    proxy.once('error', () => resolve(false));
    proxy.listen(0, '::1', () => resolve(true));
  });
  if (!bound) {
    console.log('skip: cannot bind ::1 on this host');
    await agent.close();
    return;
  }
  const url = `https://[::1]:${(proxy.address() as { port: number }).port}`;
  try {
    await assert.rejects(
      () => api(url, 'CA4_MASTER', 'GET', '/api/status', undefined, 8000, { caFile: CA_A }),
      (e: unknown) => e instanceof ApiError && e.status === 0,
    );
  } finally {
    proxy.closeAllConnections();
    await new Promise<void>((r) => proxy.close(() => r()));
    await agent.close();
  }
});
