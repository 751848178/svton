// Cross-format compatibility + non-interactive preservation regressions
// (audit cases A03, A04, A13-CLI): a REAL `ship init --json` subprocess in a
// temp project, with a local both-role agent stub. Verifies existing ports are
// never overwritten by EXPOSE values and .yml/.json configs are updated in
// place instead of being shadowed by a new .yaml.

import test from 'node:test';
import assert from 'node:assert/strict';

import { readFile, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { freshProject, runCli, startStubAgent } from './wizard-fixtures.js';



async function withStub(fn: (stubUrl: string, host: string) => Promise<void>): Promise<void> {
  const stub = await startStubAgent();
  try {
    await fn(stub.url, stub.host);
  } finally {
    await stub.close();
  }
}

test('A03: non-interactive rerun keeps existing port mappings, adds nothing, and is idempotent', async () => {
  await withStub(async (stubUrl, host) => {
    const dir = await freshProject({
      'ship.yaml': 'name: audit-app\nports:\n  - 8080:3000\n',
      'ship.config.yaml': configYamlStub(stubUrl, host),
    });
    // Dockerfile EXPOSEs 3000 — the old bug rewrote 8080:3000 into 3000:3000
    const r = await runCli(dir);
    assert.equal(r.code, 0, JSON.stringify(r.json));
    assert.equal(r.json.ok, true);
    const spec = yaml.load(await readFile(path.join(dir, 'ship.yaml'), 'utf8')) as { ports?: string[] };
    assert.deepEqual(spec.ports, ['8080:3000'], 'existing mappings must survive a non-interactive rerun (M1-04)');
    const again = await runCli(dir);
    assert.equal(again.code, 0);
    assert.deepEqual((again.json.wrote as string[]) ?? [], [], 'idempotent rerun must not rewrite anything');
  });
});

test('A03b: no EXPOSE and multiple EXPOSE both preserve existing mappings non-interactively', async () => {
  await withStub(async (stubUrl, host) => {
    const noExpose = await freshProject({
      'ship.yaml': 'name: audit-app\nports:\n  - 8080:3000\n',
      'ship.config.yaml': configYamlStub(stubUrl, host),
    }, 'FROM scratch\n');
    const r1 = await runCli(noExpose);
    assert.equal(r1.code, 0, JSON.stringify(r1.json));
    const spec1 = yaml.load(await readFile(path.join(noExpose, 'ship.yaml'), 'utf8')) as { ports?: string[] };
    assert.deepEqual(spec1.ports, ['8080:3000'], 'no EXPOSE must not delete existing mappings');

    const multi = await freshProject({
      'ship.yaml': 'name: audit-app\nports:\n  - 8080:3000\n',
      'ship.config.yaml': configYamlStub(stubUrl, host),
    }, 'FROM scratch\nEXPOSE 3000\nEXPOSE 8081\n');
    const r2 = await runCli(multi);
    assert.equal(r2.code, 0);
    const spec2 = yaml.load(await readFile(path.join(multi, 'ship.yaml'), 'utf8')) as { ports?: string[] };
    assert.deepEqual(spec2.ports, ['8080:3000'], 'detection must fill gaps only in interactive mode');
  });
});

test('A04: .yml projects are updated in place — no shadowing .yaml, nothing lost', async () => {
  await withStub(async (stubUrl, host) => {
    const dir = await freshProject({
      'ship.yml': yaml.dump({ name: 'audit-app', context: 'web', buildArgs: { PUBLIC_TEST: 'yes' }, ports: ['3000:3000'] }),
      'ship.config.yml': configYamlStub(stubUrl, host, ['source:', '  repo: https://source.example.invalid/team/app.git', '  token: AUDIT_SOURCE']),
    });
    const r = await runCli(dir);
    assert.equal(r.code, 0, JSON.stringify(r.json));
    assert.equal(existsSync(path.join(dir, 'ship.yaml')), false, 'no new .yaml may shadow ship.yml (M1-05)');
    const spec = yaml.load(await readFile(path.join(dir, 'ship.yml'), 'utf8')) as Record<string, unknown>;
    assert.equal(spec.context, 'web', 'context survives');
    assert.deepEqual(spec.buildArgs, { PUBLIC_TEST: 'yes' }, 'buildArgs survive');
    const config = yaml.load(await readFile(path.join(dir, 'ship.config.yml'), 'utf8')) as {
      source?: { repo?: string };
      runtime: { targets: Record<string, unknown> };
    };
    assert.ok(config.source?.repo?.includes('source.example.invalid'), 'source section survives');
    assert.ok('prod' in config.runtime.targets, 'other runtime targets survive');
  });
});

test('A04b: .json projects are updated in place and stay valid JSON', async () => {
  await withStub(async (stubUrl, host) => {
    const dir = await freshProject({
      'ship.json': JSON.stringify({ name: 'audit-app', context: 'web', buildArgs: { PUBLIC_TEST: 'yes' }, ports: ['3000:3000'] }),
      'ship.config.json': JSON.stringify(yaml.load(configYamlStub(stubUrl, host))),
    });
    const r = await runCli(dir);
    assert.equal(r.code, 0, JSON.stringify(r.json));
    assert.equal(existsSync(path.join(dir, 'ship.yaml')), false);
    assert.equal(existsSync(path.join(dir, 'ship.config.yaml')), false);
    const spec = JSON.parse(await readFile(path.join(dir, 'ship.json'), 'utf8')) as Record<string, unknown>;
    assert.equal(spec.context, 'web');
    assert.deepEqual(spec.buildArgs, { PUBLIC_TEST: 'yes' });
    const config = JSON.parse(await readFile(path.join(dir, 'ship.config.json'), 'utf8')) as Record<string, unknown>;
    assert.ok('runtime' in config);
    assert.equal((await stat(path.join(dir, 'ship.config.json'))).mode & 0o777, 0o600, 'json secret config is 0600 too');
  });
});

test('A13-CLI: after completion, a user-repointed endpoint never receives another entry\'s new token', async () => {
  const oldStub = await startStubAgent();
  try {
    const dir = await freshProject({
      'ship.yaml': 'name: audit-app\nports:\n  - 3000:3000\n',
      'ship.config.yaml': configYamlStub(oldStub.url, oldStub.host),
    });
    const r1 = await runCli(dir);
    assert.equal(r1.code, 0, JSON.stringify(r1.json));
    // user repoints builder to an unreachable endpoint with a brand-new token
    const cfg = yaml.load(await readFile(path.join(dir, 'ship.config.yaml'), 'utf8')) as {
      builder: { static: { url: string; token: string } };
    };
    cfg.builder.static = { url: 'http://127.0.0.1:1', token: 'AUDIT_USER_NEW_TOKEN' };
    await writeFile(path.join(dir, 'ship.config.yaml'), yaml.dump(cfg));
    const before = oldStub.requests.length;

    const r2 = await runCli(dir);
    assert.notEqual(r2.code, 0, 'non-interactive with a failing check must not report success');
    assert.equal(r2.json.ok, false);
    const newAuths = oldStub.requests.slice(before).map((x) => x.auth);
    assert.ok(!newAuths.includes('Bearer AUDIT_USER_NEW_TOKEN'), `token leaked to old endpoint: ${JSON.stringify(oldStub.requests.slice(before))}`);
    const after = yaml.load(await readFile(path.join(dir, 'ship.config.yaml'), 'utf8')) as typeof cfg;
    assert.equal(after.builder.static.url, 'http://127.0.0.1:1', 'user edits preserved on abort');
  } finally {
    await oldStub.close();
  }
});

function configYamlStub(url: string, host: string, extraLines: string[] = []): string {
  return [
    'builder:', '  mode: static', '  static:', `    url: ${url}`, '    token: AUDIT_OLD_BUILDER',
    'registry:', `  url: ${host}`, '  namespace: audit',
    'runtime:', '  targets:', '    staging:', `      url: ${url}`, '      token: AUDIT_OLD_RUNTIME',
    '    prod:', '      url: https://prod.example.com', '      token: AUDIT_PROD',
    ...extraLines,
  ].join('\n') + '\n';
}
