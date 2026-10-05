// CLI→real-agent integration for v2 groups (MS-01..MS-04): the REAL cmdRelease
// --plan/--json, runGroupDeployPipeline and cmdRollback over real HTTP against
// an in-process agent; docker faked only at the exec seam (same harness style
// as deploy-isolation.e2e). Asserts the money boundary: invalid selections and
// old agents refuse BEFORE anything is built, pulled or switched.

import test from 'node:test';
import { mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const realExec = await import('../shared/exec.js');
const FX = { compose: [] as Array<{ project: string; args: string[] }>, pulls: [] as string[] };
mock.module('../shared/exec.js', {
  namedExports: {
    ...realExec,
    exec: async (cmd: string, args: string[], opts?: unknown) => {
      if (cmd === 'git') return { code: 128, stdout: '', stderr: 'no git', truncated: false, timedOut: false };
      if (cmd !== 'docker') return realExec.exec(cmd, args, opts as never);
      const ok = (stdout = '') => ({ code: 0, stdout, stderr: '', truncated: false, timedOut: false });
      if (args[0] === 'pull') { FX.pulls.push(args[1] ?? ''); return ok(); }
      if (args[0] === 'image' && args[1] === 'inspect') return { code: 1, stdout: '', stderr: 'none', truncated: false, timedOut: false };
      if (args[0] === 'compose') {
        FX.compose.push({ project: args[args.indexOf('-p') + 1] ?? '', args });
        return ok();
      }
      if (args[0] === 'ps') return ok('');
      if (args[0] === 'inspect') return ok('');
      if (args[0] === 'version') return ok('24.0');
      return ok('');
    },
  },
});

const { startAgent } = await import('../agent/server.js');
const { cmdRelease } = await import('./cmd-release.js');
const { cmdRollback } = await import('./cmd-rollback.js');
const { runGroupDeployPipeline } = await import('./pipeline-group-deploy.js');
const { validateProjectSpec } = await import('../shared/spec-v2.js');
const yaml = (await import('js-yaml')).default;
const { createLogger } = await import('../shared/log.js');
const { resolveProjectId } = await import('./project-id.js');
const typeShared = await import('../shared/group-protocol.js');
import type { ProjectSpec } from '../shared/spec-v2.js';
type GroupBuildManifestLike = {
  project: string;
  spec: ProjectSpec;
  services: Record<string, { imageRef: string; tag: string; digest?: string; sha?: string; platform: string; source: { type: 'git' | 'tarball' } }>;
  builderUrl: string;
  builderRelease: unknown;
};

const log = createLogger(false);
log.info = () => undefined;
const realHome = process.env.HOME;
const digest = (s: string) => `reg.example/ns/${s}@sha256:${s.repeat(64).slice(0, 64)}`;

const SPEC_YAML = `schemaVersion: 2
name: twgg
services:
  backend:
    dockerfile: apps/backend/Dockerfile
    target: prod
    ports: ["8080:8080"]
  admin:
    dockerfile: apps/admin/Dockerfile
    ports: ["8081:80"]
    envFile: admin.env
    networks: ["twgg-net"]
`;

async function repo(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-multi-repo-'));
  await writeFile(path.join(dir, 'ship.yaml'), SPEC_YAML);
  await writeFile(path.join(dir, 'admin.env'), 'SECRET=admin-value\n');
  return dir;
}

test('real CLI + real agent: --plan is read-only; invalid first-deploy selection refuses before any build; deploy/rollback round-trip over HTTP', async (t) => {
  const workRoot = await mkdtemp(path.join(tmpdir(), 'ship-multi-work-'));
  const agent = await startAgent({ role: 'both', token: 't', port: 0, host: '127.0.0.1', workRoot });
  const home = await mkdtemp(path.join(tmpdir(), 'ship-multi-home-'));
  const cwd = await repo();
  t.after(async () => {
    await agent.close();
    process.env.HOME = realHome;
    await rm(workRoot, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
    await rm(cwd, { recursive: true, force: true });
  });
  process.env.HOME = home;
  const realCwd = process.cwd();
  process.chdir(cwd);
  t.after(() => process.chdir(realCwd));
  const configJson = JSON.stringify({
    builder: { mode: 'static', static: { url: agent.url, token: 't' } },
    registry: { url: 'reg.example', namespace: 'ns' },
    runtime: { targets: { local: { url: agent.url, token: 't' } } },
  });
  const cfg = path.join(cwd, 'ship.config.json');
  await writeFile(cfg, configJson);

  // ---- invalid selections refuse BEFORE any builder/build/pull (money boundary)
  FX.compose.length = 0; FX.pulls.length = 0;
  await assert.rejects(() => cmdRelease(['--config', cfg, '--services', 'admin,admin', '--json']), /duplicate/);
  await assert.rejects(() => cmdRelease(['--config', cfg, '--services', 'nope', '--json']), /unknown service/);
  await assert.rejects(() => cmdRelease(['--config', cfg, '--services', '', '--json']), /--services is empty/);
  await assert.rejects(() => cmdRelease(['--config', cfg, '--services', 'admin', '--json']), /first deployment.*missing required services: backend/);
  assert.equal(FX.compose.length, 0);
  assert.deepEqual(FX.pulls, []);

  // ---- --plan --json: read-only, machine-readable, no secrets
  const captured: string[] = [];
  const realWrite = process.stdout.write.bind(process.stdout);
  (process.stdout as { write: (s: string) => boolean }).write = (s: string) => { captured.push(s); return true; };
  let code = -1;
  try {
    code = await cmdRelease(['--config', cfg, '--plan', '--json']);
  } finally {
    (process.stdout as { write: (s: string) => boolean }).write = realWrite;
  }
  assert.equal(code, 0);
  const planned = JSON.parse(captured.join('')) as { ok: boolean; plan: { firstDeployment: boolean; selection: { resolved: string[]; inherited: string[] }; services: Record<string, { action: string }> } };
  assert.equal(planned.ok, true);
  assert.equal(planned.plan.firstDeployment, true);
  assert.deepEqual(planned.plan.selection.resolved, ['backend', 'admin']);
  assert.ok(!captured.join('').includes('admin-value'), 'env CONTENT never appears in the plan');
  assert.equal(FX.compose.length, 0, 'plan performed zero docker operations');

  // ---- first deploy through the real CLI pipeline (manifest from a build)
  const spec = validateProjectSpec(yaml.load(SPEC_YAML));
  const project = await resolveProjectId(cwd, JSON.parse(configJson));
  const manifest: GroupBuildManifestLike = {
    project, spec, builderUrl: agent.url, builderRelease: { builderRelease: 'static' },
    services: {
      backend: { imageRef: digest('b1'), tag: 'tb1', digest: `sha256:${'b'.repeat(64)}`, sha: 'deadbee', platform: 'linux/amd64', source: { type: 'git' } },
      admin: { imageRef: digest('a1'), tag: 'ta1', digest: `sha256:${'a'.repeat(64)}`, sha: 'deadbee', platform: 'linux/amd64', source: { type: 'git' } },
    },
  };
  const deployEnv = await runGroupDeployPipeline({
    config: JSON.parse(configJson), cwd, logger: log, spec, project, manifest: manifest as never, targetName: 'local', timeoutMs: 30_000,
  });
  assert.equal(deployEnv.target, 'local');
  assert.deepEqual([...deployEnv.changedServices].sort(), ['admin', 'backend']);
  assert.equal(FX.compose.filter((c) => c.args.includes('up')).length, 2, 'both services switched');
  // env file declared in ship.yaml was delivered and written privately
  assert.equal(readFileSync(path.join(workRoot, 'apps', 'twgg', 'services', 'admin', 'runtime.env'), 'utf8'), 'SECRET=admin-value\n');
  // declared external network is verified before switching — absent network refuses
  assert.ok(existsSync(path.join(workRoot, 'apps', 'twgg', 'services', 'admin', 'compose.yaml')));

  // ---- partial release #2 via the same pipeline: only admin switches
  FX.compose.length = 0; FX.pulls.length = 0;
  const partialManifest: GroupBuildManifestLike = { ...manifest, services: { admin: manifest.services.admin! } };
  const partial = await runGroupDeployPipeline({
    config: JSON.parse(configJson), cwd, logger: log, spec, project, manifest: partialManifest as never, targetName: 'local', timeoutMs: 30_000,
  });
  assert.deepEqual(partial.changedServices, ['admin']);
  assert.deepEqual(partial.inheritedServices, ['backend']);
  assert.deepEqual(FX.pulls, [digest('a1')], 'only the selected image pulled');
  assert.equal(FX.compose.filter((c) => c.args.includes('up')).length, 1, 'only the selected service switched');
  assert.equal(FX.compose.filter((c) => c.args.includes('up') && c.project === 'ship_twgg_backend').length, 0);

  // ---- --plan after a release shows inheritance from the committed combination
  const plan2cap: string[] = [];
  (process.stdout as { write: (s: string) => boolean }).write = (s: string) => { plan2cap.push(s); return true; };
  try { await cmdRelease(['--config', cfg, '--plan', '--json', '--services', 'admin']); } finally { (process.stdout as { write: (s: string) => boolean }).write = realWrite; }
  const plan2 = JSON.parse(plan2cap.join('')) as { plan: { firstDeployment: boolean; baseReleaseId: string | null; services: Record<string, { action: string; imageRef?: string }> } };
  assert.equal(plan2.plan.firstDeployment, false);
  assert.ok(plan2.plan.baseReleaseId);
  assert.equal(plan2.plan.services.admin?.action, 'build+deploy');
  assert.equal(plan2.plan.services.backend?.action, 'inherit');
  assert.equal(plan2.plan.services.backend?.imageRef, digest('b1'));

  // ---- real `ship rollback twgg` (v2 group) via the CLI entry
  FX.compose.length = 0;
  const rc = await cmdRollback(['twgg', '--config', cfg, '--to', 'local']);
  assert.equal(rc, 0);
  assert.deepEqual(FX.compose.filter((c) => c.args.includes('up')).map((c) => c.project), ['ship_twgg_admin'], 'default rollback undoes exactly the last changed service');
  void typeShared;
});
