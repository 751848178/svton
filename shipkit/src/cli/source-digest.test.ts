// R10 core invariant (re-audit N1): the content digest must cover EXACTLY
// what the uploaded tarball covers. Verified behaviorally: mutating an
// EXCLUDED file (slash-style envFile path, component-style config) never
// changes the digest; mutating an INCLUDED file always does. Symlinks
// contribute their target deterministically.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sourceContentDigest } from './source-digest.js';
import { packSourceDir } from './pipeline.js';

async function tree(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-sdig-'));
  await mkdir(path.join(dir, 'config'), { recursive: true });
  await mkdir(path.join(dir, 'src'), { recursive: true });
  await writeFile(path.join(dir, 'config', 'prod.env'), 'SECRET=1\n');
  await writeFile(path.join(dir, 'ship.config.yaml'), 'builder: {}\n');
  await writeFile(path.join(dir, 'src', 'app.js'), 'console.log(1);\n');
  await writeFile(path.join(dir, 'README.md'), 'hello\n');
  await symlink('README.md', path.join(dir, 'src', 'link.md'));
  return dir;
}

test('excluded entries (slash-style envFile path AND component-style config) never affect the digest; tar agrees', async (t) => {
  const dir = await tree();
  t.after(() => rm(dir, { recursive: true, force: true }));
  const excludes = ['config/prod.env', 'ship.config.yaml'];
  const before = await sourceContentDigest(dir, excludes);

  await writeFile(path.join(dir, 'config', 'prod.env'), 'SECRET=2\n');
  await writeFile(path.join(dir, 'ship.config.yaml'), 'builder: {mode: dynamic}\n');
  const afterExcluded = await sourceContentDigest(dir, excludes);
  assert.equal(afterExcluded.digest, before.digest, 'changing EXCLUDED files must not change the source digest');

  await writeFile(path.join(dir, 'src', 'app.js'), 'console.log(2);\n');
  const afterIncluded = await sourceContentDigest(dir, excludes);
  assert.notEqual(afterIncluded.digest, before.digest, 'changing an INCLUDED file must change the digest');

  // the actual upload excludes the same entries (tar side of the invariant)
  const tgz = path.join(dir, '..', `sd-${Date.now()}.tgz`);
  await packSourceDir(dir, tgz, excludes);
  const list = spawnSync('tar', ['-tzf', tgz], { encoding: 'utf8' });
  assert.equal(list.status, 0, list.stderr);
  const names = list.stdout.split('\n').filter(Boolean).map((l) => l.replace(/^\.\//, '')).filter((n) => n && !n.endsWith('/'));
  assert.ok(!names.some((n) => n.includes('prod.env')), `tar must exclude config/prod.env: ${names.join(',')}`);
  assert.ok(!names.some((n) => n === 'ship.config.yaml'), 'tar must exclude ship.config.yaml');
  assert.ok(names.some((n) => n.includes('app.js')), 'sources are uploaded');
  assert.ok(names.some((n) => n.includes('link.md')), 'tar archives the symlink (digest must count it too)');
  assert.equal(before.files, names.length, 'digest entry count matches the tarball entries');
});

test('bare-name and glob excludes still match any component; symlinks are hashed deterministically', async (t) => {
  const dir = await tree();
  t.after(() => rm(dir, { recursive: true, force: true }));
  const a = await sourceContentDigest(dir, ['node_modules', '*.pem']);
  const b = await sourceContentDigest(dir, ['node_modules', '*.pem']);
  assert.equal(a.digest, b.digest, 'deterministic across runs');
  assert.equal(a.files, 4, 'file + symlink + env-style entries counted (config/prod.env included when not excluded)');

  await writeFile(path.join(dir, 'README.md'), 'changed\n'); // symlink target content AND its own entry
  const c = await sourceContentDigest(dir, ['node_modules', '*.pem']);
  assert.notEqual(c.digest, a.digest, 'symlink-relevant content change is visible through the link entry');
});
