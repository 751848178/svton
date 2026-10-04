// M2-05 regressions: an init rerun over an already-paired project must KEEP the
// tokenRef references (no plaintext long-term token is written into the project
// config) unless the user explicitly changes the credential or its endpoint.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';
import { runWizard } from './wizard.js';
import { createPrompter } from './prompt.js';
import { freshProject, noopLog, scriptedPrompter, startStubAgent, type StubAgent } from './wizard-fixtures.js';

const BUILDER_TOKEN = 'PAIR_TOKEN_BUILDER';
const RUNTIME_TOKEN = 'PAIR_TOKEN_RUNTIME';

/** temp HOME with a credentials.json holding the paired entries */
async function pairedHome(stub: StubAgent): Promise<string> {
  const home = await mkdtemp(path.join(tmpdir(), 'ship-m2home-'));
  await mkdir(path.join(home, '.ship'), { recursive: true });
  await writeFile(path.join(home, '.ship', 'credentials.json'), JSON.stringify({
    builder: { url: stub.url, token: BUILDER_TOKEN, role: 'builder' },
    staging: { url: stub.url, token: RUNTIME_TOKEN, role: 'runtime' },
  }, null, 2));
  return home;
}

function refConfig(stub: StubAgent): string {
  return [
    'builder:', '  mode: static', '  static:', `    url: ${stub.url}`, '    tokenRef: builder',
    `registry:`, `  url: ${stub.host}`, '  namespace: audit',
    'runtime:', '  targets:', '    staging:', `      url: ${stub.url}`, '      tokenRef: staging',
  ].join('\n') + '\n';
}

async function readConfig(dir: string): Promise<{ builder: { static: Record<string, string> }; runtime: { targets: Record<string, Record<string, string>> } }> {
  return yaml.load(await readFile(path.join(dir, 'ship.config.yaml'), 'utf8')) as never;
}

function withHome<T>(home: string, fn: () => Promise<T>): Promise<T> {
  const prev = process.env.HOME;
  process.env.HOME = home;
  return fn().finally(() => { if (prev === undefined) delete process.env.HOME; else process.env.HOME = prev; });
}

test('M2-05: non-interactive rerun keeps tokenRef — no plaintext token enters the config', async () => {
  const stub = await startStubAgent();
  const home = await pairedHome(stub);
  try {
    const dir = await freshProject({ 'ship.yaml': 'name: audit-app\nports:\n  - 3000:3000\n', 'ship.config.yaml': refConfig(stub) });
    const seen = stub.requests.length;
    const r = await withHome(home, () => runWizard({ cwd: dir, prompter: createPrompter(false), log: noopLog }));
    assert.equal(r.ok, true, JSON.stringify(r));
    const cfg = await readConfig(dir);
    assert.equal(cfg.builder.static.tokenRef, 'builder');
    assert.equal(cfg.builder.static.token, undefined, 'plaintext token must not be written for a kept reference');
    assert.equal(cfg.runtime.targets.staging!.tokenRef, 'staging');
    assert.equal(cfg.runtime.targets.staging!.token, undefined);
    // the live checks still used the resolved tokens against the real endpoint
    assert.ok(stub.requests.slice(seen).some((x) => x.auth === `Bearer ${BUILDER_TOKEN}`));
  } finally {
    await rm(home, { recursive: true, force: true });
    await stub.close();
  }
});

test('M2-05: interactive Enter keeps the defaults and keeps tokenRef', async () => {
  const stub = await startStubAgent();
  const home = await pairedHome(stub);
  try {
    const dir = await freshProject({ 'ship.yaml': 'name: audit-app\n', 'ship.config.yaml': refConfig(stub) });
    const r = await withHome(home, () => runWizard({ cwd: dir, prompter: scriptedPrompter().prompter, log: noopLog }));
    assert.equal(r.ok, true, JSON.stringify(r));
    const cfg = await readConfig(dir);
    assert.equal(cfg.builder.static.tokenRef, 'builder');
    assert.equal(cfg.runtime.targets.staging!.tokenRef, 'staging');
    assert.equal(cfg.builder.static.token, undefined);
  } finally {
    await rm(home, { recursive: true, force: true });
    await stub.close();
  }
});

test('M2-05: typing a different token explicitly invalidates the reference (plaintext wins)', async () => {
  const stub = await startStubAgent();
  const home = await pairedHome(stub);
  try {
    const dir = await freshProject({ 'ship.yaml': 'name: audit-app\n', 'ship.config.yaml': refConfig(stub) });
    // builder token retyped; runtime kept (Enter) → mixed outcome per machine
    const r = await withHome(home, () => runWizard({
      cwd: dir, prompter: scriptedPrompter({ builderToken: 'MASTER_TOKEN_TYPED' }).prompter, log: noopLog,
    }));
    assert.equal(r.ok, true, JSON.stringify(r));
    const cfg = await readConfig(dir);
    assert.equal(cfg.builder.static.token, 'MASTER_TOKEN_TYPED');
    assert.equal(cfg.builder.static.tokenRef, undefined, 'a manually typed token invalidates the reference');
    assert.equal(cfg.runtime.targets.staging!.tokenRef, 'staging');
  } finally {
    await rm(home, { recursive: true, force: true });
    await stub.close();
  }
});

test('M2-05: changing the endpoint drops the token prefill (and with it the reference)', async () => {
  const a = await startStubAgent();
  const b = await startStubAgent();
  const home = await pairedHome(a);
  try {
    const dir = await freshProject({ 'ship.yaml': 'name: audit-app\n', 'ship.config.yaml': refConfig(a) });
    const r = await withHome(home, () => runWizard({
      cwd: dir,
      prompter: scriptedPrompter({ builderUrl: b.url, builderToken: 'TOKEN_FOR_B' }).prompter,
      log: noopLog,
    }));
    assert.equal(r.ok, true, JSON.stringify(r));
    const cfg = await readConfig(dir);
    assert.equal(cfg.builder.static.url, b.url);
    assert.equal(cfg.builder.static.token, 'TOKEN_FOR_B');
    assert.equal(cfg.builder.static.tokenRef, undefined, 'the reference belonged to the OLD endpoint and is now invalid');
    // the paired token must never travel to the new endpoint
    assert.ok(!b.requests.some((x) => x.auth === `Bearer ${BUILDER_TOKEN}`), 'old machine token must not be sent to the new endpoint');
  } finally {
    await rm(home, { recursive: true, force: true });
    await a.close();
    await b.close();
  }
});
