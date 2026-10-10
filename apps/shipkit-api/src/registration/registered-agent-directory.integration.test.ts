import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { privateFree, registrationHttpFixture, responseBody } from './registration-http.fixture.js';
import { registeredAgentSelect } from './registered-agent.select.js';

test('directory presence uses Server receipt time, suspect/lease thresholds and clock/revision fences independently of roles', async () => {
  const h = await registrationHttpFixture();
  try {
    const a = await h.enroll(), row = async () => (await responseBody(await h.human('/api/registered-agents'), 200))[0];
    assert.equal((await row()).presence, 'registered');
    await responseBody(await h.machine('/api/agent-registration/session', a.credential, a.request), 201);
    h.advance(44999); assert.equal((await row()).presence, 'online');
    h.advance(1); assert.equal((await row()).presence, 'suspect');
    h.advance(45000); assert.equal((await row()).presence, 'offline');
    h.advance(-90001); let view = await row(); assert.equal(view.presence, 'offline'); assert(view.readinessReasons.includes('server-clock-invalid'));
    h.advance(1); await h.db.agent.update({ where: { id: a.receipt.agentId }, data: { trustRevision: 2 } });
    view = await row(); assert.equal(view.presence, 'offline'); assert(view.readinessReasons.includes('session-fenced'));
    assert.equal(view.transportReady, false); assert.equal(view.executionReady, false);
  } finally { await h.close(); }
});

test('effective roles are approved/report/capability intersections requiring Docker and cannot grant a larger role', async () => {
  const h = await registrationHttpFixture();
  try {
    const a = await h.enroll('runtime'), opened = await responseBody(await h.machine('/api/agent-registration/session', a.credential, a.request), 201);
    const update = async (sequence: number, status: unknown) => {
      await responseBody(await h.machine('/api/agent-registration/heartbeat', a.credential,
        { ...a.request, epoch: opened.epoch, sequence, status }), 201);
      return (await responseBody(await h.human('/api/registered-agents'), 200))[0];
    };
    let view = await update(1, { ...a.request.status, reportedRole: 'builder' });
    assert.deepEqual(view.effectiveRoles, []); assert.equal(view.roleReady, false); assert.equal(view.presence, 'online');
    view = await update(2, { ...a.request.status, capabilities: ['builder'] }); assert.deepEqual(view.effectiveRoles, []);
    view = await update(3, { ...a.request.status, docker: false }); assert.deepEqual(view.effectiveRoles, []);
    view = await update(4, a.request.status); assert.deepEqual(view.effectiveRoles, ['runtime']); assert.equal(view.roleReady, true);
    await h.db.agentSession.update({ where: { agentId: a.receipt.agentId }, data: { capabilitiesJson: '["unsafe metadata!"]' } });
    view = (await responseBody(await h.human('/api/registered-agents'), 200))[0];
    assert.equal(view.roleReady, false); assert.deepEqual(view.capabilities, []); assert(view.readinessReasons.includes('reported-metadata-invalid'));
    privateFree([view, registeredAgentSelect], a.credential, a.issued.code);
  } finally { await h.close(); }
});

test('workspace-filtered safe projection never lists or controls another workspace and never selects internal proof fields', async () => {
  const h = await registrationHttpFixture();
  try {
    const a = await h.enroll(), foreignId = randomUUID(), actorId = randomUUID();
    const { generateMachineSecret, hashMachineSecret } = await import('shipkit/platform');
    await h.db.workspace.create({ data: { id: 'foreign', name: 'Another workspace' } });
    await h.db.actor.create({ data: { id: actorId, kind: 'machine', name: 'Foreign machine' } });
    await h.db.agent.create({ data: { id: foreignId, actorId, name: 'Foreign machine', workspaceId: 'foreign',
      incarnation: randomUUID(), resourceKind: 'persistent', approvedRole: 'builder', credentialHash: hashMachineSecret(generateMachineSecret()) } });
    const rows = await responseBody(await h.human('/api/registered-agents'), 200);
    assert.deepEqual(rows.map((value: { id: string }) => value.id), [a.receipt.agentId]);
    assert.equal((await h.human(`/api/registered-agents/${foreignId}/revoke`, { v: 1, expectedTrustRevision: 1 })).status, 404);
    privateFree([registeredAgentSelect, rows], a.credential, a.issued.code);
    await h.db.actor.update({ where: { id: h.user.id }, data: { disabled: true } });
    assert.equal((await h.human('/api/registered-agents')).status, 401);
  } finally { await h.close(); }
});
