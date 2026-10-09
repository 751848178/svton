import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import { syncBuiltinESMExports } from 'node:module';
import { SecretStore } from '../secrets/secret-store.js';
import { snapshotFingerprint } from '../../../../shipkit/src/platform/private-fingerprint.js';
import { loadProject } from '../../../../shipkit/src/platform/project-context.js';
import { executeTask } from '../../../../shipkit/src/platform/execute-task.js';
import type { PrivateProjectSnapshot, ExecutionKind, ExecutionPlan } from 'shipkit/platform';

function fixture(executionKind: ExecutionKind): PrivateProjectSnapshot {
  return { executionKind,
    config: { builder: { mode: 'static', static: { url: 'http://offline-builder.invalid', token: 'fixture-builder-token' } },
      runtime: { targets: { local: { url: 'http://runtime.invalid', token: 'fixture-runtime-token' } } },
      registry: { url: 'registry.invalid', namespace: 'fixture' }, source: { repo: 'https://git.invalid/org/project', ref: 'main' } },
    spec: { schemaVersion: 2, name: 'fixture', services: { api: { dockerfile: 'api/Dockerfile', context: 'api', ports: ['19751:80'],
      healthcheck: { path: '/', hostPort: 19751, timeoutSeconds: 15 }, platform: 'linux/arm64' } } },
    identity: 'git.invalid/org/project', runtime: { url: 'http://runtime.invalid', token: 'fixture-runtime-token', via: 'plaintext' },
    targetKey: 'local', envFiles: { api: 'VALUE="synthetic secret"\nEMPTY=""\n' }, redactionValues: ['synthetic secret'],
    configRefs: { api: { versionId: 'frozen-version', version: '0.0.1', name: 'Production config', serviceKey: 'api' } },
    noEnvServices: [], configDigest: 'connection-digest', configFingerprint: 'secret-value-fingerprint', gitRef: 'a'.repeat(40) };
}

for (const kind of ['release', 'config-only', 'rollback'] as const) {
  test(`${kind} fingerprint survives authenticated encryption and rejects changed inputs before any network`, async t => {
    const directory = await mkdtemp(path.join(tmpdir(), 'shipkit-plan-fingerprint-'));
    const previous = process.env.SHIPKIT_SECRET_KEY_FILE;
    process.env.SHIPKIT_SECRET_KEY_FILE = path.join(directory, 'key.json');
    const fetchSpy = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected fetch before fingerprint rejection'); });
    const httpSpy = t.mock.method(http, 'request', () => { throw new Error('Unexpected HTTP Agent request before fingerprint rejection'); });
    const httpsSpy = t.mock.method(https, 'request', () => { throw new Error('Unexpected HTTPS Agent request before fingerprint rejection'); });
    syncBuiltinESMExports();
    try {
      await writeFile(process.env.SHIPKIT_SECRET_KEY_FILE, JSON.stringify({ version: 1, activeKeyId: 'fixture', keys: { fixture: randomBytes(32).toString('base64') } }), { mode: 0o600 });
      const original = fixture(kind), store = new SecretStore();
      const scope = { kind: 'plan', projectId: 'project', targetKey: 'local', objectId: `plan-${kind}` };
      const frozen = snapshotFingerprint(original, 'git', false, 'version');
      const encrypted = store.seal(original, scope);
      assert(!encrypted.includes('synthetic secret'));
      const decoded = store.open<PrivateProjectSnapshot>(encrypted, scope);
      assert.deepEqual(decoded, original);
      assert.notDeepEqual(Object.keys(decoded.config), Object.keys(original.config));
      assert.notDeepEqual(Object.keys(decoded.configRefs!.api!), Object.keys(original.configRefs!.api!));
      const restored = await loadProject({ privateSnapshot: decoded, targetKey: 'local', executionKind: kind }, 'git');
      assert.equal(snapshotFingerprint(decoded, 'git', false, 'version'), frozen);
      assert.equal(snapshotFingerprint(restored, 'git', false, 'version'), frozen);
      const mutations: Array<(value: PrivateProjectSnapshot) => void> = [
        value => { value.envFiles.api = 'VALUE="changed"\n'; },
        value => { value.noEnvServices = ['api']; },
        value => { value.configRefs!.api!.versionId = 'different-version'; },
        value => { value.config.runtime.targets.local!.url = 'http://different-runtime.invalid'; },
        value => { value.runtime.url = 'https://different-resolved-runtime.invalid'; },
        value => { value.runtime.caFile = '/different/resolved/ca.pem'; },
        value => { value.runtime.via = 'credential-ref'; },
        value => { value.runtime.token = 'rotated-runtime-token'; },
        value => { value.identity = 'different-project'; },
        value => { value.targetKey = 'different-target'; },
        value => { value.spec.services.api!.ports = ['19752:80']; },
        value => { value.gitRef = 'b'.repeat(40); },
      ];
      const plan: ExecutionPlan = { kind, sourceMode: 'git', configMode: 'version', selection: ['api'], baseReleaseId: null,
        keepEnv: false, keepBuilder: false, fingerprint: frozen, expiresAt: new Date(Date.now() + 60_000).toISOString(),
        detail: { projectIdentity: original.identity, targetKey: original.targetKey, snapshotVersion: 1 } };
      for (const mutate of mutations) {
        const changed = structuredClone(restored); mutate(changed);
        assert.notEqual(snapshotFingerprint(changed, 'git', false, 'version'), frozen);
        const outcome = await executeTask({ privateSnapshot: changed }, plan, { emit: async () => {}, isCancellationRequested: async () => false });
        assert.equal(outcome.status, 'failed');
        assert.match(outcome.error ?? '', /Project inputs changed after planning/);
        assert.equal(fetchSpy.mock.callCount(), 0);
        assert.equal(httpSpy.mock.callCount(), 0);
        assert.equal(httpsSpy.mock.callCount(), 0);
      }
      assert.notEqual(snapshotFingerprint(restored, 'directory', false, 'version'), frozen);
      assert.notEqual(snapshotFingerprint(restored, 'git', true, 'version'), frozen);
      assert.notEqual(snapshotFingerprint(restored, 'git', false, 'inherit'), frozen);
    } finally {
      fetchSpy.mock.restore(); httpSpy.mock.restore(); httpsSpy.mock.restore(); syncBuiltinESMExports();
      if (previous === undefined) delete process.env.SHIPKIT_SECRET_KEY_FILE; else process.env.SHIPKIT_SECRET_KEY_FILE = previous;
      await rm(directory, { recursive: true, force: true });
    }
  });
}
