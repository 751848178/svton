import { randomBytes } from 'node:crypto';
import type { DatabaseService } from '../database/database.service.js';
import { hashPassword } from '../auth/password.js';
import { sessionHash } from '../auth/cookie.js';

const TABLES = ['Workspace', 'Actor', 'AuthSession', 'Project', 'Target', 'Service', 'Plan', 'Task',
  'Stage', 'Event', 'LogArchive', 'ResourceLease', 'Audit', 'ConfigDraft', 'ConfigVersion'] as const;
export async function seedIdentityLegacy(db: DatabaseService) {
  const password = randomBytes(24).toString('base64url'), token = randomBytes(32).toString('base64url');
  const passwordHash = await hashPassword(password), hash = sessionHash(token);
  await db.actor.create({ data: { id: 'legacy-user', kind: 'user', name: 'Legacy User', username: 'legacy-user', passwordHash } });
  await db.authSession.create({ data: { id: hash, actorId: 'legacy-user', expiresAt: new Date(Date.now() + 3_600_000) } });
  await db.project.create({ data: { id: 'legacy-project', workspaceId: 'local', name: 'Legacy', rootPath: '/fixture/project',
    configPath: '/fixture/config', targetKey: 'prod', projectIdentity: 'legacy-project', createdByActorId: 'legacy-user',
    lastVersion: '1.2.3', repositorySecret: 'fixture-ciphertext-repository', targets: { create: { id: 'legacy-target', targetKey: 'prod' } },
    services: { create: { id: 'legacy-service', serviceKey: 'server', entryUrl: 'http://127.0.0.1:1234' } } } });
  await db.configDraft.create({ data: { id: 'legacy-draft', projectId: 'legacy-project', targetKey: 'prod', name: 'Legacy config',
    actorId: 'legacy-user', servicesJson: '{"ciphertext":"fixture-config"}' } });
  await db.configVersion.create({ data: { id: 'legacy-config', projectId: 'legacy-project', targetKey: 'prod', draftId: 'legacy-draft',
    name: 'Legacy config', version: '0.0.1', actorId: 'legacy-user', fingerprint: 'fixture-fingerprint', servicesJson: '{"ciphertext":"fixture-config"}' } });
  await db.plan.create({ data: { id: 'legacy-plan', projectId: 'legacy-project', kind: 'release', targetKey: 'prod', version: '1.2.3',
    selectionJson: '["server"]', snapshotJson: '{"source":"legacy"}', privateSnapshot: 'fixture-ciphertext-plan',
    configVersionId: 'legacy-config', fingerprint: 'legacy-fingerprint', actorId: 'legacy-user', expiresAt: new Date(Date.now() + 60_000) } });
  await db.task.create({ data: { id: 'legacy-task', projectId: 'legacy-project', planId: 'legacy-plan', kind: 'release',
    version: '1.2.3', status: 'succeeded', actorId: 'legacy-user', remoteReleaseId: 'legacy-remote', outputJson: '{"saved":true}' } });
  await db.stage.create({ data: { id: 'legacy-stage', taskId: 'legacy-task', stageKey: 'verify', status: 'succeeded' } });
  await db.event.create({ data: { id: 'legacy-event', taskId: 'legacy-task', seq: 1, type: 'log', payloadJson: '{"legacy":true}' } });
  await db.logArchive.create({ data: { id: 'legacy-log', taskId: 'legacy-task', stageKey: 'verify', relativePath: 'legacy.log', bytes: 10, complete: true } });
  await db.resourceLease.create({ data: { id: 'legacy-lease', taskId: 'legacy-task', provider: 'fixture', leaseRef: 'original', status: 'released' } });
  await db.audit.create({ data: { id: 'legacy-audit', workspaceId: 'local', actorId: 'legacy-user', requestId: 'legacy-request',
    action: 'legacy.saved', resourceType: 'project', resourceId: 'legacy-project', outcome: 'succeeded' } });
  return { token, hash, password, passwordHash };
}
export async function identityLegacySnapshot(db: DatabaseService) {
  const rows: Record<string, unknown> = {};
  for (const table of TABLES) rows[table] = await db.$queryRawUnsafe(`SELECT * FROM "${table}" ORDER BY id`);
  const definitions = await db.$queryRawUnsafe('SELECT name, sql FROM sqlite_master WHERE type=\'table\' AND name IN (\'Actor\',\'AuthSession\') ORDER BY name');
  return { rows, definitions };
}
