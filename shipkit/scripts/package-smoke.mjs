// Isolated-package smoke (M2 remediation, delivery step 4): install the packed
// shipkit-<version>.tgz into a temp prefix OUTSIDE the repository (no symlink to
// the repo) and prove the key M2 fixes hold inside the installed package:
//   cross-process pairing · role gates (M2-03) · status auth (M2-04) ·
//   tokenRef doctor chain (M2-05/M2-10) · raw source upload (LEGACY-02).
// No Docker mutations, no cloud, no publication.

import { execFile as run, spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile, stat, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const exec = promisify(run);
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(await readFile(path.join(REPO, 'package.json'), 'utf8'));
const TARBALL = path.join(REPO, 'pack', `shipkit-${pkg.version}.tgz`);
const base = await mkdtemp(path.join(tmpdir(), 'ship-pkgsmoke-'));
const prefix = path.join(base, 'prefix');
const home = path.join(base, 'home');
const project = path.join(base, 'project');

const failed = [];
function check(cond, name, detail = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${cond ? '' : ` — ${detail}`}`);
  if (!cond) failed.push(name);
}

try {
  // 1. offline-ish isolated install (deps resolved from the npm cache when possible)
  try {
    await exec('npm', ['install', '--prefix', prefix, '--omit=dev', '--no-audit', '--no-fund', '--offline', TARBALL], { timeout: 180_000 });
    console.log('install: offline');
  } catch {
    await exec('npm', ['install', '--prefix', prefix, '--omit=dev', '--no-audit', '--no-fund', TARBALL], { timeout: 300_000 });
    console.log('install: online (npm cache miss)');
  }
  const pkgRoot = path.join(prefix, 'node_modules', 'shipkit');
  check(await stat(path.join(pkgRoot, 'dist', 'agent', 'server.js')).then(() => true, () => false), 'installed package layout present');
  check(!path.resolve(pkgRoot).startsWith(REPO + path.sep) || false === pkgRoot.startsWith(REPO), 'prefix is outside the repository');

  await mkdir(path.join(home, '.ship'), { recursive: true });
  await mkdir(project, { recursive: true });
  await writeFile(path.join(project, 'Dockerfile'), 'FROM scratch\nEXPOSE 3000\n');

  const AGENT = path.join(pkgRoot, 'dist', 'agent', 'server.js');
  const CLI = path.join(prefix, 'node_modules', '.bin', 'ship');
  const workRoot = path.join(base, 'agent-root');
  await mkdir(workRoot, { recursive: true });
  // Only Docker's availability probe is needed; every mutation is refused.
  const fakeBin = path.join(base, 'fake-bin');
  await mkdir(fakeBin);
  await writeFile(path.join(fakeBin, 'docker'), '#!/bin/sh\nif [ "$1" = version ]; then echo 24.0; exit 0; fi\necho "unexpected Docker operation in package smoke" >&2\nexit 99\n', { mode: 0o755 });

  // The installed artifact must carry the actual fixes, not only a healthy
  // version string. These tests mock Docker and use real localhost HTTP.
  const isolation = await exec(process.execPath, ['--experimental-test-module-mocks', '--test',
    'dist/cli/deploy-isolation.e2e.test.js', 'dist/cli/deployment-provenance.test.js',
    'dist/cli/project-id.test.js', 'dist/agent/project-binding.test.js', 'dist/agent/deploy-ownership.test.js',
    'dist/agent/deploy-env-safety.test.js', 'dist/agent/deploy-commit-safety.test.js',
    'dist/providers/bundle-server.test.js', 'dist/providers/tencent-bundle-port.test.js',
  ], { cwd: pkgRoot, timeout: 180_000, env: { ...process.env, PATH: `${fakeBin}${path.delimiter}${process.env.PATH}`, DOCKER_HOST: 'unix:///tmp/shipkit-smoke-no-docker.sock' } });
  check(/^# fail 0$/m.test(isolation.stdout), `installed deployment isolation regressions (${isolation.stdout.match(/^# tests (\d+)$/m)?.[1] ?? '?'} tests)`);

  // 2. real installed agent subprocess
  const agent = spawn(process.execPath, [AGENT], {
    env: { ...process.env, PATH: `${fakeBin}${path.delimiter}${process.env.PATH}`, DOCKER_HOST: 'unix:///tmp/shipkit-smoke-no-docker.sock', SHIP_AGENT_ROLE: 'both', SHIP_AGENT_TOKEN: 'SMOKE_MASTER', SHIP_AGENT_PORT: '0', SHIP_AGENT_HOST: '127.0.0.1', SHIP_WORK_ROOT: workRoot },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let errText = '';
  agent.stderr.on('data', (d) => { errText += d; });
  const url = await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`agent did not start: ${errText}`)), 20_000);
    agent.stderr.on('data', () => {
      const m = errText.match(/listening on (127\.0\.0\.1:\d+)/);
      if (m) { clearTimeout(t); resolve(`http://${m[1]}`); }
    });
  });
  try {
    const health = await (await fetch(`${url}/health`)).json();
    check(health.version === pkg.version, `installed agent reports ${pkg.version}`, JSON.stringify(health));

    // 3. administrator --pair child process mints a code (cross-process store, M2-06)
    const mint = await exec(process.execPath, [AGENT, '--pair', '--role', 'builder', '--ttl-min', '5'], {
      env: { ...process.env, SHIP_WORK_ROOT: workRoot },
    });
    const code = mint.stdout.match(/skp-[A-Za-z0-9_-]+/)?.[0];
    check(Boolean(code), 'installed --pair mints a one-time code');

    // 4. installed CLI: pair (prechecks + 0600 store, M2-08/M2-07)
    const pair = await exec(CLI, ['pair', url, '--name', 'builder', '--code', code, '--json'], { env: { ...process.env, HOME: home } });
    check(JSON.parse(pair.stdout).ok === true, 'installed ship pair succeeds');
    const credFile = path.join(home, '.ship', 'credentials.json');
    const mode = (await stat(credFile)).mode & 0o777;
    check(mode === 0o600, `credential file is 0600 (got ${mode.toString(8)})`);

    // 5. M2-03 in the installed package: runtime token may not store push creds
    const mintRt = await exec(process.execPath, [AGENT, '--pair', '--role', 'runtime', '--ttl-min', '5'], {
      env: { ...process.env, SHIP_WORK_ROOT: workRoot },
    });
    const rtCode = mintRt.stdout.match(/skp-[A-Za-z0-9_-]+/)?.[0];
    const rtPair = await exec(CLI, ['pair', url, '--name', 'staging', '--code', rtCode, '--json'], { env: { ...process.env, HOME: home } });
    check(JSON.parse(rtPair.stdout).ok === true, 'installed ship pair (runtime role)');
    const creds = JSON.parse(await readFile(credFile, 'utf8'));
    const rtPush = await fetch(`${url}/api/registry-creds`, {
      method: 'PUT', headers: { authorization: `Bearer ${creds.staging.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'push', user: 'u', password: 'p' }),
    });
    check(rtPush.status === 403, 'runtime credential cannot store push creds (M2-03)', `status ${rtPush.status}`);
    const btPush = await fetch(`${url}/api/registry-creds`, {
      method: 'PUT', headers: { authorization: `Bearer ${creds.builder.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'push', user: 'u', password: 'p' }),
    });
    check(btPush.status === 200, 'builder credential stores push creds');

    // 6. status auth (M2-04) through the installed agent
    const st = (await (await fetch(`${url}/api/status`, { headers: { authorization: `Bearer ${creds.staging.token}` } })).json());
    check(st.auth?.role === 'runtime', 'status reports the caller\'s effective role', JSON.stringify(st.auth));
    check(st.auth?.capabilities?.includes('deployment-identity-v1'), 'installed runtime enforces project and environment identity');
    check(st.auth?.capabilities?.includes('deployment-env-preserve-v1'), 'installed runtime supports safe keep-env');

    // 7. doctor through tokenRef (M2-05 keep + M2-04 gates) with the installed CLI
    await writeFile(path.join(project, 'ship.config.json'), JSON.stringify({
      builder: { mode: 'static', static: { url, tokenRef: 'builder' } },
      registry: { url: new URL(url).host, namespace: 'smoke' },
      runtime: { targets: { staging: { url, tokenRef: 'staging' } } },
    }, null, 2));
    const doctor = await exec(CLI, ['doctor', '--json'], { cwd: project, env: { ...process.env, HOME: home } });
    const report = JSON.parse(doctor.stdout);
    check(report.allOk === true, 'installed doctor passes via tokenRef', JSON.stringify(report.checks?.map((c) => `${c.name}:${c.ok}`)));

    // 8. LEGACY-02 in the installed package: real tarball upload streams
    const staging = path.join(base, 'src');
    await mkdir(staging, { recursive: true });
    await writeFile(path.join(staging, 'Dockerfile'), 'FROM scratch\n');
    const tgz = path.join(base, 'up.tgz');
    await exec('tar', ['czf', tgz, '-C', staging, '.']);
    const up = await fetch(`${url}/api/sources`, {
      method: 'POST', headers: { authorization: `Bearer ${creds.builder.token}`, 'content-type': 'application/gzip' },
      body: new Uint8Array(await readFile(tgz)),
    });
    check(up.status === 201, 'binary source upload → 201 (LEGACY-02)', `status ${up.status}`);
    const upBody = (await up.json());
    const id = upBody.id;
    check((await readdir(path.join(workRoot, 'sources'))).includes(`tar-${id}`), 'uploaded tarball extracted server-side');

    // 9. the config on disk carries tokenRef only — no plaintext long-term secrets (M2-05)
    const cfg = await readFile(path.join(project, 'ship.config.json'), 'utf8');
    check(!cfg.includes(creds.builder.token) && !cfg.includes(creds.staging.token), 'project config holds no plaintext agent tokens');

    // 10. M2-R2 in the installed package: real cross-process lock contention —
    // agent + several administrator --pair subprocesses racing on security.json.
    // Every fulfilled exchange token must authenticate, every code is consumed
    // exactly once, and the store survives with no lost updates.
    const mintChild2 = async () => {
      const c = await exec(process.execPath, [AGENT, '--pair', '--role', 'builder', '--ttl-min', '5'], {
        env: { ...process.env, SHIP_WORK_ROOT: workRoot },
      });
      const m = c.stdout.match(/skp-[A-Za-z0-9_-]+/);
      if (!m) throw new Error(`--pair child printed no code: ${c.stdout}`);
      return m[0];
    };
    const codes2 = [];
    for (let i = 0; i < 4; i++) codes2.push(await mintChild2());
    const exchanges2 = codes2.map((code2) => fetch(`${url}/api/pairing/exchange`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: code2 }),
    }).then(async (res) => ({ code: code2, status: res.status, token: res.status === 200 ? ((await res.json()).token) : undefined })));
    const concurrentMints2 = Array.from({ length: 4 }, () => mintChild2());
    const results2 = await Promise.all([...exchanges2, ...concurrentMints2.map(async (p) => { await p; return null; })]);
    let allAuthenticate = true;
    let allConsumedOnce = true;
    for (const r of results2) {
      if (r === null || r.code === undefined) continue;
      if (r.status !== 200) allAuthenticate = false;
      const probe = await fetch(`${url}/api/status`, { headers: { authorization: `Bearer ${r.token}` } });
      if (probe.status !== 200) allAuthenticate = false;
      const replay = await fetch(`${url}/api/pairing/exchange`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: r.code }),
      });
      if (replay.status !== 401) allConsumedOnce = false;
    }
    check(allAuthenticate, 'M2-R2 (package): every fulfilled pairing token authenticates');
    check(allConsumedOnce, 'M2-R2 (package): every code consumed exactly once (replay refused)');
    const store2 = JSON.parse(await readFile(path.join(workRoot, 'security.json'), 'utf8'));
    check(Array.isArray(store2.codes) && store2.codes.length >= 8 && store2.tokens.length >= 6, 'M2-R2 (package): no lost updates in the shared store');
  } finally {
    agent.kill('SIGTERM');
  }
} catch (e) {
  check(false, 'smoke harness', String(e.message ?? e));
} finally {
  await rm(base, { recursive: true, force: true }).catch(() => {});
}

console.log(failed.length === 0 ? `package-smoke: all checks passed (${pkg.version})` : `package-smoke: FAILED — ${failed.join('; ')}`);
process.exit(failed.length === 0 ? 0 : 1);
