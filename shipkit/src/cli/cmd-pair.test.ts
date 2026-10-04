// M2-08/M2-10 regressions for `ship pair`: locally decidable failures (name
// conflict, unusable store) must be rejected BEFORE the one-time code is
// consumed, and --ca-file is recorded with the credential.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, mkdir, rm, writeFile, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { startAgent, type AgentHandle } from '../agent/server.js';
import { SecurityStore } from '../agent/security.js';
import { cmdPair } from './cmd-pair.js';
import { CliError } from './errors.js';

const realHome = process.env.HOME;

async function isolatedHome(): Promise<string> {
  const home = await mkdtemp(path.join(tmpdir(), 'ship-paircli-'));
  process.env.HOME = home;
  return home;
}

test.afterEach(() => {
  process.env.HOME = realHome;
});

async function startWithCode(role: 'builder' | 'runtime'): Promise<{ agent: AgentHandle; workRoot: string; code: string }> {
  const workRoot = await mkdtemp(path.join(tmpdir(), 'ship-paircli-'));
  const agent = await startAgent({ role: 'both', token: 'PAIR_MASTER', port: 0, host: '127.0.0.1', workRoot });
  const store = new SecurityStore(path.join(workRoot, 'security.json'));
  await store.load();
  const { code } = await store.createCode(role, 15);
  return { agent, workRoot, code };
}

async function exchangeStatus(url: string, code: string): Promise<number> {
  const res = await fetch(`${url}/api/pairing/exchange`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }),
  });
  await res.body?.cancel();
  return res.status;
}

test('M2-08: a name conflict is rejected with exit 2 and the code stays UNUSED', async () => {
  const home = await isolatedHome();
  const { agent, code } = await startWithCode('builder');
  try {
    await mkdir(path.join(home, '.ship'), { recursive: true });
    await writeFile(path.join(home, '.ship', 'credentials.json'), JSON.stringify({
      builder: { url: 'https://old.example.invalid', token: 'OLD' },
    }));
    let err: unknown;
    try {
      await cmdPair([agent.url, '--name', 'builder', '--code', code, '--json']);
    } catch (e) { err = e; }
    assert.ok(err instanceof CliError && err.exitCode === 2, `expected CliError exit 2, got ${String(err)}`);
    assert.match(err.message, /已指向/);
    assert.match(err.message, /配对码未消耗|未发送配对码/);
    assert.equal(await exchangeStatus(agent.url, code), 200, 'the one-time code must still be consumable');
  } finally {
    await agent.close();
  }
});

test('M2-08: a corrupt credentials store aborts before the code is consumed', async () => {
  const home = await isolatedHome();
  const { agent, code } = await startWithCode('runtime');
  try {
    await mkdir(path.join(home, '.ship'), { recursive: true });
    await writeFile(path.join(home, '.ship', 'credentials.json'), '{broken');
    let err: unknown;
    try {
      await cmdPair([agent.url, '--code', code, '--json']);
    } catch (e) { err = e; }
    assert.ok(err instanceof CliError && err.exitCode === 2, String(err));
    assert.equal(await exchangeStatus(agent.url, code), 200, 'code still unused');
  } finally {
    await agent.close();
  }
});

test('M2-08: an unwritable store aborts before the code is consumed', async () => {
  const home = await isolatedHome();
  const { agent, code } = await startWithCode('builder');
  try {
    const shipDir = path.join(home, '.ship');
    await mkdir(shipDir, { recursive: true });
    await chmod(shipDir, 0o500);
    let err: unknown;
    try {
      await cmdPair([agent.url, '--code', code, '--json']);
    } catch (e) { err = e; }
    assert.ok(err instanceof CliError && err.exitCode === 2, String(err));
    assert.match(err.message, /未发送配对码|不可用/);
    assert.equal(await exchangeStatus(agent.url, code), 200, 'code still unused');
    await chmod(shipDir, 0o700);
  } finally {
    await agent.close();
    await chmod(path.join(home, '.ship'), 0o700).catch(() => {});
  }
});

test('M2-08: --force rotates over a conflicting name and consumes the code', async () => {
  const home = await isolatedHome();
  const { agent, code } = await startWithCode('builder');
  try {
    await mkdir(path.join(home, '.ship'), { recursive: true });
    await writeFile(path.join(home, '.ship', 'credentials.json'), JSON.stringify({
      builder: { url: 'https://old.example.invalid', token: 'OLD' },
    }));
    const rc = await cmdPair([agent.url, '--name', 'builder', '--code', code, '--force', '--json']);
    assert.equal(rc, 0);
    const stored = JSON.parse(await readFile(path.join(home, '.ship', 'credentials.json'), 'utf8')) as { builder: { url: string } };
    assert.equal(stored.builder.url, agent.url);
    assert.equal(await exchangeStatus(agent.url, code), 401, 'code now consumed');
  } finally {
    await agent.close();
  }
});

test('M2-10: --ca-file is recorded in the stored credential', async () => {
  const home = await isolatedHome();
  const { agent, code } = await startWithCode('builder');
  try {
    const ca = path.join(home, 'my-ca.pem');
    await writeFile(ca, '-----BEGIN CERTIFICATE-----\nplaceholder\n-----END CERTIFICATE-----\n');
    const rc = await cmdPair([agent.url, '--code', code, '--ca-file', ca, '--json']);
    assert.equal(rc, 0);
    const stored = JSON.parse(await readFile(path.join(home, '.ship', 'credentials.json'), 'utf8')) as Record<string, { caFile?: string }>;
    const entry = stored.runtime ?? stored.builder; // default name derives from the machine role
    assert.equal(entry?.caFile, ca, 'the CA used at pair time travels with the credential');
  } finally {
    await agent.close();
  }
});
