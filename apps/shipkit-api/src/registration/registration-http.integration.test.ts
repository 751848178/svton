import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { privateFree, registrationHttpFixture, responseBody } from './registration-http.fixture.js';

test('full Nest HTTP consumes a real enrollment, persists sessions/heartbeats and keeps configured inventory separate', async () => {
  const h = await registrationHttpFixture();
  try {
    const a = await h.enroll();
    const recovered = await responseBody(await h.machine('/api/agent-registration/enroll', a.issued.code, a.consume), 201);
    assert.deepEqual(recovered, a.receipt); assert.equal(await h.db.agent.count(), 1);
    const opened = await responseBody(await h.machine('/api/agent-registration/session', a.credential, a.request), 201);
    h.advance(15000); const heartbeat = { ...a.request, epoch: opened.epoch, sequence: 1 };
    const receipt = await responseBody(await h.machine('/api/agent-registration/heartbeat', a.credential, heartbeat), 201);
    h.advance(15000); assert.deepEqual(await responseBody(await h.machine('/api/agent-registration/heartbeat', a.credential, heartbeat), 201), receipt);
    const rows = await responseBody(await h.human('/api/registered-agents'), 200); assert.equal(rows.length, 1);
    assert.equal(rows[0].presence, 'online'); assert.equal(rows[0].approvedRole, 'runtime'); assert.equal(rows[0].reportedRole, 'both');
    assert.deepEqual(rows[0].effectiveRoles, ['runtime']); assert.equal(rows[0].roleReady, true);
    assert.equal(rows[0].source, 'registration-center'); assert.equal(rows[0].purpose, '运行时机器');
    assert.equal(rows[0].transportReady, false); assert.equal(rows[0].executionReady, false);
    assert(rows[0].readinessReasons.includes('registration-transport-not-connected'));
    assert.deepEqual(await responseBody(await h.human('/api/agents'), 200), { items: [], dynamicBuilders: [], issues: [] });
    const audits = await h.db.audit.findMany({ where: { action: { startsWith: 'agent.' } } });
    privateFree([a.receipt, recovered, opened, receipt, rows, audits], a.credential, a.issued.code);
    const cache = await h.human('/api/registered-agents'); assert.equal(cache.headers.get('cache-control'), 'no-store');
  } finally { await h.close(); }
});

test('machine ingress defaults closed while the existing user session and localhost read paths retain their behavior', async () => {
  const h = await registrationHttpFixture('disabled');
  try {
    assert.equal((await h.human('/api/auth/session')).status, 200);
    assert.equal((await h.human('/api/projects')).status, 200);
    assert.equal((await h.send('/api/projects')).status, 401); assert.equal((await h.send('/api/health')).status, 200);
    const issue = await responseBody(await h.human('/api/registered-agents/enrollments',
      { v: 1, name: 'Pending', approvedRole: 'runtime', resourceKind: 'persistent' }), 201);
    assert.equal((await h.machine('/api/agent-registration/enroll', issue.code, {})).status, 503);
    assert.equal(await h.db.agent.count(), 0);
  } finally { await h.close(); }
});

test('human cookies cannot enter machine handlers and machine bearers cannot enter user or legacy resource handlers', async () => {
  const h = await registrationHttpFixture();
  try {
    const a = await h.enroll();
    assert.equal((await h.human('/api/agent-registration/session', a.request)).status, 403);
    assert.equal((await h.machine('/api/agent-registration/session', a.credential, a.request, { cookie: h.cookie })).status, 403);
    assert.equal((await h.machine('/api/agent-registration/session', a.issued.code, a.request)).status, 401);
    assert.equal((await h.machine('/api/agent-registration/enroll', a.credential, a.consume)).status, 401);
    assert.equal((await h.send('/api/registered-agents', { headers: { authorization: `Bearer ${a.credential}` } })).status, 401);
    assert.equal((await h.machine(`/api/registered-agents/${a.receipt.agentId}/disable`, a.credential,
      { v: 1, expectedTrustRevision: 1, disabled: true }, { 'x-shipkit-local': '1' })).status, 401);
    assert.equal((await h.send('/api/agents', { headers: { authorization: `Bearer ${a.credential}` } })).status, 401);
    assert.equal((await h.send('/api/agent-registration/session')).status, 404);
    assert.equal((await h.machine('/api/agent-registration/unknown', a.credential, {}, { 'x-shipkit-local': '1' })).status, 404);
    assert.equal((await h.machine('/api/agent-registration/session', a.credential, { ...a.request, approvedRole: 'both' })).status, 400);
    assert.equal(await h.db.agentSession.count(), 0);
  } finally { await h.close(); }
});

test('strict human control DTOs reject missing revisions, fields, wrong UUIDs and client-supplied workspace', async () => {
  const h = await registrationHttpFixture();
  try {
    const a = await h.enroll(), root = `/api/registered-agents/${a.receipt.agentId}`;
    for (const body of [{ v: 1, disabled: true }, { v: 1, expectedTrustRevision: 0, disabled: true },
      { v: 1, expectedTrustRevision: 1, disabled: 'true' }, { v: 1, expectedTrustRevision: 1, disabled: true, workspaceId: 'other' }]) {
      assert.equal((await h.human(`${root}/disable`, body)).status, 400);
    }
    assert.equal((await h.human('/api/registered-agents/not-a-uuid/revoke', { v: 1, expectedTrustRevision: 1 })).status, 400);
    assert.equal((await h.human(`/api/registered-agents/${randomUUID()}/revoke`, { v: 1, expectedTrustRevision: 1 })).status, 404);
    assert.equal((await h.human('/api/registered-agents/enrollments',
      { v: 1, name: 'No temporary', approvedRole: 'builder', resourceKind: 'temporary' })).status, 400);
    assert.equal((await h.db.agent.findUniqueOrThrow({ where: { id: a.receipt.agentId } })).trustRevision, 1);
    assert.equal((await h.send(`${root}/revoke`, h.json({ v: 1, expectedTrustRevision: 1 }, { cookie: h.cookie }))).status, 403);
  } finally { await h.close(); }
});
