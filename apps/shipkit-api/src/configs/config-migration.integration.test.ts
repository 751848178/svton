import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '../../generated/client/index.js';

test('incremental config migration retains existing project, target, plan, task, and log ledger', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'shipkit-upgrade-test-'));
  const root = path.join(directory, 'prisma');
  const schema = path.join(root, 'schema');
  const url = `file:${path.join(directory, 'platform.db')}`;
  const deploy = (schemaPath: string) => spawnSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy', '--schema', schemaPath], { encoding: 'utf8', env: { ...process.env, DATABASE_URL: url } });
  let db: PrismaClient | undefined;
  try {
    await mkdir(path.join(root, 'migrations'), { recursive: true });
    await writeFile(url.slice(5), '', { mode: 0o600 });
    await cp('prisma/schema', schema, { recursive: true });
    for (const name of await readdir('prisma/migrations')) if (name !== '2026100904_versioned_config') await cp(path.join('prisma/migrations', name), path.join(root, 'migrations', name), { recursive: true });
    assert.equal(deploy(schema).status, 0, 'baseline migrations must apply');
    db = new PrismaClient({ datasources: { db: { url } } });
    await db.$executeRawUnsafe('INSERT INTO "Workspace" ("id", "name") VALUES (?, ?)', 'local', 'Local');
    await db.$executeRawUnsafe('INSERT INTO "Actor" ("id", "kind", "name") VALUES (?, ?, ?)', 'actor', 'local', 'Actor');
    await db.$executeRawUnsafe('INSERT INTO "Project" ("id", "workspaceId", "name", "rootPath", "configPath", "targetKey", "projectIdentity", "createdByActorId", "updatedAt", "lastVersion") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 'p', 'local', 'Legacy', '/tmp/legacy', '/tmp/config', 'prod', 'legacy', 'actor', new Date(), '1.2.3');
    await db.$executeRawUnsafe('INSERT INTO "Target" ("id", "projectId", "targetKey") VALUES (?, ?, ?)', 'target', 'p', 'prod');
    await db.$executeRawUnsafe('INSERT INTO "Plan" ("id", "projectId", "kind", "targetKey", "selectionJson", "snapshotJson", "fingerprint", "actorId", "expiresAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', 'plan', 'p', 'release', 'prod', '["api"]', '{"keepEnv":true}', 'legacy-fingerprint', 'actor', new Date());
    await db.$executeRawUnsafe('INSERT INTO "Task" ("id", "projectId", "planId", "kind", "actorId", "version") VALUES (?, ?, ?, ?, ?, ?)', 'task', 'p', 'plan', 'release', 'actor', '1.2.3');
    await db.$executeRawUnsafe('INSERT INTO "LogArchive" ("id", "taskId", "stageKey", "serviceKey", "relativePath") VALUES (?, ?, ?, ?, ?)', 'log', 'task', 'build', 'api', 'logs/task/build.api.log');
    await db.$disconnect(); db = undefined;
    assert.equal(deploy('prisma/schema').status, 0, 'incremental migration must apply');
    db = new PrismaClient({ datasources: { db: { url } } });
    const project = await db.project.findUniqueOrThrow({ where: { id: 'p' }, include: { targets: true } });
    assert.equal(project.lastVersion, '1.2.3'); assert.equal(project.sourceKind, 'directory'); assert.equal(project.sourceRevision, 1);
    assert.equal(project.repositorySecret, null); assert.equal(project.targets.length, 1);
    const plan = await db.plan.findUniqueOrThrow({ where: { id: 'plan' } });
    assert.equal(plan.snapshotJson, '{"keepEnv":true}'); assert.equal(plan.privateSnapshot, null); assert.equal(plan.configVersionId, null);
    assert.equal(await db.task.count(), 1); assert.equal(await db.logArchive.count(), 1);
    assert.equal(await db.configVersion.count(), 0);
    assert.deepEqual(await db.$queryRawUnsafe('PRAGMA foreign_key_check'), []);
  } finally { await db?.$disconnect(); await rm(directory, { recursive: true, force: true }); }
});
