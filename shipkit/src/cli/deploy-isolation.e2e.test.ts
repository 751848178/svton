// Deploy project-isolation e2e (2026-10-04d): the REAL CLI pipeline over real
// HTTP against a real in-process agent serving ONE shared workRoot (one apps
// dir — project and environment identities share the same appsRoot). The docker CLI is faked only at the exec seam: a
// machine-wide container census the tests control + recorded compose calls;
// every refusal asserts ZERO mutations. The same fake also serves the agent's
// `docker version` probe.

import test from 'node:test';
import { mock } from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const realExec = await import('../shared/exec.js');
const FX = {
  containers: [] as Array<{ id: string; name: string; project?: string; dir?: string }>,
  compose: [] as string[][],
  /** called on every `docker compose pull` — lets a test flip ownership DURING the pull window */
  onPull: null as null | (() => void),
};
mock.module('../shared/exec.js', {
  namedExports: {
    ...realExec,
    exec: async (cmd: string, args: string[], opts?: unknown) => {
      if (cmd === 'git') return { code: 128, stdout: '', stderr: 'no git in this sandbox', truncated: false, timedOut: false }; // identity falls back to local:<cwd>
      if (cmd !== 'docker') return realExec.exec(cmd, args, opts as never);
      const ok = (stdout = '') => ({ code: 0, stdout, stderr: '', truncated: false, timedOut: false });
      if (args[0] === 'compose') {
        FX.compose.push(args);
        if (args.includes('pull')) FX.onPull?.();
        return ok('');
      }
      if (args[0] === 'ps' && args.includes('--filter')) {
        const project = args.find((a) => a.startsWith('label=com.docker.compose.project='))?.split('=')[2];
        return ok(FX.containers.filter((c) => c.project === project).map((c) => c.id).join('\n') + '\n');
      }
      if (args[0] === 'ps') return ok(FX.containers.map((c) => `${c.id}\t${c.name}`).join('\n') + '\n');
      if (args[0] === 'inspect') {
        const ids = args.slice(args.indexOf('--format') + 2);
        return ok(FX.containers.filter((c) => ids.includes(c.id)).map((c) => `/${c.name}\t${c.project ?? ''}\t${c.dir ?? ''}`).join('\n') + '\n');
      }
      if (args.join(' ').startsWith('image inspect')) return { code: 1, stdout: '', stderr: 'no such image', truncated: false, timedOut: false };
      if (args[0] === 'version') return ok('24.0');
      return ok('');
    },
  },
});

const { startAgent } = await import('../agent/server.js');
const { runDeployPipeline } = await import('./pipeline.js');
const { cmdRollback } = await import('./cmd-rollback.js');
const { resolveProjectId } = await import('./project-id.js');
const { saveLastBuild, readLastBuild } = await import('./local-state.js');
const { createLogger } = await import('../shared/log.js');

const realHome = process.env.HOME;
const log = createLogger(false);
const SPEC_YAML = (name: string) => `name: ${name}\nports: ["3${name.length}00:3000"]\n`;
const ups = () => FX.compose.filter((a) => a.includes('up'));
test.beforeEach(() => { FX.containers = []; FX.compose = []; FX.onPull = null; });

/** a "repo" is just a directory with a ship.yaml — no git remote exists, so
 *  the project identity is the resolved cwd (deterministic, distinct) */
async function repo(app: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), `ship-repo-${app}-`));
  await writeFile(path.join(dir, 'ship.yaml'), SPEC_YAML(app));
  return dir;
}

function twoTargetConfig(agentUrl: string, sourceRepo?: string): unknown {
  return {
    ...(sourceRepo ? { source: { repo: sourceRepo } } : {}),
    builder: { mode: 'static', static: { url: agentUrl, token: 't' } },
    registry: { url: 'reg.example.com', namespace: 'ns' },
    runtime: { targets: { prod: { url: agentUrl, token: 't' }, staging: { url: agentUrl, token: 't' } } },
  };
}

async function deploy(o: { cwd: string; agentUrl: string; app: string; imageRef?: string; targetName?: string; sourceRepo?: string; envFile?: string; keepEnv?: boolean }) {
  const name = o.targetName ?? 'local';
  const config = name === 'local'
    ? {
      builder: { mode: 'static', static: { url: o.agentUrl, token: 't' } },
      registry: { url: 'reg.example.com', namespace: 'ns' },
      runtime: { targets: { local: { url: o.agentUrl, token: 't' } } },
    }
    : twoTargetConfig(o.agentUrl, o.sourceRepo);
  return runDeployPipeline({
    config: config as never,
    cwd: o.cwd,
    logger: log,
    app: o.app,
    imageRef: o.imageRef,
    keepEnv: o.keepEnv,
    envFile: o.envFile,
    targetName: name,
    timeoutMs: 30_000,
  });
}

test('one agent, ONE appsRoot: the same app name from a DIFFERENT project is refused, the owner is untouched', async (t) => {
  const workRoot = await mkdtemp(path.join(tmpdir(), 'ship-iso-work-'));
  const agent = await startAgent({ role: 'runtime', token: 't', port: 0, host: '127.0.0.1', workRoot });
  t.after(async () => { await agent.close(); process.env.HOME = realHome; });
  const home = await mkdtemp(path.join(tmpdir(), 'ship-home-'));
  process.env.HOME = home;

  const repoA = await repo('web');
  const repoB = await repo('web'); // same app NAME, a different project dir
  const projectA = await resolveProjectId(repoA);
  const projectB = await resolveProjectId(repoB);
  assert.notEqual(projectA, projectB, 'the two projects have distinct identities');

  const first = await deploy({ cwd: repoA, agentUrl: agent.url, app: 'web', imageRef: 'reg/ns/web:1' });
  assert.equal(first.app, 'web');
  assert.ok(ups().length >= 1, 'project A deployed for real');
  const bound = JSON.parse(await readFile(path.join(workRoot, 'apps', 'web', 'project.json'), 'utf8')) as { project: string };
  assert.equal(bound.project, projectA, 'the app name is bound to project A');

  FX.compose = [];
  await assert.rejects(
    () => deploy({ cwd: repoB, agentUrl: agent.url, app: 'web', imageRef: 'reg/ns/web:2' }),
    (e: Error) => /已绑定到其他项目|拒绝执行/.test(e.message),
    'project B deploying the same app name is refused',
  );
  assert.equal(FX.compose.length, 0, 'the refusal mutated nothing');
  const binding2 = JSON.parse(await readFile(path.join(workRoot, 'apps', 'web', 'project.json'), 'utf8')) as { project: string };
  assert.equal(binding2.project, projectA, 'the binding is unchanged');

  // the OWNING project redeploys fine — no false positive
  const again = await deploy({ cwd: repoA, agentUrl: agent.url, app: 'web', imageRef: 'reg/ns/web:3' });
  assert.equal(again.imageRef, 'reg/ns/web:3');
  assert.ok(ups().every((a) => !a.includes('--remove-orphans')), 'no unconstrained orphan cleanup anywhere');

  // rollback: A succeeds, B is refused — the real CLI entry (`ship rollback`)
  // derives its project from process.cwd(), so drive it per repo
  const cfg = (dir: string) => {
    const file = path.join(dir, 'ship.config.yaml');
    const had = existsSync(file);
    if (!had) {
      writeFileSync(file, `builder:\n  mode: static\n  static:\n    url: ${agent.url}\n    token: t\nruntime:\n  targets:\n    local:\n      url: ${agent.url}\n      token: t\n`);
    }
    return file;
  };
  const realCwd = process.cwd();
  process.chdir(repoB);
  await assert.rejects(
    () => cmdRollback(['--config', cfg(repoB), 'web', '--to', 'local']),
    (e: Error) => /已绑定到其他项目|拒绝执行/.test(e.message),
  );
  process.chdir(repoA);
  try {
    const code = await cmdRollback(['--config', cfg(repoA), 'web', '--to', 'local']);
    assert.equal(code, 0);
  } finally {
    process.chdir(realCwd);
  }
});

test('real CLI/HTTP keep-env preserves deployed secrets and rejects invalid env controls before creating jobs', async (t) => {
  const workRoot = await mkdtemp(path.join(tmpdir(), 'ship-env-http-'));
  const cwd = await repo('envweb');
  const agent = await startAgent({ role: 'runtime', token: 't', port: 0, host: '127.0.0.1', workRoot });
  t.after(async () => { await agent.close(); await rm(workRoot, { recursive: true, force: true }); await rm(cwd, { recursive: true, force: true }); });
  const envFile = path.join(cwd, 'deploy.env');
  await writeFile(envFile, 'SECRET=server-value\n');
  await deploy({ cwd, agentUrl: agent.url, app: 'envweb', imageRef: 'reg/ns/envweb:1', envFile });
  await rm(envFile);
  const next = await deploy({ cwd, agentUrl: agent.url, app: 'envweb', imageRef: 'reg/ns/envweb:2', keepEnv: true });
  const appDir = path.join(workRoot, 'apps', 'envweb');
  assert.equal(await readFile(path.join(appDir, 'runtime.env'), 'utf8'), 'SECRET=server-value\n');
  assert.equal(await readFile(path.join(appDir, 'releases', next.releaseId, 'env'), 'utf8'), 'SECRET=server-value\n');
  assert.match(await readFile(path.join(appDir, 'compose.yaml'), 'utf8'), /env_file:/);
  FX.compose = [];
  for (const invalid of [{ keepEnv: 'false' }, { envFileContent: null }, { envFileContent: 23 }]) {
    const res = await fetch(`${agent.url}/api/deploy`, {
      method: 'POST', headers: { authorization: 'Bearer t', 'content-type': 'application/json' },
      body: JSON.stringify({ app: 'envweb', project: await resolveProjectId(cwd), env: 'local', imageRef: 'reg/ns/envweb:3', spec: { name: 'envweb' }, ...invalid }),
    });
    assert.equal(res.status, 400);
  }
  assert.equal(FX.compose.length, 0);
});

test('last-build records are project-scoped: each repo deploys ITS OWN image via the real CLI path', async (t) => {
  const workRoot = await mkdtemp(path.join(tmpdir(), 'ship-iso-work-'));
  const agent = await startAgent({ role: 'runtime', token: 't', port: 0, host: '127.0.0.1', workRoot });
  t.after(async () => { await agent.close(); process.env.HOME = realHome; });
  const home = await mkdtemp(path.join(tmpdir(), 'ship-home-'));
  process.env.HOME = home;

  const repoA = await repo('api');
  const repoB = await repo('api');
  const projectA = await resolveProjectId(repoA);
  const projectB = await resolveProjectId(repoB);
  // each project's own last-build record (as runBuildPipeline would write)
  await saveLastBuild({ app: 'api', project: projectA, imageRef: 'reg/ns/api:from-a', tag: 't', at: new Date().toISOString(), builderUrl: 'http://x' });
  await saveLastBuild({ app: 'api', project: projectB, imageRef: 'reg/ns/api:from-b', tag: 't', at: new Date().toISOString(), builderUrl: 'http://x' });
  assert.equal((await readLastBuild('api', projectA))?.imageRef, 'reg/ns/api:from-a');
  assert.equal((await readLastBuild('api', projectB))?.imageRef, 'reg/ns/api:from-b');

  // no --ref: the pipeline must resolve each project's OWN record end to end
  FX.compose = [];
  const a = await deploy({ cwd: repoA, agentUrl: agent.url, app: 'api' });
  assert.equal(a.imageRef, 'reg/ns/api:from-a', 'repo A deployed its own image');
  await assert.rejects(
    () => deploy({ cwd: repoB, agentUrl: agent.url, app: 'api' }),
    (e: Error) => /已绑定到其他项目|拒绝执行/.test(e.message),
    'repo B cannot even deploy — the app name belongs to project A on this agent',
  );
  // and on a FRESH agent (fresh appsRoot) repo B's own record works
  const workRoot2 = await mkdtemp(path.join(tmpdir(), 'ship-iso-work2-'));
  const agent2 = await startAgent({ role: 'runtime', token: 't', port: 0, host: '127.0.0.1', workRoot: workRoot2 });
  try {
    const b = await deploy({ cwd: repoB, agentUrl: agent2.url, app: 'api' });
    assert.equal(b.imageRef, 'reg/ns/api:from-b', 'repo B deploys its own image on its own target — records never crossed');
  } finally {
    await agent2.close();
  }
});

test('ownership taken over DURING the image pull: the pre-activation re-check refuses and recovery does not adopt foreign resources', async (t) => {
  const workRoot = await mkdtemp(path.join(tmpdir(), 'ship-iso-work-'));
  const agent = await startAgent({ role: 'runtime', token: 't', port: 0, host: '127.0.0.1', workRoot });
  t.after(async () => { await agent.close(); process.env.HOME = realHome; });
  const home = await mkdtemp(path.join(tmpdir(), 'ship-home-'));
  process.env.HOME = home;

  const repoA = await repo('svc');
  await deploy({ cwd: repoA, agentUrl: agent.url, app: 'svc', imageRef: 'reg/ns/svc:1' });

  // a foreign actor seizes the compose project while our NEXT deploy pulls
  const appDir = path.join(workRoot, 'apps', 'svc');
  FX.onPull = () => {
    FX.containers = [{ id: 'fx1', name: 'ship-svc-svc-1', project: 'ship-svc', dir: '/srv/other/apps/svc' }];
  };
  FX.compose = [];
  // the failure surfaces as a deploy failure whose recovery ALSO refused to
  // touch the foreign resources — the load-bearing assertions are the zero
  // `up` invocations below and the intact state
  await assert.rejects(
    () => deploy({ cwd: repoA, agentUrl: agent.url, app: 'svc', imageRef: 'reg/ns/svc:2' }),
    (e: Error) => /reg\/ns\/svc:2 failed/.test(e.message),
    'the deploy fails; the takeover was caught during the pull window',
  );
  assert.deepEqual(ups(), [], 'neither the deploy NOR the auto-recovery ran `up` on the foreign resources');
  const state = JSON.parse(await readFile(path.join(appDir, 'state.json'), 'utf8')) as { current?: unknown };
  assert.ok(state.current !== undefined, 'state intact');
  FX.onPull = null;
});

test('sibling apps coexist: ship-web never matches ship-web-api containers', async (t) => {
  const workRoot = await mkdtemp(path.join(tmpdir(), 'ship-iso-work-'));
  const agent = await startAgent({ role: 'runtime', token: 't', port: 0, host: '127.0.0.1', workRoot });
  t.after(async () => { await agent.close(); process.env.HOME = realHome; });
  const home = await mkdtemp(path.join(tmpdir(), 'ship-home-'));
  process.env.HOME = home;

  // another app's container exists on the machine (compose v2 derived name,
  // owned by a DIFFERENT appDir of the same appsRoot — its own deployment)
  const repoWeb = await repo('web');
  const webApiDir = path.join(workRoot, 'apps', 'web-api');
  FX.containers = [{ id: 'k1', name: 'ship-web-api-web-api-1', project: 'ship-web-api', dir: webApiDir }];

  const r = await deploy({ cwd: repoWeb, agentUrl: agent.url, app: 'web', imageRef: 'reg/ns/web:1' });
  assert.equal(r.app, 'web', 'web deploys — the sibling container is NOT mistaken for ours (exact name match)');

  // but a same-named web container owned elsewhere still refuses
  FX.containers = [
    { id: 'k1', name: 'ship-web-api-web-api-1', project: 'ship-web-api', dir: webApiDir },
    { id: 'k2', name: 'ship-web-web-1', project: 'ship-web', dir: '/srv/foreign/apps/web' },
  ];
  FX.compose = [];
  await assert.rejects(
    () => deploy({ cwd: repoWeb, agentUrl: agent.url, app: 'web', imageRef: 'reg/ns/web:2' }),
    (e: Error) => /属于其他部署/.test(e.message),
  );
  assert.equal(FX.compose.filter((a) => a.includes('up')).length, 0);
});

test('concurrent same-project deploys serialize cleanly (lock boundary), and unauthenticated callers still get 400', async (t) => {
  const workRoot = await mkdtemp(path.join(tmpdir(), 'ship-iso-work-'));
  const agent = await startAgent({ role: 'runtime', token: 't', port: 0, host: '127.0.0.1', workRoot });
  t.after(async () => { await agent.close(); process.env.HOME = realHome; });
  const home = await mkdtemp(path.join(tmpdir(), 'ship-home-'));
  process.env.HOME = home;

  const repoA = await repo('par');
  const results = await Promise.allSettled([
    deploy({ cwd: repoA, agentUrl: agent.url, app: 'par', imageRef: 'reg/ns/par:1' }),
    deploy({ cwd: repoA, agentUrl: agent.url, app: 'par', imageRef: 'reg/ns/par:2' }),
  ]);
  assert.ok(results.every((r) => r.status === 'fulfilled'), `both same-project deploys succeed (serialized), got ${results.map((r) => r.status).join(',')}`);
  const state = JSON.parse(await readFile(path.join(workRoot, 'apps', 'par', 'state.json'), 'utf8')) as { current: string };
  assert.ok(state.current, 'final state is a consistent single release');

  // a caller WITHOUT project identity is rejected at the API boundary
  const res = await fetch(`${agent.url}/api/deploy`, {
    method: 'POST', headers: { authorization: 'Bearer t', 'content-type': 'application/json' },
    body: JSON.stringify({ app: 'par', imageRef: 'reg/ns/par:9', spec: { name: 'par' } }),
  });
  assert.equal(res.status, 400, 'unidentified callers cannot deploy');
  const errBody = (await res.json()) as { error?: { message?: string } };
  assert.match(errBody.error?.message ?? '', /project identity required/);
});


test('same repo, same agent, same app: prod and staging are EXPLICITLY separated — staging is refused, never silently shared', async (t) => {
  FX.containers = [];
  FX.onPull = null;
  const workRoot = await mkdtemp(path.join(tmpdir(), 'ship-iso3-work-'));
  const agent = await startAgent({ role: 'runtime', token: 't', port: 0, host: '127.0.0.1', workRoot });
  t.after(async () => { await agent.close(); process.env.HOME = realHome; });
  const home = await mkdtemp(path.join(tmpdir(), 'ship-home-'));
  process.env.HOME = home;

  const repoA = await repo('web');
  const prod = await deploy({ cwd: repoA, agentUrl: agent.url, app: 'web', imageRef: 'reg/ns/web:p1', targetName: 'prod' });
  assert.equal(prod.imageRef, 'reg/ns/web:p1');
  const bound = JSON.parse(await readFile(path.join(workRoot, 'apps', 'web', 'project.json'), 'utf8')) as { project: string; env: string };
  assert.equal(bound.env, 'prod', 'the binding records the environment identity');

  FX.compose = [];
  await assert.rejects(
    () => deploy({ cwd: repoA, agentUrl: agent.url, app: 'web', imageRef: 'reg/ns/web:s1', targetName: 'staging' }),
    (e: Error) => /已绑定到 'prod' 环境|拒绝执行/.test(e.message),
    'staging on the SAME agent is explicitly refused (one app name, one environment here)',
  );
  assert.equal(FX.compose.length, 0, 'zero mutations from the refusal');
  const bound2 = JSON.parse(await readFile(path.join(workRoot, 'apps', 'web', 'project.json'), 'utf8')) as { env: string };
  assert.equal(bound2.env, 'prod', 'the binding is not rewritten');
  // prod keeps working
  const again = await deploy({ cwd: repoA, agentUrl: agent.url, app: 'web', imageRef: 'reg/ns/web:p2', targetName: 'prod' });
  assert.equal(again.imageRef, 'reg/ns/web:p2');
  const cfgFile = path.join(repoA, 'ship.config.json');
  await writeFile(cfgFile, JSON.stringify(twoTargetConfig(agent.url)));
  const cwdBeforeRollback = process.cwd();
  const stateFile = path.join(workRoot, 'apps', 'web', 'state.json');
  const stateBeforeRollback = await readFile(stateFile, 'utf8');
  process.chdir(repoA);
  try {
    FX.compose = [];
    await assert.rejects(() => cmdRollback(['web', '--config', cfgFile, '--to', 'staging']), /prod.*环境/);
    assert.equal(FX.compose.length, 0);
    assert.equal(await readFile(stateFile, 'utf8'), stateBeforeRollback);
    assert.equal(await cmdRollback(['web', '--config', cfgFile, '--to', 'prod']), 0);
  } finally {
    process.chdir(cwdBeforeRollback);
  }
  // config.source.repo drives the project identity (same agent, same env, different repo string => different project => refused)
  await assert.rejects(
    () => deploy({ cwd: repoA, agentUrl: agent.url, app: 'web', imageRef: 'reg/ns/web:x', targetName: 'prod', sourceRepo: 'git@other.example.com:acme/web.git' }),
    (e: Error) => /已绑定到其他项目/.test(e.message),
  );
});

test('existing runtime containers with lost disk metadata are never adopted by a new project', async (t) => {
  const workRoot = await mkdtemp(path.join(tmpdir(), 'ship-lost-state-'));
  const agent = await startAgent({ role: 'runtime', token: 't', port: 0, host: '127.0.0.1', workRoot });
  t.after(async () => { await agent.close(); await rm(workRoot, { recursive: true, force: true }); });
  const cwd = await repo('lost');
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const appDir = path.join(workRoot, 'apps', 'lost');
  FX.containers = [{ id: 'orphan', name: 'ship-lost-lost-1', project: 'ship-lost', dir: appDir }];
  await assert.rejects(() => deploy({ cwd, agentUrl: agent.url, app: 'lost', imageRef: 'reg/ns/lost:1' }), /缺少项目绑定|已有 Compose 容器/);
  assert.equal(FX.compose.length, 0);
  assert.equal(existsSync(path.join(appDir, 'project.json')), false);
});

test('binding loss or environment change during pull blocks both activation and automatic recovery', async (t) => {
  const workRoot = await mkdtemp(path.join(tmpdir(), 'ship-binding-race-'));
  const agent = await startAgent({ role: 'runtime', token: 't', port: 0, host: '127.0.0.1', workRoot });
  t.after(async () => { await agent.close(); await rm(workRoot, { recursive: true, force: true }); });
  const cwd = await repo('race');
  t.after(() => rm(cwd, { recursive: true, force: true }));
  await deploy({ cwd, agentUrl: agent.url, app: 'race', imageRef: 'reg/ns/race:1' });
  const dir = path.join(workRoot, 'apps', 'race');
  const file = path.join(dir, 'project.json');
  const original = await readFile(file, 'utf8');
  const state = await readFile(path.join(dir, 'state.json'), 'utf8');
  for (const replacement of [null, JSON.stringify({ ...JSON.parse(original), env: 'foreign' })]) {
    await writeFile(file, original);
    FX.compose = [];
    FX.onPull = () => replacement === null ? rmSync(file) : writeFileSync(file, replacement);
    await assert.rejects(() => deploy({ cwd, agentUrl: agent.url, app: 'race', imageRef: 'reg/ns/race:2' }), /failed/);
    assert.deepEqual(ups(), []);
    assert.equal(await readFile(path.join(dir, 'state.json'), 'utf8'), state);
    if (replacement === null) assert.equal(existsSync(file), false);
    else assert.equal(await readFile(file, 'utf8'), replacement);
  }
});

test('strict claim: legacy deployed app without a binding must MIGRATE explicitly; read errors / corrupt / invalid bindings refuse AND preserve the file', async (t) => {
  FX.containers = [];
  FX.onPull = null;
  const workRoot = await mkdtemp(path.join(tmpdir(), 'ship-iso4-work-'));
  const agent = await startAgent({ role: 'runtime', token: 't', port: 0, host: '127.0.0.1', workRoot });
  t.after(async () => { await agent.close(); process.env.HOME = realHome; });
  const home = await mkdtemp(path.join(tmpdir(), 'ship-home-'));
  process.env.HOME = home;

  const repoA = await repo('legacy');
  const projA = await resolveProjectId(repoA);
  await deploy({ cwd: repoA, agentUrl: agent.url, app: 'legacy', imageRef: 'reg/ns/legacy:1' });
  const appDir = path.join(workRoot, 'apps', 'legacy');
  const bindingFile = path.join(appDir, 'project.json');

  // legacy state: the app WAS deployed but the binding is gone
  await rm(bindingFile, { force: true });
  FX.compose = [];
  await assert.rejects(
    () => deploy({ cwd: repoA, agentUrl: agent.url, app: 'legacy', imageRef: 'reg/ns/legacy:2' }),
    (e: Error) => /缺少项目绑定|显式迁移/.test(e.message),
    'a deployed app without a binding is NEVER auto-claimed',
  );
  assert.equal(FX.compose.length, 0, 'no mutation during the refusal');
  await assert.rejects(() => readFile(bindingFile), (e: NodeJS.ErrnoException) => e.code === 'ENOENT', 'no binding file was created by the refusal');

  // the documented migration: the operator writes the binding by hand
  await writeFile(bindingFile, `${JSON.stringify({ app: 'legacy', project: projA, env: 'local' })}\n`);
  const migrated = await deploy({ cwd: repoA, agentUrl: agent.url, app: 'legacy', imageRef: 'reg/ns/legacy:2' });
  assert.equal(migrated.imageRef, 'reg/ns/legacy:2', 'after explicit migration the project deploys again');

  // corrupt JSON: refuse and PRESERVE the exact bytes
  const corrupt = '{ this is not json';
  await writeFile(bindingFile, corrupt);
  FX.compose = [];
  await assert.rejects(
    () => deploy({ cwd: repoA, agentUrl: agent.url, app: 'legacy', imageRef: 'reg/ns/legacy:3' }),
    (e: Error) => /不是合法 JSON|原文件已保留/.test(e.message),
  );
  assert.equal(await readFile(bindingFile, 'utf8'), corrupt, 'the corrupt file is preserved byte-for-byte');
  assert.equal(FX.compose.length, 0);

  // invalid shape (wrong app): refuse and preserve
  const invalid = JSON.stringify({ app: 'other-app', project: projA, env: 'local' });
  await writeFile(bindingFile, invalid);
  await assert.rejects(
    () => deploy({ cwd: repoA, agentUrl: agent.url, app: 'legacy', imageRef: 'reg/ns/legacy:3' }),
    (e: Error) => /结构非法|原文件已保留/.test(e.message),
  );
  assert.equal(await readFile(bindingFile, 'utf8'), invalid);

  // unreadable binding (permissions): refuse and preserve the mode
  await writeFile(bindingFile, JSON.stringify({ app: 'legacy', project: projA, env: 'local' }) + '\n', { mode: 0o600 });
  await chmod(bindingFile, 0o000);
  let modeDuringRefusal = -1;
  FX.compose = [];
  try {
    await assert.rejects(
      () => deploy({ cwd: repoA, agentUrl: agent.url, app: 'legacy', imageRef: 'reg/ns/legacy:3' }),
      (e: Error) => /无法读取项目绑定|原文件已保留/.test(e.message),
    );
    assert.equal(FX.compose.length, 0, 'no mutation on the unreadable binding');
    modeDuringRefusal = (await stat(bindingFile)).mode & 0o777; // captured BEFORE our own restore
  } finally {
    await chmod(bindingFile, 0o600).catch(() => {});
  }
  assert.equal(modeDuringRefusal, 0o000, 'the unreadable file and its permissions are preserved by the refusal');
});

test('local identity is a stable digest: no-git dirs WITH SPACES and long names deploy end-to-end', async (t) => {
  FX.containers = [];
  FX.onPull = null;
  const workRoot = await mkdtemp(path.join(tmpdir(), 'ship-iso5-work-'));
  const agent = await startAgent({ role: 'runtime', token: 't', port: 0, host: '127.0.0.1', workRoot });
  t.after(async () => { await agent.close(); process.env.HOME = realHome; });
  const home = await mkdtemp(path.join(tmpdir(), 'ship-home-'));
  process.env.HOME = home;

  const base = await mkdtemp(path.join(tmpdir(), 'ship-space-'));
  const spacedDir = path.join(base, 'my projects with spaces and a really long descriptive directory name 2026');
  await mkdir(spacedDir, { recursive: true });
  await writeFile(path.join(spacedDir, 'ship.yaml'), SPEC_YAML('spacey'));
  const idA = await resolveProjectId(spacedDir);
  assert.match(idA, /^local:[0-9a-f]{32}$/, 'identity is a whitespace-free digest');
  const r = await deploy({ cwd: spacedDir, agentUrl: agent.url, app: 'spacey', imageRef: 'reg/ns/spacey:1' });
  assert.equal(r.app, 'spacey', 'a no-git spaced path deploys through the real path');
  assert.equal((JSON.parse(await readFile(path.join(workRoot, 'apps', 'spacey', 'project.json'), 'utf8')) as { project: string }).project, idA);

  // a DIFFERENT spaced directory with the same app name is still refused
  const otherDir = path.join(base, 'another project dir with spaces');
  await mkdir(otherDir, { recursive: true });
  await writeFile(path.join(otherDir, 'ship.yaml'), SPEC_YAML('spacey'));
  FX.compose = [];
  await assert.rejects(
    () => deploy({ cwd: otherDir, agentUrl: agent.url, app: 'spacey', imageRef: 'reg/ns/spacey:2' }),
    (e: Error) => /已绑定到其他项目/.test(e.message),
  );
  assert.equal(FX.compose.length, 0);
});
