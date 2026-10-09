import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseService } from '../database/database.service.js';

test('version migration preserves original identities, foreign keys and project-local chronological history', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'shipkit-version-migration-'));
  const previousUrl = process.env.DATABASE_URL;
  const previousRoot = process.env.SHIPKIT_DATA_DIR;
  process.env.DATABASE_URL = `file:${path.join(directory, 'platform.db')}`;
  process.env.SHIPKIT_DATA_DIR = directory;
  await writeFile(path.join(directory, 'platform.db'), '', { mode: 0o600 });
  const prismaDirectory = path.join(directory, 'prisma');
  await mkdir(path.join(prismaDirectory, 'migrations'), { recursive: true });
  await writeFile(path.join(prismaDirectory, 'schema.prisma'), 'datasource db {\n provider = "sqlite"\n url = env("DATABASE_URL")\n}\n');
  await copyFile('prisma/migrations/migration_lock.toml', path.join(prismaDirectory, 'migrations/migration_lock.toml'));
  const execute = async (migration: string, injectFailure = false) => {
    await mkdir(path.join(prismaDirectory, 'migrations', migration), { recursive: true });
    const sql = await readFile(`prisma/migrations/${migration}/migration.sql`, 'utf8');
    await writeFile(path.join(prismaDirectory, 'migrations', migration, 'migration.sql'), injectFailure
      ? sql.replace('COMMIT;', 'SELECT * FROM "__shipkit_fault_injected__";\nCOMMIT;') : sql);
    const result = spawnSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy', '--schema', path.join(prismaDirectory, 'schema.prisma')], { encoding: 'utf8', env: process.env });
    assert.equal(result.status, injectFailure ? 1 : 0, `Isolated migration returned unexpected status (${result.status})`);
  };
  let db: DatabaseService | undefined;
  try {
    await execute('2026100801_initial');
    db = new DatabaseService();
    // This phase intentionally uses the original Actor shape, before auth exists.
    await db.$connect();
    await db.$executeRawUnsafe('PRAGMA foreign_keys=ON');
    await db.$executeRawUnsafe('INSERT INTO Workspace (id,name) VALUES (?,?)', 'local', 'Original workspace');
    await db.$executeRawUnsafe('INSERT INTO Actor (id,kind,name) VALUES (?,?,?)', 'local-controller', 'local', 'Original controller');
    for (const projectId of ['project-a', 'project-b']) {
      await db.$executeRawUnsafe('INSERT INTO Project (id,workspaceId,name,rootPath,configPath,targetKey,projectIdentity,createdByActorId,updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        projectId, 'local', projectId, `${directory}/${projectId}`, '/fixture.yaml', 'test', projectId, 'local-controller', Date.now());
      await db.$executeRawUnsafe('INSERT INTO Plan (id,projectId,kind,targetKey,selectionJson,snapshotJson,fingerprint,actorId,expiresAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        `plan-${projectId}`, projectId, 'release', 'test', '["api"]', '{}', 'original-plan-hash', 'local-controller', Date.now() + 60_000);
    }
    // The ID tie-break is deliberate: timestamps can have equal precision.
    for (const [id, projectId, createdAt] of [['task-z', 'project-a', 1_000], ['task-b', 'project-a', 2_000], ['task-a', 'project-a', 2_000], ['task-other', 'project-b', 1_000]] as const) {
      await db.$executeRawUnsafe('INSERT INTO Task (id,projectId,planId,kind,actorId,createdAt,remoteReleaseId,outputJson,status,cleanupState) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        id, projectId, `plan-${projectId}`, 'release', 'local-controller', createdAt, `remote-${id}`, '{"image":"sha256:original"}', 'succeeded', 'released');
    }
    await db.stage.create({ data: { taskId: 'task-a', stageKey: 'verify', status: 'succeeded', detailJson: '{"health":"observed"}' } });
    await db.event.create({ data: { taskId: 'task-a', seq: 1, type: 'log', payloadJson: '{"message":"original evidence"}' } });
    await db.logArchive.create({ data: { taskId: 'task-a', stageKey: 'build', relativePath: 'original.log', bytes: 100, complete: true } });
    await db.onModuleDestroy();
    db = undefined;
    // Fail after every DDL/backfill statement, immediately before COMMIT.
    await execute('2026100802_release_versions', true);
    db = new DatabaseService();
    await db.$connect();
    for (const table of ['Project', 'Plan', 'Task']) {
      const columns = await db.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info("${table}")`);
      assert(!columns.some(({ name }) => ['lastVersion', 'version'].includes(name)), 'Failed migration must roll back every new column');
    }
    assert.deepEqual(await db.$queryRawUnsafe('PRAGMA foreign_key_check'), []);
    assert.deepEqual(await db.$queryRawUnsafe('SELECT id, remoteReleaseId FROM Task ORDER BY id'), [
      { id: 'task-a', remoteReleaseId: 'remote-task-a' }, { id: 'task-b', remoteReleaseId: 'remote-task-b' },
      { id: 'task-other', remoteReleaseId: 'remote-task-other' }, { id: 'task-z', remoteReleaseId: 'remote-task-z' },
    ]);
    assert.equal((await db.stage.findFirstOrThrow()).detailJson, '{"health":"observed"}');
    await db.onModuleDestroy();
    db = undefined;
    const resolved = spawnSync('pnpm', ['exec', 'prisma', 'migrate', 'resolve', '--rolled-back', '2026100802_release_versions', '--schema', path.join(prismaDirectory, 'schema.prisma')], { encoding: 'utf8', env: process.env });
    assert.equal(resolved.status, 0, 'Confirmed rolled-back isolated migration can be resolved and retried');
    await execute('2026100802_release_versions');
    await execute('2026100802_release_versions');
    await execute('2026100901_auth_sessions');
    await execute('2026100901_auth_sessions');
    await execute('2026100904_versioned_config');
    db = new DatabaseService();
    await db.onModuleInit();
    const originalActor = await db.actor.findUniqueOrThrow({ where: { id: 'local-controller' } });
    assert.equal(originalActor.kind, 'local'); assert.equal(originalActor.name, 'Original controller');
    assert.equal(originalActor.username, null); assert.equal(originalActor.passwordHash, null); assert.equal(originalActor.disabled, false);
    assert.equal(await db.authSession.count(), 0);
    const tasks = await db.task.findMany({ orderBy: [{ projectId: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }] });
    assert.deepEqual(tasks.map(({ id, version }) => [id, version]), [
      ['task-z', '0.0.1'], ['task-a', '0.0.2'], ['task-b', '0.0.3'], ['task-other', '0.0.1'],
    ]);
    assert(tasks.every((task) => task.remoteReleaseId === `remote-${task.id}` && task.outputJson === '{"image":"sha256:original"}'));
    assert.equal((await db.project.findUniqueOrThrow({ where: { id: 'project-a' } })).lastVersion, '0.0.3');
    assert.equal((await db.project.findUniqueOrThrow({ where: { id: 'project-b' } })).lastVersion, '0.0.1');
    assert.equal((await db.plan.findUniqueOrThrow({ where: { id: 'plan-project-a' } })).version, null);
    assert.equal((await db.stage.findFirstOrThrow()).detailJson, '{"health":"observed"}');
    assert.equal((await db.event.findFirstOrThrow()).payloadJson, '{"message":"original evidence"}');
    assert.equal((await db.logArchive.findFirstOrThrow()).relativePath, 'original.log');
    assert.deepEqual(await db.$queryRawUnsafe('PRAGMA foreign_key_check'), []);
    await assert.rejects(db.task.update({ where: { id: 'task-a' }, data: { version: '0.0.1' } }), /Unique constraint/);
  } finally {
    if (db) await db.onModuleDestroy();
    if (previousUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousUrl;
    if (previousRoot === undefined) delete process.env.SHIPKIT_DATA_DIR; else process.env.SHIPKIT_DATA_DIR = previousRoot;
    await rm(directory, { recursive: true, force: true });
  }
});
