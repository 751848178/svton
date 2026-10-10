// Run explicitly inside a unique read-only Docker container with /tmp mounted noexec.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:https';
import { spawn } from 'node:child_process';
import { chmod, copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { exec } from '../shared/exec.js';
import { repositoryDescriptor } from './repository-metadata.js';
import { resolveGenericSource } from './repository-generic.js';

test('generic private HTTPS Git resolves and cleans credentials on a real noexec temporary mount', async t => {
  if (process.env.SHIPKIT_GIT_NOEXEC_FIXTURE !== '1') return t.skip('run isolated Docker noexec fixture explicitly');
  assert.equal(process.platform, 'linux');
  const mounts = await readFile('/proc/self/mountinfo', 'utf8');
  assert.ok(mounts.split('\n').some(line => line.includes(' /tmp ') && line.split(' ')[5]?.split(',').includes('noexec')));
  const root = await mkdtemp(path.join(tmpdir(), 'ship-git-noexec-'));
  const oldTemporary = process.env.TMPDIR, oldCa = process.env.GIT_SSL_CAINFO;
  t.after(async () => {
    if (oldTemporary === undefined) delete process.env.TMPDIR; else process.env.TMPDIR = oldTemporary;
    if (oldCa === undefined) delete process.env.GIT_SSL_CAINFO; else process.env.GIT_SSL_CAINFO = oldCa;
    await rm(root, { recursive: true, force: true });
  });
  const temporary = path.join(root, 'temporary path \'single\' "double"');
  await mkdir(temporary, { mode: 0o700 });
  process.env.TMPDIR = temporary;
  const executable = path.join(temporary, 'noexec-probe');
  await copyFile('/usr/bin/true', executable); await chmod(executable, 0o700);
  const probe = await exec(executable, []);
  assert.equal(probe.code, -1); assert.match(probe.stderr, /EACCES/);

  async function command(program: string, args: string[], cwd?: string) {
    const result = await exec(program, args, { cwd, timeoutMs: 20_000 });
    assert.equal(result.code, 0, `${program} fixture setup failed`);
    return result.stdout.trim();
  }
  const seed = path.join(root, 'seed'), gitRoot = path.join(root, 'git');
  await mkdir(seed); await mkdir(path.join(gitRoot, 'team'), { recursive: true });
  await command('git', ['init', '--initial-branch=main', seed]);
  await writeFile(path.join(seed, 'ship.yaml'), 'schemaVersion: 2\nname: noexec-fixture\nservices:\n  server: {}\n');
  await command('git', ['add', 'ship.yaml'], seed);
  await command('git', ['-c', 'user.name=ShipkitFixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'isolated fixture'], seed);
  const expectedSha = await command('git', ['rev-parse', 'HEAD'], seed);
  await command('git', ['clone', '--bare', seed, path.join(gitRoot, 'team', 'repo.git')]);
  const key = path.join(root, 'key.pem'), certificate = path.join(root, 'certificate.pem');
  await command('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-keyout', key, '-out', certificate,
    '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost', '-addext', 'basicConstraints=critical,CA:TRUE']);
  process.env.GIT_SSL_CAINFO = certificate;
  const expectedAuth = `Basic ${Buffer.from('fixture-reader:fixture-private-token').toString('base64')}`;
  let rejected = 0, accepted = 0;
  const server = createServer({ key: await readFile(key), cert: await readFile(certificate) }, (request, response) => {
    if (request.headers.authorization !== expectedAuth) {
      rejected++; response.writeHead(401, { 'WWW-Authenticate': 'Basic realm="isolated-fixture"' }); response.end(); return;
    }
    accepted++;
    const url = new URL(request.url!, 'https://localhost');
    const child = spawn('git', ['http-backend'], { env: { ...process.env, GIT_PROJECT_ROOT: gitRoot, GIT_HTTP_EXPORT_ALL: '1',
      PATH_INFO: url.pathname, QUERY_STRING: url.search.slice(1), REQUEST_METHOD: request.method!,
      CONTENT_TYPE: request.headers['content-type'] ?? '', REMOTE_USER: 'fixture-reader' }, stdio: ['pipe', 'pipe', 'ignore'] });
    const chunks: Buffer[] = [];
    child.stdout.on('data', chunk => chunks.push(chunk));
    child.once('error', () => { response.writeHead(500); response.end(); });
    child.once('close', code => {
      if (code !== 0 || response.writableEnded) { if (!response.writableEnded) response.end(); return; }
      const data = Buffer.concat(chunks), split = data.indexOf('\r\n\r\n');
      if (split < 0) { response.writeHead(500); response.end(); return; }
      for (const line of data.subarray(0, split).toString().split('\r\n')) {
        const colon = line.indexOf(':'); if (colon < 0) continue;
        if (line.startsWith('Status:')) response.statusCode = Number.parseInt(line.slice(colon + 1), 10);
        else response.setHeader(line.slice(0, colon), line.slice(colon + 1).trim());
      }
      response.end(data.subarray(split + 4));
    });
    request.pipe(child.stdin);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const port = (server.address() as { port: number }).port;
  const options = { provider: 'generic' as const, allowedHosts: ['localhost'], allowPrivateHosts: ['localhost'],
    temporaryRoot: temporary, token: 'fixture-private-token', username: 'fixture-reader', timeoutMs: 15_000 };
  const descriptor = repositoryDescriptor({ repoUrl: `https://localhost:${port}/team/repo.git`,
    ref: { kind: 'branch', value: 'main' }, specPath: 'ship.yaml' }, options);
  await assert.rejects(() => resolveGenericSource(descriptor, { ...options, token: 'fixture-invalid-token' }), /operation failed/);
  assert.deepEqual(await readdir(temporary), ['noexec-probe']);
  const snapshot = await resolveGenericSource(descriptor, options);
  assert.equal(snapshot.commit, expectedSha); assert.equal(snapshot.appName, 'noexec-fixture');
  assert.ok(accepted >= 2 && rejected >= 2, 'actual HTTPS challenges and authenticated Git requests occurred');
  assert.deepEqual(await readdir(temporary), ['noexec-probe'], 'repositories and private credential files cleaned on success and failure');
});
