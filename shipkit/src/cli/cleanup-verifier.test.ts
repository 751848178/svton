// S05 regressions: the e2e cleanup verifier must never report a false zero.
// An rmi conflict (image still present), a failed Docker query and any new
// before/after image delta must all FAIL the verification; the honest success
// case proves zero new residue. All with an injected fake docker runner.

import test from 'node:test';
import assert from 'node:assert/strict';
import { captureCleanupBaseline, cleanupAndVerify, snapshotImages, type RunFn, type RunResult } from './test-support/cleanup-verifier.js';

const ok = (stdout = ''): RunResult => ({ code: 0, stdout, stderr: '' });
const fail = (stderr: string): RunResult => ({ code: 1, stdout: '', stderr });

function world(o: {
  containersByProject?: Record<string, string[]>;
  networksByProject?: Record<string, string[]>;
  allNetworks?: string[];
  allVolumes?: string[];
  images?: string[];
  dangling?: string[];
  rmiFails?: Record<string, string>;
  breakQuery?: RegExp;
  calls?: string[];
}): RunFn {
  return async (cmd: string): Promise<RunResult> => {
    o.calls?.push(cmd);
    if (o.breakQuery?.test(cmd)) return fail('docker: cannot connect to the daemon');
    const m = /--filter label=com.docker\.compose\.project=(\S+).*--format '\{\{\.Name\}\}'/.exec(cmd);
    if (cmd.startsWith('docker network ls --filter')) {
      return ok((o.networksByProject?.[m?.[1] ?? ''] ?? []).join('\n'));
    }
    if (cmd.startsWith('docker ps -aq --filter')) {
      const p = /label=com\.docker\.compose\.project=(\S+)/.exec(cmd)?.[1] ?? '';
      return ok((o.containersByProject?.[p] ?? []).join('\n'));
    }
    if (cmd.startsWith('docker network ls ')) return ok((o.allNetworks ?? []).join('\n'));
    if (cmd.startsWith('docker volume ls')) return ok((o.allVolumes ?? []).join('\n'));
    if (cmd.includes('--filter dangling=true')) return ok((o.dangling ?? []).join('\n'));
    if (cmd.startsWith('docker images ')) return ok((o.images ?? []).join('\n'));
    if (cmd.startsWith('docker rmi ')) {
      const tag = cmd.slice('docker rmi '.length);
      const err = o.rmiFails?.[tag];
      if (err) return fail(err);
      o.images = (o.images ?? []).filter((t) => t !== tag);
      return ok();
    }
    if (cmd.startsWith('docker rm -f ') || cmd.startsWith('docker network rm ') || cmd.startsWith('docker volume rm ')) {
      const id = cmd.split(' ').pop() ?? '';
      for (const k of Object.keys(o.containersByProject ?? {})) {
        o.containersByProject![k] = (o.containersByProject![k] ?? []).filter((c) => c !== id);
      }
      for (const k of Object.keys(o.networksByProject ?? {})) {
        o.networksByProject![k] = (o.networksByProject![k] ?? []).filter((n) => n !== id);
      }
      o.allNetworks = (o.allNetworks ?? []).filter((n) => n !== id);
      o.allVolumes = (o.allVolumes ?? []).filter((v) => v !== id);
      return ok();
    }
    return ok();
  };
}

const SCOPE = {
  projects: ['ship_g_api', 'ship_g_web'],
  networks: ['g-net'],
  volumes: ['g-data'],
  imageTags: ['shipbuild/api:t1', 'shipbuild/web:t1'],
  // pre-existing only — tags this run builds are NOT in the before set
  beforeImages: ['httpd:alpine', 'somebody-else:latest'],
  beforeDangling: ['sha256:pre-existing-dangling'],
};

test('S05: an rmi CONFLICT (image still in use/present) fails the verification — no false zero', async () => {
  const run = world({
    containersByProject: { ship_g_api: ['c1'], ship_g_web: ['c2'] },
    allNetworks: ['g-net', 'ship_g_api_default', 'bridge'],
    allVolumes: ['g-data'],
    images: ['httpd:alpine', 'shipbuild/api:t1', 'shipbuild/web:t1'],
    rmiFails: { 'shipbuild/api:t1': 'Error: image is being used by stopped container, conflict: unable to delete' },
  });
  const r = await cleanupAndVerify(run, SCOPE);
  assert.ok(r.problems.some((p) => p.includes('shipbuild/api:t1') && /conflict|still present/i.test(p)), `conflict must surface: ${r.problems.join(' | ')}`);
  assert.ok(r.problems.some((p) => /new image residue.*shipbuild\/api:t1/.test(p)), `conflicted image counts as residue: ${r.problems.join(' | ')}`);
});

test('S05: a failed Docker query fails the verification instead of reading as an empty set', async () => {
  const run = world({
    images: ['httpd:alpine'],
    breakQuery: /docker images /,
  });
  const r = await cleanupAndVerify(run, SCOPE);
  assert.ok(r.problems.some((p) => /image list query failed|query failed/.test(p)), `query failure surfaces: ${r.problems.join(' | ')}`);
  const run2 = world({ breakQuery: /docker ps -aq/ });
  const r2 = await cleanupAndVerify(run2, SCOPE);
  assert.ok(r2.problems.length > 0, 'container query failure also fails');
});

test('S05: honest success — everything ours removed, nothing new left, pre-existing images untouched', async () => {
  const run = world({
    containersByProject: { ship_g_api: ['c1'], ship_g_web: ['c2'] },
    networksByProject: { ship_g_api: ['ship_g_api_default'] },
    allNetworks: ['g-net', 'ship_g_api_default', 'bridge', 'pre-existing-net'],
    allVolumes: ['g-data', 'other-volume'],
    images: ['httpd:alpine', 'shipbuild/api:t1', 'shipbuild/web:t1', 'somebody-else:latest'],
    dangling: ['sha256:pre-existing-dangling'],
  });
  const r = await cleanupAndVerify(run, SCOPE);
  assert.deepEqual(r.problems, []);
  assert.equal(r.removed.containers, 2);
  assert.equal(r.removed.networks, 2); // g-net + api default (web has none in this world)
  assert.equal(r.removed.images, 2);
  // the world after: our stuff gone, pre-existing untouched
  const after = await snapshotImages(run);
  assert.deepEqual(after?.sort(), ['httpd:alpine', 'somebody-else:latest'].sort(), 'pre-existing/shared images are never removed');
});

test('S05: a NEW dangling image (untagged <none>:<none>) is caught by the ID-level delta', async () => {
  const run = world({ images: [], dangling: ['sha256:pre-existing-dangling', 'sha256:new-layer'] });
  const r = await cleanupAndVerify(run, SCOPE);
  assert.ok(r.problems.some((p) => /new dangling image residue: sha256:new-layer/.test(p)), `ID delta catches it: ${r.problems.join(' | ')}`);
});

test('S05: a leftover NEW image tag (missed by tracking) is caught by the before/after delta', async () => {
  const run = world({
    images: ['httpd:alpine', 'shipbuild/api:t1', 'shipbuild/web:t1', 'shipbuild/api:UNTRACKED'],
  });
  const r = await cleanupAndVerify(run, SCOPE);
  assert.ok(r.problems.some((p) => /new image residue.*UNTRACKED/.test(p)), `delta catches it: ${r.problems.join(' | ')}`);
});

test('cleanup preserves a tracked tag that already existed before this run', async () => {
  const calls: string[] = [];
  const existing = 'shipbuild/api:t1';
  const scope = { ...SCOPE, imageTags: [existing], beforeImages: [...SCOPE.beforeImages, existing] };
  const run = world({ calls, images: [...scope.beforeImages], dangling: scope.beforeDangling });
  const report = await cleanupAndVerify(run, scope);
  assert.deepEqual(report.problems, []);
  assert.equal(report.removed.images, 0);
  assert.ok(!calls.includes(`docker rmi ${existing}`), 'existing tag must never be removed');
  assert.ok((await snapshotImages(run))?.includes(existing));
});

test('cleanup cannot claim pre-existing images untouched when one disappeared', async () => {
  const report = await cleanupAndVerify(world({ images: ['httpd:alpine'], dangling: SCOPE.beforeDangling }), SCOPE);
  assert.ok(report.problems.some((p) => p.includes('somebody-else:latest') && /pre-existing/.test(p)));
});

test('cleanup baseline queries must succeed before an e2e can create resources', async () => {
  for (const breakQuery of [/docker images --format/, /--filter dangling=true/]) {
    await assert.rejects(captureCleanupBaseline(world({ breakQuery })), /baseline.*query failed/);
  }
  assert.deepEqual(await captureCleanupBaseline(world({ images: [], dangling: [] })), { beforeImages: [], beforeDangling: [] });
});
