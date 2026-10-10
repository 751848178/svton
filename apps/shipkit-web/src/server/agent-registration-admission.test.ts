import assert from 'node:assert/strict';
import { chmod, link, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { admitAgentRegistration } from './agent-registration-admission';
import { agentGatewayFixture } from './agent-registration-base.fixture';
import { AgentGatewayFault } from './agent-registration-fault';
import { AgentRegistrationGatewaySettings } from './agent-registration-settings';

test('gateway remains disabled with no files, and invalid configuration fails closed', async () => {
  const settings = new AgentRegistrationGatewaySettings({});
  assert.equal(settings.enabled, false);
  assert.throws(() => admitAgentRegistration(new Request('https://shipkit.fixture'), 'session', settings),
    (error: unknown) => error instanceof AgentGatewayFault && error.code === 'AGENT_GATEWAY_DISABLED');
  for (const env of [{ SHIPKIT_AGENT_GATEWAY_MODE: 'local-development' }, { SHIPKIT_API_PORT: '0' }]) {
    assert.throws(() => new AgentRegistrationGatewaySettings(env), /网关配置不可用/);
  }
});

test('independent safe proof files and exact HTTPS origin are required; secrets never enumerate', async () => {
  const h = await agentGatewayFixture();
  try {
    const settings = h.settings();
    assert(!JSON.stringify(settings).includes(h.edge)); assert(!JSON.stringify(settings).includes(h.api));
    for (const origin of ['http://shipkit.fixture', 'https://shipkit.fixture/', 'https://u@shipkit.fixture', 'https://shipkit.fixture?x']) {
      assert.throws(() => h.settings({ SHIPKIT_AGENT_PUBLIC_ORIGIN: origin }), /网关配置不可用/);
    }
    assert.throws(() => h.settings({ SHIPKIT_AGENT_INGRESS_PROOF_FILE: h.edgeFile }), /网关配置不可用/);
    assert.throws(() => h.settings({ SHIPKIT_AGENT_EDGE_PROOF_FILE: 'relative' }), /网关配置不可用/);
    await chmod(h.edgeFile, 0o644); assert.throws(() => h.settings(), /网关配置不可用/); await chmod(h.edgeFile, 0o600);
    const alias = path.join(h.directory, 'link'); await symlink(h.edgeFile, alias);
    assert.throws(() => h.settings({ SHIPKIT_AGENT_EDGE_PROOF_FILE: alias }), /网关配置不可用/);
    await link(h.apiFile, path.join(h.directory, 'hardlink')); assert.throws(() => h.settings(), /网关配置不可用/);
  } finally { await h.close(); }
});

test('malformed, oversize and unsafe-parent proof files are rejected', async () => {
  const h = await agentGatewayFixture();
  try {
    for (const value of ['a'.repeat(43), h.edge + '\r\n', h.edge + '\nextra', '', h.edge.slice(0, 42)]) {
      await writeFile(h.edgeFile, value); assert.throws(() => h.settings(), /网关配置不可用/);
    }
    await writeFile(h.edgeFile, h.edge + '\n'); await chmod(h.directory, 0o755);
    assert.throws(() => h.settings(), /网关配置不可用/);
  } finally { await h.close(); }
});

test('proof alone does not attest HTTPS origin, method, exact route or bearer kind', async () => {
  const h = await agentGatewayFixture();
  try {
    assert.equal(admitAgentRegistration(h.request(), 'session', h.settings()), `Bearer ${h.machine}`);
    const bad: Record<string, string>[] = [
      { host: 'other.fixture' }, { 'x-forwarded-proto': 'http' }, { 'x-forwarded-host': 'other.fixture' },
      { 'x-forwarded-port': '8443' }, { 'x-forwarded-for': '127.0.0.1, 1.1.1.1' }, { origin: 'https://other.fixture' },
      { authorization: 'Bearer ska_machine_' + 'a'.repeat(43) }, { authorization: `Bearer ska_enroll_${h.edge}` },
      { 'x-shipkit-agent-edge': h.api }, { 'x-shipkit-agent-edge': '' },
    ];
    for (const extra of bad) assert.throws(() => admitAgentRegistration(h.request({ headers: { ...h.headers, ...extra } }), 'session', h.settings()));
    assert.throws(() => admitAgentRegistration(h.request({ method: 'GET', body: undefined }), 'session', h.settings()));
    for (const route of ['/api/agent-registration/session?x=1', '/api/agent-registration/session/', '/api/agent-registration/enroll']) {
      assert.throws(() => admitAgentRegistration(h.request({}, route), 'session', h.settings()));
    }
  } finally { await h.close(); }
});

test('human cookies, client internal proofs, unknown forwarding and visible merged duplicates reject', async () => {
  const h = await agentGatewayFixture();
  try {
    const bad: Record<string, string>[] = [{ cookie: '' }, { forwarded: 'proto=https' }, { 'x-shipkit-agent-ingress': h.api },
      { 'x-forwarded-client-cert': 'fake' }, { 'x-shipkit-local': '1' }, { 'x-shipkit-agent-other': 'fake' },
      { 'content-encoding': 'gzip' }, { 'content-type': 'text/plain' }, { 'content-length': '1, 1' }];
    for (const extra of bad) assert.throws(() => admitAgentRegistration(h.request({ headers: { ...h.headers, ...extra } }), 'session', h.settings()));
    for (const name of ['host', 'authorization', 'content-type', 'x-shipkit-agent-edge', 'x-forwarded-proto', 'x-forwarded-host', 'x-forwarded-port']) {
      const headers = new Headers(h.headers); headers.append(name, headers.get(name)!);
      assert.throws(() => admitAgentRegistration(h.request({ headers }), 'session', h.settings()));
    }
    assert.throws(() => admitAgentRegistration(h.request({ headers: { ...h.headers, 'content-length': '8193' } }), 'session', h.settings()),
      (error: unknown) => error instanceof AgentGatewayFault && error.status === 413);
  } finally { await h.close(); }
});
