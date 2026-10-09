import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseService } from '../database/database.service.js';
import { ProjectRepository } from '../projects/project.repository.js';
import { databaseFixture } from '../testing/database.fixture.js';
import { TaskEventService } from './task-event.service.js';
import { TaskLogService } from './task-log.service.js';
import { TaskRepository } from './task.repository.js';
import { TaskRunnerService } from './task-runner.service.js';
import type { PlatformExecutorService } from '../executor/platform-executor.service.js';
import { LocalPolicyService } from '../policy/local-policy.service.js';
import { ProjectService } from '../projects/project.service.js';
import { TaskService } from './task.service.js';
import type { ExecutionHooks } from '../executor/executor.port.js';
import { randomBytes } from 'node:crypto';

test('SQLite migrations, foreign keys, concurrent gate, durable event/log cursors and cancellation', async () => {
  const fixture = await databaseFixture();
  const { db } = fixture;
  try {
    const actor = await fixture.seedAccount('ledger-operator', randomBytes(24).toString('base64url'));
    const sessionId = randomBytes(32).toString('hex');
    await db.authSession.create({ data: { id: sessionId, actorId: actor.id, expiresAt: new Date(Date.now() + 60000) } });
    const context = { actorId: actor.id, workspaceId: 'local', requestId: 'integration', source: 'session' as const, sessionId };
    const projects = new ProjectRepository(db);
    const project = await projects.register({
      workspace: { connect: { id: 'local' } }, createdBy: { connect: { id: actor.id } },
      name: 'Isolated', rootPath: fixture.directory, configPath: '/private/fixture.yaml', targetKey: 'local-test',
      projectIdentity: 'local:ledger-test', targets: { create: [{ targetKey: 'local-test' }, { targetKey: 'other' }] },
      services: { create: [{ serviceKey: 'api' }] },
    }, context);
    await assert.rejects(db.audit.create({ data: { workspaceId: 'foreign', actorId: 'missing', requestId: 'invalid', action: 'test', resourceType: 'task', resourceId: 'x', outcome: 'x' } }), /Foreign key|constraint/i);
    const plan = await db.plan.create({ data: {
      projectId: project.id, kind: 'release', targetKey: 'local-test', selectionJson: '["api"]',
      snapshotJson: '{}', fingerprint: 'digest', actorId: context.actorId, expiresAt: new Date(Date.now() + 60_000),
    } });
    const tasks = new TaskRepository(db);
    const concurrent = await Promise.allSettled([tasks.create(project.id, plan.id, 'a', context), tasks.create(project.id, plan.id, 'b', context)]);
    assert.equal(concurrent.filter((item) => item.status === 'fulfilled').length, 1);
    const task = (concurrent.find((item) => item.status === 'fulfilled') as PromiseFulfilledResult<Awaited<ReturnType<typeof tasks.create>>>).value.task;
    await assert.rejects(projects.patch(project, { targetKey: 'other' }, context), /不能切换/);
    const originalKey = task.idempotencyKey!.split(':').at(-1)!;
    assert.equal((await tasks.create(project.id, plan.id, originalKey, context)).task.id, task.id);
    const logs = new TaskLogService(db);
    const events = new TaskEventService(db, logs);
    await Promise.all([
      events.append(task.id, { type: 'stage', stageKey: 'build', status: 'running' }),
      events.append(task.id, { type: 'log', stageKey: 'build', serviceKey: 'api', message: 'first build line' }),
      events.append(task.id, { type: 'remote-job', remoteJob: { jobId: 'job-1', agentRole: 'builder', urlRef: 'builder.static', stageKey: 'build', serviceKey: 'api', logOffset: 20, eventOffset: 3 } }),
    ]);
    assert.deepEqual((await db.event.findMany({ where: { taskId: task.id }, orderBy: { seq: 'asc' } })).map((event) => event.seq), [1, 2, 3]);
    assert.equal((await db.remoteJob.findFirstOrThrow({ where: { taskId: task.id } })).logOffset, 20);
    const first = await logs.read(task.id, 'build', 'api', 0) as { text: string; nextOffset: number };
    assert.equal(first.text, 'first build line\n');
    await events.append(task.id, { type: 'log', stageKey: 'build', serviceKey: 'api', message: 'second line token=fixture-secret' });
    const next = await logs.read(task.id, 'build', 'api', first.nextOffset) as { text: string };
    assert.equal(next.text, 'second line token=[redacted]\n');
    const unicode = `${'x'.repeat(131070)}🙂tail`;
    await logs.append(task.id, 'push', undefined, unicode);
    const chunk = await logs.read(task.id, 'push', undefined, 0) as { text: string; nextOffset: number };
    const rest = await logs.read(task.id, 'push', undefined, chunk.nextOffset) as { text: string };
    assert.equal(chunk.text + rest.text, `${unicode}\n`);
    assert(!JSON.stringify(await db.event.findMany()).includes('fixture-secret'));
    const reopened = new DatabaseService();
    await reopened.onModuleInit();
    assert.equal((await reopened.remoteJob.findFirstOrThrow()).eventOffset, 3);
    assert.equal(await reopened.task.count(), 1);
    await reopened.onModuleDestroy();
    await db.task.update({ where: { id: task.id }, data: { cancelState: 'noncancellable' } });
    await assert.rejects(tasks.requestCancel(await tasks.get(task.id), context), /不能取消/);
    await db.task.update({ where: { id: task.id }, data: { cancelState: 'none' } });
    assert.equal((await tasks.requestCancel(await tasks.get(task.id), context)).status, 'cancel-requested');
    assert.notEqual((await tasks.get(task.id)).cancelState, 'cancelled');
    await db.task.update({ where: { id: task.id }, data: { status: 'cancelled', activeScope: null, cleanupState: 'released' } });
    await logs.finish(task.id);
    const expired = await db.plan.create({ data: { ...plan, id: undefined, expiresAt: new Date(0) } });
    await assert.rejects(tasks.create(project.id, expired.id, undefined, context), /过期/);
    const nextTask = await tasks.create(project.id, plan.id, 'next', context);
    assert.equal(nextTask.created, true);
    assert.equal(await db.audit.count({ where: { actorId: actor.id, workspaceId: 'local' } }), 4);
    const failedExecutor = {
      executeTask: async (_input: unknown, _plan: unknown, hooks: { executionId?: string; emit(event: unknown): Promise<void> }) => {
        assert.equal(hooks.executionId, nextTask.task.id);
        await hooks.emit({ type: 'cleanup', stageKey: 'cleanup', status: 'kept' });
        await hooks.emit({ type: 'recovery', status: 'succeeded' });
        await hooks.emit({ type: 'stage', stageKey: 'deploy', status: 'running' });
        await hooks.emit({ type: 'remote-intent', stageKey: 'deploy', detail: { operationId: `${nextTask.task.id}:deploy:group`, agentRole: 'runtime', urlRef: 'http://127.0.0.1:7410' } });
        throw new Error('connection dropped after remote submission');
      },
    } as unknown as PlatformExecutorService;
    new TaskRunnerService(tasks, failedExecutor, events, logs).dispatch(nextTask.task);
    await until(async () => (await tasks.get(nextTask.task.id)).status === 'interrupted');
    assert((await tasks.get(nextTask.task.id)).activeScope);
    assert.equal((await tasks.get(nextTask.task.id)).cleanupState, 'kept');
    assert.equal((await tasks.get(nextTask.task.id)).recoveryState, 'succeeded');
    assert.equal((await logs.read(nextTask.task.id, 'deploy', undefined, 0) as { complete: boolean }).complete, false);
    const recoveredExecutor = {
      reconcileTask: async (_input: unknown, refs: unknown[], hooks: { executionId?: string }) => {
        assert.equal(refs.length, 0);
        assert.equal(hooks.executionId, nextTask.task.id);
        return { status: 'interrupted', cleanupState: 'static', recoveryState: 'none', output: { safeToReleaseGate: true } };
      },
    } as unknown as PlatformExecutorService;
    const restarted = new TaskRunnerService(tasks, recoveredExecutor, events, logs);
    restarted.onApplicationBootstrap();
    await until(async () => (await tasks.get(nextTask.task.id)).activeScope === null);
    restarted.onModuleDestroy();
    assert((await tasks.get(nextTask.task.id)).finishedAt);
    assert.equal((await tasks.requestCancel(await tasks.get(nextTask.task.id), context)).status, 'interrupted');
    assert.equal((await tasks.get(nextTask.task.id)).activeScope, null);
    assert.equal((await db.stage.findFirstOrThrow({ where: { taskId: nextTask.task.id, stageKey: 'deploy' } })).status, 'failed');
    await db.resourceLease.create({ data: { taskId: nextTask.task.id, provider: 'tencent', leaseRef: 'instance-test', status: 'failed' } });
    await db.task.update({ where: { id: nextTask.task.id }, data: { cancelState: 'cancelled' } });
    let archiveFailure = true;
    let releaseCalls = 0;
    const cleanupExecutor = {
      archiveForCleanup: async (_input: unknown, _refs: unknown, hooks: ExecutionHooks, _plan: unknown, leaseRef: string) => {
        assert.equal(hooks.executionId, nextTask.task.id);
        assert.equal(leaseRef, 'instance-test');
        if (archiveFailure) throw new Error('terminal builder archive unavailable');
        await hooks.emit({ type: 'log', stageKey: 'push', serviceKey: 'api', message: 'archived before resource release' });
        await hooks.emit({ type: 'cancel', status: 'available', detail: { cancellable: true } });
      },
      retryCleanup: async (_input: unknown, _plan: unknown, leaseRef: string) => {
        releaseCalls++;
        assert.equal(leaseRef, 'instance-test');
        const archive = await logs.read(nextTask.task.id, 'push', 'api', 0) as { text: string };
        assert(archive.text.includes('archived before resource release'));
        return { cleanupState: 'released' };
      },
    } as unknown as PlatformExecutorService;
    const policy = new LocalPolicyService();
    const commands = new TaskService(tasks, new TaskRunnerService(tasks, cleanupExecutor, events, logs), logs,
      new ProjectService(projects, cleanupExecutor, policy), cleanupExecutor, policy, events);
    const blocked = await commands.cleanup(nextTask.task.id, context) as { cleanupState: string };
    assert.equal(blocked.cleanupState, 'failed');
    assert.equal(releaseCalls, 0);
    archiveFailure = false;
    const cleaned = await commands.cleanup(nextTask.task.id, context) as { cleanupState: string };
    assert.equal(cleaned.cleanupState, 'released');
    assert.equal(releaseCalls, 1);
    assert.equal((await tasks.get(nextTask.task.id)).cancelState, 'cancelled');
    assert.equal((await db.resourceLease.findFirstOrThrow({ where: { taskId: nextTask.task.id } })).status, 'released');
    const successTask = await tasks.create(project.id, plan.id, 'success-stage-close', context);
    await db.stage.updateMany({ where: { taskId: successTask.task.id, stageKey: 'verify', serviceKey: '' }, data: { status: 'succeeded' } });
    await db.stage.createMany({ data: [
      { taskId: successTask.task.id, stageKey: 'verify', serviceKey: 'api', status: 'running', detailJson: '{"probe":"observed"}' },
      { taskId: successTask.task.id, stageKey: 'verify', serviceKey: 'web', status: 'failed' },
    ] });
    const successExecutor = { executeTask: async () => ({ status: 'succeeded', cleanupState: 'static', recoveryState: 'none' }) } as unknown as PlatformExecutorService;
    new TaskRunnerService(tasks, successExecutor, events, logs).dispatch(successTask.task);
    await until(async () => (await tasks.get(successTask.task.id)).status === 'succeeded');
    const apiProbe = await db.stage.findFirstOrThrow({ where: { taskId: successTask.task.id, stageKey: 'verify', serviceKey: 'api' } });
    assert.equal(apiProbe.status, 'succeeded');
    assert.equal(apiProbe.detailJson, '{"probe":"observed"}');
    assert.equal((await db.stage.findFirstOrThrow({ where: { taskId: successTask.task.id, stageKey: 'verify', serviceKey: 'web' } })).status, 'failed');
  } finally { await fixture.dispose(); }
});

async function until(predicate: () => Promise<boolean>): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail('Task did not reach expected durable state');
}
