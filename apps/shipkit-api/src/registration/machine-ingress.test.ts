import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chmod, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertMachineIngress } from './machine-ingress.js';
import { ingressRequest, machineProofFixture, machineSettings } from './machine-ingress.fixture.js';
import { MACHINE_INGRESS_PROOF_HEADER } from './machine-ingress.settings.js';

test('machine ingress defaults disabled; direct local development does not accept forwarded TLS, cookies or remote peers', () => {
  assert.throws(() => assertMachineIngress(ingressRequest(), machineSettings()), /未启用/);
  const settings = machineSettings('local-development');
  assert.doesNotThrow(() => assertMachineIngress(ingressRequest(), settings));
  for (const headers of [['Cookie', 'shipkit_session=fixture'], ['Forwarded', 'proto=https'],
    ['X-Forwarded-Proto', 'https'], [MACHINE_INGRESS_PROOF_HEADER, 'fixture'], ['Origin', 'https://evil.example']]) {
    assert.throws(() => assertMachineIngress(ingressRequest(headers), settings), /入口不符合/);
  }
  assert.throws(() => assertMachineIngress(ingressRequest([], '10.0.0.2'), settings), /入口不符合/);
  const hostile = ingressRequest(); hostile.rawHeaders[1] = 'evil.example';
  assert.throws(() => assertMachineIngress(hostile, settings), /入口不符合/);
  assert.doesNotThrow(() => assertMachineIngress(ingressRequest(['Origin', 'http://localhost:8769']), settings));
});

test('trusted proxy requires the private proof and normalized singleton ingress fields, never TLS claims alone', async () => {
  const h = await machineProofFixture();
  try {
    const settings = h.settings(), headers = [MACHINE_INGRESS_PROOF_HEADER, h.value,
      'X-Forwarded-Proto', 'https', 'X-Forwarded-Host', 'shipkit.example', 'X-Forwarded-Port', '443', 'X-Forwarded-For', '192.0.2.1'];
    assert.doesNotThrow(() => assertMachineIngress(ingressRequest(headers), settings));
    assert(!JSON.stringify(settings).includes(h.value));
    for (const [name, value] of [[MACHINE_INGRESS_PROOF_HEADER, 'wrong'], ['X-Forwarded-Proto', 'http'],
      ['X-Forwarded-Host', 'evil.example'], ['X-Forwarded-Port', '80'], ['X-Forwarded-For', 'not-an-ip']]) {
      const changed = [...headers]; changed[changed.indexOf(name) + 1] = value;
      assert.throws(() => assertMachineIngress(ingressRequest(changed), settings));
    }
    assert.throws(() => assertMachineIngress(ingressRequest(headers.slice(2)), settings), /证明无效/);
    assert.throws(() => assertMachineIngress(ingressRequest([...headers, 'Origin', 'https://evil.example']), settings));
    assert.throws(() => assertMachineIngress(ingressRequest([...headers, 'Forwarded', 'proto=https']), settings));
    assert.throws(() => assertMachineIngress(ingressRequest(headers, '192.0.2.2'), settings));
  } finally { await h.close(); }
});

test('raw duplicate authorization, proof, host and forwarded fields plus mixed Cookie fail closed', async () => {
  const h = await machineProofFixture();
  try {
    const headers = [MACHINE_INGRESS_PROOF_HEADER, h.value, 'X-Forwarded-Proto', 'https',
      'X-Forwarded-Host', 'shipkit.example', 'X-Forwarded-Port', '443'];
    for (const extra of [['Authorization', 'Bearer one', 'authorization', 'Bearer two'],
      [MACHINE_INGRESS_PROOF_HEADER, h.value], ['Host', 'localhost'], ['X-Forwarded-Proto', 'https'],
      ['Cookie', 'shipkit_session=fixture'], ['X-Forwarded-For', '127.0.0.1, 192.0.2.1']]) {
      assert.throws(() => assertMachineIngress(ingressRequest([...headers, ...extra]), h.settings()), /入口不符合/);
    }
  } finally { await h.close(); }
});

test('proof settings require explicit HTTPS, safe permissions, canonical bounded bytes and no symlink', async () => {
  const h = await machineProofFixture();
  try {
    for (const origin of ['http://shipkit.example', 'https://shipkit.example/path', 'https://u:p@shipkit.example', 'https://shipkit.example?x=1']) {
      assert.throws(() => machineSettings('trusted-proxy', { SHIPKIT_AGENT_PUBLIC_ORIGIN: origin, SHIPKIT_AGENT_INGRESS_PROOF_FILE: h.file }), /配置不可用/);
    }
    assert.throws(() => machineSettings('unknown'), /配置不可用/);
    assert.throws(() => machineSettings('trusted-proxy'), /配置不可用/);
    await chmod(h.file, 0o644); assert.throws(() => h.settings(), /配置不可用/); await chmod(h.file, 0o600);
    await chmod(h.directory, 0o755); assert.throws(() => h.settings(), /配置不可用/); await chmod(h.directory, 0o700);
    const link = path.join(h.directory, 'link'); await symlink(h.file, link);
    assert.throws(() => machineSettings('trusted-proxy', { SHIPKIT_AGENT_PUBLIC_ORIGIN: 'https://shipkit.example', SHIPKIT_AGENT_INGRESS_PROOF_FILE: link }), /配置不可用/);
    for (const contents of ['', h.value + 'extra', h.value + ' ', '='.repeat(43), h.value.slice(0, 42)]) {
      await writeFile(h.file, contents); assert.throws(() => h.settings(), /配置不可用/);
    }
  } finally { await h.close(); }
});
