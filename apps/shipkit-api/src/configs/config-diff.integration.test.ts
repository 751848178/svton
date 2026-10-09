import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { databaseFixture } from '../testing/database.fixture.js';
import { LocalPolicyService } from '../policy/local-policy.service.js';
import type { RequestContext } from '../policy/request-context.js';
import { SecretStore } from '../secrets/secret-store.js';
import { ConfigPrivateService } from './config-private.service.js';
import { ConfigRepository } from './config.repository.js';
import { ConfigService } from './config.service.js';
import type { ServicePatch } from './config.types.js';

test('frozen config diff compares known scoped references and never interprets unknown state as empty', async () => {
  const fixture = await databaseFixture(), previousKey = process.env.SHIPKIT_SECRET_KEY_FILE;
  const keyFile = path.join(fixture.directory, 'key.json');
  process.env.SHIPKIT_SECRET_KEY_FILE = keyFile;
  const context: RequestContext = { actorId: 'local-controller', workspaceId: 'local', requestId: 'config-diff', source: 'session', sessionId: 'test' };
  const beforeSecret = 'isolated-before-secret', afterSecret = 'isolated-after-secret';
  try {
    await writeFile(keyFile, JSON.stringify({ version: 1, activeKeyId: 'test', keys: { test: randomBytes(32).toString('base64') } }), { mode: 0o600 });
    const project = await fixture.db.project.create({ data: { workspaceId: 'local', name: 'Diff fixture', rootPath: fixture.directory,
      configPath: path.join(fixture.directory, 'connections.json'), targetKey: 'prod', projectIdentity: 'diff-fixture', createdByActorId: context.actorId,
      targets: { create: [{ targetKey: 'prod' }, { targetKey: 'test' }] }, services: { create: ['api', 'web', 'worker'].map(serviceKey => ({ serviceKey })) } } });
    const foreign = await fixture.db.project.create({ data: { workspaceId: 'local', name: 'Other project', rootPath: path.join(fixture.directory, 'other'),
      configPath: path.join(fixture.directory, 'connections.json'), targetKey: 'prod', projectIdentity: 'foreign-diff', createdByActorId: context.actorId,
      targets: { create: [{ targetKey: 'prod' }] }, services: { create: [{ serviceKey: 'api' }] } } });
    const repository = new ConfigRepository(fixture.db, new LocalPolicyService());
    const configs = new ConfigService(repository, new ConfigPrivateService(repository, new SecretStore()));
    const freeze = async (projectId: string, targetKey: string, version: string, services: ServicePatch[]) => {
      const draft = await configs.create(projectId, targetKey, { name: 'Diff version', services }, context);
      return configs.freeze(projectId, targetKey, draft.id, { etag: draft.etag, version }, context);
    };
    const old = await freeze(project.id, 'prod', '0.0.1', [
      { serviceKey: 'api', variables: [{ key: 'PRIVATE', value: beforeSecret }, { key: 'REMOVED', value: 'removed-value' }, { key: 'SAME', value: 'stable-value', secret: false }] },
      { serviceKey: 'web', noEnv: true },
    ]);
    const next = await freeze(project.id, 'prod', '0.0.2', [
      { serviceKey: 'api', variables: [{ key: 'PRIVATE', value: afterSecret }, { key: 'ADDED', value: '' }, { key: 'SAME', value: 'stable-value', secret: false }] },
      { serviceKey: 'web', variables: [{ key: 'ENABLED', value: 'enabled-value' }] },
      { serviceKey: 'worker', variables: [{ key: 'FRESH', value: 'worker-value' }] },
    ]);
    await configs.archive(project.id, 'prod', old.id, context);
    const diff = await configs.diff(project.id, 'prod', next.id, ['api', 'web', 'worker'], {
      api: { versionId: old.id }, web: { versionId: old.id }, worker: { versionId: old.id },
    });
    assert.deepEqual(diff, { services: {
      api: { added: ['ADDED'], removed: ['REMOVED'], changed: ['PRIVATE'], noEnvChanged: false },
      web: { added: ['ENABLED'], removed: [], changed: [], noEnvChanged: true },
    } });
    for (const value of [beforeSecret, afterSecret, 'removed-value', 'stable-value', 'enabled-value', 'worker-value']) assert(!JSON.stringify(diff).includes(value));
    const otherTarget = await freeze(project.id, 'test', '0.0.1', [{ serviceKey: 'worker', noEnv: true }]);
    const otherProject = await freeze(foreign.id, 'prod', '0.0.1', [{ serviceKey: 'api', noEnv: true }]);
    assert.deepEqual(await configs.diff(project.id, 'prod', next.id, ['api', 'web', 'worker'], {
      api: null, web: { versionId: 'missing-version' }, worker: { versionId: otherTarget.id },
    }), { services: {} });
    assert.deepEqual(await configs.diff(project.id, 'prod', next.id, ['api'], { api: { versionId: otherProject.id } }), { services: {} });
    assert.deepEqual(await configs.diff(project.id, 'prod', next.id, ['api'], {}), { services: {} });
    assert.deepEqual(await configs.diff(project.id, 'prod', next.id, ['api'], { api: { versionId: next.id } }), {
      services: { api: { added: [], removed: [], changed: [], noEnvChanged: false } },
    });
    await assert.rejects(configs.diff(project.id, 'prod', next.id, ['missing'], {}), /覆盖/);
    await assert.rejects(configs.diff(project.id, 'prod', next.id, ['api', 'api'], {}), /范围无效/);
  } finally {
    if (previousKey === undefined) delete process.env.SHIPKIT_SECRET_KEY_FILE; else process.env.SHIPKIT_SECRET_KEY_FILE = previousKey;
    await fixture.dispose();
  }
});
