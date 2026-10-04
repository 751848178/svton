// Resume / failure-outcome regressions (audit cases A05, A06, A09, A13):
// post-commit state-save failures must not claim a rollback; resumed drafts
// restore Dockerfile/ports answers; a failed machine check yields
// "saved but not ready"; a completed draft never overrides newer user config
// and a new token is never sent to an old endpoint.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';
import { runWizard } from './wizard.js';
import { createPrompter, CANCEL } from './prompt.js';
import { readInitState, statePath } from './state.js';
import { configYaml, freshProject, noopLog, scriptedPrompter, startStubAgent } from './wizard-fixtures.js';

test('A05: config committed + state save failing → ok with a warning, never a false "rolled back"', async () => {
  const stub = await startStubAgent();
  const dir = await freshProject({
    'ship.yaml': 'name: audit-app\nports:\n  - 3000:3000\n',
    'ship.config.yaml': configYaml(stub),
  });
  // the state file path is a directory: every save fails, but the config write succeeds
  await mkdir(path.join(dir, '.ship', 'init-state.json'), { recursive: true });
  const p = scriptedPrompter({ builderToken: 'AUDIT_NEW_BUILDER' });
  try {
    const r = await runWizard({ cwd: dir, prompter: p.prompter, log: noopLog });
    assert.equal(r.ok, true, `config commit succeeded, so the run is ok: ${JSON.stringify(r)}`);
    assert.ok(r.wrote.includes('ship.config.yaml'), 'the config really was committed');
    assert.ok(r.warnings.some((w) => w.includes('init-state.json') && w.includes('不影响已写入的配置')), JSON.stringify(r.warnings));
    const config = await readFile(path.join(dir, 'ship.config.yaml'), 'utf8');
    assert.ok(config.includes('AUDIT_NEW_BUILDER'), 'the new token is in the committed config');
    assert.ok(!JSON.stringify(r).includes('已回滚'), 'no rollback may be claimed');
  } finally {
    await stub.close();
  }
});

test('A06: cancelling at the machines step keeps Dockerfile + custom ports; resume re-asks with defaults', async () => {
  const dir = await freshProject({}, 'FROM scratch\nEXPOSE 3000\n');
  await writeFile(path.join(dir, 'Dockerfile.prod'), 'FROM scratch\nEXPOSE 9000\n');

  const first = scriptedPrompter(
    { dockerfile: 'Dockerfile.prod', ports: '8080:9000', builderUrl: CANCEL },
    { name: 'audit-app' },
  );
  const r1 = await runWizard({ cwd: dir, prompter: first.prompter, log: noopLog });
  assert.equal(r1.ok, false);
  assert.equal(r1.reason, 'cancelled');
  const saved = await readInitState(dir);
  assert.equal(saved!.app!.dockerfile, 'Dockerfile.prod');
  assert.deepEqual(saved!.app!.ports, ['8080:9000']);

  const seen: Record<string, string | null> = {};
  const second = scriptedPrompter({ builderUrl: CANCEL }, {}, (q) => {
    if (q.field === 'dockerfile') seen.dockerfile = q.default ?? null;
    if (q.field === 'ports') seen.ports = q.default ?? null;
  });
  await runWizard({ cwd: dir, prompter: second.prompter, log: noopLog });
  assert.equal(seen.dockerfile, 'Dockerfile.prod', 'the resumed choice must be the default (M1-07)');
  assert.equal(seen.ports, '8080:9000', 'the resumed custom ports must be the default (M1-07)');
});

test('A09: choosing "still use" on a failed check saves the config but does not report ready/done', async () => {
  const stub = await startStubAgent();
  const dir = await freshProject({
    'ship.yaml': 'name: audit-app\nports:\n  - 3000:3000\n',
    'ship.config.yaml': configYaml(stub),
  });
  const p = scriptedPrompter(
    { builderUrl: 'http://127.0.0.1:1', builderToken: 'AUDIT_NEW_BUILDER', builderCheckAction: 's' },
  );
  const r = await runWizard({ cwd: dir, prompter: p.prompter, log: noopLog });
  await stub.close();

  assert.equal(r.ok, true, 'the user explicitly chose to save');
  assert.equal(r.ready, false, 'a failed check must not read as ready (M1-10)');
  assert.ok(r.pending.length > 0 && r.pending[0]!.includes('构建机'));
  assert.ok(!r.next[0]!.includes('初始化完成'), `next steps must not announce completion: ${JSON.stringify(r.next)}`);
  assert.ok(r.next.some((s) => s.includes('ship doctor')));
  const state = JSON.parse(await readFile(statePath(dir), 'utf8'));
  assert.equal(state.step, 'done');
  assert.equal(state.blocked, 'check-failed');
});

test('A13: after completion the user changes URL+token+name → the new token is never sent to the old endpoint', async () => {
  const oldEndpoint = await startStubAgent();
  const newEndpoint = await startStubAgent();
  const dir = await freshProject({
    'ship.yaml': 'name: audit-app\nports:\n  - 3000:3000\n',
    'ship.config.yaml': configYaml(oldEndpoint),
  });
  // 1st run completes against the old endpoint (both stubs, same answers)
  const r1 = await runWizard({ cwd: dir, prompter: scriptedPrompter().prompter, log: noopLog });
  assert.equal(r1.ok, true);

  // the user then repoints builder to a NEW endpoint with a NEW token and renames the app
  const cfg = yaml.load(await readFile(path.join(dir, 'ship.config.yaml'), 'utf8')) as {
    builder: { static: { url: string; token: string } };
  };
  cfg.builder.static = { url: newEndpoint.url, token: 'AUDIT_USER_NEW_TOKEN' };
  await writeFile(path.join(dir, 'ship.config.yaml'), yaml.dump(cfg));
  const spec = yaml.load(await readFile(path.join(dir, 'ship.yaml'), 'utf8')) as { name: string };
  spec.name = 'user-renamed-app';
  await writeFile(path.join(dir, 'ship.yaml'), yaml.dump(spec));

  const oldAuthBefore = oldEndpoint.requests.length;
  // 2nd run, non-interactive: defaults must come from the CURRENT config group
  const r2 = await runWizard({ cwd: dir, prompter: createPrompter(false), log: noopLog });
  await oldEndpoint.close();
  await newEndpoint.close();

  assert.equal(r2.ok, true);
  assert.equal(r2.ready, true, 'checks ran against the user-chosen new endpoint');
  const oldAuths = oldEndpoint.requests.slice(oldAuthBefore).map((x) => x.auth);
  assert.ok(!oldAuths.includes('Bearer AUDIT_USER_NEW_TOKEN'), `new token leaked to the old endpoint: ${JSON.stringify(oldEndpoint.requests)}`);
  const after = yaml.load(await readFile(path.join(dir, 'ship.config.yaml'), 'utf8')) as typeof cfg;
  assert.equal(after.builder.static.url, newEndpoint.url, 'user-selected endpoint preserved');
  assert.equal(after.builder.static.token, 'AUDIT_USER_NEW_TOKEN', 'user token preserved');
  const afterSpec = yaml.load(await readFile(path.join(dir, 'ship.yaml'), 'utf8')) as { name: string };
  assert.equal(afterSpec.name, 'user-renamed-app', 'user rename preserved');
});

test('A13b: an unfinished draft is dropped for groups whose file changed afterwards', async () => {
  const stub = await startStubAgent();
  const dir = await freshProject({ 'ship.config.yaml': configYaml(stub) });
  const r1 = await runWizard({ cwd: dir, prompter: scriptedPrompter({ builderUrl: CANCEL }, { name: 'audit-app' }).prompter, log: noopLog });
  assert.equal(r1.ok, false);
  assert.equal(r1.ok ? '' : r1.reason, 'cancelled');
  // the user edits the config after cancelling: the draft's machine defaults are stale
  const cfg = yaml.load(await readFile(path.join(dir, 'ship.config.yaml'), 'utf8')) as { registry?: { namespace?: string } };
  cfg.registry = { ...cfg.registry, namespace: 'changed' };
  await writeFile(path.join(dir, 'ship.config.yaml'), yaml.dump(cfg));

  const seen: Record<string, string | null> = {};
  const p = scriptedPrompter({}, {}, (q) => {
    if (q.field === 'registryNamespace') seen.registryNamespace = q.default ?? null;
  });
  await runWizard({ cwd: dir, prompter: p.prompter, log: noopLog });
  await stub.close();
  assert.equal(seen.registryNamespace, 'changed', 'file values must win over the stale draft (M1-02)');
});
