// Closure-audit regressions R1–R4 (see docs/audits/2026-09-29/m1-closure-audit.md):
// R1 target name ↔ connection group binding; R2 git-effective ignore protection;
// R3 permission check on unchanged content; R4 draft/clear intent preservation.
// All credentials are synthetic; agents are local HTTP stubs.

import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import yaml from 'js-yaml';
import { runWizard } from './wizard.js';
import { createPrompter, CANCEL } from './prompt.js';
import { readInitState } from './state.js';
import { freshProject, noopLog, runCli, scriptedPrompter, startStubAgent, type StubAgent } from './wizard-fixtures.js';

function twoTargetConfig(a: StubAgent, b: StubAgent): string {
  return [
    'builder:', '  mode: static', '  static:', `    url: ${a.url}`, '    token: TA',
    `registry:`, `  url: ${a.host}`, '  namespace: audit',
    'runtime:', '  targets:',
    '    staging:', `      url: ${a.url}`, '      token: T_STAG',
    '    prod:', `      url: ${b.url}`, '      token: T_PROD',
  ].join('\n') + '\n';
}

function targetOf(cfg: { runtime: { targets: Record<string, { url: string; token: string }> } }, name: string): { url: string; token: string } {
  const t = cfg.runtime.targets[name];
  assert.ok(t, `target ${name} must exist`);
  return t;
}

test('R1: switching to an existing target rebinds to THAT target\'s endpoint and token', async () => {
  const a = await startStubAgent();
  const b = await startStubAgent();
  try {
    const dir = await freshProject({
      'ship.yaml': 'name: audit-app\nports:\n  - 3000:3000\n',
      'ship.config.yaml': twoTargetConfig(a, b),
    });
    const bBefore = b.requests.length;
    const r = await runWizard({ cwd: dir, prompter: scriptedPrompter({ targetName: 'prod' }).prompter, log: noopLog });
    assert.equal(r.ok, true, JSON.stringify(r));

    const cfg = yaml.load(await readFile(path.join(dir, 'ship.config.yaml'), 'utf8')) as {
      runtime: { targets: Record<string, { url: string; token: string }> };
    };
    assert.equal(targetOf(cfg, 'prod').url, b.url, 'prod keeps ITS OWN endpoint (audit: was overwritten with staging A)');
    assert.equal(targetOf(cfg, 'prod').token, 'T_PROD');
    assert.equal(targetOf(cfg, 'staging').url, a.url, 'staging untouched');
    // requests prove the destination: the runtime check must hit B, not A
    assert.ok(b.requests.slice(bBefore).some((x) => x.auth === 'Bearer T_PROD'));
    assert.ok(!a.requests.some((x) => x.auth === 'Bearer T_PROD'), 'prod token must never be sent to the staging endpoint');
  } finally {
    await a.close();
    await b.close();
  }
});

test('R1b: reverse switch and staying on the default keep their own groups', async () => {
  const a = await startStubAgent();
  const b = await startStubAgent();
  try {
    // default target is staging (first key); switching prod→staging explicitly
    const dir = await freshProject({ 'ship.yaml': 'name: audit-app\n', 'ship.config.yaml': twoTargetConfig(a, b) });
    const p1 = scriptedPrompter({ targetName: 'staging' });
    const r1 = await runWizard({ cwd: dir, prompter: p1.prompter, log: noopLog });
    assert.equal(r1.ok, true);
    const cfg1 = yaml.load(await readFile(path.join(dir, 'ship.config.yaml'), 'utf8')) as { runtime: { targets: Record<string, { url: string; token: string }> } };
    assert.equal(targetOf(cfg1, 'staging').url, a.url);
    assert.equal(targetOf(cfg1, 'prod').url, b.url);
  } finally {
    await a.close();
    await b.close();
  }
});

test('R1c: a brand-new target gets NO inherited url/token; replacing the URL drops the token prefill', async () => {
  const a = await startStubAgent();
  try {
    const dir = await freshProject({ 'ship.yaml': 'name: audit-app\n', 'ship.config.yaml': twoTargetConfig(a, a) });
    // new target: runtime url/token have no defaults → must be provided by the script
    const seen: Record<string, string | null> = {};
    const p = scriptedPrompter(
      { targetName: 'prod2', runtimeUrl: a.url, runtimeToken: 'T_NEW_TARGET' },
      {},
      (q) => {
        if (q.field === 'runtimeUrl') seen.runtimeUrlDefault = q.default ?? null;
        if (q.field === 'runtimeToken') seen.runtimeTokenDefault = q.default ?? null;
      },
    );
    const r = await runWizard({ cwd: dir, prompter: p.prompter, log: noopLog });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(seen.runtimeUrlDefault, null, 'a new target must not inherit staging/prod endpoints');
    assert.equal(seen.runtimeTokenDefault, null, 'and must not inherit any token');
    const cfg = yaml.load(await readFile(path.join(dir, 'ship.config.yaml'), 'utf8')) as { runtime: { targets: Record<string, { url: string; token: string }> } };
    assert.equal(targetOf(cfg, 'prod2').token, 'T_NEW_TARGET');
    assert.equal(targetOf(cfg, 'prod').token, 'T_PROD', 'existing prod untouched');
  } finally {
    await a.close();
  }
});

test('R1d: explicitly replacing the runtime URL drops the old token default (group binding)', async () => {
  const a = await startStubAgent();
  const b = await startStubAgent();
  try {
    const dir = await freshProject({ 'ship.yaml': 'name: audit-app\n', 'ship.config.yaml': twoTargetConfig(a, b) });
    const seen: Record<string, string | null> = {};
    const p = scriptedPrompter({ runtimeUrl: b.url, runtimeToken: 'T_REPLACED' }, {}, (q) => {
      if (q.field === 'runtimeToken') seen.runtimeTokenDefault = q.default ?? null;
    });
    const r = await runWizard({ cwd: dir, prompter: p.prompter, log: noopLog });
    assert.equal(r.ok, true);
    assert.equal(seen.runtimeTokenDefault, null, 'changing the URL must clear the old endpoint\'s token default');
    const cfg = yaml.load(await readFile(path.join(dir, 'ship.config.yaml'), 'utf8')) as { runtime: { targets: Record<string, { url: string; token: string }> } };
    assert.equal(targetOf(cfg, 'staging').url, b.url);
    assert.equal(targetOf(cfg, 'staging').token, 'T_REPLACED');
  } finally {
    await a.close();
    await b.close();
  }
});

test('R2: a later negation rule is corrected (append at end) and re-verified after writing', async () => {
  const stub = await startStubAgent();
  try {
    const dir = await freshProject({
      'ship.yaml': 'name: audit-app\n',
      'ship.config.yaml': [
        'builder:', '  mode: static', '  static:', `    url: ${stub.url}`, '    token: TA',
        `registry:`, `  url: ${stub.host}`, '  namespace: audit',
        'runtime:', '  targets:', '    staging:', `      url: ${stub.url}`, '      token: TR',
      ].join('\n') + '\n',
      '.gitignore': '.ship/\nship.config.yaml\n!ship.config.yaml\n',
    });
    spawnSync('git', ['init', '-q', dir]);
    const r = await runCli(dir);
    assert.equal(r.code, 0, JSON.stringify(r.json));
    const warnings = (r.json.warnings as string[]) ?? [];
    assert.ok(warnings.some((w) => w.includes('否定规则')), `the defeated rule must be surfaced: ${JSON.stringify(warnings)}`);
    assert.equal(spawnSync('git', ['-C', dir, 'check-ignore', '-q', 'ship.config.yaml']).status, 0, 'must be REALLY ignored after the fix');
    const gi = await readFile(path.join(dir, '.gitignore'), 'utf8');
    assert.ok(gi.trimEnd().endsWith('ship.config.yaml'), `append-at-end so the last match wins: ${JSON.stringify(gi)}`);
  } finally {
    await stub.close();
  }
});

test('R2b: protection already granted by a wildcard is not duplicated; subdirectory projects protected too', async () => {
  const stub = await startStubAgent();
  try {
    const dir = await freshProject({
      'ship.yaml': 'name: audit-app\n',
      'ship.config.yaml': [
        'builder:', '  mode: static', '  static:', `    url: ${stub.url}`, '    token: TA',
        `registry:`, `  url: ${stub.host}`, '  namespace: audit',
        'runtime:', '  targets:', '    staging:', `      url: ${stub.url}`, '      token: TR',
      ].join('\n') + '\n',
      '.gitignore': '.ship/\nship.config.*\n',
    });
    spawnSync('git', ['init', '-q', dir]);
    const r = await runCli(dir);
    assert.equal(r.code, 0, JSON.stringify(r.json));
    assert.equal(spawnSync('git', ['-C', dir, 'check-ignore', '-q', 'ship.config.yaml']).status, 0);
    const gi = await readFile(path.join(dir, '.gitignore'), 'utf8');
    assert.ok(!gi.includes('ship.config.yaml\nship.config.yaml'), 'no duplicate append when a wildcard already covers it');

    // subdirectory: the project sits below the repo root whose .gitignore negates
    const root = await freshProject({}, 'FROM scratch\n');
    spawnSync('git', ['init', '-q', root]);
    await mkdir(path.join(root, 'apps'), { recursive: true });
    const sub = path.join(root, 'apps', 'web');
    await mkdir(sub, { recursive: true });
    await writeFile(path.join(sub, 'Dockerfile'), 'FROM scratch\nEXPOSE 3000\n');
    await writeFile(path.join(sub, 'ship.yaml'), 'name: audit-app\n');
    await writeFile(path.join(sub, 'ship.config.yaml'), [
      'builder:', '  mode: static', '  static:', `    url: ${stub.url}`, '    token: TA',
      `registry:`, `  url: ${stub.host}`, '  namespace: audit',
      'runtime:', '  targets:', '    staging:', `      url: ${stub.url}`, '      token: TR',
    ].join('\n') + '\n');
    await writeFile(path.join(root, '.gitignore'), 'apps/web/ship.config.yaml\n!apps/web/ship.config.yaml\n');
    const r2 = await runCli(sub);
    assert.equal(r2.code, 0, JSON.stringify(r2.json));
    assert.equal(spawnSync('git', ['-C', sub, 'check-ignore', '-q', 'ship.config.yaml']).status, 0, 'subdirectory config must end up really ignored');
  } finally {
    await stub.close();
  }
});

test('R3: unchanged content but 0644 mode → fixed to 0600, reported in wrote, then idempotent', async () => {
  const stub = await startStubAgent();
  try {
    const dir = await freshProject({
      'ship.yaml': 'name: audit-app\nports:\n  - 3000:3000\n',
      'ship.config.yaml': [
        'builder:', '  mode: static', '  static:', `    url: ${stub.url}`, '    token: TA',
        `registry:`, `  url: ${stub.host}`, '  namespace: audit',
        'runtime:', '  targets:', '    staging:', `      url: ${stub.url}`, '      token: TR',
      ].join('\n') + '\n',
    });
    spawnSync('git', ['init', '-q', dir]);
    const first = await runCli(dir);
    assert.equal(first.code, 0);
    await chmod(path.join(dir, 'ship.config.yaml'), 0o644);

    const fixed = await runCli(dir);
    assert.equal(fixed.code, 0, JSON.stringify(fixed.json));
    assert.ok((fixed.json.wrote as string[]).includes('ship.config.yaml'), `mode fix must be visible in wrote: ${JSON.stringify(fixed.json.wrote)}`);
    assert.equal((await stat(path.join(dir, 'ship.config.yaml'))).mode & 0o777, 0o600);

    const again = await runCli(dir);
    assert.equal(again.code, 0);
    assert.deepEqual(again.json.wrote ?? [], [], 'after the fix the run is a true no-op again');
    assert.equal((await stat(path.join(dir, 'ship.config.yaml'))).mode & 0o777, 0o600);
  } finally {
    await stub.close();
  }
});

test('R4a: modify → cancel → resume keeps the draft answer over the unchanged file', async () => {
  const stub = await startStubAgent();
  try {
    const dir = await freshProject({
      'ship.yaml': 'name: audit-app\nports:\n  - 8080:3000\n',
      'ship.config.yaml': [
        'builder:', '  mode: static', '  static:', `    url: ${stub.url}`, '    token: TA',
        'runtime:', '  targets:', '    staging:', `      url: ${stub.url}`, '      token: TR',
      ].join('\n') + '\n',
    });
    await runWizard({ cwd: dir, prompter: scriptedPrompter({ ports: '9090:3000', builderUrl: CANCEL }).prompter, log: noopLog });
    const saved = await readInitState(dir);
    assert.deepEqual(saved!.app!.ports, ['9090:3000']);

    let seen: string | null | undefined;
    const second = scriptedPrompter({ builderUrl: CANCEL }, {}, (q) => { if (q.field === 'ports') seen = q.default ?? null; });
    await runWizard({ cwd: dir, prompter: second.prompter, log: noopLog });
    assert.equal(seen, '9090:3000', 'a still-valid draft is newer intent than the unchanged file (audit: reverted to 8080:3000)');
  } finally {
    await stub.close();
  }
});

test('R4b: resume → cancel again → resume keeps fields not yet re-asked', async () => {
  const stub = await startStubAgent();
  try {
    const dir = await freshProject({});
    await runWizard({ cwd: dir, prompter: scriptedPrompter({ ports: '9090:3000', builderUrl: CANCEL }).prompter, log: noopLog });
    assert.ok((await readInitState(dir))!.app, 'first cancel keeps the app draft');

    // cancel immediately at the first question — nothing has been re-answered
    const r2 = await runWizard({ cwd: dir, prompter: scriptedPrompter({ name: CANCEL }).prompter, log: noopLog });
    assert.equal(r2.ok ? '' : r2.reason, 'cancelled');
    const after = await readInitState(dir);
    assert.ok(after!.app, 'an early cancel must NOT erase the prior draft (audit: app field vanished)');
    assert.deepEqual(after!.app!.ports, ['9090:3000']);

    let seen: string | null | undefined;
    const third = scriptedPrompter({ builderUrl: CANCEL }, {}, (q) => { if (q.field === 'ports') seen = q.default ?? null; });
    await runWizard({ cwd: dir, prompter: third.prompter, log: noopLog });
    assert.equal(seen, '9090:3000', 'and the third run still resumes the full draft');
  } finally {
    await stub.close();
  }
});

test('R4c: cleared ports persist as an explicit empty list and survive idempotent reruns', async () => {
  const stub = await startStubAgent();
  try {
    const dir = await freshProject({
      'ship.yaml': 'name: audit-app\nports:\n  - 8080:3000\n',
      'ship.config.yaml': [
        'builder:', '  mode: static', '  static:', `    url: ${stub.url}`, '    token: TA',
        `registry:`, `  url: ${stub.host}`, '  namespace: audit',
        'runtime:', '  targets:', '    staging:', `      url: ${stub.url}`, '      token: TR',
      ].join('\n') + '\n',
    });
    // clear via '-' (translated like the real TTY), save
    const cleared = await runWizard({ cwd: dir, prompter: scriptedPrompter({ ports: '-' }).prompter, log: noopLog });
    assert.equal(cleared.ok, true);
    const specAfterClear = yaml.load(await readFile(path.join(dir, 'ship.yaml'), 'utf8')) as { ports?: string[] };
    assert.deepEqual(specAfterClear.ports, [], '"cleared" persists as an explicit empty list, not a missing key');

    // non-interactive rerun: no change, EXPOSE does NOT resurrect a mapping
    const rerun = await runWizard({ cwd: dir, prompter: createPrompter(false), log: noopLog });
    assert.equal(rerun.ok, true);
    assert.deepEqual(rerun.wrote, []);
    const specAfterRerun = yaml.load(await readFile(path.join(dir, 'ship.yaml'), 'utf8')) as { ports?: string[] };
    assert.deepEqual(specAfterRerun.ports, [], 'no 3000:3000 resurrection from EXPOSE (audit: ports came back)');

    // interactive rerun: the ports default stays empty
    let seen: string | null | undefined;
    const third = scriptedPrompter({ builderUrl: CANCEL }, {}, (q) => { if (q.field === 'ports') seen = q.default ?? null; });
    await runWizard({ cwd: dir, prompter: third.prompter, log: noopLog });
    assert.equal(seen, '', 'interactive default is the explicit empty value, not EXPOSE');
  } finally {
    await stub.close();
  }
});

test('R4d: an externally changed file rejects the stale draft; cleared healthcheck/envFile stay cleared', async () => {
  const stub = await startStubAgent();
  try {
    const dir = await freshProject({ 'ship.config.yaml': `builder:\n  mode: static\n  static:\n    url: ${stub.url}\n    token: TA\nruntime:\n  targets:\n    staging:\n      url: ${stub.url}\n      token: TR\n` });
    await runWizard({ cwd: dir, prompter: scriptedPrompter({ healthcheckPath: '/x', envFile: 'deploy.env', builderUrl: CANCEL }, { name: 'audit-app' }).prompter, log: noopLog });
    // user edits the spec AFTER the draft → draft answers are stale for the app group
    await writeFile(path.join(dir, 'ship.yaml'), 'name: audit-app\nports:\n  - 7070:3000\n');
    let seen: Record<string, string | null> = {};
    const second = scriptedPrompter({ builderUrl: CANCEL }, {}, (q) => { seen[q.field] = q.default ?? null; });
    await runWizard({ cwd: dir, prompter: second.prompter, log: noopLog });
    assert.equal(seen.ports, '7070:3000', 'file values win once the file changed after the draft');

    // cleared optional fields keep their state across reruns (set → clear → idempotent)
    const dir2 = await freshProject({ 'ship.config.yaml': `builder:\n  mode: static\n  static:\n    url: ${stub.url}\n    token: TA\nregistry:\n  url: ${stub.host}\n  namespace: audit\nruntime:\n  targets:\n    staging:\n      url: ${stub.url}\n      token: TR\n` });
    const set = await runWizard({ cwd: dir2, prompter: scriptedPrompter({ healthcheckPath: '/x', envFile: 'deploy.env' }).prompter, log: noopLog });
    assert.equal(set.ok, true, JSON.stringify(set));
    const specSet = yaml.load(await readFile(path.join(dir2, 'ship.yaml'), 'utf8')) as Record<string, unknown>;
    assert.equal((specSet.healthcheck as { path?: string } | undefined)?.path, '/x');

    const clear = await runWizard({ cwd: dir2, prompter: scriptedPrompter({ healthcheckPath: '-', envFile: '-' }).prompter, log: noopLog });
    assert.equal(clear.ok, true, JSON.stringify(clear));
    const specClear = yaml.load(await readFile(path.join(dir2, 'ship.yaml'), 'utf8')) as Record<string, unknown>;
    assert.ok(!('healthcheck' in specClear) && !('envFile' in specClear), 'clearing removes the fields');

    const rerun = await runWizard({ cwd: dir2, prompter: createPrompter(false), log: noopLog });
    assert.equal(rerun.ok, true);
    assert.deepEqual(rerun.wrote, []);
    const spec2 = yaml.load(await readFile(path.join(dir2, 'ship.yaml'), 'utf8')) as Record<string, unknown>;
    assert.ok(!('healthcheck' in spec2) && !('envFile' in spec2), 'cleared optional fields stay cleared across reruns');
  } finally {
    await stub.close();
  }
});
