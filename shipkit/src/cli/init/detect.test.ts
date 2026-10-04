import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { detectProject } from './detect.js';

function withFiles(files: Record<string, string>): Promise<string> {
  return mkdtemp(path.join(tmpdir(), 'ship-det-')).then(async (dir) => {
    for (const [rel, content] of Object.entries(files)) {
      await mkdir(path.dirname(path.join(dir, rel)), { recursive: true });
      await writeFile(path.join(dir, rel), content);
    }
    return dir;
  });
}

test('finds a single Dockerfile and parses EXPOSE ports with source', async () => {
  const dir = await withFiles({
    'Dockerfile': 'FROM node:20-alpine\nEXPOSE 3000\nCMD ["node", "app.js"]\n',
    'app.js': 'console.log(1)',
  });
  const det = detectProject(dir);
  assert.deepEqual(det.dockerfiles, ['Dockerfile']);
  assert.deepEqual(det.portsFor('Dockerfile'), [3000]);
  assert.equal(det.existingSpecPath, null);
});

test('multiple Dockerfiles are all reported, shallowest first (wizard must ask)', async () => {
  const dir = await withFiles({
    'Dockerfile': 'FROM scratch\n',
    'packages/api/Dockerfile': 'FROM node:20-alpine\n',
    'deploy/web.Dockerfile': 'FROM nginx\n',
  });
  const det = detectProject(dir);
  assert.equal(det.dockerfiles.length, 3);
  assert.equal(det.dockerfiles[0], 'Dockerfile');
  assert.ok(det.dockerfiles.includes('packages/api/Dockerfile'));
});

test('skips heavy directories and honors depth bound', async () => {
  const dir = await withFiles({
    'Dockerfile': 'FROM scratch\n',
    'node_modules/pkg/Dockerfile': 'FROM x\n',
    'a/b/c/d/Dockerfile': 'FROM y\n', // depth 4 > 3
  });
  const det = detectProject(dir);
  assert.deepEqual(det.dockerfiles, ['Dockerfile']);
});

test('no Dockerfile yields an empty candidate list', async () => {
  const dir = await withFiles({ 'app.js': '' });
  assert.deepEqual(detectProject(dir).dockerfiles, []);
});

test('EXPOSE with multiple ports keeps tcp order and drops udp', async () => {
  const dir = await withFiles({ 'Dockerfile': 'FROM x\nEXPOSE 3000/tcp 53/udp 8080\nEXPOSE 3000\n' });
  assert.deepEqual(detectProject(dir).portsFor('Dockerfile'), [3000, 8080]);
});

test('name candidates prefer package.json, then directory name, sanitized', async () => {
  const pkgDir = await withFiles({ 'package.json': JSON.stringify({ name: '@scope/My_App' }) });
  assert.deepEqual(detectProject(pkgDir).nameCandidates[0], { value: 'my-app', source: 'package.json 的 name 字段' });

  const base = await mkdtemp(path.join(tmpdir(), 'ship-det-'));
  const bareDir = path.join(base, 'Demo.Web');
  await mkdir(bareDir, { recursive: true });
  assert.deepEqual(detectProject(bareDir).nameCandidates[0], { value: 'demo-web', source: '当前目录名' });
});

test('detects existing ship.yaml and ship.config.yaml', async () => {
  const dir = await withFiles({
    'Dockerfile': 'FROM scratch\n',
    'ship.yaml': 'name: demo\n',
    'ship.config.yml': 'builder:\n  mode: static\n',
  });
  const det = detectProject(dir);
  assert.equal(path.basename(det.existingSpecPath!), 'ship.yaml');
  assert.equal(path.basename(det.existingConfigPath!), 'ship.config.yml');
});
