// Regression tests for RA01 (corrupt snapshots block GC), RA08 (ledger beyond 20 deploys),
// RA09 (docker error classification). Uses temp dirs; docker is fully faked via the injected runner.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ExecResult } from '../shared/exec.js';
import { executeImageGc, planImageGc, ledgerFileFor, type GcPlan } from './gc.js';
import { ImageLedger } from './image-ledger.js';
import { ReleaseStore } from './release.js';
import { validateSpec } from '../shared/spec-schema.js';

const SPEC = () => validateSpec({ name: 'a', ports: ['3000:3000'] });
const log = () => {};

async function appsRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'ship-gcs-'));
  const apps = path.join(root, 'apps');
  await mkdir(apps, { recursive: true });
  return apps;
}

async function deploy(apps: string, ref: string): Promise<void> {
  const store = new ReleaseStore(apps);
  const rel = await store.saveRelease('app', ref, SPEC());
  await store.shift('app', rel.id, 'deploy');
  await new ImageLedger(ledgerFileFor(apps)).record(ref, 'app');
}

function runOk(args: string[]): ExecResult {
  return { code: 0, stdout: '', stderr: '', truncated: false, timedOut: false, ...(args[0] === 'image' ? { stdout: 'sha256:f' } : {}) };
}

test('RA01: a corrupt retained snapshot aborts planning — its image can never become a candidate', async () => {
  const apps = await appsRoot();
  await deploy(apps, 'reg/a:1');
  await deploy(apps, 'reg/a:2');
  const relDir = path.join(apps, 'app', 'releases');
  // corrupt the OLDER (previous) snapshot
  const store = new ReleaseStore(apps);
  const st = await store.loadState('app');
  assert.ok(st.previous);
  await writeFile(path.join(relDir, st.previous, 'meta.json'), 'not json');
  await assert.rejects(() => planImageGc(apps), /corrupt|JSON|meta|release/i);
});

test('RA01: missing current snapshot aborts execution before any docker call', async () => {
  const apps = await appsRoot();
  await deploy(apps, 'reg/a:1');
  const store = new ReleaseStore(apps);
  const st = await store.loadState('app');
  await rm(path.join(apps, 'app', 'releases', st.current!, 'meta.json'), { force: true });
  const plan: GcPlan = { protectedRefs: [], candidates: [{ imageRef: 'reg/a:1', app: 'app' }] };
  let called = 0;
  await assert.rejects(
    () => executeImageGc(apps, plan, log, async () => { called++; return runOk([]); }),
  );
  assert.equal(called, 0, 'docker must not be touched when the ledger is unreadable');
});

test('RA08: candidates come from the ledger — 35 deploys later every old image is still discoverable', async () => {
  const apps = await appsRoot();
  // only the last two releases exist as snapshots; the ledger saw all 35
  const store = new ReleaseStore(apps);
  const r1 = await store.saveRelease('app', 'reg/a:34', SPEC());
  const r2 = await store.saveRelease('app', 'reg/a:35', SPEC());
  await store.shift('app', r1.id, 'deploy');
  await store.shift('app', r2.id, 'deploy');
  const ledger = new ImageLedger(ledgerFileFor(apps));
  for (let i = 0; i < 35; i++) await ledger.record(`reg/a:${i}`, 'app');
  await ledger.record('reg/a:34', 'app');
  await ledger.record('reg/a:35', 'app');
  const plan = await planImageGc(apps);
  assert.equal(plan.candidates.length, 34); // 36 unique ledger entries minus the two protected snapshots
  assert.ok(plan.candidates.some((c) => c.imageRef === 'reg/a:0'));
});

test('RA09: docker daemon unreachable is failed, not missing', async () => {
  const apps = await appsRoot();
  const plan: GcPlan = { protectedRefs: [], candidates: [{ imageRef: 'reg/x:1', app: 'app' }] };
  const r = await executeImageGc(apps, plan, log, async (args) => ({
    code: 1, stdout: '', stderr: 'Cannot connect to the Docker daemon at unix:///var/run/docker.sock', truncated: false, timedOut: false,
    ...(args[0] === 'image' ? {} : {}),
  }));
  assert.equal(r.failed.length, 1);
  assert.match(r.failed[0]?.error ?? '', /Cannot connect/);
  assert.equal(r.missing.length, 0);
});

test('RA09: a definite image-not-found is missing and leaves the ledger', async () => {
  const apps = await appsRoot();
  await deploy(apps, 'reg/keep:1');
  const ledger = new ImageLedger(ledgerFileFor(apps));
  await ledger.record('reg/gone:1', 'app');
  const plan: GcPlan = { protectedRefs: [], candidates: [{ imageRef: 'reg/gone:1', app: 'app' }] };
  const r = await executeImageGc(apps, plan, log, async (args) => {
    if (args[0] === 'image') return { code: 1, stdout: '', stderr: 'Error: No such image: reg/gone:1', truncated: false, timedOut: false };
    return runOk(args);
  });
  assert.deepEqual(r.missing, ['reg/gone:1']);
  assert.equal(r.failed.length, 0);
  const left = await ledger.entries();
  assert.ok(!left.some((e) => e.imageRef === 'reg/gone:1'), 'verified-absent image leaves the ledger');
});

test('RA09: timeouts are failures, never missing', async () => {
  const apps = await appsRoot();
  const plan: GcPlan = { protectedRefs: [], candidates: [{ imageRef: 'reg/x:1', app: 'app' }] };
  const r = await executeImageGc(apps, plan, log, async () => ({
    code: 124, stdout: '', stderr: '', truncated: false, timedOut: true,
  }));
  assert.equal(r.failed.length, 1);
  assert.equal(r.missing.length, 0);
});

test('RA02: candidates protected between preview and execute are skipped', async () => {
  const apps = await appsRoot();
  const plan: GcPlan = { protectedRefs: [], candidates: [{ imageRef: 'reg/a:1', app: 'app' }] };
  // after the "preview", this exact image became a retained release snapshot
  await deploy(apps, 'reg/a:1');
  const r = await executeImageGc(apps, plan, log, async (args) => {
    if (args[0] === 'image') return { code: 0, stdout: 'sha256:f', stderr: '', truncated: false, timedOut: false };
    return runOk(args);
  });
  assert.deepEqual(r.skippedProtected, ['reg/a:1']);
  assert.equal(r.removed.length, 0);
});
