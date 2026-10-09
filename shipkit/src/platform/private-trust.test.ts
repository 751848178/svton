import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { cloudCredentialDigests } from './cloud-credential-trust.js';
import { assertSnapshotTrust } from './private-fingerprint.js';
import { captureProject } from './capture-project.js';
import { executeTask } from './execute-task.js';
import { reconcileTask } from './reconcile-task.js';
import { archiveForCleanup } from './cleanup-task.js';
import type { PrivateProjectSnapshot } from './private-snapshot.js';
import type { ExecutionPlan } from './contracts.js';

function snapshot(): PrivateProjectSnapshot {
  return { config: { builder: { mode: 'dynamic' }, runtime: { targets: { prod: { url: 'http://127.0.0.1:1', token: 'fixture-runtime-token' } } } },
    runtime: { url: 'http://127.0.0.1:1', token: 'fixture-runtime-token', via: 'plaintext' }, targetKey: 'prod', identity: 'fixture-project',
    spec: { schemaVersion: 2, name: 'fixture', services: { api: {} } }, envFiles: {}, redactionValues: [] };
}
test('rotated or unpinned cloud credentials reject execution, restart observation and cleanup before any SDK or Agent contact', async () => {
  const beforeId = process.env.TENCENTCLOUD_SECRET_ID, beforeKey = process.env.TENCENTCLOUD_SECRET_KEY;
  try {
    process.env.TENCENTCLOUD_SECRET_ID = 'fixture-cloud-id'; process.env.TENCENTCLOUD_SECRET_KEY = 'fixture-old-cloud-key';
    const saved = snapshot(); saved.cloudCredentialDigests = cloudCredentialDigests(saved.config);
    await assertSnapshotTrust(saved);
    process.env.TENCENTCLOUD_SECRET_KEY = 'fixture-new-cloud-key';
    const hooks = { executionId: 'fixture-task', isCancellationRequested: async () => false, emit: async () => {} };
    const plan: ExecutionPlan = { kind: 'release', selection: ['api'], sourceMode: 'git', baseReleaseId: null, keepEnv: true, keepBuilder: false,
      fingerprint: 'unused', expiresAt: new Date(Date.now() + 60000).toISOString(), detail: { targetKey: 'prod', projectIdentity: saved.identity, snapshotVersion: 1 } };
    assert.equal((await executeTask({ privateSnapshot: saved }, plan, hooks)).error?.includes('cloud credential'), true);
    await assert.rejects(reconcileTask({ privateSnapshot: saved }, [], hooks), /cloud credential/);
    await assert.rejects(archiveForCleanup({ privateSnapshot: saved }, [], hooks, plan), /cloud credential/);
    delete saved.cloudCredentialDigests;
    await assert.rejects(assertSnapshotTrust(saved), /not pinned/);
    saved.executionKind = 'config-only'; await assertSnapshotTrust(saved);
    saved.executionKind = 'rollback'; await assertSnapshotTrust(saved);
  } finally {
    if (beforeId === undefined) delete process.env.TENCENTCLOUD_SECRET_ID; else process.env.TENCENTCLOUD_SECRET_ID = beforeId;
    if (beforeKey === undefined) delete process.env.TENCENTCLOUD_SECRET_KEY; else process.env.TENCENTCLOUD_SECRET_KEY = beforeKey;
  }
});
test('recapturing a saved project never accepts rotated CA material by replacing its trusted digest', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'ship-ca-snapshot-'));
  try {
    const ca = path.join(directory, 'ca.pem'), original = 'fixture original trust material';
    await writeFile(ca, original); const saved = snapshot(); saved.config.builder = { mode: 'static' };
    saved.config.runtime.targets.prod!.caFile = ca; saved.runtime.caFile = ca;
    saved.caDigests = { [ca]: createHash('sha256').update(original).digest('hex') };
    const captured = await captureProject({ privateSnapshot: saved }, { kind: 'release', services: ['api'], configMode: 'inherit' });
    assert.deepEqual(captured.caDigests, saved.caDigests);
    await writeFile(ca, 'fixture changed trust material');
    await assert.rejects(captureProject({ privateSnapshot: saved }, { kind: 'release', services: ['api'], configMode: 'inherit' }), /TLS CA/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
