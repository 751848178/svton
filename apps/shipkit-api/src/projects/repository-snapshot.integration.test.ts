import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { HttpException } from '@nestjs/common';
import { ProjectController } from './project.controller.js';
import type { LocalRequest } from '../policy/request-context.js';
import type { PlanService } from '../tasks/plan.service.js';
import type { TaskService } from '../tasks/task.service.js';
import { PlanInputService } from '../tasks/plan-input.service.js';
import type { ConfigService } from '../configs/config.service.js';
import { repositoryIntegrationFixture } from './repository-snapshot.integration.fixture.js';

test('all public project views identify credentials by token, while repeated status reads use registered metadata', async () => {
  const h = await repositoryIntegrationFixture();
  try {
    const registered = await h.repositories.register(h.body, h.context) as { id: string; hasCredential: boolean };
    assert.equal(registered.hasCredential, false);
    const stored = await h.projects.get(registered.id, 'local');
    assert(stored.repositorySecret);
    assert.equal(h.sources.hasCredential(stored), false);
    assert.equal(h.state.metadataRequests, 1);
    const controller = new ProjectController(h.api, {} as PlanService, {} as TaskService, h.repositories);
    const views = [registered, await controller.get(stored.id, { localContext: h.context } as LocalRequest),
      ...(await h.api.list(h.context) as { items: unknown[] }).items, await h.api.patch(stored.id, { name: 'Renamed' }, h.context)];
    for (const view of views) {
      assert.equal((view as { hasCredential: boolean }).hasCredential, false);
      assert(!JSON.stringify(view).includes('sourceSnapshot'));
      assert(!JSON.stringify(view).includes('repositorySecret'));
    }
    h.state.commit = 'b'.repeat(40);
    for (let i = 0; i < 4; i++) {
      const status = await h.api.status(stored.id, h.context) as { project: { hasCredential: boolean }; live: { source: { commit: string } } };
      assert.equal(status.project.hasCredential, false); assert.equal(status.live.source.commit, 'a'.repeat(40));
    }
    await h.api.history(stored.id, h.context);
    assert.equal(h.state.metadataRequests, 1, 'routine reads must not refresh provider metadata');
    const inputs = new PlanInputService(h.secrets, {} as ConfigService, h.sources);
    const request = { kind: 'release' as const, services: ['server'], configMode: 'inherit' as const };
    const prepared = await inputs.prepare(stored, request, 'server', randomUUID());
    assert.equal(prepared.input.sourceSnapshot, undefined);
    assert.deepEqual(prepared.options.repository, {});
    const plan = await h.executor.preparePlan(prepared.input, request, prepared.options);
    assert.equal(plan.detail.sourceSnapshot?.commit, 'b'.repeat(40)); assert(prepared.encrypted());
    assert.equal(h.state.metadataRequests, 2);
    await h.api.checks(stored.id, h.context); assert.equal(h.state.metadataRequests, 3);
    const privateView = await h.repositories.update(stored.id, { revision: 1, repository: h.body.repository, token: 'fixture-reader-token', username: 'fixture-reader' }, h.context);
    assert.equal(privateView.hasCredential, true);
    assert.equal((h.api.view(await h.projects.get(stored.id, 'local')) as { hasCredential: boolean }).hasCredential, true);
    assert.equal((await h.repositories.get(stored.id, h.context)).hasCredential, true);
  } finally { await h.close(); }
});

test('repository update CAS seals the winning snapshot and audit together, and audit failure rolls everything back', async () => {
  const h = await repositoryIntegrationFixture();
  try {
    const registered = await h.repositories.register(h.body, h.context) as { id: string };
    h.state.commit = 'b'.repeat(40);
    const update = { revision: 1, repository: h.body.repository };
    h.state.beforeResolve = async () => { await h.repositories.update(registered.id, update, h.context); };
    await assert.rejects(h.repositories.update(registered.id, update, h.context), /仓库设置已更新/);
    const winner = await h.projects.get(registered.id, 'local');
    assert.equal(winner.sourceRevision, 2);
    assert.equal(h.sources.inspectionInput(winner).sourceSnapshot?.commit, 'b'.repeat(40));
    assert.equal(h.sources.inspectionInput(winner).sourceSnapshot?.sourceRevision, 2);
    assert.equal(await h.db.audit.count({ where: { action: 'project.repository.update', resourceId: winner.id } }), 1);
    await h.db.$executeRawUnsafe("CREATE TRIGGER fixture_reject_repository_audit BEFORE INSERT ON Audit WHEN NEW.action = 'project.repository.update' BEGIN SELECT RAISE(ABORT, 'fixture audit rejection'); END");
    h.state.commit = 'c'.repeat(40);
    await assert.rejects(h.repositories.update(winner.id, { revision: 2, repository: h.body.repository }, h.context));
    const unchanged = await h.projects.get(winner.id, 'local');
    assert.equal(unchanged.sourceRevision, 2); assert.equal(unchanged.repositorySecret, winner.repositorySecret);
    assert.equal(unchanged.repositoryJson, winner.repositoryJson);
    assert.equal(await h.db.audit.count({ where: { action: 'project.repository.update', resourceId: winner.id } }), 1);
  } finally { await h.close(); }
});

test('legacy public metadata stays fresh until an explicit save, and known provider limit errors remain controlled 429', async () => {
  const h = await repositoryIntegrationFixture();
  try {
    const registered = await h.repositories.register(h.body, h.context) as { id: string };
    await h.db.project.update({ where: { id: registered.id }, data: { repositorySecret: null } });
    await h.api.status(registered.id, h.context); assert.equal(h.state.metadataRequests, 2);
    await h.repositories.update(registered.id, { revision: 1, repository: h.body.repository }, h.context);
    await h.api.status(registered.id, h.context); assert.equal(h.state.metadataRequests, 3);
    const retryAt = new Date(Date.now() + 60000).toISOString();
    h.executor.resolveRepositorySource = async () => { throw Object.assign(new Error('upstream private text'), { code: 'REPOSITORY_RATE_LIMITED', retryAt }); };
    await assert.rejects(h.repositories.preview(h.body, h.context), error => {
      assert(error instanceof HttpException); assert.equal(error.getStatus(), 429);
      assert.deepEqual(error.getResponse(), { code: 'REPOSITORY_RATE_LIMITED', message: '仓库服务已限流，请等待配额恢复后重试', retryAt }); return true;
    });
  } finally { await h.close(); }
});
