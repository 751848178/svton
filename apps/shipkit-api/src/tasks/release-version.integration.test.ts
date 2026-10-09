import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConflictException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { ProjectRepository } from '../projects/project.repository.js';
import { databaseFixture } from '../testing/database.fixture.js';
import { nextReleaseVersion, proposedReleaseVersion, releaseVersion } from './release-version.js';
import { TaskRepository } from './task.repository.js';
import { planView } from './task.view.js';

const context = { actorId: 'local-controller', workspaceId: 'local', requestId: 'versions', source: 'loopback' as const };

test('stable versions validate syntax and compare numerically', () => {
  for (const value of ['v1.0.0', '01.0.0', '1.0', '1.0.0-beta', '1.0.0+build', '1.0.0 ', '', 1, '2147483647.0.0']) {
    assert.throws(() => releaseVersion(value), /版本号/);
  }
  assert.equal(nextReleaseVersion('0.0.0'), '0.0.1');
  assert.equal(nextReleaseVersion('0.0.9'), '0.0.10');
  assert.equal(proposedReleaseVersion('1.0.0', '0.9.999'), '1.0.0');
  assert.equal(proposedReleaseVersion('0.10.0', '0.9.999'), '0.10.0');
  assert.throws(() => proposedReleaseVersion('0.0.9', '0.0.10'), /不高于/);
  assert.throws(() => proposedReleaseVersion('1.0.0', '1.0.0'), /已使用/);
});

test('versions are durable, project scoped and allocated once per attempt', async () => {
  const fixture = await databaseFixture();
  const { db } = fixture;
  try {
    const projects = new ProjectRepository(db);
    const createProject = (suffix: string) => projects.register({
      workspace: { connect: { id: 'local' } }, createdBy: { connect: { id: context.actorId } },
      name: suffix, rootPath: `${fixture.directory}/${suffix}`, configPath: '/fixture.yaml', targetKey: 'a',
      projectIdentity: `fixture:${suffix}`, targets: { create: [{ targetKey: 'a' }, { targetKey: 'b' }] },
    }, context);
    const project = await createProject('versions');
    const other = await createProject('other');
    const prepare = (projectId: string, version: string, targetKey = 'a', kind = 'release') => db.plan.create({ data: {
      projectId, version, kind, targetKey, selectionJson: '["api"]', snapshotJson: '{}', fingerprint: 'fixture',
      actorId: context.actorId, expiresAt: new Date(Date.now() + 60_000),
    } });
    const tasks = new TaskRepository(db);
    const firstPlan = await prepare(project.id, '0.0.1');
    const first = await tasks.create(project.id, firstPlan.id, 'first', context);
    assert.equal(first.task.version, '0.0.1');
    assert.equal((await tasks.create(project.id, firstPlan.id, 'first', context)).task.id, first.task.id);
    assert.equal((await db.project.findUniqueOrThrow({ where: { id: project.id } })).lastVersion, '0.0.1');
    const blockedPlan = await prepare(project.id, '0.0.2');
    await assert.rejects(tasks.create(project.id, blockedPlan.id, 'blocked-active-target', context), /运行中的发布/);
    assert.equal((await db.project.findUniqueOrThrow({ where: { id: project.id } })).lastVersion, '0.0.1', 'Rejected task starts roll back allocation');
    await db.task.update({ where: { id: first.task.id }, data: { status: 'failed', activeScope: null, cleanupState: 'released' } });
    await assert.rejects(tasks.create(project.id, firstPlan.id, 'reused', context), versionConflict);
    const [planA, planB] = await Promise.all([prepare(project.id, '1.0.0', 'a'), prepare(project.id, '1.0.0', 'b')]);
    const concurrent = await Promise.allSettled([
      tasks.create(project.id, planA.id, 'major-a', context), tasks.create(project.id, planB.id, 'major-b', context),
    ]);
    assert.equal(concurrent.filter((result) => result.status === 'fulfilled').length, 1);
    const failure = concurrent.find((result) => result.status === 'rejected') as PromiseRejectedResult;
    assert(versionConflict(failure.reason), 'Concurrent stale plan must return a clear version conflict');
    const major = (concurrent.find((result) => result.status === 'fulfilled') as PromiseFulfilledResult<typeof first>).value.task;
    assert.equal(major.version, '1.0.0');
    await db.task.update({ where: { id: major.id }, data: { status: 'succeeded', activeScope: null, cleanupState: 'released', remoteReleaseId: 'remote-original-1' } });
    const rollbackPlan = await prepare(project.id, '1.0.1', 'a', 'rollback');
    const rollback = await tasks.create(project.id, rollbackPlan.id, 'rollback', context);
    assert.equal(rollback.task.version, '1.0.1');
    assert.equal(rollback.task.kind, 'rollback');
    assert.equal((await tasks.get(major.id)).remoteReleaseId, 'remote-original-1');
    const independent = await prepare(other.id, '0.0.1');
    assert.equal((await tasks.create(other.id, independent.id, 'other', context)).task.version, '0.0.1');
    const reopened = new DatabaseService();
    await reopened.onModuleInit();
    try {
      assert.equal((await reopened.task.findUniqueOrThrow({ where: { id: major.id } })).version, '1.0.0');
      assert.equal(nextReleaseVersion((await reopened.project.findUniqueOrThrow({ where: { id: project.id } })).lastVersion), '1.0.2');
    } finally { await reopened.onModuleDestroy(); }
    assert.equal(planView({ ...rollbackPlan, version: null }, rollback.task.version).version, '1.0.1');
  } finally { await fixture.dispose(); }
});

test('simultaneous idempotent starts across database connections return the same allocation', async () => {
  const fixture = await databaseFixture();
  const second = new DatabaseService();
  await second.onModuleInit();
  try {
    const project = await new ProjectRepository(fixture.db).register({
      workspace: { connect: { id: 'local' } }, createdBy: { connect: { id: context.actorId } },
      name: 'Idempotent', rootPath: fixture.directory, configPath: '/fixture.yaml', targetKey: 'test', projectIdentity: 'fixture:idempotent',
    }, context);
    const plan = await fixture.db.plan.create({ data: {
      projectId: project.id, kind: 'release', version: '0.0.1', targetKey: 'test', selectionJson: '["api"]', snapshotJson: '{}',
      fingerprint: 'fixture', actorId: context.actorId, expiresAt: new Date(Date.now() + 60_000),
    } });
    const repositories = [new TaskRepository(fixture.db), new TaskRepository(second)];
    const starts = await Promise.allSettled(repositories.map((repository) => repository.create(project.id, plan.id, 'same-key', context)));
    assert.equal(starts.filter((result) => result.status === 'fulfilled').length, 2, JSON.stringify(starts));
    const completed = starts.map((result) => (result as PromiseFulfilledResult<Awaited<ReturnType<TaskRepository['create']>>>).value);
    assert.equal(completed[0]!.task.id, completed[1]!.task.id);
    assert.equal(completed.filter((result) => result.created).length, 1);
    assert.equal(await fixture.db.task.count({ where: { projectId: project.id } }), 1);
    assert.equal((await fixture.db.project.findUniqueOrThrow({ where: { id: project.id } })).lastVersion, '0.0.1');
    assert.equal(await fixture.db.audit.count({ where: { action: 'task.start' } }), 1);
    const conflicting = await fixture.db.plan.create({ data: { ...plan, id: undefined, version: '0.0.2' } });
    await assert.rejects(repositories[1]!.create(project.id, conflicting.id, 'same-key', context), /重复请求键已用于不同计划/);
  } finally { await second.onModuleDestroy(); await fixture.dispose(); }
});

function versionConflict(error: unknown): boolean {
  return error instanceof ConflictException && (error.getResponse() as { code?: string }).code === 'VERSION_CONFLICT';
}
