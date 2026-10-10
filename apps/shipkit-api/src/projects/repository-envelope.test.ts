import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { repositorySnapshotFixture } from './repository-snapshot.fixture.js';

test('public snapshots are encrypted metadata, and credentials project only real token and username', async () => {
  const h = await repositorySnapshotFixture();
  try {
    const publicProject = { ...h.project, repositorySecret: h.sources.sealRepository({ sourceSnapshot: h.snapshot }, h.project.id, 1, h.repository) };
    assert.equal(h.sources.hasCredential(publicProject), false);
    assert.equal(h.sources.hasUsername(publicProject), false);
    assert.deepEqual(h.sources.credentials(publicProject), {});
    assert.deepEqual(h.sources.inspectionInput(publicProject).sourceSnapshot, h.snapshot);
    assert.equal(Object.hasOwn(h.sources.input(publicProject), 'sourceSnapshot'), false);
    assert(!publicProject.repositorySecret.includes(h.snapshot.commit));
    const privateProject = { ...h.project, repositorySecret: h.sources.sealRepository({ token: 'fixture-token', username: 'fixture-reader', sourceSnapshot: h.snapshot }, h.project.id, 1, h.repository) };
    assert.equal(h.sources.hasCredential(privateProject), true);
    assert.deepEqual(h.sources.credentials(privateProject), { token: 'fixture-token', username: 'fixture-reader' });
    assert(!JSON.stringify(h.sources.credentials(privateProject)).includes('sourceSnapshot'));
    const legacy = { ...h.project, repositorySecret: h.sources.sealToken('legacy-token', h.project.id, 1, 'legacy-reader') };
    assert.deepEqual(h.sources.credentials(legacy), { token: 'legacy-token', username: 'legacy-reader' });
    assert.equal(Object.hasOwn(h.sources.inspectionInput(legacy), 'sourceSnapshot'), false);
    assert.equal(Object.hasOwn(h.sources.inspectionInput(h.project), 'sourceSnapshot'), false);
    assert.throws(() => h.sources.sealRepository({ sourceSnapshot: h.snapshot }, h.project.id, 1,
      { ...h.repository, ref: { kind: 'branch', value: 'other' } }), /快照无法验证/);
  } finally { await h.close(); }
});

test('scope changes, ciphertext tampering and absent master key never fall back to fresh metadata', async () => {
  const h = await repositorySnapshotFixture();
  try {
    const project = { ...h.project, repositorySecret: h.sources.sealRepository({ sourceSnapshot: h.snapshot }, h.project.id, 1, h.repository) };
    for (const changed of [{ ...project, id: 'other-project' }, { ...project, sourceRevision: 2 }]) {
      assert.throws(() => h.sources.inspectionInput(changed), /密文无法验证/);
      assert.throws(() => h.sources.credentials(changed), /密文无法验证/);
    }
    const envelope = JSON.parse(project.repositorySecret);
    envelope.data = (envelope.data[0] === 'A' ? 'B' : 'A') + envelope.data.slice(1);
    assert.throws(() => h.sources.inspectionInput({ ...project, repositorySecret: JSON.stringify(envelope) }), /密文无法验证/);
    delete process.env.SHIPKIT_SECRET_KEY_FILE;
    assert.throws(() => h.sources.hasCredential(project), /主密钥不可用/);
    process.env.SHIPKIT_SECRET_KEY_FILE = h.key;
  } finally { await h.close(); }
});

test('present malformed or mismatched snapshots fail closed for inspection and credential consumers', async () => {
  const h = await repositorySnapshotFixture();
  try {
    const mutations: unknown[] = [null, [], {}, 'snapshot',
      { ...h.snapshot, sourceRevision: '1' }, { ...h.snapshot, sourceRevision: 2 },
      { ...h.snapshot, repoUrl: [h.snapshot.repoUrl] }, { ...h.snapshot, repoUrl: 'https://github.com/other/app.git' },
      { ...h.snapshot, requestedRef: { kind: 'tag', value: 'main' } }, { ...h.snapshot, requestedRef: { kind: 'branch', value: 'other' } },
      { ...h.snapshot, specPath: 'other.yaml' }, { ...h.snapshot, appName: 'other' },
      { ...h.snapshot, commit: 'short' }, { ...h.snapshot, specDigest: 'bad' }, { ...h.snapshot, provider: 'generic' },
      { ...h.snapshot, spec: { ...h.snapshot.spec, name: 'other' } }];
    for (const sourceSnapshot of mutations) {
      const project = { ...h.project, repositorySecret: h.secrets.seal({ sourceSnapshot }, h.scope) };
      assert.throws(() => h.sources.inspectionInput(project), /快照无法验证/);
      assert.throws(() => h.sources.credentials(project), /快照无法验证/);
    }
    const sealed = h.sources.sealRepository({ sourceSnapshot: h.snapshot }, h.project.id, 1, h.repository);
    const changedSources = [
      { ...h.repository, repoUrl: 'https://github.com/other/app.git' }, { ...h.repository, repoUrl: [h.repository.repoUrl] }, { ...h.repository, specPath: 'other.yaml' },
      { ...h.repository, ref: { kind: 'branch', value: 'other' } }, { ...h.repository, revision: '1' },
      { ...h.repository, provider: 'generic' },
    ];
    for (const repository of changedSources) assert.throws(() => h.sources.inspectionInput({ ...h.project, repositorySecret: sealed, repositoryJson: JSON.stringify(repository) }), /快照无法验证/);
    assert.throws(() => h.sources.inspectionInput({ ...h.project, repositorySecret: sealed, appName: 'other' }), /快照无法验证/);
    const fixed = { ...h.repository, ref: { kind: 'commit', value: 'b'.repeat(40) } };
    const wrongCommit = { ...h.snapshot, requestedRef: fixed.ref };
    assert.throws(() => h.sources.inspectionInput({ ...h.project, repositoryJson: JSON.stringify(fixed), repositorySecret: h.secrets.seal({ sourceSnapshot: wrongCommit }, h.scope) }), /快照无法验证/);
  } finally { await h.close(); }
});

test('invalid encrypted payload and credential types cannot reach transport options', async () => {
  const h = await repositorySnapshotFixture();
  try {
    for (const value of [null, [], 'payload', { token: 42 }, { token: '' }, { token: 'valid', username: [] }, { username: 'reader' }]) {
      const project = { ...h.project, repositorySecret: h.secrets.seal(value, h.scope) };
      assert.throws(() => h.sources.credentials(project), /私密输入无法验证/);
    }
  } finally { await h.close(); }
});

test('persisted source revisions must be positive safe integers before sealing or inspection', async () => {
  const h = await repositorySnapshotFixture();
  try {
    for (const revision of [0, -1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '1'] as unknown as number[]) {
      const source = { ...h.repository, revision }, sourceSnapshot = { ...h.snapshot, sourceRevision: revision };
      assert.throws(() => h.sources.sealRepository({ sourceSnapshot }, h.project.id, revision, source), /快照无法验证/);
      const scope = { ...h.scope, revision };
      const project = { ...h.project, sourceRevision: revision, repositoryJson: JSON.stringify(source),
        repositorySecret: h.secrets.seal({ sourceSnapshot }, scope) };
      assert.throws(() => h.sources.inspectionInput(project), /快照无法验证/);
    }
  } finally { await h.close(); }
});
