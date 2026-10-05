// S01/S03 regressions: the frozen artifact is the ONLY thing a from-dir
// release uploads and hashes. Literal envFile names (brackets, './'-prefixes)
// are excluded by OUR normalization — never as tar globs — so a declared
// secret like `prod[1].env` can never ride into the archive while an innocent
// `prod1.env` is dropped. And whatever happens to the workspace AFTER the
// freeze (env edits, source edits during capability check / machine prep)
// cannot change the bytes or the digest that ship in the manifest.

import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { link, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { freezeSourceDir, normalizeLiteralPath } from './source-freeze.js';
import { sourceContentDigest } from './source-digest.js';

// Pipeline seams exercise source uploads, not the user's controller ledger.
mock.module('./local-state.js', { namedExports: { saveLastBuild: async () => undefined, readLastBuild: async () => null } });

async function tree(extra: Record<string, string> = {}): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-sfreeze-'));
  await mkdir(path.join(dir, 'config'), { recursive: true });
  await mkdir(path.join(dir, 'src'), { recursive: true });
  await writeFile(path.join(dir, 'Dockerfile'), 'FROM scratch\n');
  await writeFile(path.join(dir, 'src', 'app.js'), 'v1\n');
  for (const [p, c] of Object.entries(extra)) await writeFile(path.join(dir, p), c);
  return dir;
}

const tarEntries = (tgz: string): string[] => {
  const r = spawnSync('tar', ['-tzf', tgz], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.split('\n').filter(Boolean).map((l) => l.replace(/^\.\//, '')).filter((n) => n && !n.endsWith('/'));
};

const sha = (buf: Buffer) => createHash('sha256').update(buf).digest('hex');

test('S01: a literal envFile with glob metacharacters is excluded BY NAME — the innocent look-alike ships, the secret does not', async (t) => {
  const dir = await tree({ 'prod[1].env': 'SECRET=1\n', 'prod1.env': 'NOT-A-SECRET=1\n' });
  t.after(() => rm(dir, { recursive: true, force: true }));
  const frozen = await freezeSourceDir(dir, ['prod[1].env']);
  t.after(() => frozen.cleanup());
  const names = tarEntries(frozen.tarball);
  assert.ok(names.includes('prod1.env'), `ordinary prod1.env must be uploaded: ${names.join(',')}`);
  assert.ok(!names.some((n) => n === 'prod[1].env'), 'the DECLARED secret prod[1].env must never enter the archive');
  // the digest covers exactly those bytes: editing the excluded secret later changes nothing,
  // editing the shipped file does
  const d1 = await sourceContentDigest(frozen.stagingDir, []);
  await writeFile(path.join(dir, 'prod[1].env'), 'SECRET=2\n');
  const again = await freezeSourceDir(dir, ['prod[1].env']);
  await again.cleanup();
  assert.equal(again.contentDigest, frozen.contentDigest, 'excluded-secret edits do not change the artifact digest');
  assert.equal(d1.digest, frozen.contentDigest);
});

test('S01: "./"-prefixed and nested envFile paths normalize to the same literal exclusion', async (t) => {
  assert.equal(normalizeLiteralPath('./config/a.env'), 'config/a.env');
  assert.equal(normalizeLiteralPath('config/./a.env'), 'config/a.env');
  const dir = await tree({ 'config/a.env': 'A=1\n', 'config/b.env': 'B=1\n' });
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const declared of ['./config/a.env', 'config/./a.env']) {
    const frozen = await freezeSourceDir(dir, [declared]);
    const names = tarEntries(frozen.tarball);
    assert.ok(!names.includes('config/a.env'), `'${declared}' must exclude config/a.env`);
    assert.ok(names.includes('config/b.env'), 'sibling env files are unaffected');
    await frozen.cleanup();
  }
});

test('S03: after the freeze, editing ANY file in the live workspace (env or source) changes neither the uploaded bytes nor the digest', async (t) => {
  const dir = await tree({ 'api.env': 'TOKEN=1\n' });
  t.after(() => rm(dir, { recursive: true, force: true }));
  const frozen = await freezeSourceDir(dir, ['api.env']);
  t.after(() => frozen.cleanup());
  const bytesBefore = sha(await readFile(frozen.tarball));

  await writeFile(path.join(dir, 'api.env'), 'TOKEN=changed\n'); // env-only edit
  await writeFile(path.join(dir, 'src', 'app.js'), 'v2-mid-provisioning\n'); // source edit
  mkdir(path.join(dir, 'late-dir'), { recursive: true }).then(() => writeFile(path.join(dir, 'late-dir', 'x.txt'), 'late\n'));

  assert.equal(sha(await readFile(frozen.tarball)), bytesBefore, 'frozen tarball bytes are immutable');
  const stagingList = tarEntries(frozen.tarball);
  assert.ok(!stagingList.some((n) => n.includes('late-dir')), 'files created after the freeze are not uploaded');
  assert.ok(stagingList.includes('src/app.js'));
  const content = spawnSync('tar', ['-xzf', frozen.tarball, '-O', './src/app.js'], { encoding: 'utf8' });
  assert.equal(content.stdout, 'v1\n', 'the uploaded source is the FROZEN version, not the later edit');
});

test('S03 (pipeline seam): a source edit during the capability check still ships the frozen content and digest', async (t) => {
  const stub = await startStubBuilder();
  t.after(() => stub.close());
  const dir = await tree({ 'api.env': 'TOKEN=1\n' });
  t.after(() => rm(dir, { recursive: true, force: true }));
  const pristine = await mkdtemp(path.join(tmpdir(), 'ship-sfreeze-pristine-'));
  t.after(() => rm(pristine, { recursive: true, force: true }));
  await mkdir(pristine, { recursive: true });
  // pristine copy = the tree exactly as it is BEFORE the pipeline starts
  for (const f of ['Dockerfile', 'src/app.js', 'api.env']) {
    const buf = await readFile(path.join(dir, f));
    const dest = path.join(pristine, f);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, buf);
  }
  const expectedDigest = (await sourceContentDigest(pristine, ['api.env'])).digest;

  // the builder stub flips a file DURING the capability check (after the freeze)
  stub.fx.onStatus = async () => {
    await writeFile(path.join(dir, 'src', 'app.js'), 'edited-during-capability-check\n');
  };
  const { runMultiBuildPipeline } = await import('./pipeline-multi.js');
  const spec = { schemaVersion: 2 as const, name: 'g', services: { api: { envFile: 'api.env' } } };
  const manifest = await runMultiBuildPipeline({
    config: stub.config, cwd: dir, logger: stub.log, spec, selection: ['api'], fromDir: dir, timeoutMs: 5_000,
  });
  assert.equal(manifest.services.api?.source.contentDigest, expectedDigest, 'manifest digest = the FROZEN (uploaded) content, not the later dir');
  const uploaded = stub.fx.uploadedBytes;
  assert.ok(uploaded.length > 0, 'an upload happened');
  const body = spawnSync('tar', ['-xzf', '-', '-O', './src/app.js'], { input: uploaded, encoding: 'utf8' });
  assert.ok(/v1/.test(body.stdout), `uploaded archive carries the frozen source: ${JSON.stringify(body.stdout)} ${body.stderr}`);
});

test('declared env files exclude their symlink targets and hardlink aliases from the real archive', async (t) => {
  const dir = await tree({ 'private.txt': 'DECLARED_SECRET=synthetic\n' });
  t.after(() => rm(dir, { recursive: true, force: true }));
  await symlink('../private.txt', path.join(dir, 'config', 'runtime.env'));
  await link(path.join(dir, 'private.txt'), path.join(dir, 'copy.txt'));
  const frozen = await freezeSourceDir(dir, ['config/runtime.env']);
  t.after(() => frozen.cleanup());
  const names = tarEntries(frozen.tarball);
  for (const secret of ['config/runtime.env', 'private.txt', 'copy.txt']) {
    assert.ok(!names.includes(secret), `secret alias ${secret} entered the source archive`);
  }
  assert.ok(names.includes('src/app.js'), 'ordinary source must remain included');
});

test('env paths through a directory symlink exclude the physical secret, retaining its public sibling', async (t) => {
  const dir = await tree();
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(path.join(dir, 'settings'));
  await writeFile(path.join(dir, 'settings', 'runtime.env'), 'TOKEN=synthetic\n');
  await writeFile(path.join(dir, 'settings', 'public.txt'), 'public\n');
  await symlink('settings', path.join(dir, 'env-alias'));
  const frozen = await freezeSourceDir(dir, ['env-alias/runtime.env']);
  t.after(() => frozen.cleanup());
  const names = tarEntries(frozen.tarball);
  assert.ok(!names.includes('settings/runtime.env'), 'physical secret behind directory alias must be excluded');
  assert.ok(names.includes('settings/public.txt'), 'public sibling must not be over-excluded');
});

test('default secret filenames also exclude their physical file aliases', async (t) => {
  const dir = await tree({ 'private.txt': 'TOKEN=synthetic\n', 'cert-data.txt': 'PRIVATE_KEY=synthetic\n' });
  t.after(() => rm(dir, { recursive: true, force: true }));
  await symlink('private.txt', path.join(dir, '.env'));
  await symlink('cert-data.txt', path.join(dir, 'server.pem'));
  const frozen = await freezeSourceDir(dir, []);
  t.after(() => frozen.cleanup());
  const names = tarEntries(frozen.tarball);
  for (const secret of ['.env', 'private.txt', 'server.pem', 'cert-data.txt']) {
    assert.ok(!names.includes(secret), `default secret alias ${secret} entered the archive`);
  }
  assert.ok(names.includes('src/app.js'));
});

test('v1/v2 use cwd-relative env paths when the uploaded source root is a subdirectory', async (t) => {
  const stub = await startStubBuilder();
  t.after(() => stub.close());
  const dir = await tree();
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(path.join(dir, 'build'));
  await writeFile(path.join(dir, 'build', 'runtime.env'), 'TOKEN=synthetic\n');
  await writeFile(path.join(dir, 'build', 'app.js'), 'public\n');
  await writeFile(path.join(dir, 'ship.yaml'), 'name: api\nenvFile: build/runtime.env\n');
  const { runBuildPipeline } = await import('./pipeline.js');
  const { runMultiBuildPipeline } = await import('./pipeline-multi.js');
  const options = { config: stub.config, cwd: dir, logger: stub.log, fromDir: 'build', timeoutMs: 5_000 };
  for (const run of [
    () => runBuildPipeline(options),
    () => runMultiBuildPipeline({ ...options, spec: { schemaVersion: 2, name: 'g', services: { api: { envFile: 'build/runtime.env' } } }, selection: ['api'] }),
  ]) {
    await run();
    const list = spawnSync('tar', ['-tzf', '-'], { input: stub.fx.uploadedBytes, encoding: 'utf8' });
    assert.equal(list.status, 0, list.stderr);
    assert.ok(!list.stdout.includes('runtime.env'), 'runtime env path must be relative to cwd, not from-dir');
    assert.ok(list.stdout.includes('app.js'), 'public source must still upload');
  }
});

test('v1 runtime env override is excluded as well as the default declared env file', async (t) => {
  const stub = await startStubBuilder();
  t.after(() => stub.close());
  const dir = await tree({ 'default.txt': 'DEFAULT=synthetic\n', 'override.txt': 'OVERRIDE=synthetic\n' });
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(path.join(dir, 'ship.yaml'), 'name: api\nenvFile: default.txt\n');
  const { runBuildPipeline } = await import('./pipeline.js');
  const options = { config: stub.config, cwd: dir, logger: stub.log, fromDir: '.', timeoutMs: 5_000, envFile: 'override.txt' };
  await runBuildPipeline(options);
  const list = spawnSync('tar', ['-tzf', '-'], { input: stub.fx.uploadedBytes, encoding: 'utf8' });
  assert.equal(list.status, 0, list.stderr);
  assert.ok(!list.stdout.includes('default.txt'), 'default env must remain excluded');
  assert.ok(!list.stdout.includes('override.txt'), 'runtime override must never be uploaded');
});

test('ship release wires --env-file into packing and retains default/keep-env precedence', async (t) => {
  const stub = await startStubBuilder();
  t.after(() => stub.close());
  const dir = await tree({ 'default.txt': 'DEFAULT=synthetic\n', 'override.txt': 'OVERRIDE=synthetic\n' });
  const controllerHome = await mkdtemp(path.join(tmpdir(), 'ship-sfreeze-controller-'));
  t.after(() => rm(controllerHome, { recursive: true, force: true }));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(path.join(dir, 'ship.yaml'), 'name: api\nenvFile: default.txt\n');
  await writeFile(path.join(dir, 'ship.config.json'), JSON.stringify(stub.config));
  for (const [flags, expected] of [
    [[], 'DEFAULT=synthetic\n'],
    [['--env-file', 'override.txt'], 'OVERRIDE=synthetic\n'],
    [['--env-file', 'override.txt', '--keep-env'], 'OVERRIDE=synthetic\n'],
    [['--keep-env'], undefined],
  ] as Array<[string[], string | undefined]>) {
    const code = await new Promise<number | null>((resolve, reject) => {
      const child = spawn(process.execPath, [new URL('./main.js', import.meta.url).pathname, 'release', '--from-dir', '.', '--json', ...flags], {
        cwd: dir, env: { ...process.env, HOME: controllerHome }, stdio: 'ignore',
      });
      child.on('error', reject);
      child.on('exit', resolve);
    });
    assert.equal(code, 0, `CLI release failed for ${flags.join(' ')}`);
    assert.equal(stub.fx.deployedEnv, expected, 'runtime env precedence must remain compatible');
    const list = spawnSync('tar', ['-tzf', '-'], { input: stub.fx.uploadedBytes, encoding: 'utf8' });
    assert.equal(list.status, 0, list.stderr);
    assert.ok(!list.stdout.includes('default.txt'));
    if (flags.includes('--env-file')) assert.ok(!list.stdout.includes('override.txt'), 'CLI env override must stay off the builder');
  }
});

// ---- a minimal builder stub with a mid-capability-check hook ----
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createLogger } from '../shared/log.js';

async function startStubBuilder(): Promise<{
  close: () => Promise<void>;
  fx: { onStatus: null | (() => Promise<void> | void); uploadedBytes: Buffer; deployedEnv: string | undefined };
  config: import('../shared/types.js').ShipConfig;
  log: import('../shared/log.js').Logger;
}> {
  const fx = { onStatus: null as null | (() => Promise<void> | void), uploadedBytes: Buffer.alloc(0), deployedEnv: undefined as string | undefined };
  let builds = 0;
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c as Buffer));
    req.on('end', async () => {
      const body = Buffer.concat(chunks);
      const json = (status: number, payload: unknown) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(payload)); };
      if (req.url === '/api/status') { await fx.onStatus?.(); return json(200, { role: 'both', auth: { role: 'both', capabilities: ['build', 'push', 'multi-service-v2', 'deployment-identity-v1', 'deployment-env-preserve-v1'] } }); }
      if (req.url === '/api/sources') { fx.uploadedBytes = body; return json(201, { id: '01234567-89ab-cdef-0123-456789abcdef' }); }
      if (req.url === '/api/build') { builds++; return json(202, { jobId: `b${builds}` }); }
      if (req.url === '/api/push') return json(202, { jobId: 'p1' });
      if (req.url === '/api/deploy') { fx.deployedEnv = (JSON.parse(body.toString()) as { envFileContent?: string }).envFileContent; return json(202, { jobId: 'd1' }); }
      if (req.url?.startsWith('/api/jobs/')) {
        const id = req.url.split('/')[3] ?? '';
        if (id.startsWith('b')) return json(200, { id, status: 'succeeded', result: { name: 'api', tag: 't', arch: 'linux/amd64' } });
        if (id.startsWith('d')) return json(200, { id, status: 'succeeded', result: { imageRef: 'reg.example/ns/api:t', healthy: true } });
        return json(200, { id, status: 'succeeded', result: { imageRef: 'reg.example/ns/api:t', digest: `sha256:${'a'.repeat(64)}` } });
      }
      json(404, {});
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const log = createLogger(false);
  log.info = () => undefined;
  return {
    close: () => new Promise<void>((r) => server.close(() => r())),
    fx,
    log,
    config: {
      source: { repo: 'https://git.example/t.git' },
      builder: { mode: 'static', static: { url, token: 't' } },
      registry: { url: 'reg.example', namespace: 'ns' },
      runtime: { targets: { prod: { url, token: 't' } } },
    },
  };
}
