import { writeFile } from 'node:fs/promises';
import type { ExecutionPlan, LiveProject, PrivateProjectSnapshot } from 'shipkit/platform';
import { databaseFixture } from '../testing/database.fixture.js';
import { PlatformExecutorService } from '../executor/platform-executor.service.js';
import { LocalPolicyService } from '../policy/local-policy.service.js';
import type { RequestContext } from '../policy/request-context.js';
import { ProjectRepository } from './project.repository.js';
import { ProjectService } from './project.service.js';
import { RepositoryProjectService } from './repository-project.service.js';
import { repositorySnapshotFixture } from './repository-snapshot.fixture.js';

export async function repositoryIntegrationFixture() {
  const database = await databaseFixture();
  const h = await repositorySnapshotFixture(database.directory);
  await writeFile(h.project.configPath, '{}', { mode: 0o600 });
  const executor = new PlatformExecutorService();
  const state = { commit: h.snapshot.commit, metadataRequests: 0, beforeResolve: undefined as (() => Promise<void>) | undefined };
  executor.resolveRepositorySource = async source => {
    state.metadataRequests++;
    const hook = state.beforeResolve; state.beforeResolve = undefined; await hook?.();
    return { ...structuredClone(h.snapshot), commit: state.commit, sourceRevision: source.revision, specPath: source.specPath,
      requestedRef: { ...source.ref, value: source.ref.value || 'main' } };
  };
  executor.inspectProject = async input => {
    const snapshot = input.sourceSnapshot ?? await executor.resolveRepositorySource(input.repository!);
    return { name: 'fixture', projectIdentity: h.project.projectIdentity, targetKey: 'server',
      targets: [{ targetKey: 'server', url: 'http://127.0.0.1:1', ip: '127.0.0.1' }], source: { branch: 'main', commit: snapshot.commit, dirty: false, repo: snapshot.repoUrl },
      builder: { mode: 'static' }, runtime: { url: 'http://127.0.0.1:1', ip: '127.0.0.1', check: { ok: true }, currentReleaseId: null },
      services: [{ serviceKey: 'server', currentImage: null, spec: snapshot.spec.services.server!, hasEnv: false }], registry: { configured: false, verification: 'not-configured' } } satisfies LiveProject;
  };
  executor.fetchHistory = async input => {
    if (!input.sourceSnapshot) throw new Error('History must receive registered metadata');
    return { app: 'fixture', current: null, items: [] };
  };
  executor.diagnoseProject = async input => {
    if (input.sourceSnapshot) throw new Error('Explicit inspection must resolve fresh metadata');
    return { live: await executor.inspectProject(input), checks: [] };
  };
  executor.preparePlan = async (input, request, options) => {
    if (input.sourceSnapshot) throw new Error('Plan must resolve fresh metadata');
    const sourceSnapshot = await executor.resolveRepositorySource(input.repository!, options?.repository);
    await options?.onPrivateSnapshot?.({ config: {}, spec: sourceSnapshot.spec, identity: input.projectIdentity, targetKey: input.targetKey,
      runtime: { url: 'http://127.0.0.1:1', token: 'fixture-runtime-token' }, envFiles: {}, redactionValues: [], sourceSnapshot } as unknown as PrivateProjectSnapshot);
    return { kind: request.kind, selection: request.services, baseReleaseId: null, sourceMode: 'git', keepEnv: true, keepBuilder: false,
      fingerprint: 'fixture', expiresAt: new Date(Date.now() + 60000).toISOString(), detail: { targetKey: 'server', projectIdentity: h.project.projectIdentity, sourceSnapshot } } as ExecutionPlan;
  };
  const policy = new LocalPolicyService(), projects = new ProjectRepository(database.db);
  const api = new ProjectService(projects, executor, policy, h.sources);
  const repositories = new RepositoryProjectService(database.db, projects, h.sources, executor, policy);
  const context: RequestContext = { actorId: 'local-controller', workspaceId: 'local', requestId: 'fixture-repository-snapshot', source: 'session', sessionId: 'fixture-session' };
  const body = { name: 'Fixture', repository: { ...h.repository, ref: { kind: 'branch', value: '' } }, configPath: h.project.configPath, targetKey: 'server' };
  return { ...h, ...database, executor, state, projects, api, repositories, context, body, close: async () => { await h.close(); await database.dispose(); } };
}
