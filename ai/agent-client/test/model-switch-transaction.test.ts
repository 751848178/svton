import { describe, expect, it, vi } from 'vitest';
import {
  ModelSwitchTransactionService,
  type ModelSwitchBindings,
} from '../src/model-switch/model-switch-transaction.service';
import type {
  ModelKey,
  ModelSwitchRequest,
} from '../src/model-switch/model-switch.types';
import { MAX_PUBLIC_MODEL_SWITCH_ERROR } from '../src/model-switch/model-switch-public-error';

const a = { providerId: 'provider-a', modelId: 'shared' };
const b = { providerId: 'provider-b', modelId: 'shared' };

function request(id: string, to = b): ModelSwitchRequest {
  return {
    requestId: id,
    sessionId: 'session-a',
    from: a,
    to,
    reasoningEffort: 'high',
    persistence: 'default-and-session',
  };
}

function harness(overrides: Partial<ModelSwitchBindings<{ key: ModelKey }>> = {}) {
  let active = a;
  let persisted = a;
  const events: string[] = [];
  const bindings: ModelSwitchBindings<{ key: ModelKey }> = {
    active: () => active,
    persisted: () => persisted,
    blockedReason: () => null,
    prepare: async (next) => {
      events.push(`prepare:${next.to.providerId}`);
      return { key: next.to };
    },
    commit: (_next, candidate) => {
      events.push(`commit:${candidate.key.providerId}`);
      active = candidate.key;
      return true;
    },
    dispose: (candidate) => events.push(`dispose:${candidate.key.providerId}`),
    persistDefault: async (next, candidate) => {
      events.push(`persist:${candidate.key.providerId}`);
      persisted = next.to;
    },
    commitPersistedDefault: (_next, candidate) => {
      events.push(`default:${candidate.key.providerId}`);
    },
    publishPhase: (phase) => events.push(`phase:${phase}`),
    ...overrides,
  };
  return { bindings, events, active: () => active, persisted: () => persisted };
}

describe('ModelSwitchTransactionService', () => {
  it('prepares, commits runtime, then persists and promotes the default', async () => {
    const transaction = new ModelSwitchTransactionService();
    const test = harness();
    await expect(transaction.execute(request('one'), test.bindings)).resolves.toMatchObject({
      kind: 'succeeded',
      active: b,
      persisted: b,
    });
    expect(test.events).toEqual([
      'phase:preparing',
      'prepare:provider-b',
      'phase:committing',
      'commit:provider-b',
      'persist:provider-b',
      'default:provider-b',
      'phase:succeeded',
    ]);
  });

  it('keeps the committed runtime and reports active/default split on persistence failure', async () => {
    const transaction = new ModelSwitchTransactionService();
    const test = harness({
      persistDefault: vi.fn(async () => {
        throw new Error(`api_key=secret-fixture-value-123456789 ${'x'.repeat(2_000)}`);
      }),
    });
    const result = await transaction.execute(request('split'), test.bindings);
    expect(result).toMatchObject({
      kind: 'failed',
      code: 'persistence',
      active: b,
      persisted: a,
      activeDefaultSplit: true,
    });
    if (result.kind !== 'failed') throw new Error('expected persistence failure');
    expect(result.message).toContain('[REDACTED:');
    expect(result.message).not.toContain('secret-fixture-value');
    expect(result.message.length).toBeLessThanOrEqual(MAX_PUBLIC_MODEL_SWITCH_ERROR);
    expect(test.events).not.toContain('default:provider-b');
  });

  it('redacts and bounds thrown prepare and commit errors before publishing', async () => {
    const unsafe = new Error(`Authorization: Bearer abc.def.ghi ${'z'.repeat(1_000)}`);
    const cases: Array<Partial<ModelSwitchBindings<{ key: ModelKey }>>> = [
      { prepare: vi.fn(async () => { throw unsafe; }) },
      { commit: vi.fn(() => { throw unsafe; }) },
    ];
    for (const [index, overrides] of cases.entries()) {
      const transaction = new ModelSwitchTransactionService();
      const test = harness(overrides);
      const result = await transaction.execute(request(`unsafe-${index}`), test.bindings);
      expect(result).toMatchObject({ kind: 'failed' });
      if (result.kind !== 'failed') throw new Error('expected public failure');
      expect(result.message).toContain('[REDACTED:');
      expect(result.message).not.toContain('abc.def.ghi');
      expect(result.message.length).toBeLessThanOrEqual(MAX_PUBLIC_MODEL_SWITCH_ERROR);
    }
  });

  it('rejects an owned turn before preparing a candidate', async () => {
    const transaction = new ModelSwitchTransactionService();
    const prepare = vi.fn();
    const test = harness({
      blockedReason: () => 'turn active',
      prepare,
    });
    await expect(transaction.execute(request('blocked'), test.bindings)).resolves.toMatchObject({
      kind: 'failed',
      code: 'blocked',
      message: 'turn active',
    });
    expect(prepare).not.toHaveBeenCalled();
  });

  it('disposes a delayed stale candidate when a newer preparation wins', async () => {
    let release!: (candidate: { key: ModelKey }) => void;
    const delayed = new Promise<{ key: ModelKey }>((resolve) => { release = resolve; });
    const transaction = new ModelSwitchTransactionService();
    const test = harness({
      prepare: vi.fn()
        .mockImplementationOnce(() => delayed)
        .mockResolvedValueOnce({ key: a }),
    });
    const old = transaction.execute(request('old'), test.bindings);
    const latest = transaction.execute(request('latest', a), test.bindings);
    await expect(latest).resolves.toMatchObject({ kind: 'succeeded', active: a });
    release({ key: b });
    await expect(old).resolves.toMatchObject({ kind: 'superseded' });
    expect(test.events).toContain('dispose:provider-b');
  });
});
