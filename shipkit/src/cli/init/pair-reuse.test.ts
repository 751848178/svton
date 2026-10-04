// M2-04 regression (wizard path): a builder credential stored for an entry is
// never offered — let alone reused — when onboarding that entry's RUNTIME role.
// The local role field pre-filters candidates; the server-side check decides.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { startAgent, type AgentHandle } from '../../agent/server.js';
import { SecurityStore } from '../../agent/security.js';
import { pairMachine } from './pair-flow.js';
import { CANCEL, type Prompter } from './prompt.js';
import { noopLog } from './wizard-fixtures.js';
import { Writable } from 'node:stream';

const realHome = process.env.HOME;
test.afterEach(() => { process.env.HOME = realHome; });

/** answers: URL default; code asked up to N times; check actions 's' */
function pairPrompter(code: string, opts: { cancelOnSecondCode?: boolean } = {}): { prompter: Prompter; text: () => string } {
  let codeAsks = 0;
  let captured = '';
  const out = new Writable({ write(c, _e, cb) { captured += c; cb(); } });
  const prompter: Prompter = {
    interactive: true,
    out: out as unknown as NodeJS.WriteStream,
    missing: () => [],
    ask: async (q) => {
      if (q.field.endsWith('PairingCode')) {
        codeAsks += 1;
        if (codeAsks > 1 && opts.cancelOnSecondCode) return CANCEL;
        return code;
      }
      if (q.field.endsWith('PairCheckAction')) return 's';
      if (q.field.endsWith('Reuse')) throw new Error(`reuse must not be offered here: ${JSON.stringify(q)}`);
      if (q.default !== undefined) return q.default;
      throw new Error(`unexpected question: ${q.field}`);
    },
  };
  return { prompter, text: () => captured };
}

async function setup(): Promise<{ agent: AgentHandle; workRoot: string }> {
  const workRoot = await mkdtemp(path.join(tmpdir(), 'ship-reuse-'));
  const agent = await startAgent({ role: 'both', token: 'REUSE_MASTER', port: 0, host: '127.0.0.1', workRoot });
  return { agent, workRoot };
}

test('M2-04: runtime onboarding never reuses the builder credential of the same entry', async () => {
  const { agent, workRoot } = await setup();
  const home = await mkdtemp(path.join(tmpdir(), 'ship-reuse-home-'));
  process.env.HOME = home;
  try {
    const store = new SecurityStore(path.join(workRoot, 'security.json'));
    await store.load();
    // a builder credential for THIS entry, server-verified as builder
    const { code: builderCode } = await store.createCode('builder', 15);
    const ex = await fetch(`${agent.url}/api/pairing/exchange`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: builderCode }),
    });
    const bt = ((await ex.json()) as { token: string }).token;
    await mkdir(path.join(home, '.ship'), { recursive: true });
    await writeFile(path.join(home, '.ship', 'credentials.json'), JSON.stringify({
      builder: { url: agent.url, token: bt, role: 'builder' },
    }));

    const { code: runtimeCode } = await store.createCode('runtime', 15);
    const p = pairPrompter(runtimeCode, { cancelOnSecondCode: true });
    const outcome = await pairMachine('runtime', p.prompter, noopLog, agent.url);
    assert.equal(outcome.reused, false, 'the builder credential must not be reused as runtime');
    assert.equal(outcome.tokenRef, 'runtime');
    assert.ok(outcome.token !== bt);
    // the reuse question was never even offered (role pre-filter)
    assert.ok(!p.text().includes('直接使用'), 'no reuse offer for a mismatched credential role');
  } finally {
    await agent.close();
    await rm(home, { recursive: true, force: true }).catch(() => {});
  }
});

test('M2-04 (control): a MATCHING role credential is still offered and reusable (UX08 unchanged)', async () => {
  const { agent, workRoot } = await setup();
  const home = await mkdtemp(path.join(tmpdir(), 'ship-reuse-home-'));
  process.env.HOME = home;
  try {
    const store = new SecurityStore(path.join(workRoot, 'security.json'));
    await store.load();
    const { code } = await store.createCode('builder', 15);
    const ex = await fetch(`${agent.url}/api/pairing/exchange`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }),
    });
    const bt = ((await ex.json()) as { token: string }).token;
    await mkdir(path.join(home, '.ship'), { recursive: true });
    await writeFile(path.join(home, '.ship', 'credentials.json'), JSON.stringify({
      builder: { url: agent.url, token: bt, role: 'builder' },
    }));
    // reuse answer 'y' via default (the reuse question has default 'y')
    const asked: string[] = [];
    const out = new Writable({ write(_c, _e, cb) { cb(); } });
    const prompter: Prompter = {
      interactive: true,
      out: out as unknown as NodeJS.WriteStream,
      missing: () => [],
      ask: async (q) => {
        asked.push(q.field);
        if (q.default !== undefined) return q.default;
        throw new Error(`unexpected question: ${q.field}`);
      },
    };
    const outcome = await pairMachine('builder', prompter, noopLog, agent.url);
    assert.equal(outcome.reused, true);
    assert.equal(outcome.tokenRef, 'builder');
    assert.equal(outcome.token, bt);
    assert.ok(asked.includes('builderReuse'), 'the reuse offer is still made for matching roles');
  } finally {
    await agent.close();
    await rm(home, { recursive: true, force: true }).catch(() => {});
  }
});
