// M2-08 regression: when the REMOTE exchange already committed but the local
// save fails, `ship pair` must report "remote committed, local not saved" with
// the concrete recovery path (exit 5) instead of a generic pairing failure.
// saveCredential is module-mocked to fail; everything else (agent, exchange,
// store pre-flight) is real.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { startAgent, type AgentHandle } from '../agent/server.js';
import { SecurityStore } from '../agent/security.js';
import { CliError } from './errors.js';
import { CANCEL, type Prompter } from './init/prompt.js';

const realHome = process.env.HOME;

test.afterEach(() => {
  process.env.HOME = realHome;
  mock.restoreAll();
});

test('save failure after a successful exchange → exit 5, remote-committed wording, code consumed', async (t) => {
  const home = await mkdtemp(path.join(tmpdir(), 'ship-savefail-'));
  process.env.HOME = home;
  await mkdir(path.join(home, '.ship'), { recursive: true });
  const workRoot = await mkdtemp(path.join(tmpdir(), 'ship-savefail-'));
  const agent: AgentHandle = await startAgent({ role: 'both', token: 'SAVEFAIL_MASTER', port: 0, host: '127.0.0.1', workRoot });
  const store = new SecurityStore(path.join(workRoot, 'security.json'));
  await store.load();
  const { code } = await store.createCode('builder', 15);

  const credsUrl = new URL('../shared/credentials.js', import.meta.url).href;
  const actual = await import(credsUrl);
  t.after(async () => { await rm(home, { recursive: true, force: true }); });
  mock.module(credsUrl, {
    namedExports: {
      ...actual,
      saveCredential: async () => { throw new Error('simulated disk full'); },
    },
  });
  const { cmdPair } = await import('./cmd-pair.js');
  try {
    let err: unknown;
    try {
      await cmdPair([agent.url, '--code', code, '--json']);
    } catch (e) { err = e; }
    assert.ok(err instanceof CliError, `expected CliError, got ${String(err)}`);
    assert.equal((err as CliError).exitCode, 5, 'remote-committed-but-unsaved has its own exit code');
    assert.match(err.message, /远端已配对成功/);
    assert.match(err.message, /本地保存失败：simulated disk full/);
    assert.match(err.message, /重新生成|重新执行 ship pair/, 'must name the recovery path');
    // and the code IS spent on the agent — the report must not pretend otherwise
    const replay = await fetch(`${agent.url}/api/pairing/exchange`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }),
    });
    assert.equal(replay.status, 401);
    // nothing was stored locally
    const { existsSync } = await import('node:fs');
    assert.equal(existsSync(path.join(home, '.ship', 'credentials.json')), false, 'no credential file may appear');
  } finally {
    await agent.close();
  }
});

test('wizard pairing reports remote-committed when its local save fails', async (t) => {
  const home = await mkdtemp(path.join(tmpdir(), 'ship-savefail-'));
  process.env.HOME = home;
  await mkdir(path.join(home, '.ship'), { recursive: true });
  const workRoot = await mkdtemp(path.join(tmpdir(), 'ship-savefail-'));
  const agent: AgentHandle = await startAgent({ role: 'both', token: 'SAVEFAIL2_MASTER', port: 0, host: '127.0.0.1', workRoot });
  const store = new SecurityStore(path.join(workRoot, 'security.json'));
  await store.load();
  const { code } = await store.createCode('builder', 15);

  const credsUrl = new URL('../shared/credentials.js', import.meta.url).href;
  const actual = await import(credsUrl);
  t.after(async () => { await rm(home, { recursive: true, force: true }); });
  mock.module(credsUrl, {
    namedExports: {
      ...actual,
      saveCredential: async () => { throw new Error('simulated disk full'); },
    },
  });
  const { pairMachine } = await import('./init/pair-flow.js');
  const { noopLog } = await import('./init/wizard-fixtures.js');
  const { Writable } = await import('node:stream');
  // scripted interactive prompter: answers the URL (default), gives the code once,
  // and cancels when the retry loop re-asks — the FAILURE TEXT is the assertion
  let codeGiven = false;
  let captured = '';
  const out = new Writable({ write(c, _e, cb) { captured += c; cb(); } });
  const prompter: Prompter = {
    interactive: true,
    out: out as unknown as NodeJS.WriteStream,
    missing: () => [],
    ask: async (q) => {
      if (q.field === 'builderPairingCode') {
        if (codeGiven) return CANCEL;
        codeGiven = true;
        return code;
      }
      if (q.default !== undefined) return q.default;
      throw new Error(`unexpected question: ${q.field}`);
    },
  };
  await assert.rejects(
    () => pairMachine('builder', prompter, noopLog, agent.url),
    (e: Error) => e.constructor.name === 'Cancelled' || /远端已配对成功/.test(e.message),
  );
  assert.match(captured, /远端已配对成功/, 'the wizard must say the remote transaction committed');
  assert.match(captured, /本地保存失败/, 'and name the local save failure');
  const replay = await fetch(`${agent.url}/api/pairing/exchange`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }),
  });
  assert.equal(replay.status, 401, 'the code was really consumed (remote committed)');
  await agent.close();
});
