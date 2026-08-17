import { describe, expect, it, vi } from 'vitest';
import type { AgentConfig } from '@svton/agent-core';
import type { BrowserPlatform } from '@svton/agent-platform';
import {
  encodeModelKey,
  ModelSwitchTransactionService,
  type ModelKey,
  type ModelSwitchBindings,
  type ModelSwitchRequest,
  type PreparedModelConfig,
} from '@svton/agent-client';
import { createAgentAppModelSwitchHost } from '../src/models/agent-app-model-switch-host';
import type { DefaultSettingsAdapter } from '../src/lib/default-settings-adapter';
import type { AgentAppStorage } from '../src/lib/storage';

const keyA = { providerId: 'provider-a', modelId: 'shared' };
const keyB = { providerId: 'provider-b', modelId: 'shared' };

function request(id: string, to: ModelKey): ModelSwitchRequest {
  return {
    requestId: id,
    sessionId: 'session-a',
    from: keyA,
    to,
    persistence: 'default-and-session',
  };
}

describe('createAgentAppModelSwitchHost', () => {
  it('persists the exact winning config after a delayed superseded prepare and retry', async () => {
    let releaseA!: (config: AgentConfig) => void;
    const delayedA = new Promise<AgentConfig>((resolve) => { releaseA = resolve; });
    const configA = { model: 'runtime-a' } as AgentConfig;
    const configB = { model: 'runtime-b' } as AgentConfig;
    const build = vi.fn(async (options: { model: string }) =>
      options.model === encodeModelKey(keyA) ? delayedA : configB);
    const setAgentConfig = vi.fn();
    const setString = vi.fn();
    const host = createAgentAppModelSwitchHost(
      {} as BrowserPlatform,
      () => ({}) as never,
      { setAgentConfig } as unknown as DefaultSettingsAdapter,
      { setString } as unknown as AgentAppStorage,
      keyA,
      build as never,
    );
    const transaction = new ModelSwitchTransactionService();
    let runtime = 'runtime-a';
    const bindings: ModelSwitchBindings<PreparedModelConfig> = {
      active: () => runtime === 'runtime-b' ? keyB : keyA,
      persisted: host.getPersisted,
      blockedReason: () => null,
      prepare: host.prepareConfig,
      commit: (_next, candidate) => { runtime = candidate.config.model; return true; },
      dispose: vi.fn(),
      persistDefault: (next, candidate) => host.persistDefault(next.to, candidate),
      commitPersistedDefault: vi.fn(),
      publishPhase: vi.fn(),
    };

    const old = transaction.execute(request('old-a', keyA), bindings);
    const preparedB = await host.prepareConfig(request('manual-b', keyB));
    const latest = transaction.execute(request('latest-b', keyB), {
      ...bindings,
      prepare: async () => preparedB,
    });
    await expect(latest).resolves.toMatchObject({ kind: 'succeeded', active: keyB });
    releaseA(configA);
    await expect(old).resolves.toMatchObject({ kind: 'superseded' });

    await host.persistDefault(keyB, preparedB);
    expect(runtime).toBe('runtime-b');
    expect(host.getPersisted()).toEqual(keyB);
    expect(setAgentConfig).toHaveBeenLastCalledWith(configB);
    expect(setAgentConfig).not.toHaveBeenCalledWith(configA);
    expect(setString).toHaveBeenLastCalledWith('defaultModel', encodeModelKey(keyB));
  });
});
