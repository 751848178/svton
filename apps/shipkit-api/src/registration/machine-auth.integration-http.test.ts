import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { machineHttpFixture, MachineFixtureController } from './machine-auth.integration-http.fixture.js';
import { MACHINE_HANDLER_METADATA } from './machine-handler.js';
import { machineProofFixture, machineSettings } from './machine-ingress.fixture.js';
import { MACHINE_INGRESS_PROOF_HEADER } from './machine-ingress.settings.js';

const route = '/api/agent-registration/session';
test('real Nest default disabled and local machine-vs-human isolation preserve the original human guard', async () => {
  let h = await machineHttpFixture(machineSettings());
  try { assert.equal((await h.send(route, { Authorization: `Bearer ${h.machineSecret}` })).status, 503); }
  finally { await h.close(); }
  h = await machineHttpFixture(machineSettings('local-development'));
  try {
    const auth = { Authorization: `Bearer ${h.machineSecret}` };
    const accepted = await h.send(route, auth); assert.equal(accepted.status, 201);
    const body = await accepted.text(); assert(body.includes(h.agent.id));
    for (const secret of [h.machineSecret, h.enrollmentSecret, h.agent.credentialHash, h.enrollment.tokenHash]) assert(!body.includes(secret));
    assert.equal((await h.send('/api/agent-registration/heartbeat', auth)).status, 201);
    assert.equal((await h.send('/api/agent-registration/enroll', { Authorization: `Bearer ${h.enrollmentSecret}` })).status, 201);
    assert.equal((await h.send(route, { Cookie: h.cookie })).status, 403);
    assert.equal((await h.send(route, { ...auth, Cookie: h.cookie })).status, 403);
    assert.equal((await h.send('/api/machine-auth-fixture-human', auth, 'GET')).status, 401);
    assert.equal((await h.send('/api/machine-auth-fixture-human', { Cookie: h.cookie }, 'GET')).status, 200);
    assert.equal((await h.send('/api/machine-auth-fixture-human', { Cookie: h.cookie })).status, 403);
    assert.equal((await h.send('/api/machine-auth-fixture-human', { Cookie: h.cookie, 'x-shipkit-local': '1' })).status, 201);
    assert.equal((await h.send('/api/machine-auth-fixture-human', { Cookie: h.cookie, 'x-shipkit-local': '1', Origin: 'https://evil.example' })).status, 403);
    assert.equal((await h.send('/api/agent-registration/sibling', auth)).status, 403);
    assert.equal((await h.send('/api/agent-registration/class-only', auth)).status, 403);
    assert.equal((await h.send('/api/agent-registration/class-only', { Cookie: h.cookie, 'x-shipkit-local': '1' })).status, 201);
    assert.equal((await h.send(route, auth, 'GET')).status, 403);
    assert.equal((await h.send('/api/agent-registration/wrong-path', auth)).status, 403);
    assert.equal(await h.db.agentSession.count(), 0, 'fixture auth handlers must not pretend to open a session');
  } finally { await h.close(); }
});

test('real HTTP raw duplicates and malformed method capability metadata never reach machine fixture handlers', async () => {
  const h = await machineHttpFixture(machineSettings('local-development'));
  const handler = MachineFixtureController.prototype.session;
  const original = Reflect.getOwnMetadata(MACHINE_HANDLER_METADATA, handler);
  try {
    for (const metadata of [{ capability: 'jobs.deploy', authMode: 'machine' }, { capability: 'session.open', authMode: 'enrollment' },
      { capability: 'session.open', authMode: 'machine', extra: true }, null, []]) {
      Reflect.defineMetadata(MACHINE_HANDLER_METADATA, metadata, handler);
      assert.equal((await h.send(route, { Authorization: `Bearer ${h.machineSecret}` })).status, 403);
    }
    Reflect.defineMetadata(MACHINE_HANDLER_METADATA, original, handler);
    for (const headers of [['Authorization', `Bearer ${h.machineSecret}`, 'authorization', `Bearer ${h.machineSecret}`],
      ['Authorization', `Bearer ${h.machineSecret}`, 'Cookie', h.cookie], ['Authorization', `Bearer ${h.machineSecret}`, 'Forwarded', 'proto=https']]) {
      const response = await h.raw(headers); assert.equal(response.status, 403);
      assert(!response.text.includes(h.machineSecret)); assert(!response.text.includes(h.agent.credentialHash));
    }
  } finally { Reflect.defineMetadata(MACHINE_HANDLER_METADATA, original, handler); await h.close(); }
});

test('real Nest proxy-mode auth rejects forwarded-only TLS and requires the safe proof plus machine bearer', async () => {
  const proof = await machineProofFixture(), h = await machineHttpFixture(proof.settings());
  try {
    const headers = { Authorization: `Bearer ${h.machineSecret}`, 'X-Forwarded-Proto': 'https',
      'X-Forwarded-Host': 'shipkit.example', 'X-Forwarded-Port': '443' };
    assert.equal((await h.send(route, headers)).status, 403);
    assert.equal((await h.send(route, { ...headers, [MACHINE_INGRESS_PROOF_HEADER]: proof.value })).status, 201);
    assert.equal((await h.send(route, { ...headers, [MACHINE_INGRESS_PROOF_HEADER]: proof.value, Cookie: h.cookie })).status, 403);
    assert.equal((await h.send(route, { ...headers, [MACHINE_INGRESS_PROOF_HEADER]: proof.value, Authorization: `Bearer ${h.enrollmentSecret}` })).status, 401);
    const duplicate = await h.raw(['Authorization', `Bearer ${h.machineSecret}`, MACHINE_INGRESS_PROOF_HEADER, proof.value,
      MACHINE_INGRESS_PROOF_HEADER, proof.value, 'X-Forwarded-Proto', 'https', 'X-Forwarded-Host', 'shipkit.example', 'X-Forwarded-Port', '443']);
    assert.equal(duplicate.status, 403);
    for (const secret of [proof.value, h.machineSecret, h.enrollmentSecret]) assert(!duplicate.text.includes(secret));
    const forwardedDuplicate = await h.raw(['Authorization', `Bearer ${h.machineSecret}`, MACHINE_INGRESS_PROOF_HEADER, proof.value,
      'X-Forwarded-Proto', 'https', 'x-forwarded-proto', 'https', 'X-Forwarded-Host', 'shipkit.example', 'X-Forwarded-Port', '443']);
    assert.equal(forwardedDuplicate.status, 403);
  } finally { await h.close(); await proof.close(); }
});
