import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer, request as httpRequest } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { databaseFixture } from '../testing/database.fixture.js';

test('HTTP policy and registration use real platform inspection with an isolated read-only Agent', async () => {
  const fixture = await databaseFixture();
  const mode = { baseline: null as string | null };
  const agent = createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json');
    if (request.url?.startsWith('/api/status')) response.end(JSON.stringify({ role: 'both', version: '0.6.0', docker: true, auth: { role: 'both', capabilities: ['build', 'deploy'] } }));
    else if (request.url?.startsWith('/api/group-state')) response.end(JSON.stringify({ schemaVersion: 2, app: 'fixture', current: mode.baseline, services: {} }));
    else if (request.url?.startsWith('/api/group-history')) response.end(JSON.stringify({ app: 'fixture', current: mode.baseline, items: [] }));
    else { response.statusCode = 404; response.end('{}'); }
  });
  await new Promise<void>((resolve) => agent.listen(0, '127.0.0.1', resolve));
  const address = agent.address() as { port: number };
  const projectRoot = path.join(fixture.directory, 'project');
  await mkdir(projectRoot);
  await writeFile(path.join(projectRoot, 'Dockerfile'), 'FROM scratch\n');
  await writeFile(path.join(projectRoot, 'ship.yaml'), 'schemaVersion: 2\nname: fixture\nservices:\n  api:\n    dockerfile: Dockerfile\n    envFile: runtime.env\n  web:\n    dockerfile: Dockerfile\n');
  await writeFile(path.join(projectRoot, 'runtime.env'), 'PRIVATE_FIXTURE=fixture-runtime-value-private\n', { mode: 0o600 });
  const configPath = path.join(fixture.directory, 'private-config.yaml');
  await writeFile(configPath, `builder:\n  mode: static\n  static:\n    url: http://127.0.0.1:${address.port}\n    token: never-show-this-token\nregistry:\n  url: localhost:5000\n  namespace: fixture\nruntime:\n  targets:\n    local-test:\n      url: http://127.0.0.1:${address.port}\n      token: never-show-this-token\n`, { mode: 0o600 });
  const app = await NestFactory.create(AppModule, { logger: false });
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  const register = { name: 'Fixture project', rootPath: projectRoot, configPath, serverName: '隔离服务器', services: [{ serviceKey: 'api', displayName: '接口', entryUrl: 'http://127.0.0.1:12345' }] };
  const writeHeaders = { 'Content-Type': 'application/json', 'x-shipkit-local': '1', Origin: 'http://127.0.0.1:8769' };
  try {
    assert.equal((await fetch(`${base}/api/projects`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(register) })).status, 403);
    assert.equal((await fetch(`${base}/api/projects`, { method: 'POST', headers: { ...writeHeaders, Origin: 'https://evil.example' }, body: JSON.stringify(register) })).status, 403);
    const deniedHost = await new Promise<number>((resolve, reject) => {
      const request = httpRequest(`${base}/api/projects`, { headers: { host: 'evil.example' } }, (response) => { response.resume(); resolve(response.statusCode ?? 0); });
      request.on('error', reject); request.end();
    });
    assert.equal(deniedHost, 403);
    assert.equal((await fetch(`${base}/api/projects`, { method: 'POST', headers: { ...writeHeaders, Origin: 'null' }, body: JSON.stringify(register) })).status, 403);
    assert.equal((await fetch(`${base}/api/projects`, { method: 'POST', headers: { ...writeHeaders, Origin: 'http://127.0.0.1:8769/path' }, body: JSON.stringify(register) })).status, 403);
    const created = await fetch(`${base}/api/projects`, { method: 'POST', headers: writeHeaders, body: JSON.stringify(register) });
    assert.equal(created.status, 201);
    const project = await created.json() as { id: string; serverName: string; services: { serviceKey: string }[] };
    assert.equal(project.serverName, '隔离服务器');
    assert.equal(project.services[0]?.serviceKey, 'api');
    const metadata = await fetch(`${base}/api/projects/${project.id}`, { method: 'PATCH', headers: writeHeaders, body: JSON.stringify({ serverName: null, services: [{ serviceKey: 'api', displayName: null, entryUrl: null }, { serviceKey: 'web', displayName: '', entryUrl: '' }] }) });
    assert.equal(metadata.status, 200);
    const cleared = await metadata.json() as { serverName: unknown; services: { serviceKey: string; displayName: unknown; entryUrl: unknown }[] };
    assert.equal(cleared.serverName, null);
    assert.equal(cleared.services.find((service) => service.serviceKey === 'api')?.displayName, null);
    assert.equal(cleared.services.find((service) => service.serviceKey === 'api')?.entryUrl, null);
    assert.equal((await fetch(`${base}/api/projects/${project.id}`, { method: 'PATCH', headers: writeHeaders, body: JSON.stringify({ targetKey: '' }) })).status, 400);
    assert.equal((await fetch(`${base}/api/projects/${project.id}`, { method: 'PATCH', headers: writeHeaders, body: JSON.stringify({ services: [{ serviceKey: '', displayName: null }] }) })).status, 400);
    const status = await fetch(`${base}/api/projects/${project.id}/status`);
    const statusText = await status.text();
    assert.equal(status.status, 200);
    assert(!statusText.includes('never-show-this-token'));
    assert.equal(JSON.parse(statusText).live.runtime.check.ok, true);
    assert.equal(JSON.parse(statusText).project.nextVersion, '0.0.1');
    for (const version of ['v1.0.0', '01.0.0', '0.0.0', '1.0.0-beta', null]) {
      const invalidVersion = await fetch(`${base}/api/projects/${project.id}/plans`, { method: 'POST', headers: writeHeaders, body: JSON.stringify({ kind: 'release', services: ['api', 'web'], version }) });
      assert.equal(invalidVersion.status, version === '0.0.0' ? 409 : 400);
    }
    const partial = await fetch(`${base}/api/projects/${project.id}/plans`, { method: 'POST', headers: writeHeaders, body: JSON.stringify({ kind: 'release', services: ['api'] }) });
    assert.equal(partial.status, 400);
    assert.equal((await partial.json() as { code: string }).code, 'FIRST_DEPLOYMENT_FULL_REQUIRED');
    const unknown = await fetch(`${base}/api/projects/${project.id}/plans`, { method: 'POST', headers: writeHeaders, body: JSON.stringify({ kind: 'release', services: ['missing'] }) });
    assert.equal(unknown.status, 400);
    assert.equal((await unknown.json() as { code: string }).code, 'SERVICE_SELECTION_INVALID');
    const planned = await fetch(`${base}/api/projects/${project.id}/plans`, { method: 'POST', headers: writeHeaders, body: JSON.stringify({ kind: 'release', services: ['api', 'web'], sourceMode: 'directory' }) });
    assert.equal(planned.status, 201);
    const plan = await planned.json() as { id: string; version: string; detail: { releasePlan: { firstDeployment: boolean } } };
    assert.equal(plan.version, '0.0.1');
    assert.equal(plan.detail.releasePlan.firstDeployment, true);
    assert.equal(await fixture.db.task.count(), 0);
    await fixture.db.plan.update({ where: { id: plan.id }, data: { expiresAt: new Date(0) } });
    const expired = await fetch(`${base}/api/projects/${project.id}/tasks`, { method: 'POST', headers: writeHeaders, body: JSON.stringify({ planId: plan.id }) });
    assert.equal(expired.status, 409);
    assert.equal((await expired.json() as { code: string }).code, 'PLAN_EXPIRED');
    const freshPlan = await fetch(`${base}/api/projects/${project.id}/plans`, { method: 'POST', headers: writeHeaders, body: JSON.stringify({ kind: 'release', services: ['api', 'web'] }) }).then((response) => response.json()) as { id: string };
    mode.baseline = 'baseline-changed';
    const stale = await fetch(`${base}/api/projects/${project.id}/tasks`, { method: 'POST', headers: writeHeaders, body: JSON.stringify({ planId: freshPlan.id }) }).then((response) => response.json()) as { id: string };
    let detail: { task: { status: string; error: string }; remoteJobs: unknown[] } | undefined;
    for (let attempt = 0; attempt < 100; attempt++) {
      detail = await fetch(`${base}/api/tasks/${stale.id}`).then((response) => response.json());
      if (detail?.task.status === 'failed') break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(detail?.task.status, 'failed');
    assert.match(detail!.task.error, /baseline changed/i);
    assert.equal(detail!.remoteJobs.length, 0);
    mode.baseline = null;
    const unavailable = await fetch(`${base}/api/projects/${project.id}/plans`, { method: 'POST', headers: writeHeaders, body: JSON.stringify({ kind: 'rollback', services: ['api'], changeReleaseId: 'missing-change' }) });
    assert.equal(unavailable.status, 409);
    assert.equal((await unavailable.json() as { code: string }).code, 'SNAPSHOT_UNAVAILABLE');
    for (const route of [`/api/projects/${project.id}/status`, `/api/projects/${project.id}/tasks`, `/api/tasks/${stale.id}`, `/api/tasks/${stale.id}/events`, ...['provision', 'build', 'push', 'cleanup', 'deploy', 'verify'].map((stage) => `/api/tasks/${stale.id}/logs?stage=${stage}`)]) {
      const response = await fetch(`${base}${route}`).then((result) => result.text());
      for (const secret of ['never-show-this-token', 'fixture-runtime-value-private']) assert(!response.includes(secret), 'API exposed a fixture secret');
    }
    assert.equal((await fetch(`${base}/api/projects/${project.id}`, { method: 'PATCH', headers: writeHeaders, body: JSON.stringify({ targetKey: 'rename' }) })).status, 400);
    assert.equal((await fetch(`${base}/api/projects`, { method: 'POST', headers: writeHeaders, body: JSON.stringify({ ...register, rootPath: '/missing/isolated/project' }) })).status, 400);
    assert.equal((await fetch(`${base}/api/projects`, { method: 'POST', headers: writeHeaders, body: JSON.stringify(register) })).status, 409);
    await writeFile(configPath, 'invalid: credentials-supersecret\n');
    const invalid = await fetch(`${base}/api/projects/${project.id}/status`);
    assert.equal(invalid.status, 422);
    assert(!(await invalid.text()).includes('credentials-supersecret'));
  } finally {
    await app.close();
    await new Promise<void>((resolve) => agent.close(() => resolve()));
    await fixture.dispose();
  }
});
