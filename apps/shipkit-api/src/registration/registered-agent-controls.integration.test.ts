import assert from 'node:assert/strict';
import { test } from 'node:test';
import { privateFree, registrationHttpFixture, responseBody } from './registration-http.fixture.js';

test('human HTTP disable, enable, draining, candidate rotation and permanent revoke call the fresh transactional repositories', async () => {
  const h = await registrationHttpFixture();
  try {
    const a = await h.enroll(), root = `/api/registered-agents/${a.receipt.agentId}`;
    await responseBody(await h.machine('/api/agent-registration/session', a.credential, a.request), 201);
    const disabled = await responseBody(await h.human(`${root}/disable`, { v: 1, expectedTrustRevision: 1, disabled: true }), 201);
    assert.equal(disabled.disabled, true); assert.equal(disabled.trustRevision, 2);
    assert.equal((await h.machine('/api/agent-registration/session', a.credential, a.request)).status, 401);
    assert.equal((await responseBody(await h.human('/api/registered-agents'), 200))[0].presence, 'disabled');
    await responseBody(await h.human(`${root}/disable`, { v: 1, expectedTrustRevision: 2, disabled: false }), 201);
    const drained = await responseBody(await h.human(`${root}/draining`, { v: 1, expectedTrustRevision: 3, draining: true }), 201);
    assert.equal(drained.draining, true);
    const { generateMachineSecret } = await import('shipkit/platform'), candidate = generateMachineSecret();
    const rotateBody = { v: 1, expectedTrustRevision: 4, expectedCredentialRevision: 1, newCredential: candidate };
    const rotated = await responseBody(await h.human(`${root}/rotate`, rotateBody), 201);
    assert.deepEqual(await responseBody(await h.human(`${root}/rotate`, rotateBody), 201), rotated);
    assert.equal((await h.machine('/api/agent-registration/session', a.credential, a.request)).status, 401);
    const reopened = await responseBody(await h.machine('/api/agent-registration/session', candidate, a.request), 201);
    await responseBody(await h.machine('/api/agent-registration/heartbeat', candidate,
      { ...a.request, epoch: reopened.epoch, sequence: 1 }), 201);
    let rows = await responseBody(await h.human('/api/registered-agents'), 200); assert.equal(rows[0].presence, 'online');
    assert.equal(rows[0].draining, true); assert.equal(rows[0].executionReady, false);
    const revoked = await responseBody(await h.human(`${root}/revoke`, { v: 1, expectedTrustRevision: 5 }), 201);
    assert.equal(revoked.revoked, true);
    assert.equal((await h.machine('/api/agent-registration/session', candidate, a.request)).status, 401);
    assert.equal((await h.human(`${root}/disable`, { v: 1, expectedTrustRevision: 6, disabled: false })).status, 409);
    rows = await responseBody(await h.human('/api/registered-agents'), 200); assert.equal(rows[0].presence, 'revoked');
    const audit = await h.db.audit.findMany({ where: { action: { startsWith: 'agent.' } } });
    privateFree([disabled, drained, rotated, revoked, rows, audit], a.credential, a.issued.code, candidate);
  } finally { await h.close(); }
});

test('human enrollment revoke blocks consumption and cannot accept unknown or cross-scope parameters', async () => {
  const h = await registrationHttpFixture();
  try {
    const issued = await responseBody(await h.human('/api/registered-agents/enrollments',
      { v: 1, name: 'Revoke before use', approvedRole: 'builder', resourceKind: 'persistent' }), 201);
    assert.equal((await h.human(`/api/registered-agents/enrollments/${issued.enrollmentId}/revoke`,
      { v: 1, workspaceId: 'foreign' })).status, 400);
    const revoked = await responseBody(await h.human(`/api/registered-agents/enrollments/${issued.enrollmentId}/revoke`, { v: 1 }), 201);
    assert.equal(revoked.revoked, true); assert.equal((await h.machine('/api/agent-registration/enroll', issued.code, {})).status, 401);
    assert.equal(await h.db.agent.count(), 0); privateFree(revoked, issued.code);
  } finally { await h.close(); }
});
