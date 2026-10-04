import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, chmod, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';
import { planFileWrites } from './write.js';
import { applyFileWrites, FileConflictError, WriteFailedError } from './apply.js';
import type { InitAnswers } from './plan.js';

function answers(over: Partial<InitAnswers> = {}): InitAnswers {
  return {
    name: 'demo-web', dockerfile: 'Dockerfile', ports: ['3000:3000'],
    healthcheckPath: '/health', healthcheckHostPort: 3000, envFile: 'deploy.env',
    builderUrl: 'http://127.0.0.1:7410', builderToken: 'builder-secret',
    targetName: 'staging', runtimeUrl: 'http://127.0.0.1:7410', runtimeToken: 'runtime-secret',
    registryUrl: 'registry.example.com', registryNamespace: 'myteam',
    ...over,
  };
}

async function freshDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-write-'));
  await writeFile(path.join(dir, 'Dockerfile'), 'FROM scratch\n');
  return dir;
}

test('plans ship.yaml + ship.config.yaml + .gitignore for a fresh project, all valid', async () => {
  const dir = await freshDir();
  const plan = planFileWrites(dir, answers());
  const rels = plan.files.map((f) => f.rel);
  assert.deepEqual(rels.sort(), ['.gitignore', 'ship.config.yaml', 'ship.yaml']);
  assert.ok(plan.files.every((f) => f.before === null));
  assert.ok(plan.files.every((f) => f.changed));
  assert.equal(plan.files.find((f) => f.rel === 'ship.config.yaml')!.mode, 0o600);
});

test('apply writes files, sets 0600 on the config, appends ignore lines once', async () => {
  const dir = await freshDir();
  const outcome = await applyFileWrites(dir, planFileWrites(dir, answers()));
  assert.deepEqual(outcome.wrote.sort(), ['.gitignore', 'ship.config.yaml', 'ship.yaml']);
  const mode = (await stat(path.join(dir, 'ship.config.yaml'))).mode & 0o777;
  assert.equal(mode, 0o600);
  const gi = await readFile(path.join(dir, '.gitignore'), 'utf8');
  assert.ok(gi.includes('.ship/'));
  assert.ok(gi.includes('ship.config.yaml'), 'the secret config itself must be ignored (M1-03)');
  // second identical run → nothing to do, no duplicate gitignore line
  const again = await applyFileWrites(dir, planFileWrites(dir, answers()));
  assert.equal(again.wrote.length, 0);
});

test('existing files are merged, not replaced; the previous content is backed up', async () => {
  const dir = await freshDir();
  await writeFile(path.join(dir, 'ship.yaml'), 'name: demo-web\nbuildArgsPolicy: strict\n');
  await writeFile(path.join(dir, 'ship.config.yaml'), [
    'builder:', '  mode: static', '  static:', '    url: http://127.0.0.1:7410', '    token: builder-secret',
    'runtime:', '  targets:', '    prod:', '      url: https://prod.example.com', '      token: prod-secret',
  ].join('\n') + '\n');

  const outcome = await applyFileWrites(dir, planFileWrites(dir, answers()));
  assert.ok(outcome.wrote.includes('ship.yaml'));
  assert.ok(outcome.wrote.includes('ship.config.yaml'));
  assert.equal(outcome.backups.length, 2);

  const spec = await readFile(path.join(dir, 'ship.yaml'), 'utf8');
  assert.ok(spec.includes('buildArgsPolicy: strict'), 'user field survives the merge');
  const config = await readFile(path.join(dir, 'ship.config.yaml'), 'utf8');
  assert.ok(config.includes('prod.example.com'), 'other targets survive');
});

test('A07: a stale world-readable temp file never becomes the final config', async () => {
  const dir = await freshDir();
  // pre-existing fixed-name temp from an older crashed run, with wrong permissions
  await writeFile(path.join(dir, 'ship.config.yaml.shipinit.tmp'), 'stale', { mode: 0o644 });
  await applyFileWrites(dir, planFileWrites(dir, answers()));
  const mode = (await stat(path.join(dir, 'ship.config.yaml'))).mode & 0o777;
  assert.equal(mode, 0o600, 'final config must be 0600 regardless of pre-existing temps');
});

test('A07b: an existing 0644 config is replaced with 0600, symlinks are refused', async () => {
  const dir = await freshDir();
  await writeFile(path.join(dir, 'ship.config.yaml'), 'builder: {}\n', { mode: 0o644 });
  await applyFileWrites(dir, planFileWrites(dir, answers()));
  assert.equal((await stat(path.join(dir, 'ship.config.yaml'))).mode & 0o777, 0o600);

  const dir2 = await freshDir();
  const outside = path.join(dir2, 'outside.txt');
  await writeFile(outside, 'target\n');
  const link = path.join(dir2, 'ship.yaml');
  await mkdir(path.join(dir2, 'link-dir'), { recursive: true });
  spawnSync('ln', ['-s', outside, link]);
  const plan = planFileWrites(dir2, answers());
  // before read follows the symlink; conflict-free but the apply must refuse the symlink itself
  await assert.rejects(applyFileWrites(dir2, plan), /符号链接/);
  assert.equal(await readFile(outside, 'utf8'), 'target\n', 'symlink target must stay untouched');
});

test('A08: files changed between plan and apply abort with a conflict, user edits survive', async () => {
  const dir = await freshDir();
  const cfgPath = path.join(dir, 'ship.config.yaml');
  await writeFile(cfgPath, yaml.dump({
    builder: { mode: 'static', static: { url: 'http://b', token: 't' } },
    runtime: { targets: { staging: { url: 'http://r', token: 'rt' } } },
    source: { repo: 'https://x.git' },
  }));
  const plan = planFileWrites(dir, answers());
  // the user (or another init) edits the file during review
  const live = yaml.load(await readFile(cfgPath, 'utf8')) as Record<string, { ref?: string }>;
  live.source!.ref = 'USER_NEW_COMMIT';
  await writeFile(cfgPath, yaml.dump(live));

  await assert.rejects(applyFileWrites(dir, plan), (e: unknown) => e instanceof FileConflictError);
  const after = yaml.load(await readFile(cfgPath, 'utf8')) as Record<string, { ref?: string }>;
  assert.equal(after.source!.ref, 'USER_NEW_COMMIT', 'the concurrent edit must survive untouched');
  const shipYamlExists = await readFile(path.join(dir, 'ship.yaml'), 'utf8').then(() => true, () => false);
  assert.equal(shipYamlExists, false, 'no other file may be written once a conflict is detected');
});

test('rollback after a mid-run failure is verified and the old files are restored', async () => {
  const dir = await freshDir();
  const oldSpec = 'name: demo-web\nbuildArgsPolicy: strict\n';
  await writeFile(path.join(dir, 'ship.yaml'), oldSpec);
  // ship.config.yaml as a directory: rename() onto it fails mid-run → rollback must restore ship.yaml
  await mkdir(path.join(dir, 'ship.config.yaml'));

  const err = await applyFileWrites(dir, planFileWrites(dir, answers())).then(() => null, (e: unknown) => e);
  assert.ok(err instanceof WriteFailedError, `expected WriteFailedError, got ${String(err)}`);
  assert.equal(err.rollback, 'verified');
  assert.ok(err.message.includes('已回滚'), 'only a verified rollback may claim restoration (M1-06)');
  const spec = await readFile(path.join(dir, 'ship.yaml'), 'utf8');
  assert.equal(spec, oldSpec, 'old file must be byte-identical after a verified rollback');
  const leftovers = (await readdir(dir)).filter((f) => f.endsWith('.tmp'));
  assert.deepEqual(leftovers, [], 'no temp files may linger');
});

test('unparsable existing config is flagged instead of silently replaced', async () => {
  const dir = await freshDir();
  await writeFile(path.join(dir, 'ship.config.yaml'), 'builder: [unclosed\n');
  const plan = planFileWrites(dir, answers());
  const flagged = plan.files.filter((f) => f.existingInvalid).map((f) => f.rel);
  assert.deepEqual(flagged, ['ship.config.yaml']);
  const reviewFile = plan.files.find((f) => f.rel === 'ship.config.yaml')!;
  assert.equal(reviewFile.beforePreview, null, 'invalid raw content must never be displayed (M1-01)');
});

// --- rollback truthfulness (R5) ---

test('R3: correct content but wrong mode on the secret file is a planned change and gets fixed', async () => {
  const dir = await freshDir();
  await applyFileWrites(dir, planFileWrites(dir, answers()));
  await chmod(path.join(dir, 'ship.config.yaml'), 0o644);

  const plan = planFileWrites(dir, answers());
  const cfg = plan.files.find((f) => f.rel === 'ship.config.yaml')!;
  assert.equal(cfg.before, cfg.after, 'text is identical');
  assert.equal(cfg.beforeMode, 0o644);
  assert.ok(cfg.changed, 'a 0644 secret config is a change even with identical content');

  const outcome = await applyFileWrites(dir, plan);
  assert.ok(outcome.wrote.includes('ship.config.yaml'));
  assert.equal((await stat(path.join(dir, 'ship.config.yaml'))).mode & 0o777, 0o600);
  const again = await applyFileWrites(dir, planFileWrites(dir, answers()));
  assert.deepEqual(again.wrote, [], 'after the mode fix the next run is a no-op');
});

test('R5a: a fresh file correctly deleted by rollback reports verified, not partial', async () => {
  const dir = await freshDir(); // no ship.yaml yet
  await mkdir(path.join(dir, 'ship.config.yaml')); // second write fails mid-run
  const err = await applyFileWrites(dir, planFileWrites(dir, answers())).then(() => null, (e: unknown) => e);
  assert.ok(err instanceof WriteFailedError, String(err));
  assert.equal(err.rollback, 'verified', `absence of a file that never existed IS a successful restore: ${err.message}`);
  assert.equal(err.rollbackDetail, '');
  const specGone = await readFile(path.join(dir, 'ship.yaml'), 'utf8').then(() => false, () => true);
  assert.ok(specGone, 'the newly created file was removed');
});

test('R5b: an existing file is restored with its ORIGINAL content and mode', async (t) => {
  if (process.platform !== 'darwin') return t.skip('chflags is darwin-only');
  const dir = await freshDir();
  const oldSpec = 'name: demo-web\nbuildArgsPolicy: strict\n';
  await writeFile(path.join(dir, 'ship.yaml'), oldSpec, { mode: 0o640 });
  const cfgPath = path.join(dir, 'ship.config.yaml');
  await writeFile(cfgPath, 'builder:\n  mode: static\n  static:\n    url: http://127.0.0.1:7410\n    token: t\nruntime:\n  targets:\n    staging:\n      url: http://r\n      token: rt\n');
  const plan = planFileWrites(dir, answers());
  // make the SECOND write fail while the first (ship.yaml) succeeds
  spawnSync('chflags', ['uchg', cfgPath]);
  t.after(async () => { spawnSync('chflags', ['nouchg', cfgPath]); });
  const err = await applyFileWrites(dir, plan).then(() => null, (e: unknown) => e);
  assert.ok(err instanceof WriteFailedError, String(err));
  assert.equal(err.rollback, 'verified');
  const [text, mode] = await Promise.all([readFile(path.join(dir, 'ship.yaml'), 'utf8'), stat(path.join(dir, 'ship.yaml'))]);
  assert.equal(text, oldSpec, 'original content restored');
  assert.equal(mode.mode & 0o777, 0o640, 'original MODE restored (not the write target mode)');
});

test('R5c: mixed run — new file removed, existing file untouched, overall verified', async (t) => {
  if (process.platform !== 'darwin') return t.skip('chflags is darwin-only');
  const dir = await freshDir(); // ship.yaml will be NEW
  const cfgPath = path.join(dir, 'ship.config.yaml');
  const cfgText = 'builder:\n  mode: static\n  static:\n    url: http://127.0.0.1:7410\n    token: t\nruntime:\n  targets:\n    staging:\n      url: http://r\n      token: rt\n';
  await writeFile(cfgPath, cfgText);
  const plan = planFileWrites(dir, answers());
  spawnSync('chflags', ['uchg', cfgPath]);
  t.after(async () => { spawnSync('chflags', ['nouchg', cfgPath]); });
  const err = await applyFileWrites(dir, plan).then(() => null, (e: unknown) => e);
  assert.ok(err instanceof WriteFailedError, String(err));
  assert.equal(err.rollback, 'verified');
  const specGone = await readFile(path.join(dir, 'ship.yaml'), 'utf8').then(() => false, () => true);
  assert.ok(specGone, 'new file removed');
  assert.equal(await readFile(cfgPath, 'utf8'), cfgText, 'immutable existing file untouched');
});

// --- git integration (M1-03) ---

function git(dir: string, args: string[]): number {
  return spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' }).status ?? -1;
}

test('A02: the generated secret config is git-ignored in a fresh repository', async () => {
  const dir = await freshDir();
  assert.equal(git(dir, ['init', '-q']), 0);
  await applyFileWrites(dir, planFileWrites(dir, answers()));
  assert.equal(git(dir, ['check-ignore', '-q', 'ship.config.yaml']), 0, 'ship.config.yaml must be ignored');
  const status = spawnSync('git', ['-C', dir, 'status', '--short'], { encoding: 'utf8' }).stdout;
  assert.ok(!status.includes('?? ship.config.yaml'), `config must not appear untracked: ${status}`);
});

test('A02b: an already-tracked config produces an explicit warning, not a silent ignore', async () => {
  const dir = await freshDir();
  assert.equal(git(dir, ['init', '-q']), 0);
  const cfg = 'builder:\n  mode: static\n  static:\n    url: http://b\n    token: old\nruntime:\n  targets:\n    staging:\n      url: http://r\n      token: rt\n';
  await writeFile(path.join(dir, 'ship.config.yaml'), cfg);
  git(dir, ['add', 'ship.config.yaml']);

  const plan = planFileWrites(dir, answers());
  assert.ok(plan.warnings.some((w) => w.includes('已被 Git 跟踪') && w.includes('git rm --cached') && w.includes('轮换')),
    `tracked-config warning must tell the truth: ${JSON.stringify(plan.warnings)}`);
});

test('lock/write failure when .ship cannot be created leaves everything unchanged', async () => {
  const dir = await freshDir();
  await writeFile(path.join(dir, '.ship'), 'a file, not a dir\n');
  await assert.rejects(applyFileWrites(dir, planFileWrites(dir, answers())));
  const unchanged = await readFile(path.join(dir, '.ship'), 'utf8');
  assert.equal(unchanged, 'a file, not a dir\n');
  const wroteSpec = await readFile(path.join(dir, 'ship.yaml'), 'utf8').then(() => true, () => false);
  assert.equal(wroteSpec, false, 'nothing may be written when the run cannot even start');
});
