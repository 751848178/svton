import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import test from 'node:test';
import { gatewayProductionFixture } from './agent-registration-production.fixture';

test('real TLS edge -> standard production Next routes -> compiled Nest/SQLite closed machine gateway', { timeout: 240000 }, async t => {
  const h = await gatewayProductionFixture({ tlsHostname: 'localhost' });
  const checks: string[] = []; let cookie: string, issued: Record<string, any>, receipt: Record<string, any>, opened: Record<string, any>;
  const credential = `ska_machine_${randomBytes(32).toString('base64url')}`;
  const incarnation = randomUUID(), bootId = randomUUID(), metadata = { version: '0.0.1', docker: true, capabilities: ['runtime'] };
  let consume: Record<string, any>;
  const machine = (phase: string, token: string, body: unknown, headers: Record<string, string> = {}, method = 'POST') =>
    h.tls.send(`/api/agent-registration/${phase}`, body, { authorization: `Bearer ${token}`, ...headers }, method);
  try {
    await t.test('TLS verifies generated fixture CA, while untrusted TLS never reaches Next', async () => {
      const healthy = await h.tls.send('/api/health', {}, {}, 'GET');
      assert.equal(healthy.status, 200); assert(healthy.tlsAuthorized);
      const before = h.tls.counters.forwarded;
      await assert.rejects(h.tls.send('/api/health', {}, {}, 'GET', false));
      assert.equal(h.tls.counters.forwarded, before); checks.push('real TLS certificate verified; untrusted CA rejected');
    });
    await t.test('human login/cookie/session through unchanged actual Next rewrite receives no machine proof', async () => {
      const login = await h.tls.send('/api/auth/login', { username: h.ready.username, password: h.ready.password },
        { 'x-shipkit-local': '1', origin: h.tls.origin });
      assert.equal(login.status, 200); assert(login.cookie); assert(login.secureCookie); cookie = login.cookie!;
      assert.equal((await h.tls.send('/api/auth/session', {}, { cookie }, 'GET')).status, 200);
      assert.equal((await h.tls.send('/api/projects', {}, {}, 'GET')).status, 401);
      const seen = (await h.snapshot()).observed.filter((row: any) => row.path.startsWith('/api/auth/'));
      assert(seen.length >= 2 && seen.every((row: any) => !row.ingress && !row.edge));
      checks.push('human HTTPS secure login/session unchanged; anonymous human 401; no proof injection');
    });
    await t.test('human issue creates one persistent code, with no machine identity before consume', async () => {
      const issue = await h.tls.send('/api/registered-agents/enrollments',
        { v: 1, name: 'Gateway isolated machine', approvedRole: 'runtime', resourceKind: 'persistent' },
        { cookie, origin: h.tls.origin, 'x-shipkit-local': '1' });
      assert.equal(issue.status, 201); issued = issue.body;
      consume = { v: 1, enrollmentId: issued.enrollmentId, attemptId: randomUUID(), incarnation,
        machineCredential: credential, reportedRole: 'runtime', metadata };
      const state = await h.snapshot(); assert.equal(state.counts.enrollments, 1); assert.equal(state.counts.agents, 0);
      checks.push('actual human issue transaction; persistent code remains unconsumed until trusted gateway');
    });
    await t.test('actual Next exact route blocks direct forged HTTPS or client API proof before Nest', async () => {
      const initial = (await h.snapshot()).counts;
      const common = { host: new URL(h.tls.origin).host, 'content-type': 'application/json', authorization: `Bearer ${issued.code}`,
        'x-forwarded-proto': 'https', 'x-forwarded-host': new URL(h.tls.origin).host, 'x-forwarded-port': new URL(h.tls.origin).port };
      const extras: Record<string, string>[] = [{}, { 'x-shipkit-agent-edge': h.proofs.api }, { 'x-shipkit-agent-ingress': h.proofs.api },
        { 'x-shipkit-agent-edge': h.proofs.edge, 'x-forwarded-proto': 'http' },
        { 'x-shipkit-agent-edge': h.proofs.edge, 'x-forwarded-prefix': '/' }];
      for (const extra of extras) {
        const response = await fetch(`http://127.0.0.1:${h.nextPort}/api/agent-registration/enroll`,
          { method: 'POST', headers: { ...common, ...extra }, body: JSON.stringify(consume), redirect: 'manual' });
        assert.equal(response.status, 403);
      }
      assert.deepEqual((await h.snapshot()).counts, initial);
      checks.push('actual App Routes win over generic API rewrite; missing/wrong edge proof, forged forwarded or API proof denied');
    });
    await t.test('trusted TLS edge rejects raw duplicates and client proof/cookie/forwarded before proof injection', async () => {
      const initial = (await h.snapshot()).counts, before = h.tls.counters.rawRejected;
      const base = ['Host', new URL(h.tls.origin).host, 'Content-Type', 'application/json', 'Authorization', `Bearer ${issued.code}`];
      for (const extra of [['Authorization', `Bearer ${issued.code}`], ['Host', new URL(h.tls.origin).host],
        ['Content-Type', 'application/json'], ['X-Forwarded-Proto', 'https'], ['X-Shipkit-Agent-Ingress', h.proofs.api],
        ['X-Shipkit-Agent-Edge', h.proofs.edge], ['Cookie', cookie], ['Forwarded', 'proto=https']]) {
        const response = await h.tls.send('/api/agent-registration/enroll', consume, {}, 'POST', true, [...base, ...extra]);
        assert.equal(response.status, 403);
      }
      assert.equal(h.tls.counters.rawRejected - before, 8); assert.deepEqual((await h.snapshot()).counts, initial);
      checks.push('raw duplicate authorization/host/content-type rejected at trusted TLS edge; client private/forwarded/cookie denied');
    });
    await t.test('wrong verb/path and streamed byte budget cannot consume a code', async () => {
      const initial = (await h.snapshot()).counts;
      assert.equal((await machine('enroll', issued.code, {}, {}, 'GET')).status, 405);
      for (const suffix of ['enroll?unsafe=1', 'enroll-child']) assert((await machine(suffix, issued.code, consume)).status >= 400);
      assert.equal((await machine('enroll', issued.code, { padding: 'x'.repeat(8192) })).status, 413);
      assert.deepEqual((await h.snapshot()).counts, initial); checks.push('exact verb/path admission; 8KiB body budget enforced before DB');
    });
    await t.test('real consume and exact lost-response recovery preserve one machine identity', async () => {
      const first = await machine('enroll', issued.code, consume); assert.equal(first.status, 201); receipt = first.body;
      const replay = await machine('enroll', issued.code, consume); assert.equal(replay.status, 201); assert.deepEqual(replay.body, receipt);
      const state = await h.snapshot(); assert.equal(state.counts.agents, 1); assert.equal(state.counts.sessions, 0);
      const encoded = JSON.stringify(receipt);
      for (const secret of [credential, issued.code, h.proofs.edge, h.proofs.api]) assert(!encoded.includes(secret));
      assert(!/Hash|actorId|workspaceId|machineContext/.test(encoded));
      checks.push('actual Prisma consume/recovery produces one secret-free machine identity');
    });
    await t.test('real session and heartbeat plus exact heartbeat replay traverse distinct proof hop', async () => {
      const status = { reportedRole: 'runtime', ...metadata };
      const request = { v: 1, agentId: receipt.agentId, incarnation, bootId, status };
      const session = await machine('session', credential, request); assert.equal(session.status, 201); opened = session.body;
      const heartbeat = { ...request, epoch: opened.epoch, sequence: 1 };
      const first = await machine('heartbeat', credential, heartbeat); assert.equal(first.status, 201);
      const replay = await machine('heartbeat', credential, heartbeat); assert.equal(replay.status, 201); assert.deepEqual(replay.body, first.body);
      const seen = (await h.snapshot()).observed.filter((row: any) => /^\/api\/agent-registration\/(enroll|session|heartbeat)$/.test(row.path));
      assert(seen.length >= 5 && seen.every((row: any) => row.ingress && !row.edge && /^127\.0\.0\.1:\d+$/.test(row.host)));
      checks.push('actual SQLite session/heartbeat/replay; API sees loopback Host/API proof and never edge proof');
    });
    await t.test('human cookie cannot use machine methods; machine bearer cannot use human API', async () => {
      const initial = (await h.snapshot()).counts;
      assert.equal((await machine('session', credential, {}, { cookie })).status, 403);
      assert.equal((await h.tls.send('/api/projects', {}, { authorization: `Bearer ${credential}` }, 'GET')).status, 401);
      assert.deepEqual((await h.snapshot()).counts, initial); checks.push('human/machine identity rejection in both directions');
    });
    await t.test('standard Next restart with default-disabled gateway preserves human routes and denies machine', async () => {
      await h.launch(false);
      assert.equal((await machine('session', credential, {})).status, 503);
      assert.equal((await h.tls.send('/api/auth/session', {}, { cookie }, 'GET')).status, 200);
      checks.push('runtime gateway disablement with unchanged standard next start keeps human session active');
    });
    await h.proof({ node: process.version, actualNext: '15.5.27 standard build/start, copied unmodified next.config',
      actualApi: 'compiled CJS AppModule and isolated migrated Prisma SQLite', checks,
      counts: (await h.snapshot()).counts, limits: { bodyBytes: 8192, responseBytes: 16384, deadlineMs: 5000 },
      boundary: 'Trusted TLS edge rejects raw duplicates before proof injection. Standard Next loses some raw duplicates; valid-proof direct upstream trust breach is not observable by App Routes. No production machine enablement/NPM changes/boot proof.' });
  } finally { await h.close(); }
});
