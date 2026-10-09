import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gitHttpsFixture } from './git-https-fixture.mjs';

// Opt-in isolated acceptance; requires a built shipkit/dist, Git, and OpenSSL.
const distRoot = fileURLToPath(new URL('../dist/', import.meta.url));
const observer = fileURLToPath(new URL('./git-observer.cjs', import.meta.url));
const outputRoot = path.resolve(process.env.SHIPKIT_ACCEPTANCE_OUTPUT_DIR || '/tmp/codex-tool-runs/svton/git-config');
await mkdir(outputRoot, { recursive: true });
const directory = await mkdtemp(path.join(outputRoot, 'https-git-fixture-'));
const token = randomBytes(32).toString('base64url');
const realGit = spawnSync('/usr/bin/which', ['git'], { encoding: 'utf8' }).stdout.trim();
const backend = path.join(spawnSync(realGit, ['--exec-path'], { encoding: 'utf8' }).stdout.trim(), 'git-http-backend');
const work = path.join(directory, 'work'), repositories = path.join(directory, 'repositories'), bare = path.join(repositories, 'org', 'fixture.git');
const observationsFile = path.join(directory, 'observations.jsonl');
const saved = { PATH: process.env.PATH, GIT_SSL_CAINFO: process.env.GIT_SSL_CAINFO, SHIPKIT_GIT_ALLOWED_HOSTS: process.env.SHIPKIT_GIT_ALLOWED_HOSTS, SHIPKIT_GIT_ALLOW_PRIVATE_HOSTS: process.env.SHIPKIT_GIT_ALLOW_PRIVATE_HOSTS };
const logs = [], checks = [];
let server;
function run(command, args, cwd = directory) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', env: process.env, maxBuffer: 16 * 1024 * 1024 });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  assert(![token, encodeURIComponent(token)].some(value => output.includes(value)), 'command output must not contain credential');
  logs.push({ command: path.basename(command), status: result.status, output });
  assert.equal(result.status, 0, `${path.basename(command)} failed`); return result.stdout.trim();
}
async function check(label, action) { await action(); checks.push({ label, passed: true }); }
const shellQuote = value => "'" + value.replaceAll("'", "'\\''") + "'";
try {
  await mkdir(path.join(repositories, 'org'), { recursive: true }); await mkdir(work);
  run(realGit, ['init', '--initial-branch=main', work]);
  run(realGit, ['-C', work, 'config', 'user.name', 'Fixture']); run(realGit, ['-C', work, 'config', 'user.email', 'fixture@example.invalid']);
  const spec = { schemaVersion: 2, name: 'git-fixture', services: { api: { context: '.', dockerfile: 'Dockerfile', ports: ['19990:3000'] } } };
  await writeFile(path.join(work, 'ship.yaml'), JSON.stringify(spec)); await writeFile(path.join(work, 'Dockerfile'), 'FROM scratch\n'); await writeFile(path.join(work, 'README'), 'first\n');
  run(realGit, ['-C', work, 'add', 'ship.yaml', 'Dockerfile', 'README']); run(realGit, ['-C', work, 'commit', '-m', 'fixture first']);
  const first = run(realGit, ['-C', work, 'rev-parse', 'HEAD']);
  run(realGit, ['clone', '--bare', work, bare]);
  run(realGit, ['--git-dir', bare, 'config', 'http.receivepack', 'false']);
  run(realGit, ['--git-dir', bare, 'config', 'uploadpack.allowReachableSHA1InWant', 'true']);
  run('openssl', ['req','-x509','-newkey','rsa:2048','-nodes','-keyout','ca.key','-out','ca.crt','-days','1','-subj','/CN=Shipkit Fixture CA']);
  run('openssl', ['req','-newkey','rsa:2048','-nodes','-keyout','server.key','-out','server.csr','-subj','/CN=localhost']);
  await writeFile(path.join(directory, 'tls.ext'), 'subjectAltName=DNS:localhost,IP:127.0.0.1\nextendedKeyUsage=serverAuth\n');
  run('openssl', ['x509','-req','-in','server.csr','-CA','ca.crt','-CAkey','ca.key','-CAcreateserial','-out','server.crt','-days','1','-extfile','tls.ext']);
  server = await gitHttpsFixture({ key: await readFile(path.join(directory, 'server.key')), cert: await readFile(path.join(directory, 'server.crt')), repositoryRoot: repositories, backend, token });
  const binaries = path.join(directory, 'bin'); await mkdir(binaries);
  await writeFile(path.join(binaries, 'git'), `#!/bin/sh\nexec ${shellQuote(process.execPath)} ${shellQuote(observer)} "$@"\n`, { mode: 0o700 });
  process.env.PATH = `${binaries}:${saved.PATH}`; process.env.GIT_SSL_CAINFO = path.join(directory, 'ca.crt');
  process.env.SHIPKIT_FIXTURE_REAL_GIT = realGit; process.env.SHIPKIT_FIXTURE_TOKEN = token; process.env.SHIPKIT_FIXTURE_OBSERVATIONS = observationsFile;
  const { resolveRepositorySource } = await import(pathToFileURL(path.join(distRoot, 'platform/index.js')).href);
  const url = `${server.url}/org/fixture.git`;
  const source = { repoUrl: url, ref: { kind: 'branch', value: 'main' }, specPath: 'ship.yaml', provider: 'generic', revision: 1 };
  const temporaryRoot = path.join(directory, 'resolver'); await mkdir(temporaryRoot);
  const options = { token, allowedHosts: ['localhost'], allowPrivateHosts: ['localhost'], temporaryRoot, timeoutMs: 20000, maxBytes: 1024 * 1024 };
  process.env.SHIPKIT_GIT_ALLOWED_HOSTS = 'localhost'; process.env.SHIPKIT_GIT_ALLOW_PRIVATE_HOSTS = 'localhost';
  const { ensureSource } = await import(pathToFileURL(path.join(distRoot, 'agent/source.js')).href);
  const agentLogs = [], agentWork = path.join(directory, 'agent-work');
  let initial, advanced, pinned, checkout, repeatedCheckout;
  await check('untrusted HTTPS certificate fails while TLS verification stays enabled', async () => {
    delete process.env.GIT_SSL_CAINFO;
    try { await assert.rejects(resolveRepositorySource(source, options)); }
    finally { process.env.GIT_SSL_CAINFO = path.join(directory, 'ca.crt'); }
  });
  await check('HTTPS CA-authenticated smart Git resolves real fixed commit and spec', async () => {
    initial = await resolveRepositorySource(source, options); assert.equal(initial.commit, first); assert.equal(initial.appName, 'git-fixture'); assert.equal(initial.spec.services.api.dockerfile, 'Dockerfile');
  });
  await check('Builder performs authenticated HTTPS working-tree clone at the pinned SHA', async () => {
    checkout = await ensureSource(agentWork, { type: 'git', repo: url, ref: first, token }, line => agentLogs.push(line));
    assert.equal(checkout.sha, first); assert.equal(await readFile(path.join(checkout.dir, 'README'), 'utf8'), 'first\n');
    assert((await readFile(path.join(checkout.dir, '.git/config'), 'utf8')).includes(url));
  });
  await writeFile(path.join(work, 'README'), 'second\n'); run(realGit, ['-C', work, 'add', 'README']); run(realGit, ['-C', work, 'commit', '-m', 'fixture second']);
  const second = run(realGit, ['-C', work, 'rev-parse', 'HEAD']); run(realGit, ['--git-dir', bare, 'fetch', work, 'main:main']);
  await check('branch advancement changes new resolution but immutable commit remains pinned', async () => {
    advanced = await resolveRepositorySource(source, options); pinned = await resolveRepositorySource({ ...source, ref: { kind: 'commit', value: first } }, options);
    assert.equal(advanced.commit, second); assert.equal(pinned.commit, first); assert.notEqual(second, first);
  });
  await check('Builder repeat fetch observes branch advancement and keeps the old SHA checkout', async () => {
    repeatedCheckout = await ensureSource(agentWork, { type: 'git', repo: url, ref: first, token }, line => agentLogs.push(line));
    assert.equal(repeatedCheckout.dir, checkout.dir); assert.equal(repeatedCheckout.sha, first);
    assert.equal(await readFile(path.join(repeatedCheckout.dir, 'README'), 'utf8'), 'first\n');
    assert.equal(run(realGit, ['-C', repeatedCheckout.dir, 'rev-parse', 'origin/main']), second);
    assert(agentLogs.some(line => line.includes('cloning'))); assert(agentLogs.some(line => line.includes('fetching updates')));
  });
  await check('private host access requires explicit server option', async () => {
    await assert.rejects(resolveRepositorySource(source, { ...options, allowPrivateHosts: [] }));
  });
  await check('metadata cache byte budget refuses oversize and cleans temporary data', async () => {
    await assert.rejects(resolveRepositorySource(source, { ...options, maxBytes: 1 }), /byte limit/);
    assert.deepEqual(await readdir(temporaryRoot), []);
  });
  const observations = (await readFile(observationsFile, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  await check('askpass authentication never enters repository URL, argv, config, or process output', async () => {
    assert(observations.length > 0); assert(observations.every(item => !item.argvLeaked && !item.configLeaked && !item.outputLeaked));
    const authenticated = observations.filter(item => item.askpass); assert(authenticated.length > 0); assert(authenticated.every(item => item.tracingDisabled));
    assert(server.evidence.authorized > 0); assert(server.evidence.challenged > 0); assert.equal(server.evidence.receivePackRequests, 0);
    assert(!JSON.stringify([initial, advanced, pinned, logs, agentLogs]).includes(token));
    assert(!JSON.stringify(agentLogs).includes(encodeURIComponent(token)));
    assert(!(await readFile(path.join(checkout.dir, '.git/config'), 'utf8')).includes(token));
  });
  await check('temporary checkout and askpass credential files are removed after resolution', async () => {
    assert.deepEqual(await readdir(temporaryRoot), []);
    for (const item of observations) { if (item.askpass) assert(!existsSync(item.askpass)); if (item.credentialFile) assert(!existsSync(item.credentialFile)); }
  });
  const report = { passed: true, at: new Date().toISOString(), checks, commits: { first, second, pinned: pinned.commit, builderInitial: checkout.sha, builderAfterFetch: repeatedCheckout.sha }, authorizedRequests: server.evidence.authorized,
    credentialChallenges: server.evidence.challenged, observedGitCommands: observations.length, leakMatches: 0, receivePackRequests: server.evidence.receivePackRequests, tlsVerification: 'private CA; verification enabled', secretType: 'synthetic temporary credential' };
  await writeFile(path.join(outputRoot, 'real-git-acceptance.json'), JSON.stringify(report, null, 2));
  await writeFile(path.join(outputRoot, 'real-git-command-log.json'), JSON.stringify({ setupAndInspection: logs, builderLogs: agentLogs }, null, 2));
  console.log(JSON.stringify(report));
} catch (error) {
  const message = String(error?.message ?? error).split(token).join('[redacted]');
  await writeFile(path.join(outputRoot, 'real-git-acceptance.json'), JSON.stringify({ passed: false, checks, error: message }, null, 2));
  console.error(message); process.exitCode = 1;
} finally {
  try { await server?.stop(); } finally {
    for (const [key, value] of Object.entries(saved)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
    for (const key of ['SHIPKIT_FIXTURE_REAL_GIT','SHIPKIT_FIXTURE_TOKEN','SHIPKIT_FIXTURE_OBSERVATIONS']) delete process.env[key];
    await rm(directory, { recursive: true, force: true });
  }
}
