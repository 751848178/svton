import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { databaseFixture } from '../testing/database.fixture.js';
import type { AgentResourceChecks, AgentResourceList } from './agent.contracts.js';

test('configured Agent inventory deduplicates roles, isolates partial failures and only checks known connections', { timeout: 30_000 }, async () => {
  const fixture = await databaseFixture();
  const calls: string[] = [];
  const secret = 'private-agent-fixture-value';
  const agent = createServer((request, response) => {
    calls.push(request.url || ''); response.setHeader('Content-Type', 'application/json');
    if (request.headers.authorization === 'Bearer denied-fixture') {
      response.statusCode = 401; response.end(JSON.stringify({ error: { message: secret } })); return;
    }
    response.end(JSON.stringify({ role: 'both', version: '0.5.0', docker: true,
      auth: { role: request.headers.authorization === 'Bearer builder-only-fixture' ? 'builder' : 'both', capabilities: [] }, privateData: secret }));
  });
  await new Promise<void>(resolve => agent.listen(0, '127.0.0.1', resolve));
  const endpoint = `http://127.0.0.1:${(agent.address() as { port: number }).port}`;
  const target = (token = 'accepted-fixture') => ({ url: endpoint, token });
  const create = async (name: string, config: unknown, targets = ['prod']) => {
    const rootPath = path.join(fixture.directory, name); await mkdir(rootPath);
    const configPath = path.join(rootPath, 'private-config.json');
    await writeFile(configPath, JSON.stringify(config), { mode: 0o600 });
    return fixture.db.project.create({ data: { name, rootPath, configPath, targetKey: targets[0], projectIdentity: `local:${name}`,
      workspaceId: 'local', createdByActorId: 'local-controller', targets: { create: targets.map(targetKey => ({ targetKey, displayName: `${name}-${targetKey}` })) } } });
  };
  let app: Awaited<ReturnType<typeof NestFactory.create>> | undefined;
  try {
  await create('shared-a', { builder: { mode: 'static', static: target('denied-fixture') }, runtime: { targets: { prod: target(), other: target('builder-only-fixture') } } }, ['prod', 'other']);
  await create('shared-b', { builder: { mode: 'static', static: target() }, runtime: { targets: { prod: target() } } });
  await create('invalid', { invalid: secret });
  await create('dynamic-offline', { builder: { mode: 'dynamic', dynamic: { provider: 'tencent', tencent: {
    region: 'ap-fixture', zone: 'ap-fixture-1', instanceType: 'TEST', imageId: 'img-fixture', vpcId: 'vpc-fixture', subnetId: 'subnet-fixture', securityGroupIds: ['sg-fixture'], advertiseHost: '127.0.0.1', loginPassword: secret, preInstallScript: `echo ${secret}`,
  } } }, runtime: { targets: { prod: { url: 'http://127.0.0.1:1', token: 'offline-fixture' } } } });
  app = await NestFactory.create(AppModule, { logger: false });
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  const headers = { 'Content-Type': 'application/json', 'x-shipkit-local': '1', Origin: 'http://127.0.0.1:8769' };
    const inventoryResponse = await fetch(`${base}/api/agents`);
    const inventoryText = await inventoryResponse.text();
    assert.equal(inventoryResponse.status, 200);
    assert.equal(calls.length, 0, 'inventory must not automatically probe configured Agents');
    for (const value of [secret, 'accepted-fixture', 'denied-fixture', 'builder-only-fixture', 'offline-fixture']) assert(!inventoryText.includes(value));
    const inventory = JSON.parse(inventoryText) as AgentResourceList;
    assert.equal(inventory.items.length, 2);
    assert.equal(inventory.issues.length, 1);
    assert.equal(inventory.issues[0]?.projectName, 'invalid');
    assert.equal(inventory.dynamicBuilders.length, 1);
    assert.equal(inventory.dynamicBuilders[0]?.projectName, 'dynamic-offline');
    const shared = inventory.items.find(item => item.endpoint === endpoint)!;
    assert.deepEqual([...shared.usages].sort(), ['builder', 'runtime']);
    assert.equal(shared.bindings.length, 5);
    assert.equal(shared.bindings.filter(binding => binding.selected).length, 2);
    assert.equal((await fetch(`${base}/api/agents/${shared.id}/checks`, { method: 'POST' })).status, 403);
    assert.equal((await fetch(`${base}/api/agents/not-configured/checks`, { method: 'POST', headers })).status, 404);
    assert.equal((await fetch(`${base}/api/agents/${shared.id}/checks`, { method: 'POST', headers, body: JSON.stringify({ url: 'http://unconfigured.invalid' }) })).status, 400);
    assert.equal(calls.length, 0, 'invalid resource IDs or supplied URLs must not produce outbound checks');
    const response = await fetch(`${base}/api/agents/${shared.id}/checks`, { method: 'POST', headers });
    const checkedText = await response.text();
    assert.equal(response.status, 201);
    assert(!checkedText.includes(secret));
    const checked = JSON.parse(checkedText) as AgentResourceChecks;
    assert.equal(checked.status, 'partial');
    assert.equal(checked.checks.filter(check => check.ok).length, 3);
    assert.equal(checked.checks.filter(check => !check.ok).length, 2);
    assert(checked.checks.some(check => check.machineRole === 'both' && check.accessRole === 'builder' && !check.ok));
    assert(checked.checks.some(check => check.error === '连接认证失败，请检查此项目的凭据'));
    assert.equal(calls.length, 5);
    assert(calls.every(url => url === '/api/status'));
    const offline = inventory.items.find(item => item.endpoint.endsWith(':1'))!;
    const unavailable = await fetch(`${base}/api/agents/${offline.id}/checks`, { method: 'POST', headers }).then(response => response.json()) as AgentResourceChecks;
    assert.equal(unavailable.status, 'failed');
    assert.match(unavailable.checks[0]!.error!, /连接不可达/);
    assert.equal(await fixture.db.task.count(), 0);
    assert.equal(await fixture.db.plan.count(), 0);
    assert.equal(await fixture.db.resourceLease.count(), 0);
  } finally {
    await app?.close(); await new Promise<void>(resolve => agent.close(() => resolve())); await fixture.dispose();
  }
});
