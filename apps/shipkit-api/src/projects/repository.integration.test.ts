import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { SourceSnapshot, PrivateProjectSnapshot, ExecutionPlan } from 'shipkit/platform';
import { AppModule } from '../app.module.js';
import { PlatformExecutorService } from '../executor/platform-executor.service.js';
import { databaseFixture } from '../testing/database.fixture.js';
import { ProjectSourceService } from './project-source.service.js';
import { PlanInputService } from '../tasks/plan-input.service.js';
import { TaskRepository } from '../tasks/task.repository.js';
import { SecretStore } from '../secrets/secret-store.js';
import { ConfigService } from '../configs/config.service.js';

test('repository HTTP intake keeps credentials private, pins previews, and seals frozen task inputs', { timeout: 45_000 }, async () => {
  const { parseRuntimeEnv } = await import('shipkit/platform');
  const fixture = await databaseFixture();
  const previousKey = process.env.SHIPKIT_SECRET_KEY_FILE;
  const keyPath = path.join(fixture.directory, 'key.json');
  await writeFile(keyPath, JSON.stringify({ version: 1, activeKeyId: 'test', keys: { test: randomBytes(32).toString('base64') } }), { mode: 0o600 });
  process.env.SHIPKIT_SECRET_KEY_FILE = keyPath;
  const configPath = path.join(fixture.directory, 'connections.json');
  await writeFile(configPath, '{}', { mode: 0o600 });
    const gitSecret = 'private-git-value-acceptance';
  const envSecret = 'private-runtime-value-acceptance';
  const commit = 'a'.repeat(40);
  const spec = { schemaVersion: 2 as const, name: 'fixture', services: { api: { context: '.', dockerfile: 'Dockerfile', ports: ['18111:3000'] } } };
  const source = (revision: string | number | undefined): SourceSnapshot => ({ repoUrl: 'https://github.com/fixture/app.git', requestedRef: { kind: 'branch', value: 'main' }, commit,
    specPath: 'ship.yaml', sourceRevision: revision, specDigest: 'spec-digest', appName: 'fixture', spec });
  let app: Awaited<ReturnType<typeof NestFactory.create>> | undefined;
  try {
    app = await NestFactory.create(AppModule, { logger: false });
    const executor = app.get(PlatformExecutorService);
    let archiveDuringPrepare = false;
    const seenTokens: Array<string | undefined> = [];
    const seenUsernames: Array<string | undefined> = [];
    executor.resolveRepositorySource = async (input, options) => { seenTokens.push(options?.token); seenUsernames.push(options?.username); return source(input.revision); };
    executor.inspectProject = async () => ({ name: 'fixture', projectIdentity: 'repository:fixture', targetKey: 'test',
      targets: [{ targetKey: 'test', url: 'http://127.0.0.1:1', ip: '127.0.0.1' }], source: { branch: 'main', commit, dirty: false, repo: source(1).repoUrl },
      builder: { mode: 'static' }, runtime: { url: 'http://127.0.0.1:1', ip: '127.0.0.1', check: { ok: true }, currentReleaseId: null },
      services: [{ serviceKey: 'api', currentImage: null, spec: spec.services.api, hasEnv: false }], registry: { configured: false, verification: 'not-configured' } });
    executor.preparePlan = async (_input, request, options) => {
      const configuration = options?.runtimeConfiguration;
      assert(configuration?.envFiles.api?.includes(envSecret));
      await options?.onPrivateSnapshot?.({ config: { privateConnection: 'saved-control-credential' }, spec, identity: 'repository:fixture', targetKey: 'test',
        runtime: { url: 'http://127.0.0.1:1', token: 'saved-runtime-credential' }, envFiles: configuration!.envFiles,
        configRefs: configuration!.configRefs, redactionValues: [gitSecret, envSecret], sourceSnapshot: source(1) } as unknown as PrivateProjectSnapshot);
      if (archiveDuringPrepare) await fixture.db.configVersion.update({ where: { id: request.configVersionId! }, data: { archivedAt: new Date() } });
      return { kind: request.kind, selection: request.services, baseReleaseId: null, sourceMode: 'git', keepEnv: false, keepBuilder: false,
        configMode: 'version', configBindings: { api: { mode: 'version', configRef: configuration!.configRefs.api } },
        fingerprint: 'fixed-fingerprint', expiresAt: new Date(Date.now() + 60000).toISOString(),
        detail: { projectIdentity: 'repository:fixture', targetKey: 'test', sourceSnapshot: source(1) } } as ExecutionPlan;
    };
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    const authFetch = await fixture.authenticatedFetch(base);
    const headers = { 'Content-Type': 'application/json', 'x-shipkit-local': '1', Origin: 'http://127.0.0.1:8769' };
    const call = async (route: string, body?: unknown, method = 'POST') => {
      const response = await authFetch(`${base}${route}`, body === undefined ? undefined : { method, headers, body: JSON.stringify(body) });
      const text = await response.text();
      for (const value of [gitSecret, envSecret, 'git-reader-fixture', 'saved-control-credential', 'saved-runtime-credential']) assert(!text.includes(value), `${route} leaked a secret`);
      return { status: response.status, body: JSON.parse(text) };
    };
    const repository = { url: source(1).repoUrl, ref: { kind: 'branch', value: '' }, specPath: 'ship.yaml' };
    const body = { name: 'Repository fixture', sourceKind: 'repository', repository, token: gitSecret, username: 'git-reader-fixture', configPath, expectedCommit: commit };
    assert.equal((await call('/api/projects', { ...body, expectedCommit: 'b'.repeat(40) })).status, 409);
    const registered = await call('/api/projects', body);
    assert.equal(registered.status, 201);
    const id = registered.body.id as string;
    assert.equal(registered.body.sourceKind, 'repository');
    assert.equal(registered.body.repository.ref.value, 'main');
    assert.equal(registered.body.hasCredential, true);
    assert.equal((await call('/api/projects', body)).status, 409);
    const settings = await call(`/api/projects/${id}/repository`);
    assert.equal(settings.body.hasCredential, true);
    assert.equal(settings.body.hasUsername, true);
    assert.equal((await call(`/api/projects/${id}/repository/preview`, { repository })).status, 201);
    assert.equal(seenTokens.at(-1), gitSecret);
    assert.equal(seenUsernames.at(-1), 'git-reader-fixture');
    const lookalike = { ...repository, url: 'https://github.com/another/app.git' };
    const countBefore = seenTokens.length;
    assert.equal((await call(`/api/projects/${id}/repository/preview`, { repository: lookalike })).status, 400);
    assert.equal(seenTokens.length, countBefore, 'saved credentials must never be sent to a different repository');
    const draft = await call(`/api/projects/${id}/configs/test/drafts`, { name: 'Production settings', services: [{ serviceKey: 'api', variables: [{ key: 'APP_VALUE', value: envSecret, secret: true }] }] });
    assert.equal(draft.status, 201);
    assert.equal((await call(`/api/projects/${id}/configs/test/drafts/${draft.body.id}/preview?etag=${draft.body.etag}`)).body.etag, draft.body.etag);
    assert.equal((await call(`/api/projects/${id}/configs/test/drafts/${draft.body.id}/preview?etag=${draft.body.etag + 1}`)).status, 409);
    const frozen = await call(`/api/projects/${id}/configs/test/drafts/${draft.body.id}/freeze`, { etag: draft.body.etag, version: '0.0.1' });
    assert.equal(frozen.status, 201);
    assert.equal((await call(`/api/projects/${id}/plans`, { kind: 'release', services: ['api'] })).status, 400, 'repository mode must reject implicit local env files');
    const planned = await call(`/api/projects/${id}/plans`, { kind: 'release', services: ['api'], configMode: 'version', configVersionId: frozen.body.id });
    assert.equal(planned.status, 201, JSON.stringify(planned.body));
    assert.equal(planned.body.detail.configBindings.api.version, '0.0.1');
    assert.equal(planned.body.configVersionId, frozen.body.id);
    const plan = await fixture.db.plan.findUniqueOrThrow({ where: { id: planned.body.id } });
    assert(plan.privateSnapshot && !plan.privateSnapshot.includes(envSecret));
    assert.equal(plan.configVersionId, frozen.body.id);
    assert(!plan.snapshotJson.includes(envSecret));
    const project = await fixture.db.project.findUniqueOrThrow({ where: { id } });
    assert(project.repositorySecret && !project.repositorySecret.includes(gitSecret));
    assert(!project.repositorySecret.includes('git-reader-fixture'));
    archiveDuringPrepare = true;
    const planCount = await fixture.db.plan.count();
    const archivedRace = await call(`/api/projects/${id}/plans`, { kind: 'release', services: ['api'], configMode: 'version', configVersionId: frozen.body.id });
    assert.equal(archivedRace.status, 400, 'archiving while preparing must stop creation of a new plan');
    assert.equal(await fixture.db.plan.count(), planCount);
    archiveDuringPrepare = false;
    await writeFile(configPath, '{"privateConnection":"changed-after-plan"}');
    const actor = await fixture.db.actor.findFirstOrThrow({ where: { name: 'fixture-operator' } });
    const session = await fixture.db.authSession.findFirstOrThrow({ where: { actorId: actor.id } });
    const context = { actorId: actor.id, workspaceId: 'local', requestId: 'repository-task-test', source: 'session' as const, sessionId: session.id };
    const tasks = new TaskRepository(fixture.db);
    const task = (await tasks.create(id, plan.id, 'fixed', context)).task;
    const freshInputs = new PlanInputService(app.get(SecretStore), app.get(ConfigService), app.get(ProjectSourceService));
    const restoredInput = freshInputs.taskInput(task);
    assert.equal(restoredInput.executionKind, 'release');
    const captured = restoredInput.privateSnapshot!;
    assert.equal(parseRuntimeEnv(captured.envFiles.api)?.APP_VALUE, envSecret);
    assert.equal(captured.runtime.token, 'saved-runtime-credential');
    assert.equal(captured.sourceSnapshot?.commit, commit);
    await fixture.db.task.update({ where: { id: task.id }, data: { activeScope: null, status: 'succeeded', cleanupState: 'static' } });
    assert.equal((await call(`/api/projects/${id}/repository`, { revision: 1, repository: { ...repository, ref: { kind: 'branch', value: 'main' } } }, 'PATCH')).status, 200);
    assert.equal(seenTokens.at(-1), gitSecret);
    assert.equal(seenUsernames.at(-1), 'git-reader-fixture');
    assert.equal((await call(`/api/projects/${id}/repository`, { revision: 1, repository }, 'PATCH')).status, 409);
    await assert.rejects(tasks.create(id, plan.id, 'stale-source', context), /仓库设置已变化/);
    assert.equal(freshInputs.taskInput(await tasks.get(task.id)).privateSnapshot!.envFiles.api, captured.envFiles.api);
    const cleared = await call(`/api/projects/${id}/repository`, { revision: 2, repository, token: null }, 'PATCH');
    assert.equal(cleared.status, 200); assert.equal(cleared.body.hasCredential, false);
    assert.equal(cleared.body.hasUsername, false);
  } finally {
    await app?.close();
    if (previousKey === undefined) delete process.env.SHIPKIT_SECRET_KEY_FILE; else process.env.SHIPKIT_SECRET_KEY_FILE = previousKey;
    await fixture.dispose();
  }
});
