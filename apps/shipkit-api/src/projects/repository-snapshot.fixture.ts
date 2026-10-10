import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { RepositorySource, SourceSnapshot } from 'shipkit/platform';
import { SecretStore } from '../secrets/secret-store.js';
import { ProjectSourceService } from './project-source.service.js';

export async function repositorySnapshotFixture(directory?: string) {
  const root = directory ?? await mkdtemp(path.join(os.tmpdir(), 'shipkit-source-envelope-'));
  const previousKey = process.env.SHIPKIT_SECRET_KEY_FILE;
  const key = path.join(root, 'snapshot-key.json');
  await writeFile(key, JSON.stringify({ version: 1, activeKeyId: 'fixture', keys: { fixture: randomBytes(32).toString('base64') } }), { mode: 0o600 });
  process.env.SHIPKIT_SECRET_KEY_FILE = key;
  const secrets = new SecretStore(), sources = new ProjectSourceService(secrets);
  const repository: RepositorySource = { repoUrl: 'https://github.com/fixture/app.git', ref: { kind: 'branch', value: 'main' }, specPath: 'ship.yaml', provider: 'github', revision: 1 };
  const snapshot: SourceSnapshot = { repoUrl: repository.repoUrl, requestedRef: repository.ref, commit: 'a'.repeat(40),
    specPath: repository.specPath, sourceRevision: 1, provider: 'github', specDigest: 'c'.repeat(64), appName: 'fixture',
    spec: { schemaVersion: 2, name: 'fixture', services: { server: { context: '.', dockerfile: 'Dockerfile' } } } };
  const id = randomUUID();
  const project = { id, rootPath: `/repository/${id}`, configPath: path.join(root, 'profile.json'), targetKey: 'server',
    repositoryJson: JSON.stringify(repository), appName: 'fixture', projectIdentity: 'github.com/fixture/app', sourceRevision: 1, repositorySecret: null as string | null };
  const scope = { kind: 'repository', projectId: id, objectId: id, revision: 1 };
  return { root, key, sources, secrets, repository, snapshot, project, scope, close: async () => {
    if (previousKey === undefined) delete process.env.SHIPKIT_SECRET_KEY_FILE; else process.env.SHIPKIT_SECRET_KEY_FILE = previousKey;
    if (!directory) await rm(root, { recursive: true, force: true });
  } };
}
